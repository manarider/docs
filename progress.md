# Progress & System Documentation
## ระบบบริหารจัดการคลังเอกสาร — เทศบาลนครนครสวรรค์

**อัปเดตล่าสุด:** 4 เมษายน 2569  
**สถานะ:** Production-ready · pm2 online (id 15, 16) · restart count ~446

---

## 1. สถาปัตยกรรมระบบ

```
[Browser]
    │ HTTPS (HTTP ใน internal)
    ▼
[Nginx :80  — app.nsm.go.th]
    ├── /docs/api/*  →  proxy → Node.js :4040/api/*
    ├── /docs/assets/*  →  /data/archives/frontend/dist/assets/  (1y cache)
    └── /docs/*  →  /data/archives/frontend/dist/  (SPA + no-cache)

[Node.js :4040  — pm2 cluster x2]
    ├── Express API  (/api/auth, /api/documents, ...)
    └── Session Store  →  Redis (connect-redis)

[Redis :6379]  — session storage

[MongoDB — 192.168.100.15:27017/docs]  — main database

[Storage — /data/documents/]
    └── {deptCode}/{fiscalYearBE}/{typeCode}/{docId}_{N}.pdf
```

---

## 2. Infrastructure

| Component | Path / Address | หมายเหตุ |
|-----------|---------------|---------|
| Backend source | `/data/archives/backend/` | Node.js 20+ |
| Frontend dist | `/data/archives/frontend/dist/` | Vite build, base `/docs/` |
| MongoDB | `192.168.100.15:27017` db: `docs` | authSource: docs |
| Redis | `localhost:6379` | no auth (internal) |
| File storage | `/data/documents/` | chown manarider |
| PM2 config | `backend/ecosystem.config.js` | cluster mode, 2 workers |
| Nginx config (active) | `/etc/nginx/sites-available/app.nsm.go.th` | HTTP only (internal) |
| Nginx config (reference) | `/data/archives/nginx.conf` | มี HTTPS template |

### คำสั่ง Deploy

```bash
# Build frontend
cd /data/archives/frontend && npm run build

# Restart backend
pm2 restart docs-api

# ตรวจสอบสถานะ
pm2 status docs-api
pm2 logs docs-api --lines 50

# ตรวจสอบ port
ss -tlnp | grep -E "4040|4004|80"
```

---

## 3. การเชื่อมต่อกับ UMS (User Management System)

UMS คือระบบจัดการผู้ใช้กลางของ บน `https://nssv.nsm.go.th/ums`

### 3.1 Flow การ Login

```
1. ผู้ใช้คลิก "เข้าสู่ระบบ"
         │
         ▼
2. GET /api/auth/login
   Backend redirect → UMS: https://nssv.nsm.go.th/ums/login?redirect={callbackUrl}
         │
         ▼  (ผู้ใช้ login ที่ UMS)
3. UMS redirect กลับ → https://app.nsm.go.th/docs/auth-callback?token={jwt}
         │
         ▼
4. AuthCallbackPage.jsx รับ token จาก URL
   Redirect ต่อไป → /docs/api/auth/callback?token={jwt}
         │
         ▼
5. GET /api/auth/callback?token={jwt}
   Backend ยืนยัน token กับ UMS:
   GET https://nssv.nsm.go.th/ums/api/auth/me
   Header: Authorization: Bearer {jwt}
         │
         ▼
6. UMS คืน user object:
   {
     status: "success",
     user: {
       _id, username, email, firstName, lastName,
       systemRole: "member"|"superadmin",
       projectPermissions: [
         { project: "{UMS_PROJECT_ID}", role: "admin"|"member"|..., subDepartment: "ชื่อหน่วยงาน" }
       ]
     }
   }
         │
         ▼
7. Backend สร้าง session:
   req.session.user = {
     userId, username, email, firstName, lastName,
     systemRole, role (จาก permission), subDepartment, deptId
   }
         │
         ▼
8. Redirect → /docs/ (หน้าหลัก)
```

### 3.2 Config Variables

| ENV Variable | ค่าปัจจุบัน | ความหมาย |
|---|---|---|
| `UMS_BASE_URL` | `https://nssv.nsm.go.th/ums` | base URL ของ UMS server |
| `UMS_LOGIN_PATH` | `/login` | path หน้า login ของ UMS |
| `UMS_PROJECT_ID` | `69cfa30f156114bd2461271b` | MongoDB ObjectId ของโปรเจกต์นี้ใน UMS |
| `APP_CALLBACK_URL` | `https://app.nsm.go.th/docs/auth-callback` | URL ที่ UMS จะ redirect กลับมา (frontend) |

### 3.3 Permission Mapping

UMS ส่ง `permission.role` ต่อไปนี้ที่รู้จักในระบบ:

| UMS Role | ระดับสิทธิ์ | ทำอะไรได้ |
|---|---|----|
| `superadmin` | 50 | ทุกอย่าง |
| `admin` | 40 | จัดการทุกอย่าง + ลบถาวร |
| `manager` | 30 | ดูทุกหน่วยงาน |
| `member` | 20 | อัปโหลด/แก้ไขเอกสารตัวเอง |
| `viewer` | 10 | ดูอย่างเดียว |

### 3.4 หมายเหตุสำคัญ

- ระบบไม่เก็บ password ใดๆ — auth ทั้งหมดผ่าน UMS
- `deptId` ใน session มาจากการ query `Department.findOne({ name: permission.subDepartment })` ถ้า subDepartment ไม่ตรงกับชื่อใน DB จะเป็น `null`
- Session อายุ 8 ชั่วโมง เก็บใน Redis key prefix `docs:sess:`

---

## 4. โครงสร้างฐานข้อมูล

### Collections

| Collection | Model | หมายเหตุ |
|---|---|---|
| `documents` | Document.js | เอกสารหลัก + แนบไฟล์ + รูปภาพ |
| `departments` | Department.js | หน่วยงาน |
| `doctypes` | DocType.js | ประเภทเอกสาร |
| `auditlogs` | AuditLog.js | append-only, ลบไม่ได้ |
| `systemsettings` | SystemSettings.js | ค่าตั้งระบบ key-value |

### Indexes สำคัญ (Document)

```
dept_id + fiscal_year (compound)
type_id
created_by
deleted_at
title + description + tags (text index for $text search)
starred_by
```

---

## 5. ประวัติการพัฒนา

### Phase 1–9 (ก่อนหน้า)
- ✅ Backend Express + MongoDB + Redis session
- ✅ Auth ผ่าน UMS (callback flow)
- ✅ Document CRUD + soft delete
- ✅ Multi-file upload (PDF only), image upload
- ✅ PDF viewer inline
- ✅ Statistics + Reports
- ✅ Search (text + regex + filter)
- ✅ RBAC (5 levels)
- ✅ AuditLog (append-only)
- ✅ Frontend React + Vite + Tailwind (base: /docs/)

### Phase 10 (UI)
- ✅ ชื่อระบบ → "ระบบบริหารจัดการคลังเอกสาร"
- ✅ แก้ bug `preserveNullAndEmpty` → `preserveNullAndEmptyArrays` (statistics)
- ✅ แก้ bug deptId ต้อง cast `new mongoose.Types.ObjectId()` ใน aggregate

### Phase 11 (Attachment Soft-Delete)
- ✅ `attachmentSchema`: เพิ่ม `deleted_at` + `deleted_by`
- ✅ `deleteAttachment` (soft-delete) — ต้องมี active >= 2
- ✅ `restoreAttachment` — admin only
- ✅ `permanentDeleteAttachment` — ลบ disk + DB
- ✅ `listDeletedAttachments` — admin trash tab
- ✅ AdminTrash.jsx — 2 tabs (เอกสาร / ไฟล์แนบ)
- ✅ DocumentEdit.jsx — ปุ่มลบแสดงเฉพาะ > 1 attachment

### Phase 12 (Bug: file_path corruption)
**ปัญหา:** soft-delete ทำให้ `file_path` หายจาก MongoDB เพราะ `doc.save()` + `markModified` เขียน array ทั้งหมดกลับโดยไม่มี field ที่มี `select: false`

**แก้ไข:** เปลี่ยน `deleteAttachment` + `restoreAttachment` ให้ใช้ atomic `updateOne + $set positional operator`:
```js
await Document.updateOne(
  { _id: doc._id, 'attachments.sub_id': subId },
  { $set: { 'attachments.$.deleted_at': now, 'attachments.$.deleted_by': userId } }
);
```

### Phase 13 (Code Review & Cleanup — ปัจจุบัน)

**Dead Code ที่ลบออก:**
- ✅ ลบ `backend/src/utils/crypto.js` — ไม่ถูกใช้ + reference `config.encryption` ที่ไม่มีอยู่
- ✅ ลบ dead variable `const userRole` ใน `deleteDocument`
- ✅ ย้าย inline `require('../../config')` ออกจาก function body → top-level import

**Code Quality:**
- ✅ `admin.controller.js` — ย้าย `module.exports` ไปท้ายไฟล์ (ก่อนหน้าอยู่ก่อน function definition)

**Security:**
- ✅ `.env.example` — แทนที่ credential จริงด้วย placeholder (`<user>`, `<password>`)
- ✅ สร้าง `/data/archives/.gitignore` + `backend/.gitignore`

**Dependencies:**
- ✅ `package.json` — ลบ packages ที่ไม่ได้ใช้: `bcrypt`, `compression`, `cookie-parser`, `dotenv-safe`, `file-type`, `hpp`, `jsonwebtoken`, `sharp`, `express-mongo-sanitize`
- ✅ เพิ่ม `dotenv` แทน `dotenv-safe` (code ใช้ `require('dotenv')` โดยตรง)

---

## 6. สิ่งที่ควรทำเพิ่มเติม (Backlog)

### Security
- [ ] เปิดใช้ HTTPS/TLS บน Nginx (มี template ใน `/data/archives/nginx.conf` แล้ว)
- [ ] เพิ่ม `express-mongo-sanitize` กลับมา (หรือใช้ Mongoose sanitize) เพื่อป้องกัน NoSQL injection จาก query params
- [ ] เพิ่ม rate limit สำหรับ auth endpoints

### Performance
- [ ] เพิ่ม `compression` middleware ใน `app.js` เพื่อ gzip API responses
- [ ] Index เพิ่มเติม: `attachments.sub_id` (ตอนนี้ query by `$elemMatch` ไม่มี partial index)

### Code
- [ ] `parseThaiBEDate` + `formatThaiBEDate` ใน `fiscalYear.js` — ยังไม่ถูกใช้ ลบหรือใช้งานจริง
- [ ] `paginate` + `paginatedResponse` ใน `response.js` — ยังไม่ถูกใช้ ลบหรือใช้งานจริง
- [ ] เพิ่ม unit tests สำหรับ soft-delete flow / attachment management

### Infrastructure
- [ ] Backup MongoDB อัตโนมัติ
- [ ] Log rotation สำหรับ pm2 logs
- [ ] Redis persistence (`appendonly yes`)

---

## 7. Environment Variables ที่จำเป็น

ดู `backend/.env.example` สำหรับ template ครบถ้วน

| Variable | จำเป็น | หมายเหตุ |
|---|---|----|
| `MONGO_URI` | ✅ | ดู ops team สำหรับ credentials |
| `REDIS_URL` | ✅ | ค่า default: redis://localhost:6379 |
| `SESSION_SECRET` | ✅ | `openssl rand -hex 32` |
| `UMS_PROJECT_ID` | ✅ | รับจาก UMS admin |
| `APP_CALLBACK_URL` | ✅ | ต้องลงทะเบียนกับ UMS ด้วย |
| `CORS_ORIGIN` | ✅ | hostname ของ frontend |
| `DOC_STORAGE_PATH` | ✅ | ต้อง mkdir + chown ให้ process user |
