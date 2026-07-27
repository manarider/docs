# Progress & System Documentation
## ระบบบริหารจัดการคลังเอกสาร — เทศบาลนครนครสวรรค์

**อัปเดตล่าสุด:** 23 กรกฎาคม 2569  
**สถานะ:** Production-ready · `docs-api` online แบบ PM2 cluster 2 instances · บันทึก process list ด้วย `pm2 save` แล้ว

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

[Storage — /data/archives/documents/]
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
| File storage | `/data/archives/documents/` | chown manarider |
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
2. Browser เรียก GET /docs/api/auth/login
    Nginx proxy → backend GET /api/auth/login
    Backend redirect → UMS: https://nssv.nsm.go.th/ums/login?redirect={callbackUrl}
         │
         ▼  (ผู้ใช้ login ที่ UMS)
3. UMS redirect กลับ → https://app.nsm.go.th/docs/auth-callback?token={jwt}
         │
         ▼
4. AuthCallbackPage.jsx รับ token จาก URL
    Redirect ต่อไป → /docs/api/auth/callback?token={jwt}
    หมายเหตุ: หน้า /docs/auth-callback ต้องไม่ถูก auto redirect จาก 401 /auth/me ก่อนส่ง token
         │
         ▼
5. Nginx proxy → backend GET /api/auth/callback?token={jwt}
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
- Frontend เรียก API ผ่าน `/docs/api/*`; Nginx rewrite/proxy เข้า backend ที่ `/api/*`
- Axios interceptor ต้องยกเว้น `/docs/auth-callback` จาก auto redirect เมื่อ `/auth/me` ได้ 401 เพื่อให้ token callback ถูกส่งไป backend ก่อน

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
| `projects` | Project.js | โครงการ (linked กับ Document) |
| `projectkeys` | ProjectKey.js | KEY สำหรับ external user เข้าถึงโครงการ (เก็บ hash) |
| `dailyreports` | DailyReport.js | รายงานประจำวันของโครงการ |
| `procurements` | Procurement.js | บันทึกพัสดุ/ครุภัณฑ์ |
| `workacceptances` | WorkAcceptance.js | บันทึกการตรวจรับงาน |

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

### Phase 14 (Backlog Resolution — 4 เม.ย. 2569)

**Security:**
- ✅ เพิ่ม `express-mongo-sanitize` — ป้องกัน NoSQL injection จาก request body/query/params
- ✅ เพิ่ม rate limit บน `/api/auth/login` + `/api/auth/callback` (20 req / 15 นาที per IP)

**Performance:**
- ✅ เพิ่ม `compression` middleware — gzip API responses และ static assets
- ✅ เพิ่ม sparse index `attachments.sub_id` บน collection `documents`

**Code Cleanup:**
- ✅ ลบ `parseThaiBEDate` + `formatThaiBEDate` จาก `fiscalYear.js` (dead code)
- ✅ ลบ `paginate` + `paginatedResponse` จาก `response.js` (dead code)
- ✅ แก้ bug test: `callback=` → `redirect=` ใน auth redirect test
- ✅ เพิ่ม unit tests สำหรับ soft-delete flow ใน `backend.test.js` (7 test cases)

**Infrastructure:**
- ✅ สร้าง `/data/archives/scripts/backup-mongo.sh` — backup + compress + rotate (เก็บ 14 วัน)
- ✅ เพิ่ม cron job: `0 2 * * *` run backup-mongo.sh → `/var/log/mongo-backup.log`
- ✅ ติดตั้ง `pm2-logrotate` module (max 50M, retain 7 วัน, compress, rotate 00:00 ทุกวัน)
- ✅ เปิด Redis AOF persistence (`appendonly yes`) ผ่าน `CONFIG SET` + `CONFIG REWRITE`

### Phase 15 (Mobile UI + Settings Overhaul — 4 เม.ย. 2569)

**Mobile Responsive:**
- ✅ `Layout.jsx` — เพิ่ม sidebar state + mobile overlay backdrop
- ✅ `Navbar.jsx` — เพิ่มปุ่ม hamburger ☰ (แสดงเฉพาะ mobile `lg:hidden`)
- ✅ `Sidebar.jsx` — เปลี่ยนเป็น responsive drawer: desktop = fixed sidebar, mobile = slide-in drawer พร้อมปุ่มปิด
- ✅ ย้ายเมนู "หน่วยงาน" และ "ประเภทเอกสาร" ออกจาก sidebar → รวมใน Settings tabs

**Settings Page (multi-tab):**
- ✅ Tab "ทั่วไป" — ตั้งค่า public duration + ขนาดไฟล์สูงสุด (PDF / รูปภาพ)
- ✅ Tab "หน่วยงาน" — CRUD หน่วยงาน (ย้ายมาจาก `/admin/departments`)
- ✅ Tab "ประเภทเอกสาร" — CRUD + approve flow (ย้ายมาจาก `/admin/doctypes`)
- ✅ Tab "Backup" — list ไฟล์, trigger backup ทันที, download

**Backend APIs (admin):**
- ✅ `GET /api/admin/backups` — รายการไฟล์ backup
- ✅ `POST /api/admin/backups/trigger` — รัน script backup แบบ non-blocking
- ✅ `GET /api/admin/backups/:filename/download` — ดาวน์โหลด (path traversal protected)

**Reports Page:**
- ✅ เพิ่ม StorageSection (admin only) — จำนวนไฟล์, ขนาดที่ใช้, พื้นที่คงเหลือ, disk usage bar, แยกตามนามสกุล
- ✅ `GET /api/reports/storage` — storage stats จาก filesystem + `df`

### Phase 16 (DOW Download Share — 9 เม.ย. 2569)

**ฟีเจอร์ใหม่: เอกสารประเภท DOW (Download)**
- ✅ `Document` model — เพิ่ม field `download_share { token, starts_at, expires_at }`
- ✅ `buildStoragePath` — ประเภท `DOW` เก็บไฟล์แยกที่ `/data/archives/documents/download/` (permission 750)
- ✅ Backend `createShare` / `getShare` / `deleteShare` — สร้าง/ดู/ลบ share link + QR Code (qrcode npm)
- ✅ `share.controller.js` + `share.routes.js` — public endpoints `/api/share/:token` ไม่ต้อง login
  - Token = `crypto.randomBytes(32)` (64 hex), ตรวจ `starts_at` / `expires_at` ทุก request
  - Auto-clear token ใน DB เมื่อหมดอายุ
  - Rate limit 60 req/15 นาที ป้องกัน abuse
  - Header `Cache-Control: no-store` สำหรับไฟล์ที่ส่งผ่าน token
- ✅ `PublicDownload.jsx` — หน้า public `/docs/download/:token` (ไม่ต้อง login)
- ✅ `App.jsx` — ย้าย public route ออกนอก `AuthProvider` (แก้ bug redirect loop)
- ✅ `api.js` — interceptor ข้ามการ redirect เมื่อ path มี `/download/`
- ✅ `DocumentEdit.jsx` — เพิ่ม section แชร์: modal ตั้งวันเวลา, แสดง URL + QR Code, ปุ่มดาวน์โหลด QR
- ✅ `DocumentDetail.jsx` — แสดง share info panel (URL + QR + วันหมดอายุ) สำหรับ DOW
- ✅ `.gitignore` — เพิ่ม `documents/` ไม่ track ไฟล์ user data

### Phase 17 (UMS Permission Fix — 16 พ.ค. 2569)

**ปัญหา:** UMS ส่ง `projectPermissions[].project` เป็น populated object แทนที่จะเป็น ObjectId string ทำให้การตรวจสอบ `String(p.project) === UMS_PROJECT_ID` กลายเป็น `"[object Object]" === "69cfa30f156114bd2461271b"` และไม่พบ permission → 403 no_permission

**การแก้ไข:**
- ✅ สร้างฟังก์ชัน `extractProjectPermission(projectPermissions, projectKey)` ใน `auth.controller.js`
- ✅ รองรับรูปแบบ `project` หลายแบบ:
  - `p.projectKey === projectKey` — direct field
  - `p.project === projectKey` — string (ObjectId)
  - `p.project._id === projectKey` — populated object with _id
  - `p.project.code === projectKey` — populated object with code
- ✅ แก้ไข `callback` function ให้ใช้ `extractProjectPermission` แทนการเช็คแบบเดิม
- ✅ ทดสอบด้วย user: `naioob` / `vy,ibomiN`
  - Login ผ่าน UMS API สำเร็จ → ได้ JWT token
  - เรียก `/api/auth/callback?token=...` สำเร็จ → HTTP 302 redirect to `/docs/` (ไม่มี error parameter)
- ✅ Restart backend ด้วย `pm2 restart docs-api`

**ผลลัพธ์:** แก้ไข 403 no_permission สำเร็จ — ตอนนี้ระบบรองรับทั้ง project เป็น string และ populated object

---

### Phase 18 (Project Tracker System — กรกฎาคม 2569)

**ฟีเจอร์ใหม่: ระบบติดตามโครงการ (Project Tracker)**

ระบบนี้เชื่อมโครงการกับเอกสาร Document (ประเภทที่ระบุ) พร้อม auth แบบ KEY สำหรับ external user (ผู้รับเหมา)

#### Backend — Models

- ✅ `Project.js` — โครงการ: เชื่อม `document_id`, มี `status`, `created_by`, timestamps
- ✅ `ProjectKey.js` — KEY เข้าถึงโครงการ: เก็บ `key_hash` (SHA-256), `key_prefix` (8 ตัวแรก, ไม่เก็บ plaintext), `role` (admin/member/contractor/viewer), `label`, `expires_at`, `is_active`
- ✅ `DailyReport.js` — รายงานประจำวัน: `date`, `summary`, `weather`, `workers`, `progress_percent`, `created_by`
- ✅ `Procurement.js` — พัสดุ/ครุภัณฑ์: รายการจัดซื้อ, มูลค่า, สถานะ
- ✅ `WorkAcceptance.js` — ตรวจรับงาน: งวด, วันที่, ผลการตรวจ

#### Backend — Auth Middleware

- ✅ `authenticateProject.js` — ตรวจสอบ `req.session.project_user` หรือ `req.session.user` (UMS)
  - session field: `req.session.project_user = { keyId, projectId, role, label, expiresAt }`
  - sets `req.projectUser = { userId, username, role, internalRole, isKeyUser, isInternalStaff, permissions }`
  - หากเป็น UMS user: `userId = req.session.user.userId`
  - หากเป็น KEY user: `userId = u.userId` (ไม่ใช่ `u.id` หรือ `u._id`)

#### Backend — Modules

**`modules/projects/project.auth.controller.js`**
- ✅ `keyLogin` — รับ `{ projectId, key }`, ตรวจสอบ SHA-256 hash, สร้าง session, ตั้ง `maxAge` ตาม `key.expires_at`
- ✅ `keyLogout` — ลบ `req.session.project_user`
- ✅ `keyMe` — คืน `200 { data: null }` (ไม่ใช่ 401) เมื่อไม่มี session — ป้องกัน console error
- ✅ `getProjectPublicInfo` — endpoint สาธารณะ (ไม่ต้อง auth), คืน `{ title, dept, fiscal_year, status }`

**`modules/projects/project.auth.routes.js`**
```
POST /login        (rate limited — 10 req/15m per IP)
POST /logout
GET  /me
GET  /project/:projectId/info   (public, no auth)
```

**`modules/projects/project.controller.js`**
- ✅ `getOrCreateByDocument` — สร้างหรือดึง Project จาก `document_id`; ใช้ `req.user.userId` (route ใช้ `authenticate`)
- ✅ `getProject` — ดึงข้อมูล Project
- ✅ `updateStatus` — อัปเดตสถานะ (admin only)
- ✅ `listKeys` / `createKey` / `updateKey` — จัดการ ProjectKey; ใช้ `req.projectUser.userId` (route ใช้ `authenticateProject`)
- ✅ `regenerateKey` — สร้าง token ใหม่ คืน token ครั้งเดียว แล้ว hash เก็บ
- ✅ `deleteKey` — ลบถาวร + AuditLog

**`modules/projects/project.routes.js`**
```
POST   /by-document/:docId                      (authenticate, requireRole('member'))
GET    /:projectId                              (authenticateProject)
PATCH  /:projectId/status                       (authenticate, requireRole('admin'))
GET    /:projectId/keys                         (authenticateProject, requireInternalStaff)
POST   /:projectId/keys                         (authenticateProject, requireInternalStaff)
PATCH  /:projectId/keys/:keyId                  (authenticateProject, requireInternalStaff)
POST   /:projectId/keys/:keyId/regenerate       (authenticateProject, requireInternalStaff)
DELETE /:projectId/keys/:keyId                  (authenticateProject, requireInternalStaff)
+ sub-routes: daily-reports, procurement, acceptance
```

#### Frontend — Pages

- ✅ `ProjectTracker.jsx` — Shell หลัก: ดึง project data, แสดง tabs, ส่ง context ผ่าน Outlet
  - Header: System title "📋 ระบบติดตามโครงการ" + role badge
  - Tabs: ภาพรวม / รายงานประจำวัน / พัสดุฯ / ตรวจรับงาน / จัดการ KEY
  - Contractor เห็นเฉพาะ: ภาพรวม + รายงานประจำวัน
  - Contractor redirect อัตโนมัติเมื่อพยายามเข้าหน้าที่ไม่มีสิทธิ์
  - Tab tap target `py-3` (≥44px, เหมาะ mobile)

- ✅ `ProjectKeyLogin.jsx` — หน้า login สำหรับ external user
  - ดึงชื่อโครงการ/หน่วยงาน/ปีงบประมาณ ผ่าน `GET /project-auth/project/:id/info` (public)
  - Input `font-size: 16px` ป้องกัน iOS auto-zoom
  - Responsive: `p-6 sm:p-8`

- ✅ `ProjectKeyManager.jsx` — จัดการ KEY (internal staff เท่านั้น)
  - แสดง token ครั้งเดียวหลังสร้าง/regenerate (black bg, green mono text)
  - ปุ่ม "📋 คัดลอก KEY" (เต็มแถว, เขียว)
  - ปุ่ม "ยกเลิก KEY" (border แดง) + "ลบ" (solid แดง) ต่อ key card
  - `fetchKeys(silent=true)` — หลีกเลี่ยงการ unmount KeyCard เพื่อรักษา state token

- ✅ `ProjectOverview.jsx` — ภาพรวมโครงการ + access link (แสดงเฉพาะ internal)
- ✅ `ProjectDailyReports.jsx` — รายงานประจำวัน
- ✅ `ProjectProcurement.jsx` — พัสดุ/ครุภัณฑ์
- ✅ `ProjectAcceptance.jsx` — ตรวจรับงาน

#### Frontend — Context & API

- ✅ `ProjectAuthContext.jsx` — เรียก `/project-auth/me` ตอน load; `setProjectUser(res.data.data || null)` รองรับ `200+null`
- ✅ `api.js` — 401 interceptor ไม่ redirect ไป UMS login เมื่ออยู่บนหน้า `/projects/` หรือ `/project-access`

#### Bug Fixes ระหว่าง Development

| ปัญหา | สาเหตุ | การแก้ไข |
|-------|--------|---------|
| "ไม่พบ endpoint ที่ร้องขอ" | PM2 start ก่อนเพิ่ม project routes | `pm2 reload docs-api` |
| 500 สร้างโครงการ | `req.user.id` undefined (session ใช้ `userId`) | เปลี่ยนเป็น `req.user.userId` |
| 500 createKey/updateKey | Route ใช้ `authenticateProject` → มีแค่ `req.projectUser` | เปลี่ยนเป็น `req.projectUser.userId` |
| `authenticateProject` ตั้ง userId ผิด | `u.id \|\| u._id` ทั้งคู่ undefined | เปลี่ยนเป็น `u.userId` |
| Token ไม่แสดงหลังสร้าง KEY | `useState(!!newToken)` initialize ครั้งเดียวตอน mount (ตอนนั้น null) | เปลี่ยนเป็น `useEffect` watch `newToken` prop |
| Token หายหลัง regenerate | `fetchKeys()` ตั้ง `loading=true` → unmount KeyCard | เปลี่ยนเป็น `fetchKeys(silent=true)` |
| Key user ถูก redirect ไป UMS login | 401 interceptor ทำงานบน `/auth/me` ขณะอยู่หน้า project | เพิ่ม `isProjectPage` check ใน interceptor |
| 401 console error ตอน refresh | `keyMe` คืน 401 เมื่อไม่มี session | เปลี่ยนเป็นคืน `200 { data: null }` |

---

### Phase 19 (Mobile-First Responsive — กรกฎาคม 2569)

- ✅ `ProjectTracker.jsx` — header mobile-first: system title bar แยกแถว, role badge ในแถวเดียวกับ title, ชื่อโครงการ wrap แทน truncate
- ✅ `ProjectKeyLogin.jsx` — `py-8` ป้องกันชิดขอบบน mobile, input 16px ป้องกัน iOS auto-zoom, ปุ่ม `py-3`
- ✅ `ProjectOverview.jsx` — padding `p-4 sm:p-6` responsive
- ✅ Build สุดท้าย: `✓ 498 modules transformed. ✓ built in 5.95s`

---

## 6. สิ่งที่ควรทำเพิ่มเติม (Backlog)

### Security
- [ ] เปิดใช้ HTTPS/TLS บน Nginx (มี template ใน `/data/archives/nginx.conf` แล้ว) — ข้ามได้ถ้าใช้ Cloudflare proxy

### Infrastructure
- [ ] ตรวจสอบว่า `/data/backups/mongodb/` มีพื้นที่เพียงพอ (backup ทำงานตี 2 ทุกวัน)

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
| `DOC_DOWNLOAD_PATH` | แนะนำ | path สำหรับเอกสาร DOW share/download |
