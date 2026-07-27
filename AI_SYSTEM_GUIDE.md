# AI System Guide - ระบบติดตามโครงการและสร้างรายงาน

> เอกสารนี้จัดทำเพื่อให้ AI/LLM ทุกตัวสามารถอ่านและเข้าใจระบบได้อย่างรวดเร็ว  
> อัปเดตล่าสุด: 2026-07-27

---

## 📋 สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [สถาปัตยกรรม](#2-สถาปัตยกรรม)
3. [Tech Stack](#3-tech-stack)
4. [โครงสร้างไฟล์](#4-โครงสร้างไฟล์)
5. [ระบบหลัก](#5-ระบบหลัก)
6. [Data Models](#6-data-models)
7. [API Patterns](#7-api-patterns)
8. [ระบบสร้างรายงาน](#8-ระบบสร้างรายงาน)
9. [Mobile Responsive](#9-mobile-responsive)
10. [Authentication](#10-authentication)
11. [File Storage](#11-file-storage)
12. [Best Practices](#12-best-practices)
13. [Common Issues](#13-common-issues)

---

## 1. ภาพรวมระบบ

### ชื่อระบบ
**ระบบบริหารจัดการคลังเอกสารและติดตามโครงการ**  
(Document Archive & Project Tracking System)

### วัตถุประสงค์
1. **จัดการเอกสารดิจิทัล** - อัปโหลด, ค้นหา, ดาวน์โหลด, แชร์เอกสาร PDF
2. **ติดตามโครงการ** - บริหารโครงการก่อสร้าง/จัดซื้อ พร้อมระบบรายงานความก้าวหน้า
3. **สร้างรายงาน PDF แบบไดนามิก** - Template Designer สำหรับวาง field บนฟอร์ม และ Generate PDF อัตโนมัติ

### ผู้ใช้งาน
- **เจ้าหน้าที่เทศบาล** - UMS SSO authentication, full access
- **ผู้รับเหมา/Contractor** - Project Key authentication, limited access to specific project
- **ผู้ดูแลระบบ** - Admin role, system settings, audit logs

### Repository
```
https://github.com/manarider/docs.git
```

---

## 2. สถาปัตยกรรม

### Architecture Diagram
```
┌─────────────────┐
│   Nginx Proxy   │  :443 (HTTPS)
└────────┬────────┘
         │
         ├─→ /docs/api/*  ──→  Backend (Express)  :3009
         │                      ├─→ MongoDB       :27017
         │                      └─→ Redis         :6379
         │
         └─→ /docs/*      ──→  Frontend (Vite)   :3010
                                 (React SPA)
```

### Key Components

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| Frontend | React 18 + Vite | 3010 | SPA (Single Page Application) |
| Backend | Node.js 20 + Express | 3009 | REST API |
| Database | MongoDB 6+ | 27017 | Document storage |
| Session Store | Redis 6+ | 6379 | Session management |
| Process Manager | PM2 cluster | - | Auto-restart, clustering |
| Reverse Proxy | Nginx | 443 | HTTPS termination, routing |

### Deployment Path
```
Production: /data/archives/
├── backend/         # Node.js server
├── frontend/        # React build output
├── documents/       # User-uploaded files
├── uploads/         # Report backgrounds
└── scripts/         # Backup scripts
```

---

## 3. Tech Stack

### Backend Stack
```javascript
{
  "runtime": "Node.js 20+",
  "framework": "Express 4",
  "database": "MongoDB 6+ (Mongoose 8)",
  "session": "express-session + connect-redis",
  "validation": "zod",
  "auth": "UMS SSO (JWT callback)",
  "pdf": "pdf-lib + fontkit",
  "upload": "multer",
  "logging": "winston"
}
```

### Frontend Stack
```javascript
{
  "framework": "React 18",
  "build": "Vite 5",
  "styling": "Tailwind CSS 3",
  "routing": "React Router 6",
  "state": "React Context API",
  "http": "axios",
  "pdf": "pdf.js 3.11.174 (CDN)",
  "icons": "Heroicons (optional)"
}
```

### Development Tools
```bash
# Backend
npm install              # Install dependencies
npm run dev             # Development server (nodemon)
npm start               # Production server

# Frontend
npm install
npm run dev             # Vite dev server (HMR)
npm run build           # Production build
npm run preview         # Preview production build
```

---

## 4. โครงสร้างไฟล์

### Backend Structure
```
backend/
├── src/
│   ├── app.js                          # Express entry point
│   ├── config/
│   │   ├── database.js                 # MongoDB connection
│   │   ├── redis.js                    # Redis connection
│   │   └── index.js                    # Centralized config
│   │
│   ├── middleware/
│   │   ├── authenticate.js             # UMS session check
│   │   ├── authenticateProject.js      # Project key check
│   │   └── validate.js                 # Zod validation wrapper
│   │
│   ├── models/                         # Mongoose schemas
│   │   ├── Department.js               # หน่วยงาน
│   │   ├── DocType.js                  # ประเภทเอกสาร
│   │   ├── Document.js                 # เอกสาร + soft delete
│   │   ├── Project.js                  # โครงการ
│   │   ├── ProjectKey.js               # รหัสผ่านโครงการ
│   │   ├── DailyReport.js              # รายงานความก้าวหน้า
│   │   ├── Procurement.js              # จัดซื้อจัดจ้าง
│   │   ├── WorkAcceptance.js           # การตรวจรับงาน
│   │   ├── ReportTemplate.js           # Template สำหรับสร้างรายงาน
│   │   ├── AuditLog.js                 # Audit trail
│   │   └── SystemSettings.js           # System config
│   │
│   ├── modules/                        # Feature modules (Express routers)
│   │   ├── auth/
│   │   │   └── routes.js               # UMS callback, logout
│   │   ├── documents/
│   │   │   └── routes.js               # CRUD, upload, download, share
│   │   ├── departments/
│   │   │   └── routes.js               # Department management
│   │   ├── doctypes/
│   │   │   └── routes.js               # Document type management
│   │   ├── projects/
│   │   │   ├── routes.js               # Project CRUD
│   │   │   ├── keyRoutes.js            # Project key login
│   │   │   ├── dailyReportRoutes.js    # Progress reports
│   │   │   ├── procurementRoutes.js    # Procurement records
│   │   │   └── acceptanceRoutes.js     # Work acceptance
│   │   ├── report-templates/
│   │   │   └── routes.js               # Template designer backend
│   │   ├── reports/
│   │   │   └── routes.js               # Statistics, audit reports
│   │   └── admin/
│   │       └── routes.js               # System settings, backup
│   │
│   └── utils/
│       ├── auditHelper.js              # Audit log helper
│       ├── fiscalYear.js               # Thai fiscal year (2568)
│       ├── logger.js                   # Winston logger
│       ├── pdfGenerator.js             # PDF generation from template
│       └── response.js                 # Standardized API response
│
├── ecosystem.config.js                 # PM2 config
├── package.json
└── .env.example
```

### Frontend Structure
```
frontend/
├── src/
│   ├── main.jsx                        # React entry point
│   ├── App.jsx                         # Root component + routing
│   │
│   ├── components/
│   │   ├── Layout.jsx                  # Main layout wrapper
│   │   ├── Navbar.jsx                  # Top navigation (responsive)
│   │   ├── Sidebar.jsx                 # Left sidebar (responsive)
│   │   ├── MobileWarning.jsx           # Desktop-only feature warning
│   │   ├── PrintReportButton.jsx       # PDF print utility
│   │   └── projects/
│   │       ├── ReportDesignerCanvas.jsx # PDF/Image canvas for designer
│   │       └── ...
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx             # Global UMS auth state
│   │   └── ProjectAuthContext.jsx      # Project-scoped auth state
│   │
│   ├── lib/
│   │   └── api.js                      # axios instance with interceptors
│   │
│   └── pages/
│       ├── Home.jsx                    # Dashboard
│       ├── LoginPage.jsx               # UMS login redirect
│       ├── AuthCallbackPage.jsx        # UMS callback handler
│       │
│       ├── Documents.jsx               # Document list (table + filters)
│       ├── DocumentDetail.jsx          # Document viewer
│       ├── DocumentNew.jsx             # Upload new document
│       ├── DocumentEdit.jsx            # Edit document metadata
│       │
│       ├── ProjectOverview.jsx         # Project list
│       ├── ProjectKeyLogin.jsx         # Contractor login
│       ├── ProjectKeyManager.jsx       # Project key management
│       ├── ProjectDailyReports.jsx     # Progress reports
│       ├── ProjectProcurement.jsx      # Procurement tracking
│       ├── ProjectAcceptance.jsx       # Work acceptance
│       ├── ProjectReportManager.jsx    # Report template manager
│       │
│       ├── TemplateDesigner.jsx        # Report template designer (desktop-only)
│       │
│       ├── AdminSettings.jsx           # System settings
│       ├── AdminDepartments.jsx        # Department management
│       ├── AdminDocTypes.jsx           # Document type management
│       ├── AdminAuditLog.jsx           # Audit log viewer
│       └── AdminTrash.jsx              # Soft-deleted documents
│
├── public/                             # Static assets
├── index.html                          # HTML template
├── vite.config.js                      # Vite config (base: '/docs/')
├── tailwind.config.js                  # Tailwind config
└── package.json
```

### File Storage Structure
```
/data/archives/
├── documents/                          # User-uploaded documents
│   ├── _tmp/                           # Temporary files
│   ├── download/                       # DOW share links (750 permission)
│   │   ├── itc/2569/                   # Organized by dept/year
│   │   ├── phe/2569/
│   │   └── sbp/2569/
│   ├── itc/2569/
│   │   ├── prj/                        # Project documents
│   │   └── rep/                        # Reports
│   ├── sbp/2569/
│   │   ├── 69d0c6aeb7aa27741b896280/   # Project folder (project_id)
│   │   │   ├── dow/                    # Daily progress photos
│   │   │   ├── fav/                    # Project files
│   │   │   └── rcd/                    # Records
│   │   └── ...
│   └── ...
│
└── uploads/                            # Report backgrounds
    └── _report_backgrounds/            # PDF/PNG/JPG backgrounds
```

---

## 5. ระบบหลัก

### 5.1 Document Management System

**Features:**
- Upload PDF documents with metadata (title, department, type, fiscal year)
- Search and filter documents
- Soft delete (moved to trash, recoverable)
- Download and share (DOW - Direct Output Web)
- Audit trail for all actions

**Key Components:**
- Backend: `/backend/src/modules/documents/routes.js`
- Frontend: `/frontend/src/pages/Documents.jsx`
- Model: `/backend/src/models/Document.js`

**Document Schema:**
```javascript
{
  doc_id: String,                    // Auto-generated unique ID
  title: String,
  dept_id: ObjectId,                 // Reference to Department
  doctype_id: ObjectId,              // Reference to DocType
  fiscal_year: Number,               // 2568, 2569, etc.
  files: [{
    filename: String,
    originalName: String,
    filesize: Number,
    uploadDate: Date
  }],
  deleted: Boolean,                  // Soft delete flag
  deleted_at: Date,
  deleted_by: ObjectId,
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date
}
```

### 5.2 Project Tracking System

**Features:**
- Create projects linked to documents
- Generate project access keys for contractors
- Track daily progress reports with photos
- Manage procurement records
- Handle work acceptance documents

**Key Components:**
- Backend: `/backend/src/modules/projects/`
- Frontend: `/frontend/src/pages/Project*.jsx`
- Models: `Project.js`, `ProjectKey.js`, `DailyReport.js`, `Procurement.js`, `WorkAcceptance.js`

**Project Schema:**
```javascript
{
  document_id: ObjectId,             // Reference to parent Document
  title: String,
  dept_id: ObjectId,
  fiscal_year: Number,
  status: 'active' | 'closed',
  storage_base: String,              // Absolute path to project folder
  created_by: ObjectId,
  created_at: Date,
  updated_at: Date
}
```

**Project Key Schema:**
```javascript
{
  project_id: ObjectId,
  key: String,                       // Hashed key for authentication
  description: String,
  expires_at: Date,
  is_active: Boolean,
  created_by: ObjectId
}
```

**Authentication Flow:**
```
1. Admin creates project key
2. Contractor enters key at /docs/project-key-login
3. Server validates key, creates session
4. ProjectAuthContext provides project_id
5. Contractor accesses project-specific features
```

### 5.3 Report Generation System

**Features:**
- Visual template designer (drag-and-drop fields on PDF/image background)
- Support multiple pages per template
- Dynamic field mapping from data records
- Paper size options: A4, A5, Letter, Legal
- Orientation: Portrait, Landscape
- Thai font support: THSarabunNew

**Key Components:**
- Backend: 
  - `/backend/src/modules/report-templates/routes.js`
  - `/backend/src/utils/pdfGenerator.js`
- Frontend: 
  - `/frontend/src/pages/TemplateDesigner.jsx`
  - `/frontend/src/components/projects/ReportDesignerCanvas.jsx`
- Model: `/backend/src/models/ReportTemplate.js`

**Template Schema:**
```javascript
{
  name: String,
  module: 'daily_report' | 'procurement' | 'acceptance',
  project_id: ObjectId,              // null for global templates
  scope: 'global' | 'project',
  pages: [{
    pageNo: Number,
    backgroundFile: String,          // Filename in uploads/_report_backgrounds/
    paperSize: 'A4' | 'A5' | 'Letter' | 'Legal',
    orientation: 'portrait' | 'landscape',
    fields: [{
      fieldId: String,               // e.g., 'project_title', 'report_date'
      x: Number,                     // X coordinate (pixels from left)
      y: Number,                     // Y coordinate (pixels from top)
      width: Number,
      height: Number,
      fontSize: Number,
      fontFamily: String,            // Default: THSarabunNew
      color: String,                 // Hex color
      textAlign: 'left' | 'center' | 'right'
    }]
  }],
  status: 'active' | 'inactive'
}
```

**Paper Sizes (in points):**
```javascript
const PAPER_SIZES = {
  A4: { portrait: { width: 595.28, height: 841.89 } },
  A5: { portrait: { width: 419.53, height: 595.28 } },
  Letter: { portrait: { width: 612, height: 792 } },
  Legal: { portrait: { width: 612, height: 1008 } }
};
```

---

## 6. Data Models

### Core Models

#### 1. Department (หน่วยงาน)
```javascript
{
  dept_code: String,                 // e.g., 'itc', 'phe', 'sbp'
  dept_name: String,
  dept_name_short: String,
  is_active: Boolean
}
```

#### 2. DocType (ประเภทเอกสาร)
```javascript
{
  type_code: String,                 // e.g., 'contract', 'report'
  type_name: String,
  is_active: Boolean
}
```

#### 3. Document
```javascript
{
  doc_id: String,                    // Unique ID
  title: String,
  dept_id: ObjectId,
  doctype_id: ObjectId,
  fiscal_year: Number,
  files: [FileSchema],
  deleted: Boolean,
  deleted_at: Date,
  deleted_by: ObjectId,
  created_by: ObjectId
}
```

#### 4. Project
```javascript
{
  document_id: ObjectId,             // Parent document
  title: String,
  dept_id: ObjectId,
  fiscal_year: Number,
  status: 'active' | 'closed',
  storage_base: String,
  created_by: ObjectId
}
```

#### 5. DailyReport (รายงานความก้าวหน้า)
```javascript
{
  project_id: ObjectId,
  report_date: Date,
  weather: 'sunny' | 'cloudy' | 'rainy',
  weather_note: String,
  work_description: String,
  worker_count: Number,
  equipment_used: String,
  progress_percent: Number,
  problems: String,
  photos: [{
    filename: String,
    caption: String,
    uploadDate: Date
  }],
  created_by: ObjectId
}
```

#### 6. Procurement (จัดซื้อจัดจ้าง)
```javascript
{
  project_id: ObjectId,
  procurement_date: Date,
  item_name: String,
  quantity: Number,
  unit: String,
  unit_price: Number,
  total_price: Number,
  supplier: String,
  note: String,
  attachments: [String],
  created_by: ObjectId
}
```

#### 7. WorkAcceptance (การตรวจรับงาน)
```javascript
{
  project_id: ObjectId,
  acceptance_date: Date,
  work_description: String,
  is_approved: Boolean,
  remarks: String,
  inspector_name: String,
  attachments: [String],
  created_by: ObjectId
}
```

#### 8. ReportTemplate
```javascript
{
  name: String,
  module: 'daily_report' | 'procurement' | 'acceptance',
  project_id: ObjectId,
  scope: 'global' | 'project',
  pages: [PageSchema],
  status: 'active' | 'inactive'
}
```

#### 9. AuditLog
```javascript
{
  user_id: ObjectId,
  username: String,
  action: String,                    // 'create', 'update', 'delete', etc.
  resource_type: String,             // 'document', 'project', etc.
  resource_id: String,
  details: Object,
  ip_address: String,
  timestamp: Date
}
```

### Relationships

```
Department ──< Document ──< Project ──< DailyReport
                │                    ├──< Procurement
                │                    ├──< WorkAcceptance
                │                    └──< ReportTemplate
                │
DocType ────────┘
```

---

## 7. API Patterns

### Authentication

**UMS SSO (เจ้าหน้าที่):**
```javascript
// Login redirect
GET /api/auth/login
// Redirects to UMS SSO

// Callback
GET /api/auth/callback?token=<jwt>
// Validates token, creates session

// Logout
POST /api/auth/logout
// Clears session
```

**Project Key (ผู้รับเหมา):**
```javascript
// Login
POST /api/projects/key/login
Body: { key: "PROJECT_KEY" }
Response: { success: true, project: {...} }

// Validate
GET /api/projects/key/validate
Response: { valid: true, project: {...} }

// Logout
POST /api/projects/key/logout
```

### Standard Response Format

**Success:**
```javascript
{
  success: true,
  data: { /* result */ }
}
```

**Error:**
```javascript
{
  success: false,
  error: "Error message"
}
```

### CRUD Patterns

**List:**
```javascript
GET /api/documents?page=1&limit=20&dept_id=xxx&fiscal_year=2569
Response: {
  success: true,
  data: {
    docs: [...],
    pagination: { total, page, limit, pages }
  }
}
```

**Get by ID:**
```javascript
GET /api/documents/:id
Response: { success: true, data: {...} }
```

**Create:**
```javascript
POST /api/documents
Body: { title, dept_id, doctype_id, fiscal_year }
Response: { success: true, data: {...} }
```

**Update:**
```javascript
PUT /api/documents/:id
Body: { title, ... }
Response: { success: true, data: {...} }
```

**Delete (Soft):**
```javascript
DELETE /api/documents/:id
Response: { success: true }
```

### File Upload

**Upload Document:**
```javascript
POST /api/documents/:id/upload
Content-Type: multipart/form-data
Body: { file: <File> }
Response: { success: true, data: { filename, ... } }
```

**Upload Report Background:**
```javascript
POST /api/report-templates/:templateId/pages/:pageNo/background
Content-Type: multipart/form-data
Body: { background: <File> }
Response: { success: true, data: { backgroundFile: "xxx.pdf" } }
```

### Report Generation

**Generate PDF:**
```javascript
POST /api/projects/:projectId/reports/daily/:reportId/generate
Response: {
  success: true,
  data: {
    pdfUrl: "/api/.../download",
    filename: "daily_report_2569_01_15.pdf"
  }
}
```

---

## 8. ระบบสร้างรายงาน

### Overview

ระบบสร้างรายงาน PDF แบบไดนามิกประกอบด้วย 3 ส่วนหลัก:

1. **Template Designer (Frontend)** - UI สำหรับออกแบบรายงาน
2. **Template Storage (Backend)** - เก็บ template configuration
3. **PDF Generator (Backend)** - สร้าง PDF จริงจากข้อมูล

### 8.1 Template Designer

**Location:** `/frontend/src/pages/TemplateDesigner.jsx`

**Features:**
- Upload background (PDF/PNG/JPG)
- Add/delete pages
- Configure paper size and orientation
- Drag-and-drop fields onto background
- Adjust field properties (font size, color, alignment)
- Save template to backend

**Key Components:**

1. **ReportDesignerCanvas** - Displays background and handles PDF.js rendering
   ```jsx
   <ReportDesignerCanvas
     backgroundUrl="/api/uploads/background.pdf"
     backgroundFileName="background.pdf"
     paperSize="A4"
     orientation="portrait"
   />
   ```

2. **Field Palette** - List of available fields to drag
   ```jsx
   const availableFields = [
     { id: 'project_title', label: 'ชื่อโครงการ' },
     { id: 'report_date', label: 'วันที่รายงาน' },
     { id: 'progress_percent', label: 'ความก้าวหน้า (%)' },
     // ...
   ];
   ```

3. **Properties Panel** - Edit selected field properties
   ```jsx
   <input value={selectedField.fontSize} onChange={handleFontSizeChange} />
   <select value={selectedField.textAlign} onChange={handleAlignChange}>
     <option value="left">ซ้าย</option>
     <option value="center">กลาง</option>
     <option value="right">ขวา</option>
   </select>
   ```

**Coordinate System:**
- Frontend: `y = 0` at top, increases downward
- Backend PDF: `y = 0` at bottom, increases upward
- Conversion: `pdfY = pageHeight - field.y - field.fontSize`

**Desktop-Only:**
```jsx
// Template Designer requires large screen
<MobileWarning feature="Template Designer" />
<div className="hidden lg:block">
  {/* Designer UI */}
</div>
```

### 8.2 PDF Generation Flow

**Step 1: Load Template**
```javascript
const template = await ReportTemplate.findById(templateId);
```

**Step 2: Load Data Record**
```javascript
const report = await DailyReport.findById(reportId).populate('project_id');
```

**Step 3: Create PDF Document**
```javascript
const PDFDocument = require('pdf-lib').PDFDocument;
const pdfDoc = await PDFDocument.create();
```

**Step 4: For Each Page**
```javascript
for (const pageConfig of template.pages) {
  // 1. Add page with correct size
  const { width, height } = getPaperSize(pageConfig.paperSize, pageConfig.orientation);
  const page = pdfDoc.addPage([width, height]);
  
  // 2. Draw background (if exists)
  if (pageConfig.backgroundFile) {
    const backgroundPath = path.join(uploadsDir, '_report_backgrounds', pageConfig.backgroundFile);
    if (pageConfig.backgroundFile.endsWith('.pdf')) {
      const bgPdfBytes = fs.readFileSync(backgroundPath);
      const bgPdf = await PDFDocument.load(bgPdfBytes);
      const [bgPage] = await pdfDoc.copyPages(bgPdf, [0]);
      page.drawPage(bgPage);
    } else {
      // PNG/JPG
      const imageBytes = fs.readFileSync(backgroundPath);
      const image = await pdfDoc.embedPng(imageBytes); // or embedJpg
      page.drawImage(image, { x: 0, y: 0, width, height });
    }
  }
  
  // 3. Draw fields
  const font = await pdfDoc.embedFont(thSarabunFont);
  for (const field of pageConfig.fields) {
    const value = getFieldValue(report, field.fieldId);
    const pdfY = height - field.y - field.fontSize;
    
    page.drawText(value, {
      x: field.x,
      y: pdfY,
      size: field.fontSize,
      font: font,
      color: hexToRgb(field.color),
      maxWidth: field.width
    });
  }
}
```

**Step 5: Save PDF**
```javascript
const pdfBytes = await pdfDoc.save();
const outputPath = path.join(projectDir, 'reports', `${reportId}.pdf`);
fs.writeFileSync(outputPath, pdfBytes);
```

**Field Value Mapping:**
```javascript
function getFieldValue(record, fieldId) {
  const fieldMap = {
    'project_title': record.project_id?.title,
    'report_date': formatDate(record.report_date),
    'progress_percent': `${record.progress_percent}%`,
    'weather': weatherLabels[record.weather],
    'work_description': record.work_description,
    'worker_count': record.worker_count,
    // ...
  };
  return fieldMap[fieldId] || '';
}
```

### 8.3 Important Notes

**PDF Background Rendering:**
- ❌ **ห้ามใช้** `<iframe>`, `<object>`, `<embed>` กับ PDF โดยตรง
- ✅ **ใช้** PDF.js เพื่อ render PDF → Canvas → Blob URL
- เหตุผล: Drag-and-drop ทำงานกับ image/canvas เท่านั้น

**Font Embedding:**
```javascript
// Backend must embed Thai font
const fontkit = require('@pdf-lib/fontkit');
pdfDoc.registerFontkit(fontkit);
const fontBytes = fs.readFileSync('./assets/fonts/THSarabunNew.ttf');
const thSarabunFont = await pdfDoc.embedFont(fontBytes);
```

**File Type Detection:**
```javascript
// Pass filename to detect type
const isPdf = backgroundFileName?.toLowerCase().endsWith('.pdf');
const isPng = backgroundFileName?.toLowerCase().endsWith('.png');
const isJpg = /\.(jpg|jpeg)$/i.test(backgroundFileName);
```

---

## 9. Mobile Responsive

### Current Status

**✅ Mobile-Friendly:**
- Layout & Navigation (hamburger menu, drawer sidebar)
- Document list & detail
- Project overview
- Login/logout
- Search features

**💻 Desktop-Only:**
- Template Designer (requires precision, large screen)
- Report Manager (complex UI)
- Admin Settings (advanced features)

### Implementation

**Mobile Warning Component:**
```jsx
// /frontend/src/components/MobileWarning.jsx
export default function MobileWarning({ feature = 'ฟีเจอร์นี้' }) {
  return (
    <div className="lg:hidden min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
        <div className="text-6xl mb-4">💻</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          ต้องใช้หน้าจอขนาดใหญ่
        </h2>
        <p className="text-gray-600 mb-4">
          {feature} ต้องใช้หน้าจอขนาดใหญ่ (Tablet หรือ Desktop) เพื่อการทำงานที่มีประสิทธิภาพ
        </p>
        <p className="text-sm text-gray-500">
          แนะนำ: ใช้อุปกรณ์ที่มีหน้าจอขนาด 10 นิ้วขึ้นไป
        </p>
      </div>
    </div>
  );
}
```

**Usage:**
```jsx
import MobileWarning from '../components/MobileWarning';

export default function TemplateDesigner() {
  return (
    <>
      <MobileWarning feature="Template Designer" />
      <div className="hidden lg:block">
        {/* Desktop UI */}
      </div>
    </>
  );
}
```

### Responsive Patterns

**Table → Card View (Mobile):**
```jsx
{/* Desktop: Table */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile: Cards */}
<div className="md:hidden space-y-4">
  {items.map(item => (
    <div className="bg-white rounded-lg shadow p-4">
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </div>
  ))}
</div>
```

**Form Stacking:**
```jsx
{/* Responsive form */}
<form className="space-y-4">
  <div className="flex flex-col sm:flex-row gap-4">
    <input className="flex-1 min-h-[44px]" />
    <input className="flex-1 min-h-[44px]" />
  </div>
</form>
```

**Tailwind Breakpoints:**
```css
/* Default (mobile-first) */
.container { width: 100%; }

/* sm: ≥640px */
@media (min-width: 640px) { ... }

/* md: ≥768px */
@media (min-width: 768px) { ... }

/* lg: ≥1024px */
@media (min-width: 1024px) { ... }

/* xl: ≥1280px */
@media (min-width: 1280px) { ... }
```

### Best Practices

1. **Touch Targets:** Minimum 44x44 pixels
2. **Font Sizes:** At least 16px for body text
3. **Keyboard Types:** Use appropriate `type` attribute (tel, email, number)
4. **Viewport:** No horizontal scroll
5. **Images:** Responsive with `max-w-full h-auto`

---

## 10. Authentication

### 10.1 UMS SSO (เจ้าหน้าที่)

**Flow:**
```
1. User clicks "เข้าสู่ระบบ"
2. Frontend redirects to /api/auth/login
3. Backend redirects to UMS SSO
4. User authenticates at UMS
5. UMS redirects back to /api/auth/callback?token=<jwt>
6. Backend validates JWT, creates session
7. Frontend stores user data in AuthContext
```

**Backend Implementation:**
```javascript
// /backend/src/modules/auth/routes.js
router.get('/login', (req, res) => {
  const umsUrl = `${process.env.UMS_URL}/oauth/authorize?client_id=${process.env.UMS_CLIENT_ID}&redirect_uri=${process.env.UMS_REDIRECT_URI}`;
  res.redirect(umsUrl);
});

router.get('/callback', async (req, res) => {
  const { token } = req.query;
  const decoded = jwt.verify(token, process.env.UMS_SECRET);
  
  req.session.user = {
    id: decoded.sub,
    username: decoded.username,
    email: decoded.email,
    roles: decoded.roles
  };
  
  res.redirect('/docs/');
});
```

**Frontend Implementation:**
```javascript
// /frontend/src/contexts/AuthContext.jsx
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on mount
    api.get('/auth/me')
      .then(res => setUser(res.data.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 10.2 Project Key Authentication (ผู้รับเหมา)

**Flow:**
```
1. Admin creates project key
2. Contractor receives key (via email/phone)
3. Contractor visits /docs/project-key-login
4. Enters key
5. Backend validates key, creates session
6. ProjectAuthContext stores project_id
7. Contractor accesses project features
```

**Backend Implementation:**
```javascript
// /backend/src/modules/projects/keyRoutes.js
router.post('/login', async (req, res) => {
  const { key } = req.body;
  
  const projectKey = await ProjectKey.findOne({ key, is_active: true });
  if (!projectKey || projectKey.expires_at < new Date()) {
    return res.json({ success: false, error: 'Invalid or expired key' });
  }
  
  const project = await Project.findById(projectKey.project_id);
  
  req.session.projectAuth = {
    project_id: project._id,
    key_id: projectKey._id
  };
  
  res.json({ success: true, project });
});
```

**Middleware:**
```javascript
// /backend/src/middleware/authenticateProject.js
module.exports = (req, res, next) => {
  if (!req.session.projectAuth?.project_id) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  req.project_id = req.session.projectAuth.project_id;
  next();
};
```

**Frontend Implementation:**
```javascript
// /frontend/src/contexts/ProjectAuthContext.jsx
const ProjectAuthContext = createContext();

export const ProjectAuthProvider = ({ children }) => {
  const [projectAuth, setProjectAuth] = useState(null);

  const loginWithKey = async (key) => {
    const res = await api.post('/projects/key/login', { key });
    if (res.data.success) {
      setProjectAuth(res.data.project);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await api.post('/projects/key/logout');
    setProjectAuth(null);
  };

  return (
    <ProjectAuthContext.Provider value={{ projectAuth, loginWithKey, logout }}>
      {children}
    </ProjectAuthContext.Provider>
  );
};
```

---

## 11. File Storage

### Storage Strategy

**Organized by Department and Fiscal Year:**
```
/data/archives/documents/
├── {dept_code}/
│   └── {fiscal_year}/
│       ├── prj/              # Project documents
│       └── rep/              # Reports
```

**Project-Specific Storage:**
```
/data/archives/documents/{dept_code}/{fiscal_year}/{project_id}/
├── dow/                      # Daily progress photos
├── fav/                      # Project files
└── rcd/                      # Records
```

**Report Backgrounds:**
```
/data/archives/uploads/_report_backgrounds/
├── template_123_page1.pdf
├── template_456_page2.png
└── ...
```

### File Upload Handling

**Multer Configuration:**
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.STORAGE_BASE, 'documents', dept_code, fiscal_year);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'));
    }
  }
});
```

**Security:**
```javascript
// Prevent directory traversal
const sanitizePath = (userPath) => {
  return path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
};

// Check file ownership before download
const checkFileAccess = async (req, res, next) => {
  const doc = await Document.findOne({ 'files.filename': req.params.filename });
  if (!doc) return res.status(404).json({ error: 'File not found' });
  
  if (doc.created_by.toString() !== req.session.user.id && !req.session.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};
```

---

## 12. Best Practices

### Code Style

**Backend:**
```javascript
// ✅ Use async/await
async function getDocument(id) {
  const doc = await Document.findById(id);
  return doc;
}

// ✅ Handle errors
try {
  const doc = await Document.findById(id);
  if (!doc) throw new Error('Document not found');
  res.json({ success: true, data: doc });
} catch (error) {
  logger.error('Error:', error);
  res.status(500).json({ success: false, error: error.message });
}

// ✅ Use middleware for validation
const validateDocument = validate(documentSchema);
router.post('/documents', validateDocument, async (req, res) => {
  // req.body is validated
});
```

**Frontend:**
```javascript
// ✅ Use custom hooks
const useAuth = () => useContext(AuthContext);

// ✅ Handle loading states
const [loading, setLoading] = useState(false);

// ✅ Handle errors
try {
  const res = await api.get('/documents');
  setDocuments(res.data.data);
} catch (error) {
  toast.error('เกิดข้อผิดพลาด');
  console.error(error);
}
```

### Security

**Input Validation:**
```javascript
// Use Zod for validation
const documentSchema = z.object({
  title: z.string().min(1).max(1000),
  dept_id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  fiscal_year: z.number().int().min(2500).max(2600)
});
```

**SQL/NoSQL Injection Prevention:**
```javascript
// ✅ Use Mongoose (parameterized)
Document.findById(id);

// ❌ Never use string concatenation
Document.find(`{ _id: "${id}" }`); // VULNERABLE
```

**XSS Prevention:**
```javascript
// ✅ React escapes by default
<div>{userInput}</div>

// ❌ Avoid dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**CSRF Protection:**
```javascript
// Already handled by session cookie with SameSite
app.use(session({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax'
  }
}));
```

### Performance

**Database Indexing:**
```javascript
// Add indexes for frequently queried fields
documentSchema.index({ dept_id: 1, fiscal_year: 1 });
documentSchema.index({ deleted: 1 });
projectSchema.index({ status: 1 });
```

**Pagination:**
```javascript
// Always paginate large result sets
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;

const docs = await Document.find(query)
  .skip(skip)
  .limit(limit)
  .sort({ created_at: -1 });

const total = await Document.countDocuments(query);
```

**Caching:**
```javascript
// Cache frequently accessed data
const getDepartments = async () => {
  const cached = await redis.get('departments');
  if (cached) return JSON.parse(cached);
  
  const depts = await Department.find({ is_active: true });
  await redis.setex('departments', 3600, JSON.stringify(depts)); // 1 hour
  return depts;
};
```

### Logging

**Winston Configuration:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Log important actions
logger.info('Document created', { doc_id: doc.doc_id, user_id: req.session.user.id });
```

---

## 13. Common Issues

### Issue 1: PDF Background Not Showing

**Problem:**
```jsx
// ❌ Wrong: Using <object> or <iframe>
<object data={pdfUrl} type="application/pdf" />
```

**Solution:**
```jsx
// ✅ Correct: Use PDF.js to render to canvas
import pdfjsLib from 'pdfjs-dist';

const loadPdf = async (url) => {
  const pdf = await pdfjsLib.getDocument(url).promise;
  const page = await pdf.getPage(1);
  const canvas = canvasRef.current;
  const context = canvas.getContext('2d');
  const viewport = page.getViewport({ scale: 2 });
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  const blob = await new Promise(resolve => canvas.toBlob(resolve));
  const blobUrl = URL.createObjectURL(blob);
  setImageUrl(blobUrl);
};
```

### Issue 2: Session Not Persisting

**Problem:** Session lost after server restart

**Solution:** Use Redis for session storage
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('./config/redis');

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

### Issue 3: Thai Font Not Rendering in PDF

**Problem:** Thai characters show as boxes

**Solution:** Embed Thai font
```javascript
const fontkit = require('@pdf-lib/fontkit');
pdfDoc.registerFontkit(fontkit);

const fontPath = path.join(__dirname, '../assets/fonts/THSarabunNew.ttf');
const fontBytes = fs.readFileSync(fontPath);
const thaiFont = await pdfDoc.embedFont(fontBytes);

page.drawText('ข้อความภาษาไทย', {
  font: thaiFont,
  size: 16
});
```

### Issue 4: File Upload Size Limit

**Problem:** Large files fail to upload

**Solution:** Increase limits
```javascript
// Express body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// Nginx
client_max_body_size 50M;
```

### Issue 5: CORS Errors in Development

**Problem:** Frontend (localhost:3010) can't call backend (localhost:3009)

**Solution:** Enable CORS with credentials
```javascript
const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:3010',
  credentials: true
}));
```

### Issue 6: Coordinate Mismatch in PDF

**Problem:** Text appears at wrong position

**Solution:** Convert Y coordinate
```javascript
// Frontend: y = 0 at top
const field = { x: 100, y: 50, fontSize: 16 };

// Backend: convert to PDF coordinate (y = 0 at bottom)
const pageHeight = 841.89; // A4 portrait
const pdfY = pageHeight - field.y - field.fontSize;

page.drawText(text, {
  x: field.x,
  y: pdfY, // Use converted coordinate
  size: field.fontSize
});
```

### Issue 7: Mobile UI Not Responsive

**Problem:** UI broken on mobile devices

**Solution:** Use responsive Tailwind classes
```jsx
// ❌ Wrong: Fixed width
<div className="w-1200">

// ✅ Correct: Responsive width
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

// ❌ Wrong: Always show table
<table>...</table>

// ✅ Correct: Table on desktop, cards on mobile
<div className="hidden md:block">
  <table>...</table>
</div>
<div className="md:hidden">
  <div className="space-y-4">
    {items.map(item => <Card key={item.id} {...item} />)}
  </div>
</div>
```

---

## 14. Deployment Checklist

### Pre-Deployment

- [ ] Update environment variables in `.env`
- [ ] Run `npm install` in both backend and frontend
- [ ] Build frontend: `cd frontend && npm run build`
- [ ] Test backend: `cd backend && npm test`
- [ ] Check database connection
- [ ] Verify Redis connection
- [ ] Test UMS SSO integration
- [ ] Review Nginx configuration
- [ ] Set up PM2 ecosystem config

### Deployment Steps

```bash
# 1. Pull latest code
cd /data/archives
git pull origin main

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Build frontend
cd frontend
npm run build

# 4. Restart backend (PM2)
cd backend
pm2 restart ecosystem.config.js

# 5. Reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# 6. Check logs
pm2 logs
tail -f backend/logs/combined.log
```

### Post-Deployment

- [ ] Verify site is accessible
- [ ] Test login flow
- [ ] Test file upload
- [ ] Test report generation
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Backup database

---

## 15. Quick Reference

### Environment Variables

```env
# Backend (.env)
NODE_ENV=production
PORT=3009
MONGODB_URI=mongodb://localhost:27017/archives
REDIS_HOST=localhost
REDIS_PORT=6379
SESSION_SECRET=your-secret-key
UMS_URL=https://ums.example.com
UMS_CLIENT_ID=your-client-id
UMS_CLIENT_SECRET=your-client-secret
UMS_REDIRECT_URI=https://yourdomain.com/docs/api/auth/callback
STORAGE_BASE=/data/archives
```

```env
# Frontend (.env)
VITE_API_BASE_URL=/docs/api
```

### Useful Commands

```bash
# MongoDB
mongosh
use archives
db.documents.find().pretty()
db.documents.countDocuments()

# Redis
redis-cli
KEYS *
GET session:xxx

# PM2
pm2 list
pm2 logs
pm2 restart all
pm2 monit

# Nginx
sudo nginx -t
sudo systemctl status nginx
sudo systemctl reload nginx
tail -f /var/log/nginx/error.log

# Backup
mongodump --db archives --out /backup/$(date +%Y%m%d)
```

### Key URLs

```
Production:
https://yourdomain.com/docs/              # Frontend
https://yourdomain.com/docs/api/          # Backend API

Development:
http://localhost:3010/                    # Frontend dev server
http://localhost:3009/api/                # Backend dev server
```

---

## 16. Troubleshooting Guide

### Database Connection Failed

```bash
# Check MongoDB status
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Check connection
mongosh
```

### Redis Connection Failed

```bash
# Check Redis status
sudo systemctl status redis

# Start Redis
sudo systemctl start redis

# Test connection
redis-cli ping
```

### PM2 Process Not Starting

```bash
# Check PM2 logs
pm2 logs

# Delete and restart
pm2 delete all
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
```

### Frontend Build Errors

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check for syntax errors
npm run build

# Check Vite config
cat vite.config.js
```

### UMS SSO Not Working

```bash
# Check callback URL matches UMS config
# Check JWT secret matches UMS
# Verify session is persisting (check Redis)
redis-cli KEYS "sess:*"
```

---

## 17. Additional Resources

### Documentation

- [CreateReport.md](./CreateReport.md) - Detailed report generation guide
- [MOBILE_SUPPORT.md](./MOBILE_SUPPORT.md) - Mobile responsive guidelines
- [progress.md](./progress.md) - Development history
- [ums.md](./ums.md) - UMS integration guide
- [git.md](./git.md) - Git workflow

### External References

- [Express.js](https://expressjs.com/)
- [React](https://react.dev/)
- [Mongoose](https://mongoosejs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [pdf-lib](https://pdf-lib.js.org/)
- [PDF.js](https://mozilla.github.io/pdf.js/)

---

## 18. Contact & Support

**Developer:** manarider  
**Repository:** https://github.com/manarider/docs.git  
**Last Updated:** 2026-07-27

---

**สิ้นสุดเอกสาร AI System Guide**
