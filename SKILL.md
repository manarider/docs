# คู่มือนักพัฒนาและการแก้ไขระบบ (SKILL.md)

เอกสารนี้รวบรวมวิธีดำเนินการสำหรับการเพิ่มคุณสมบัติใหม่ๆ และการบำรุงรักษาระบบเบื้องต้นในสถาปัตยกรรมของโครงการนี้

## 1. ขั้นตอนการเพิ่มฟิลด์ข้อมูลโปรเจกต์ใหม่ (Adding Project Field)
หากต้องการเพิ่มข้อมูลใหม่ของโครงการ (เช่น ชื่อผู้จัดการสัญญา) และทำให้แสดงเป็นตัวเลือกในการวาดลงแบบฟอร์ม PDF:

1.  **แก้ไขฐานข้อมูล (Schema):**
    *   เปิดไฟล์สกีมาโครงการที่ [Project.js](file:///data/archives/backend/src/models/Project.js)
    *   เพิ่มฟิลด์ตัวแปรใหม่เข้าไป (เช่น `contract_manager: { type: String, default: '', trim: true }`)
2.  **เปิดการรับค่าและบันทึกข้อมูล (Controller):**
    *   เปิดไฟล์ควบคุมที่ [project.controller.js](file:///data/archives/backend/src/modules/projects/project.controller.js)
    *   ในส่วนฟังก์ชัน `updateProject` ให้ทำตัวรับค่าจาก `req.body` และนำมาบันทึกอัปเดตลงโมเดล
3.  **เพิ่มฟิลด์ลงในตัวแมป PDF (PDF Context Resolver):**
    *   เปิดไฟล์สร้างเอกสารที่ [pdfGenerator.js](file:///data/archives/backend/src/utils/pdfGenerator.js)
    *   ไปที่ฟังก์ชัน `getFieldValue` และทำการเพิ่มเงื่อนไขแมปรหัสคำสำคัญ:
        ```javascript
        if (key === 'contractManager') return record.project?.contract_manager || '';
        ```
4.  **เพิ่มตัวเลือกบนหน้าจอออกแบบ (Palette Catalog):**
    *   เปิดไฟล์หน้าบ้านที่ [TemplateDesigner.jsx](file:///data/archives/frontend/src/pages/TemplateDesigner.jsx)
    *   ค้นหาตัวแปรอาร์เรย์รายการฟิลด์ `PROJECT_FIELDS` จากนั้นแนบตัวเลือกใหม่ต่อท้าย:
        ```javascript
        { id: '_project.contractManager', label: 'ผู้จัดการสัญญา' },
        ```

---

## 2. ขั้นตอนการแมปฟิลด์ของโมดูลย่อย (Resolving Custom Module Fields)
กรณีมีฟิลด์หรือเนื้อหาในเอกสารย่อย (เช่น รายละเอียดบันทึกสภาพอากาศ หรือปัญหาอุปสรรค):

1.  **การดึงข้อมูล:** ตรวจสอบว่าโมเดลฟิลด์นั้นบันทึกลงในคอลเลกชันรายงานจริง
2.  **เขียนตัวจัดการแก้ค่า:** ไปที่ `pdfGenerator.js` เพื่อเขียนแมปแปลงคำสำคัญ เช่น `report.weather` ให้ออกมาเป็น `record.weather || ''`
3.  **เพิ่มเข้าดีไซเนอร์หน้าบ้าน:** นำคีย์คำสำคัญและป้ายชื่อภาษาไทยระบุเพิ่มในชุดตัวแปรของ `TemplateDesigner.jsx` เพื่อดึงขึ้นมาแสดงในรายการ Dropdown ให้เจ้าหน้าที่เลือกใช้งาน

---

## 3. การบำรุงรักษา: การแก้ไข/ทดแทนไฟล์ฟอนต์ชำรุด
หากฟอนต์ไทยไม่สามารถอ่านออก หรือเบราว์เซอร์ฟ้องสระลอยและ `Unknown font format`:
1.  ตรวจสอบความสมบูรณ์และขนาดของไฟล์ฟอนต์ผ่านคำสั่งตรวจสอบประเภทไฟล์ `file backend/src/assets/fonts/THSarabunNew.ttf`
2.  สามารถดาวน์โหลดฟอนต์ TrueType ต้นฉบับผ่านคอมมานด์ไลน์ด้วยคำสั่งนี้:
    ```bash
    curl -L -o backend/src/assets/fonts/THSarabunNew.ttf https://github.com/Phonbopit/sarabun-webfont/raw/master/fonts/thsarabunnew-webfont.ttf
    ```
3.  หลังจากทดแทนไฟล์สำเร็จ ให้ทำการรีสตาร์ทบริการหลังบ้านเพื่อโหลดฟอนต์ใหม่ด้วยคำสั่ง: `pm2 reload docs-api`
