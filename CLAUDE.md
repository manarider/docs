# แนวทางการพัฒนาระบบติดตามโครงการ (CLAUDE.md)

ไฟล์นี้ทำหน้าที่เป็นคู่มืออ้างอิงสำหรับการตั้งค่าโครงการ คำสั่งการทำงาน โครงสร้างระบบ และข้อตกลงในการเขียนโค้ดสำหรับรีพอนี้

## 1. คำสั่งการใช้งานระบบ

### คำสั่งฝั่ง Backend (ทำงานจากโฟลเดอร์ `/data/archives/backend`)
*   **รันเซิร์ฟเวอร์โหมดพัฒนา (Development):** `npm run dev`
*   **รันเซิร์ฟเวอร์โหมดจริง (Production) ผ่าน PM2:** `pm2 start src/app.js --name "docs-api"`
*   **รีสตาร์ทเซิร์ฟเวอร์:** `pm2 reload docs-api`
*   **รันการทดสอบระบบ (Unit Tests):** `DOC_STORAGE_PATH=/data/documents npm test`
*   **ดูไฟล์บันทึกการทำงาน (Logs):** `pm2 logs docs-api --lines 50`

### คำสั่งฝั่ง Frontend (ทำงานจากโฟลเดอร์ `/data/archives/frontend`)
*   **รันเซิร์ฟเวอร์โหมดพัฒนา (Development):** `npm run dev`
*   **สร้างไฟล์ Production Build:** `npm run build`
*   **พรีวิวไฟล์ Build บนเครื่อง:** `npm run preview`

---

## 2. โครงสร้างของโปรเจกต์ (Repository Architecture)

### การจัดวางโฟลเดอร์และไฟล์
*   `/backend/src/` — เซิร์ฟเวอร์ Express API หลัก
    *   `app.js` — ไฟล์ตั้งต้นการทำงาน เซ็ตติ้งมิดเดิลแวร์ เซสชัน (Redis) และสเกลเราเตอร์
    *   `config/` — การตั้งค่าภายนอก (ฐานข้อมูล MongoDB, Redis, พื้นที่เก็บเอกสาร)
    *   `middleware/` — มิดเดิลแวร์ตรวจสอบสิทธิ์ระบบและสิทธิ์โครงการ
    *   `models/` — โครงสร้างสกีมา Mongoose (`Document`, `Project`, `DailyReport` ฯลฯ)
    *   `modules/` — ตัวควบคุมแยกตามสิทธิ์และส่วนฟีเจอร์ (Controller/Route)
    *   `utils/` — ฟังก์ชันยูทิลิตี้เสริม (เช่น `pdfGenerator.js` ที่วาดเอกสารด้วย `pdf-lib`)
*   `/frontend/src/` — แอปพลิเคชัน React SPA (Vite + TailwindCSS)
    *   `components/` — ส่วนแสดงผลที่ใช้ซ้ำ (`Sidebar.jsx`, `PrintReportButton.jsx`)
    *   `contexts/` — ตัวจัดการสถานะผู้ใช้เซสชัน (Context Provider)
    *   `pages/` — หน้าจอหลักแสดงผลของระบบ (`ProjectDailyReports.jsx`, `TemplateDesigner.jsx`)

---

## 3. ข้อตกลงและหลักปฏิบัติในการเขียนโค้ด (Coding Guidelines)

1.  **รูปแบบการเขียนส่วนควบคุมหลังบ้าน (Backend Controller):**
    *   **ห้าม** ใช้ Spread Operator (`...`) โดยตรงกับ Mongoose Document Instance ให้แปลงเป็น Plain Object ด้วยการทำ `.toObject()` หรือระบุต่อท้ายด้วยคำสั่ง `.lean()` ตั้งแต่การคิวรี่
    *   ควบคุมการเข้าถึงไฟล์ให้อยู่ภายในพิกัดความปลอดภัยที่ตรวจสอบผ่านมิดเดิลแวร์ `isSafePath` เสมอ เพื่อสกัดกั้นช่องโหว่การเจาะพาธ (Path Traversal)
    *   ตัวบันทึกประวัติ (Winston logger) ไม่รองรับพารามิเตอร์แบบต่อท้ายหลายตัว ให้รวบรวมข้อความความผิดพลาดเป็นเทมเพลตสตริงชุดเดียวหรือส่ง stack trace แทน

2.  **การจัดการสเตตและการออกแบบฝั่งหน้าบ้าน (React UI State):**
    *   **ห้าม** ทำการแก้ไขข้อมูลสเตตซ้อนในอาร์เรย์ตรงๆ (Direct Mutation) ให้ใช้วิธี **Immutable State Update** เสมอ เช่น การโคลนหน้าเอกสาร/ฟิลด์โดยการเรียกใช้เมธอด `.map()` ก่อนเปลี่ยนค่า
    *   เลือกใช้คำสั่งดักจับจากกลุ่ม **Pointer Events** (`onPointerDown`, `onPointerMove`, `onPointerUp`) แทน Mouse หรือ Touch Events ปกติ เพื่อให้รองรับทัชสกรีนและเมาส์ไปพร้อมกัน
    *   รักษาสัดส่วน Canvas ภาพพื้นหลังและฟิลด์ให้ตรงตามจริงของขนาดกระดาษ (A4) โดยใช้การคำนวณและตั้งสไตล์ `transform: scale(x)` ด้วยตัวเลขทศนิยมไม่มีหน่วย

3.  **แนวทางการออกแบบอินเตอร์เฟส (UI Design):**
    *   ยึดธีมสีหลักสีส้มเหลือง (Primary Orange Theme) และใส่รูปทรงโค้งมน (rounded) ร่วมกับเงา (shadow) ของกรอบคอนเทนเนอร์เพื่อให้ดูพรีเมียม
    *   ขนาดปุ่มกดบนอุปกรณ์เคลื่อนที่ต้องเหมาะสมและเข้าถึงง่าย (มีส่วนสัมผัสสูงไม่ต่ำกว่า 40px บนสมาร์ตโฟน)
