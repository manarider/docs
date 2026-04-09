# ระบบบริหารจัดการคลังเอกสาร

ระบบจัดการเอกสารดิจิทัลสำหรับ **เทศบาลนครนครสวรรค์**  
รองรับการอัปโหลด ค้นหา ดาวน์โหลด และบริหารจัดการเอกสาร PDF พร้อม RBAC และ Audit Trail

Repository: `https://github.com/manarider/docs.git`

---

## Tech Stack

| ส่วน | Technology |
|------|-----------|
| Backend | Node.js 20+ · Express 4 · Mongoose 8 |
| Database | MongoDB (self-hosted) |
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
│   │   │   ├── documents/            # CRUD, upload, soft-delete, DOW share
│   │   │   ├── departments/          # หน่วยงาน
│   │   │   ├── doctypes/             # ประเภทเอกสาร
│   │   │   ├── reports/              # สถิติ + audit report
│   │   │   └── admin/                # settings + audit logs + backup
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
├── scripts/
│   └── backup-mongo.sh               # MongoDB backup script
├── nginx.conf                        # Nginx config reference
├── ums.md                            # เอกสาร UMS integration
├── progress.md                       # ประวัติการพัฒนาและเอกสารระบบ
└── .gitignore
```

---

## ติดตั้งใหม่ (Fresh Install)

### ข้อกำหนดเบื้องต้น

| Software | เวอร์ชัน | หมายเหตุ |
|---------|---------|---------|
| Node.js | 20+ | `node -v` |
| npm | 9+ | มากับ Node.js |
| MongoDB | 6+ | `mongod --version` |
| Redis | 6+ | `redis-server --version` |
| PM2 | ล่าสุด | `npm i -g pm2` |
| Nginx | ล่าสุด | `nginx -v` |

---

### ขั้นตอนที่ 1 — Clone Repository

```bash
git clone https://github.com/manarider/docs.git /data/archives
cd /data/archives
```

---

### ขั้นตอนที่ 2 — สร้าง Directory สำหรับเก็บไฟล์

```bash
# ไฟล์เอกสารทั่วไป
sudo mkdir -p /data/archives/documents
sudo chown $USER:$USER /data/archives/documents

# โฟลเดอร์ download (DOW) — permission 750 (ผู้อื่น access โดยตรงไม่ได้)
mkdir -p /data/archives/documents/download
chmod 750 /data/archives/documents/download

# โฟลเดอร์ tmp สำหรับ upload
mkdir -p /data/archives/documents/_tmp

# PM2 log directory
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# MongoDB backup directory
sudo mkdir -p /data/backups/mongodb
sudo chown $USER:$USER /data/backups/mongodb
```

---

### ขั้นตอนที่ 3 — Environment Variables

```bash
cp /data/archives/backend/.env.example /data/archives/backend/.env
nano /data/archives/backend/.env
```

ค่าที่ต้องกรอก:

```env
NODE_ENV=production
PORT=xxxx

# MongoDB
MONGO_URI=mongodb:>//<user:<password>@<host>:27017/xxxx?authSource=xxxx

# Redis
REDIS_URL=redis://localhost:6379

# Session (สร้างด้วย: openssl rand -hex 32)
SESSION_SECRET=<random-hex-64-chars>

# UMS SSO
UMS_BASE_URL=https://nssv.nsm.go.th/ums
UMS_PROJECT_ID=<project-id-จาก-ums-admin>
APP_CALLBACK_URL=https://app.nsm.go.th/docs/auth-callback

# CORS (hostname ของ frontend)
CORS_ORIGIN=https://app.nsm.go.th

# Storage
DOC_STORAGE_PATH=/data/archives/documents
DOC_DOWNLOAD_PATH=/data/archives/documents/download
```

---

### ขั้นตอนที่ 4 — ติดตั้ง Dependencies

```bash
# Backend
cd /data/archives/backend
npm install

# Frontend
cd /data/archives/frontend
npm install
```

---

### ขั้นตอนที่ 5 — Build Frontend

```bash
cd /data/archives/frontend
npm run build
# Output → frontend/dist/
```

---

### ขั้นตอนที่ 6 — ติดตั้ง PM2 และเริ่ม Backend

```bash
# ติดตั้ง PM2 (ถ้ายังไม่มี)
npm install -g pm2

# เริ่ม service
cd /data/archives/backend
pm2 start ecosystem.config.js

# บันทึกให้ startup อัตโนมัติ
pm2 save
pm2 startup   # ทำตามคำสั่งที่แสดงออกมา

# ติดตั้ง log rotate
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

### ขั้นตอนที่ 7 — ตั้งค่า Nginx

```bash
# copy config
sudo cp /data/archives/nginx.conf /etc/nginx/sites-available/app.nsm.go.th

# แก้ไข path SSL และ server_name ให้ตรงกับ environment จริง
sudo nano /etc/nginx/sites-available/app.nsm.go.th

# enable site
sudo ln -s /etc/nginx/sites-available/app.nsm.go.th /etc/nginx/sites-enabled/

# ทดสอบ config
sudo nginx -t

# reload
sudo systemctl reload nginx
```

---

### ขั้นตอนที่ 8 — ตั้งค่า Cron (MongoDB Backup)

```bash
# ให้ backup script executable
chmod +x /data/archives/scripts/backup-mongo.sh

# เพิ่ม cron job (backup ตี 2 ทุกวัน)
crontab -e
```

เพิ่มบรรทัด:
```
0 2 * * * /data/archives/scripts/backup-mongo.sh >> /var/log/mongo-backup.log 2>&1
```

---

### ขั้นตอนที่ 9 — ตรวจสอบการทำงาน

```bash
# ตรวจสอบ PM2
pm2 status

# ดู log
pm2 logs docs-api --lines 50

# ทดสอบ API
curl http://localhost:4040/api/auth/me

# ตรวจสอบ port
ss -tlnp | grep -E "4040|80|443"
```

---

## Update / Redeploy

```bash
cd /data/archives

# ดึง code ใหม่
git pull origin main

# ติดตั้ง package ที่เพิ่มมา (ถ้ามี)
cd backend && npm install
cd ../frontend && npm install

# Build frontend
cd /data/archives/frontend && npm run build

# Reload backend (zero-downtime)
pm2 reload docs-api
```

---

## Setup (Development)

```bash
# Terminal 1 — Backend
cd /data/archives/backend
cp .env.example .env   # แก้ MONGO_URI, SESSION_SECRET, UMS_PROJECT_ID
npm run dev            # nodemon, port 4040

# Terminal 2 — Frontend
cd /data/archives/frontend
npm run dev            # Vite dev server, port 5173
```

หน้าเว็บ: `http://localhost:5173/docs/`

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
| GET | `/api/documents/:id/share` | member+ | ดูข้อมูล share (DOW) |
| POST | `/api/documents/:id/share` | member+ | สร้าง share link + QR (DOW) |
| DELETE | `/api/documents/:id/share` | member+ | ลบ share link (DOW) |

### Public Share (ไม่ต้อง login)
| Method | Path | คำอธิบาย |
|--------|------|---------|
| GET | `/api/share/:token` | ข้อมูลเอกสาร DOW ผ่าน token |
| GET | `/api/share/:token/file/:subId` | ดาวน์โหลดไฟล์แนบผ่าน token |

### Admin
| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|---------|
| GET | `/api/admin/settings` | admin+ | ดู settings |
| PUT | `/api/admin/settings/:key` | admin+ | ตั้งค่า |
| GET | `/api/admin/audit` | admin+ | Audit logs |
| GET | `/api/admin/backups` | admin+ | รายการ backup |
| POST | `/api/admin/backups/trigger` | admin+ | trigger backup ทันที |
| GET | `/api/admin/backups/:filename/download` | admin+ | ดาวน์โหลด backup |

### Reports
| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|---------|
| GET | `/api/reports/summary` | member+ | สถิติภาพรวม |
| GET | `/api/reports/audit` | admin+ | Audit report |
| GET | `/api/reports/downloads` | manager+ | รายงานดาวน์โหลด |
| GET | `/api/reports/storage` | admin+ | Storage stats |

---

## RBAC

```
superadmin (50) > admin (40) > manager (30) > member (20) > viewer (10)
```

Role มาจาก `projectPermissions[].role` ใน UMS — ไม่มีการจัดการ user ในระบบนี้เอง

---

## Storage Layout

```
/data/archives/documents/
├── _tmp/                         # temp รอ upload (ลบหลัง move)
├── download/                     # เอกสาร DOW (permission 750)
│   └── {deptCode}/{fiscalYear}/  # เข้าถึงได้เฉพาะผ่าน token
└── {deptCode}/
    └── {fiscalYearBE}/
        └── {typeCode}/
            └── {docId}_{N}.pdf
```

- `file_path` ใน MongoDB มี `select: false` — ไม่ส่งออก API เด็ดขาด
- Checksum SHA-256 บันทึกทุกไฟล์
- เอกสาร DOW แชร์ผ่าน secure token (64 hex, `crypto.randomBytes(32)`) พร้อม QR Code

---

## ความปลอดภัย

- ✅ Session cookie: `httpOnly`, `secure`, `sameSite: lax`
- ✅ Helmet (CSP, X-Frame-Options, X-Content-Type-Options)
- ✅ CORS จำกัด origin
- ✅ express-mongo-sanitize — ป้องกัน NoSQL injection
- ✅ Rate limit: API ทั่วไป 300 req/15m, download 100 req/15m, share 60 req/15m, auth 20 req/15m
- ✅ Input validation ด้วย Zod schema
- ✅ MIME type whitelist สำหรับ upload
- ✅ `file_path` ไม่เคยส่งออก API response
- ✅ AuditLog append-only (ลบ/แก้ไขไม่ได้ในระดับ Mongoose)
- ✅ DOW share token: cryptographically random, มีวันหมดอายุ, auto-clear เมื่อหมดเวลา
- ⚠️ Nginx ปัจจุบันเป็น HTTP — ควรเปิด HTTPS (ดู `nginx.conf`)

---

## License

Internal use — เทศบาลนครนครสวรรค์


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
MONGO_URI=mongodb://<user>:<password>@<host>:27017/xxxx?authSource=xxxx
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
npm run dev            # Vite dev server port 5173, proxy /docs/api → :xxxx
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

## Copyright
© 2026 งานจัดทำและพัฒนาระบบข้อมูลสารสนเทศ กลุ่มงานสถิติข้อมูลและสารสนเทศ เทศบาลนครนครสวรรค์ by manarider
