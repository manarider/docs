# ระบบบริหารจัดการคลังเอกสาร

ระบบจัดการเอกสารดิจิทัลสำหรับ **เทศบาลนครนครสวรรค์**  
รองรับการอัปโหลด ค้นหา ดาวน์โหลด และบริหารจัดการเอกสาร PDF พร้อม RBAC และ Audit Trail

---

## Tech Stack

| ส่วน | Technology |
|------|-----------|
| Backend | Node.js 20+ · Express 4 · Mongoose 8 |
| Database | MongoDB (ผ่าน Atlas หรือ self-hosted) |
| Session | Redis + connect-redis |
| Auth | UMS SSO (JWT callback flow) |
| Frontend | React 18 · Vite · Tailwind CSS |
| Process | PM2 cluster mode |
| Proxy | Nginx |

---

## โครงสร้างโปรเจกต์

```
/data/archives/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express entry point
│   │   ├── config/                   # database, redis, index
│   │   ├── middleware/               # authenticate, validate (zod)
│   │   ├── models/                   # Mongoose schemas
│   │   ├── modules/
│   │   │   ├── auth/                 # UMS SSO callback
│   │   │   ├── documents/            # CRUD, upload, soft-delete
│   │   │   ├── departments/          # หน่วยงาน
│   │   │   ├── doctypes/             # ประเภทเอกสาร
│   │   │   ├── reports/              # สถิติ + audit report
│   │   │   └── admin/                # settings + audit logs
│   │   └── utils/                    # logger, response, auditHelper, fiscalYear
│   ├── ecosystem.config.js           # PM2 config
│   ├── .env.example                  # environment variable template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                    # React pages
│   │   ├── components/               # Layout, Sidebar, Navbar
│   │   ├── contexts/AuthContext.jsx  # global auth state
│   │   └── lib/api.js                # axios instance
│   └── vite.config.js                # base: '/docs/'
├── nginx.conf                        # Nginx config reference (HTTPS template)
├── ums.md                            # เอกสาร UMS integration
├── progress.md                       # ประวัติการพัฒนาและเอกสารระบบ
└── .gitignore
```

---

## Setup (Production)

### 1. Environment Variables

```bash
cp backend/.env.example backend/.env
# แก้ไข .env ด้วย credentials จริง
```

ตัวแปรที่จำเป็น:

```env
MONGO_URI=mongodb://<user>:<password>@<host>:27017/docs?authSource=docs
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<openssl rand -hex 32>
UMS_PROJECT_ID=<your-project-id-in-ums>
APP_CALLBACK_URL=https://app.nsm.go.th/docs/auth-callback
CORS_ORIGIN=https://app.nsm.go.th
DOC_STORAGE_PATH=/data/documents
```

### 2. Storage Path

```bash
sudo mkdir -p /data/documents
sudo chown $USER:$USER /data/documents
```

### 3. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Build Frontend

```bash
cd frontend && npm run build
# Output: frontend/dist/
```

### 5. Start Backend

```bash
cd backend
pm2 start ecosystem.config.js
pm2 save
```

### 6. Nginx

ดู `/data/archives/nginx.conf` เป็น template  
copy ไปที่ `/etc/nginx/sites-available/` และ symlink ไป `sites-enabled/`

---

## Setup (Development)

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env   # แก้ UMS_BASE_URL, MONGO_URI, etc.
npm run dev            # nodemon, port 4040

# Terminal 2 — Frontend
cd frontend
npm run dev            # Vite dev server port 5173, proxy /docs/api → :4040
```

หน้าเว็บ: http://localhost:5173/docs/

---

## Auth Flow (UMS SSO)

```
Browser → GET /docs/api/auth/login
        ← 302 redirect → UMS /login?redirect={callbackUrl}

UMS (login) → 302 redirect → /docs/auth-callback?token={jwt}

Frontend (AuthCallbackPage) → redirect → /docs/api/auth/callback?token={jwt}

Backend → verify token กับ UMS /api/auth/me
        → สร้าง Redis session
        ← 302 redirect → /docs/
```

ดูรายละเอียดเพิ่มเติมใน [progress.md](progress.md#3-การเชื่อมต่อกับ-ums-user-management-system)

---

## API Endpoints

### Auth
| Method | Path | คำอธิบาย |
|--------|------|---------|
| GET | `/api/auth/login` | Redirect ไป UMS |
| GET | `/api/auth/callback?token=` | รับ token จาก UMS, สร้าง session |
| POST | `/api/auth/logout` | ทำลาย session |
| GET | `/api/auth/me` | ข้อมูล user ปัจจุบัน |

### Documents
| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|---------|
| GET | `/api/documents` | member+ | รายการ + pagination |
| POST | `/api/documents` | member+ | สร้างเอกสาร |
| GET | `/api/documents/search` | member+ | ค้นหา global |
| GET | `/api/documents/trash` | admin+ | ถังขยะเอกสาร |
| GET | `/api/documents/trash/attachments` | admin+ | ถังขยะไฟล์แนบ |
| GET | `/api/documents/:id` | member+ | รายละเอียด |
| PATCH | `/api/documents/:id` | member+ | แก้ไข |
| DELETE | `/api/documents/:id` | member+ | soft delete |
| POST | `/api/documents/:id/restore` | admin+ | คืนจากถังขยะ |
| DELETE | `/api/documents/:id/permanent` | admin+ | ลบถาวร |
| POST | `/api/documents/:id/star` | member+ | toggle ดาว |
| POST | `/api/documents/:id/attachments` | member+ | อัปโหลดไฟล์แนบ (PDF) |
| GET | `/api/documents/:id/attachments/:subId/download` | member+ | ดาวน์โหลด |
| DELETE | `/api/documents/:id/attachments/:subId` | member+ | soft delete แนบ |
| POST | `/api/documents/:id/attachments/:subId/restore` | admin+ | คืนไฟล์แนบ |
| DELETE | `/api/documents/:id/attachments/:subId/permanent` | admin+ | ลบแนบถาวร |
| POST | `/api/documents/:id/images` | member+ | อัปโหลดรูป |
| GET | `/api/documents/:id/images/:index` | member+ | ดูรูป inline |

### Admin
| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|---------|
| GET | `/api/admin/settings` | admin+ | ดู settings |
| PUT | `/api/admin/settings/:key` | admin+ | ตั้งค่า |
| GET | `/api/admin/audit` | admin+ | Audit logs |

### Reports
| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|---------|
| GET | `/api/reports/summary` | member+ | สถิติภาพรวม |
| GET | `/api/reports/audit` | admin+ | Audit report |
| GET | `/api/reports/downloads` | manager+ | รายงานดาวน์โหลด |

---

## RBAC

```
superadmin (50) > admin (40) > manager (30) > member (20) > viewer (10)
```

Role มาจาก `projectPermissions[].role` ใน UMS — ไม่มีการจัดการ user ในระบบนี้เอง

---

## Storage

ไฟล์เก็บที่: `{DOC_STORAGE_PATH}/{deptCode}/{fiscalYearBE}/{typeCode}/{docId}_{N}.ext`

ตัวอย่าง: `/data/documents/sarak/2568/general/507f1f77bcf86cd799439011_1.pdf`

- `file_path` ใน MongoDB มี `select: false` — ไม่ส่ง path ออก API เด็ดขาด
- checksum SHA-256 บันทึกทุกไฟล์

---

## ความปลอดภัย

- ✅ Session cookie: `httpOnly`, `secure`, `sameSite: lax`
- ✅ Helmet (CSP, X-Frame-Options, etc.)
- ✅ CORS จำกัด origin
- ✅ Rate limit: API ทั่วไป 300 req/15m, download 100 req/15m
- ✅ Input validation ด้วย Zod schema
- ✅ MIME type whitelist สำหรับ upload
- ✅ `file_path` ไม่เคยส่งออก API response
- ✅ AuditLog append-only (ลบ/แก้ไขไม่ได้ในระดับ Mongoose)
- ⚠️ Nginx ปัจจุบันเป็น HTTP — ควรเปิด HTTPS (ดู `nginx.conf`)

---

## สิ่งที่ต้องดำเนินการก่อน Push Git

- [x] `.gitignore` สร้างแล้ว (root + backend)
- [x] `backend/.env.example` ไม่มี credentials จริง
- [x] `backend/.env` อยู่ใน `.gitignore`
- [ ] ตรวจสอบว่าไม่มีไฟล์ใน `uploads/` หรือ `logs/` ที่จะติดไปด้วย
- [ ] `npm install` ใหม่หลังแก้ `package.json`

```bash
# ตรวจสอบสิ่งที่จะ commit
cd /data/archives
git init   # ถ้ายังไม่มี git repo
git status
git add .
git diff --cached   # preview ก่อน commit
```

---

## License

Internal use — เทศบาลนครนครสวรรค์
