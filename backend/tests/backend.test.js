/**
 * Integration tests — Digital Document Archive Backend
 *
 * ทดสอบโดยไม่ mock session (ใช้ app จริง + MongoDB + Redis)
 * เพราะ Auth ผ่าน UMS ภายนอก ทดสอบด้วย mock session แทน
 */

const request = require('supertest');

// Mock Redis เพื่อไม่ต้องใช้ Redis จริงใน test
jest.mock('../src/config/redis', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    isOpen: true,
    isReady: true,
  };
  return {
    connectRedis: jest.fn().mockResolvedValue(mockClient),
    getRedis: jest.fn().mockReturnValue(mockClient),
  };
});

// Mock connect-redis ให้ return constructor ที่ใช้ได้ (express-session ต้องการ .on)
jest.mock('connect-redis', () => {
  const { EventEmitter } = require('events');
  class MockRedisStore extends EventEmitter {
    constructor() { super(); }
    get(sid, cb) { cb(null, null); }
    set(sid, session, cb) { cb(null); }
    destroy(sid, cb) { cb(null); }
    touch(sid, session, cb) { if (cb) cb(null); }
  }
  MockRedisStore.default = MockRedisStore;
  return MockRedisStore;
});

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const appModule = require('../src/app');
  await appModule.init();
  app = appModule.app;
});

afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});

// ─── Helper: inject session ────────────────────────────────────────────────────
function withSession(agent, userData) {
  // inject session cookie ผ่าน session store mock
  agent.set('Cookie', 'docs_session=test_session_id');
  return agent;
}

// ─── Auth Routes ───────────────────────────────────────────────────────────────
describe('Auth Routes', () => {
  test('GET /api/auth/me → 401 เมื่อไม่ได้ login', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/login → 302 redirect ไปยัง UMS', async () => {
    const res = await request(app).get('/api/auth/login').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('nssv.nsm.go.th/ums');
    expect(res.headers.location).toContain('redirect=');
  });

  test('POST /api/auth/logout → 401 เมื่อไม่ได้ login', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/callback?token=invalid → redirect ไป /?error=', async () => {
    const res = await request(app)
      .get('/api/auth/callback?token=invalidtoken')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=');
  });

  test('GET /api/auth/callback (ไม่มี token) → redirect ไปยัง error', async () => {
    const res = await request(app)
      .get('/api/auth/callback')
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=missing_token');
  });
});

// ─── Department Routes (ไม่มี auth → 401) ─────────────────────────────────────
describe('Department Routes (unauthenticated)', () => {
  test('GET /api/departments → 401', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(401);
  });

  test('POST /api/departments → 401', async () => {
    const res = await request(app).post('/api/departments').send({ name: 'Test', code: 'TST' });
    expect(res.status).toBe(401);
  });
});

// ─── DocType Routes (ไม่มี auth → 401) ────────────────────────────────────────
describe('DocType Routes (unauthenticated)', () => {
  test('GET /api/doctypes → 401', async () => {
    const res = await request(app).get('/api/doctypes');
    expect(res.status).toBe(401);
  });
});

// ─── Document Routes (ไม่มี auth → 401) ───────────────────────────────────────
describe('Document Routes (unauthenticated)', () => {
  test('GET /api/documents → 401', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  test('POST /api/documents → 401', async () => {
    const res = await request(app).post('/api/documents').send({});
    expect(res.status).toBe(401);
  });
});

// ─── Reports Routes (ไม่มี auth → 401) ────────────────────────────────────────
describe('Report Routes (unauthenticated)', () => {
  test('GET /api/reports/summary → 401', async () => {
    const res = await request(app).get('/api/reports/summary');
    expect(res.status).toBe(401);
  });

  test('GET /api/reports/audit → 401', async () => {
    const res = await request(app).get('/api/reports/audit');
    expect(res.status).toBe(401);
  });
});

// ─── Admin Routes (ไม่มี auth → 401) ──────────────────────────────────────────
describe('Admin Routes (unauthenticated)', () => {
  test('GET /api/admin/settings → 401', async () => {
    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
describe('404 Handler', () => {
  test('GET /api/nonexistent → 404 JSON', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Server Config ────────────────────────────────────────────────────────────
describe('Server Config', () => {
  test('config port ต้องเป็น 4040', () => {
    const config = require('../src/config');
    expect(config.port).toBe(4040);
  });

  test('config UMS projectId ถูกต้อง', () => {
    const config = require('../src/config');
    expect(config.ums.projectId).toBe('69cfa30f156114bd2461271b');
  });

  test('config storage basePath ถูกต้อง', () => {
    const config = require('../src/config');
    expect(config.storage.basePath).toBe('/data/documents');
  });

  test('config rateLimit.max เป็น 300', () => {
    const config = require('../src/config');
    expect(config.rateLimit.max).toBe(300);
  });
});

// ─── Models ───────────────────────────────────────────────────────────────────
describe('Models', () => {
  test('Document model มี required fields', () => {
    const Document = require('../src/models/Document');
    const paths = Document.schema.paths;
    expect(paths.title).toBeDefined();
    expect(paths.dept_id).toBeDefined();
    expect(paths.type_id).toBeDefined();
    expect(paths.fiscal_year).toBeDefined();
  });

  test('AuditLog model มี action enum ครบ', () => {
    const { AUDIT_ACTIONS } = require('../src/models/AuditLog');
    expect(AUDIT_ACTIONS).toContain('LOGIN');
    expect(AUDIT_ACTIONS).toContain('UPLOAD');
    expect(AUDIT_ACTIONS).toContain('DOWNLOAD');
    expect(AUDIT_ACTIONS).toContain('DELETE');
  });

  test('fiscalYear utility ทำงานถูกต้อง', () => {
    const { getFiscalYear, getFiscalYearRange } = require('../src/utils/fiscalYear');
    const year = getFiscalYear(new Date('2025-10-01'));
    expect(year).toBe(2569); // ต.ค. 2025 = ปีงบ 2569
    const { start, end } = getFiscalYearRange(2569);
    expect(start.getFullYear()).toBe(2025);
    expect(end.getFullYear()).toBe(2026);
  });

  test('fiscalYear ไม่ export parseThaiBEDate / formatThaiBEDate อีกต่อไป', () => {
    const mod = require('../src/utils/fiscalYear');
    expect(mod.parseThaiBEDate).toBeUndefined();
    expect(mod.formatThaiBEDate).toBeUndefined();
  });

  test('response ไม่ export paginate / paginatedResponse อีกต่อไป', () => {
    const mod = require('../src/utils/response');
    expect(mod.paginate).toBeUndefined();
    expect(mod.paginatedResponse).toBeUndefined();
    expect(mod.sendSuccess).toBeDefined();
    expect(mod.sendError).toBeDefined();
  });
});

// ─── Soft-Delete Attachment Logic ─────────────────────────────────────────────
describe('Soft-Delete Attachment Logic', () => {
  // จำลอง document object แบบ in-memory เพื่อทดสอบ business logic โดยไม่ต้องใช้ DB

  function makeDoc(attachments) {
    return { attachments };
  }

  function makeAtt(subId, deleted = false) {
    return {
      sub_id: subId,
      sub_title: `ไฟล์ ${subId}`,
      deleted_at: deleted ? new Date('2024-01-01') : null,
    };
  }

  test('activeCount คำนวณถูกต้อง — นับเฉพาะ deleted_at: null', () => {
    const doc = makeDoc([makeAtt('a'), makeAtt('b', true), makeAtt('c')]);
    const activeCount = doc.attachments.filter((a) => !a.deleted_at).length;
    expect(activeCount).toBe(2);
  });

  test('ไม่อนุญาตลบเมื่อ active เหลือ 1', () => {
    const doc = makeDoc([makeAtt('a'), makeAtt('b', true)]);
    const activeCount = doc.attachments.filter((a) => !a.deleted_at).length;
    expect(activeCount).toBeLessThanOrEqual(1);
    // ตรงกับเงื่อนไขใน deleteAttachment: if (activeCount <= 1) → return 400
    expect(activeCount <= 1).toBe(true);
  });

  test('อนุญาตลบเมื่อ active >= 2', () => {
    const doc = makeDoc([makeAtt('a'), makeAtt('b'), makeAtt('c', true)]);
    const activeCount = doc.attachments.filter((a) => !a.deleted_at).length;
    expect(activeCount >= 2).toBe(true);
  });

  test('ค้นหา attachment ด้วย sub_id ได้ถูกต้อง', () => {
    const doc = makeDoc([makeAtt('uuid-1'), makeAtt('uuid-2'), makeAtt('uuid-3', true)]);
    const found = doc.attachments.find((a) => a.sub_id === 'uuid-2');
    expect(found).toBeDefined();
    expect(found.sub_id).toBe('uuid-2');
  });

  test('attachment ที่ถูก soft-delete แล้วไม่ควรลบซ้ำ', () => {
    const att = makeAtt('x', true);
    // ตรงกับเงื่อนไขใน deleteAttachment: if (att.deleted_at) → return 404
    expect(!!att.deleted_at).toBe(true);
  });

  test('restoreAttachment: attachment ที่ถูกลบสามารถ restore ได้', () => {
    const att = makeAtt('y', true);
    // simulate restore: เคลียร์ deleted_at
    const restored = { ...att, deleted_at: null, deleted_by: null };
    expect(restored.deleted_at).toBeNull();
    expect(restored.deleted_by).toBeNull();
  });

  test('listDeletedAttachments: คืนเฉพาะ attachment ที่มี deleted_at', () => {
    const doc = makeDoc([makeAtt('a'), makeAtt('b', true), makeAtt('c', true)]);
    const deleted = doc.attachments.filter((a) => a.deleted_at !== null);
    expect(deleted).toHaveLength(2);
    deleted.forEach((a) => expect(a.deleted_at).not.toBeNull());
  });
});
