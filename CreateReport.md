<h1>CreateReport.md — Reusable Report Generation Blueprint</h1>

<p>เอกสารนี้เป็นแม่แบบสำหรับนำระบบสร้างรายงาน PDF ไปประยุกต์ใช้ในแอปอื่น โดยออกแบบให้รองรับการสร้างเอกสารจากข้อมูลคำร้อง/รายการธุรกรรมแบบไดนามิก เช่น ใบคำร้อง ใบอนุญาต ใบเสร็จ ใบแจ้งหนี้ หนังสือรับรอง หรือเอกสารราชการที่ต้องวางข้อมูลทับบนฟอร์ม PDF/รูปภาพเดิม</p>

<hr />

<h2>1. เป้าหมายของระบบ</h2>

<ul>
  <li>ให้ผู้ดูแลระบบสร้าง <strong>Report Template</strong> ได้เองโดยไม่ต้องแก้โค้ด</li>
  <li>รองรับการอัปโหลดพื้นหลังเอกสารเป็น <code>PDF</code>, <code>PNG</code>, <code>JPG</code></li>
  <li>รองรับหลายหน้าในหนึ่งรายงาน</li>
  <li>วางข้อมูลแบบไดนามิกจาก record จริงลงบนตำแหน่งที่กำหนด</li>
  <li>Preview, Print, Download PDF ได้จากหน้าเว็บ</li>
  <li>รองรับการสร้างไฟล์ชั่วคราวเพื่อส่งลิงก์ผ่าน LINE, Email หรือช่องทางอื่น</li>
  <li>ต่อยอดเพิ่มหน้าแนบท้าย เช่น ใบแจ้งยอดชำระเงิน ตารางค่าธรรมเนียม หรือ QR Code ได้</li>
</ul>

<hr />

<h2>2. แนวคิดหลัก</h2>

<p>ระบบรายงานควรแยกออกเป็น 3 ชั้นหลัก:</p>

<ol>
  <li><strong>Report Template:</strong> เก็บโครงสร้างรายงาน เช่น ชื่อ รายการหน้า พื้นหลัง และตำแหน่ง field</li>
  <li><strong>Report Designer:</strong> หน้าจอสำหรับลากวาง field ลงบนเอกสาร และบันทึกพิกัด</li>
  <li><strong>PDF Generator:</strong> backend utility ที่นำ template + record data มาสร้าง PDF จริง</li>
</ol>

<p>หลักสำคัญคือ frontend designer ใช้พิกัดแบบหน้าจอทั่วไป โดยแกน <code>x</code> เริ่มจากซ้าย และแกน <code>y</code> เริ่มจากบนลงล่าง ส่วน backend PDF library ส่วนใหญ่ใช้แกน <code>y</code> จากล่างขึ้นบน จึงต้องแปลงพิกัดก่อนวาดข้อความ</p>

<pre><code>pdfY = pageHeight - field.y - field.fontSize</code></pre>

<hr />

<h2>3. Data Model: ReportTemplate</h2>

<p>ตัวอย่าง schema แบบ MongoDB/Mongoose สามารถปรับใช้กับฐานข้อมูลอื่นได้ โดยคงแนวคิดเดียวกัน</p>

<pre><code>const reportTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sourceTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FormTemplate',
    required: true
  },
  pages: [{
    pageNo: {
      type: Number,
      required: true
    },
    backgroundFile: {
      type: String,
      default: null
    },
    paperSize: {
      type: String,
      enum: ['A4', 'A5', 'Letter', 'Legal'],
      default: 'A4'
    },
    orientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait'
    },
    fields: [{
      fieldId: {
        type: String,
        required: true
      },
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, default: 200 },
      height: { type: Number, default: 20 },
      fontSize: { type: Number, default: 16 },
      fontFamily: { type: String, default: 'THSarabunNew' },
      color: { type: String, default: '#000000' },
      textAlign: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'left'
      }
    }]
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive'
  }
}, { timestamps: true });</code></pre>

<h3>คำอธิบาย field สำคัญ</h3>

<ul>
  <li><code>sourceTemplateId</code>: ใช้ผูกกับแบบฟอร์ม ประเภทรายการ หรือ module ต้นทาง เช่น form, ticket type, license type</li>
  <li><code>pages</code>: รายการหน้าของรายงาน เรียงตาม <code>pageNo</code></li>
  <li><code>backgroundFile</code>: ไฟล์ PDF/รูปภาพที่ใช้เป็นพื้นหลังของหน้านั้น</li>
  <li><code>fields.fieldId</code>: key ของข้อมูลที่จะนำมาวาง เช่น <code>_record.number</code>, <code>_user.name</code>, <code>address</code></li>
  <li><code>x</code>, <code>y</code>: พิกัดจากมุมซ้ายบนของเอกสารในหน่วย point</li>
  <li><code>width</code>: ใช้สำหรับคำนวณ alignment เช่น center/right</li>
</ul>

<hr />

<h2>4. รูปแบบ Field ID ที่แนะนำ</h2>

<p>ควรแบ่ง field ออกเป็น 2 กลุ่ม เพื่อให้ระบบอ่านง่ายและต่อยอดได้สะดวก</p>

<h3>System Fields</h3>

<pre><code>[
  { id: '_record.number', name: 'เลขที่เอกสาร' },
  { id: '_record.createdAt', name: 'วันที่สร้าง' },
  { id: '_record.status', name: 'สถานะ' },
  { id: '_user.name', name: 'ชื่อผู้ยื่น' },
  { id: '_user.phone', name: 'เบอร์โทร' },
  { id: '_department.name', name: 'หน่วยงาน' }
]</code></pre>

<h3>Dynamic Form Fields</h3>

<p>ใช้ key จากแบบฟอร์มจริง เช่น</p>

<pre><code>[
  { key: 'fullName', label: 'ชื่อ-นามสกุล' },
  { key: 'address', label: 'ที่อยู่' },
  { key: 'requestDetail', label: 'รายละเอียดคำร้อง' },
  { key: 'signature', label: 'ลายเซ็น' }
]</code></pre>

<p>ข้อแนะนำ: ให้ใช้ <code>key</code> เป็นตัวอ้างอิงถาวร ไม่ควรใช้ label เพราะ label อาจถูกแก้ไขภายหลังได้</p>

<hr />

<h2>5. Backend API ที่ควรมี</h2>

<h3>Report Template Management</h3>

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Path</th>
      <th>หน้าที่</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/admin/report-templates</code></td>
      <td>ดึงรายการ template ทั้งหมด หรือ filter ตาม <code>sourceTemplateId</code></td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/admin/report-templates/:id</code></td>
      <td>ดึงรายละเอียด template หนึ่งรายการ</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/admin/report-templates</code></td>
      <td>สร้าง template ใหม่</td>
    </tr>
    <tr>
      <td><code>PUT</code></td>
      <td><code>/api/admin/report-templates/:id</code></td>
      <td>อัปเดตชื่อ สถานะ หน้า และตำแหน่ง field</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/admin/report-templates/:id</code></td>
      <td>ลบ template และ background ที่เกี่ยวข้อง</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/admin/report-templates/:id/background/:pageNo</code></td>
      <td>อัปโหลด background ของหน้าเอกสาร</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/admin/report-templates/:id/background/:pageNo</code></td>
      <td>ลบ background ของหน้าที่กำหนด</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/admin/report-templates/:id/page/:pageNo</code></td>
      <td>ลบหน้ารายงานและเรียงเลขหน้าใหม่</td>
    </tr>
  </tbody>
</table>

<h3>Report Generation</h3>

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Path</th>
      <th>หน้าที่</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/records/:id/report-templates</code></td>
      <td>ดึง template ที่ active และตรงกับ record นั้น</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/records/:id/generate-report/:templateId</code></td>
      <td>สร้าง PDF แบบ on-the-fly และ stream กลับไป preview/download</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/records/:id/send-report/:templateId</code></td>
      <td>สร้าง PDF เป็นไฟล์ชั่วคราว แล้วส่งลิงก์ผ่าน LINE/Email หรือช่องทางอื่น</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/public/report-download/:token</code></td>
      <td>เปิดดูหรือดาวน์โหลดไฟล์ชั่วคราว</td>
    </tr>
  </tbody>
</table>

<hr />

<h2>6. File Upload Rules</h2>

<ul>
  <li>อนุญาตเฉพาะ <code>application/pdf</code>, <code>image/png</code>, <code>image/jpeg</code></li>
  <li>จำกัดขนาดไฟล์ เช่น 5MB หรือ 10MB ตามความเหมาะสม</li>
  <li>ใช้ UUID เป็นชื่อไฟล์เสมอ ห้ามใช้ชื่อไฟล์จากผู้ใช้โดยตรง</li>
  <li>เก็บไฟล์ไว้ใน folder เฉพาะ เช่น <code>/uploads/report-backgrounds</code></li>
  <li>เมื่อเปลี่ยน background ควรลบไฟล์เดิมเพื่อลดไฟล์ขยะ</li>
  <li>ตอนอ่านไฟล์จาก disk ต้องใช้ <code>path.resolve()</code> และตรวจ prefix เพื่อป้องกัน path traversal</li>
</ul>

<pre><code>const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
if (!allowed.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}</code></pre>

<hr />

<h2>7. PDF Generator Design</h2>

<p>แนะนำใช้ <code>pdf-lib</code> สำหรับ Node.js เพราะรองรับการสร้าง PDF, copy page จาก PDF เดิม, embed image, embed font และ draw text ได้ดี</p>

<h3>Dependencies</h3>

<pre><code>npm install pdf-lib @pdf-lib/fontkit moment-timezone</code></pre>

<h4>Frontend Dependencies (สำหรับ Designer):</h4>

<pre><code>npm install react-draggable @react-pdf/renderer
# หรือใช้ PDF.js จาก CDN (แนะนำ)
# https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js</code></pre>

<p><strong>หมายเหตุ:</strong> PDF.js ใช้สำหรับแสดง PDF background ใน Designer เท่านั้น ส่วน backend ยังคงใช้ pdf-lib เพื่อสร้าง PDF ออกมา</p>

<h3>โครงสร้างฟังก์ชันหลัก</h3>

<pre><code>const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs').promises;
const path = require('path');

async function generatePdf(record, template) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await fs.readFile(path.join(__dirname, '../assets/fonts/THSarabunNew.ttf'));
  const thaiFont = await pdfDoc.embedFont(fontBytes);

  for (const pageTemplate of template.pages) {
    const page = await createPageWithBackground(pdfDoc, pageTemplate);
    const pageHeight = page.getHeight();

    for (const field of pageTemplate.fields) {
      const text = getFieldValue(record, field.fieldId);
      if (!text) continue;

      const fontSize = field.fontSize || 16;
      const pdfY = pageHeight - field.y - fontSize;
      const x = calculateAlignedX(thaiFont, text, field, fontSize);

      page.drawText(String(text), {
        x,
        y: pdfY,
        size: fontSize,
        font: thaiFont,
        color: hexToRgb(field.color)
      });
    }
  }

  return await pdfDoc.save();
}</code></pre>

<h3>Field Value Resolver</h3>

<pre><code>function getFieldValue(record, fieldId) {
  if (fieldId === '_record.number') return record.recordNo || '';
  if (fieldId === '_record.createdAt') return formatThaiDate(record.createdAt);
  if (fieldId === '_user.name') return record.submittedBy?.fullName || '';
  if (fieldId === '_department.name') return record.department || '';

  if (record.fields instanceof Map) {
    return record.fields.get(fieldId) || '';
  }

  return record.fields?.[fieldId] || '';
}</code></pre>

<h3>Background Handling</h3>

<ul>
  <li>ถ้าเป็น PDF ให้โหลดไฟล์แล้ว copy หน้าแรกเข้ามาเป็น background</li>
  <li>ถ้าเป็น PNG/JPG ให้ embed image และสร้างหน้าขนาดเท่ารูป</li>
  <li>ถ้าไม่มี background ให้สร้างหน้าว่างตาม <code>paperSize</code> และ <code>orientation</code></li>
  <li>ถ้าโหลด background ไม่สำเร็จ ให้ fallback เป็นหน้าว่างแทน และ log error</li>
</ul>

<hr />

<h2>8. Frontend: Report Manager</h2>

<p>หน้า Report Manager ควรมีความสามารถดังนี้:</p>

<ul>
  <li>แสดงรายการ template ทั้งหมด</li>
  <li>สร้าง template ใหม่โดยเลือกว่าจะผูกกับ form/module ใด</li>
  <li>เปิด/ปิดใช้งาน template ด้วยสถานะ <code>active</code>/<code>inactive</code></li>
  <li>คัดลอก template เดิมไปใช้กับ form/module อื่น</li>
  <li>ลบ template พร้อมไฟล์ background ที่เกี่ยวข้อง</li>
  <li>กดเข้า Designer เพื่อจัด layout</li>
</ul>

<h3>ตัวอย่างข้อมูลเริ่มต้นตอนสร้าง template</h3>

<pre><code>{
  "name": "ใบคำร้องทั่วไป",
  "sourceTemplateId": "FORM_ID",
  "pages": [
    {
      "pageNo": 1,
      "paperSize": "A4",
      "orientation": "portrait",
      "backgroundFile": null,
      "fields": []
    }
  ],
  "status": "inactive"
}</code></pre>

<hr />

<h2>9. Frontend: Report Designer</h2>

<p>หน้า Designer คือหัวใจของระบบ ควรแบ่งหน้าจอเป็น 3 ส่วน:</p>

<ol>
  <li><strong>Field Sidebar:</strong> รายการตัวแปรที่สามารถนำไปวางบนเอกสาร</li>
  <li><strong>Canvas Area:</strong> พื้นที่แสดงกระดาษ พื้นหลัง และ field ที่ลากวาง</li>
  <li><strong>Properties Panel:</strong> ตั้งค่าพิกัด ขนาด สี ฟอนต์ และ alignment ของ field ที่เลือก</li>
</ol>

<h3>ความสามารถที่ควรมี</h3>

<ul>
  <li>เลือกหน้าเอกสาร และเพิ่ม/ลบหน้าได้</li>
  <li>อัปโหลด background ต่อหน้า</li>
  <li>แสดง PDF background โดย <strong>แปลงเป็นรูปภาพ</strong> (ดูรายละเอียดด้านล่าง)</li>
  <li>ลาก field เพื่อเปลี่ยนตำแหน่ง</li>
  <li>resize field width/height เพื่อช่วยจัด alignment</li>
  <li>ตั้งค่า <code>x</code>, <code>y</code>, <code>width</code>, <code>height</code>, <code>fontSize</code>, <code>color</code>, <code>textAlign</code></li>
  <li>เตือนก่อนออกจากหน้าเมื่อมี unsaved changes</li>
  <li>บันทึก layout ทั้งหมดกลับเข้า template</li>
</ul>

<h3>⚠️ สำคัญ: การจัดการ PDF Background ใน Designer</h3>

<p><strong>ห้ามใช้ <code>&lt;iframe&gt;</code> หรือ <code>&lt;embed&gt;</code> กับไฟล์ PDF โดยตรง</strong> เพราะจะแสดง PDF viewer controls (toolbar) ซึ่งขัดขวางการลาก field</p>

<p><strong>วิธีที่ถูกต้อง:</strong> ใช้ <strong>PDF.js</strong> แปลง PDF เป็นรูปภาพ (Canvas → PNG Data URL) แล้วแสดงเป็น <code>&lt;img&gt;</code></p>

<h4>ขั้นตอนการ implement:</h4>

<ol>
  <li><strong>โหลด PDF.js จาก CDN</strong> (หรือ npm install)
    <pre><code>&lt;script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"&gt;&lt;/script&gt;</code></pre>
  </li>
  <li><strong>ตั้งค่า Worker path</strong>
    <pre><code>window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';</code></pre>
  </li>
  <li><strong>Render PDF เป็น Canvas</strong>
    <pre><code>const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
const pdf = await loadingTask.promise;
const page = await pdf.getPage(1); // หน้าแรก

// Scale 2.0 เพื่อความคมชัด (สำหรับ A4)
const viewport = page.getViewport({ scale: 2.0 });
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
canvas.width = viewport.width;
canvas.height = viewport.height;

await page.render({
  canvasContext: context,
  viewport: viewport
}).promise;

// แปลง canvas เป็น Data URL
const imageDataUrl = canvas.toDataURL('image/png');
setPdfImageUrl(imageDataUrl);</code></pre>
  </li>
  <li><strong>แสดงเป็น <code>&lt;img&gt;</code></strong>
    <pre><code>&lt;img 
  src={pdfImageUrl} 
  alt="PDF Background"
  style={{ width: '100%', height: 'auto', pointerEvents: 'none' }}
/&gt;</code></pre>
  </li>
</ol>

<h4>ตัวอย่างโค้ด React Component:</h4>

<pre><code>const [pdfImageUrl, setPdfImageUrl] = useState(null);
const [renderingPdf, setRenderingPdf] = useState(false);

useEffect(() => {
  if (!bgUrl || !bgUrl.endsWith('.pdf')) {
    setPdfImageUrl(null);
    return;
  }

  let active = true;
  setRenderingPdf(true);

  const renderPdf = async () => {
    try {
      // โหลด PDF.js script ถ้ายังไม่มี
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = window.pdfjsLib.getDocument(bgUrl);
      const pdf = await loadingTask.promise;
      if (!active) return;

      const pdfPage = await pdf.getPage(1);
      if (!active) return;

      const viewport = pdfPage.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await pdfPage.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      if (!active) return;

      const dataUrl = canvas.toDataURL('image/png');
      setPdfImageUrl(dataUrl);
    } catch (err) {
      console.error('Error rendering PDF background:', err);
    } finally {
      if (active) setRenderingPdf(false);
    }
  };

  renderPdf();

  return () => {
    active = false; // Cleanup เมื่อ unmount
  };
}, [bgUrl]);

// ในส่วน render
return (
  &lt;div className="canvas-container" style={{ position: 'relative' }}&gt;
    {renderingPdf && &lt;div&gt;กำลังโหลด PDF...&lt;/div&gt;}
    
    {/* แสดง PDF background เป็นรูป */}
    {pdfImageUrl && (
      &lt;img 
        src={pdfImageUrl} 
        alt="PDF Background"
        style={{ 
          width: '100%', 
          height: 'auto', 
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      /&gt;
    )}

    {/* แสดง PNG/JPG background โดยตรง */}
    {bgUrl && !bgUrl.endsWith('.pdf') && (
      &lt;img 
        src={bgUrl} 
        alt="Background"
        style={{ 
          width: '100%', 
          height: 'auto', 
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      /&gt;
    )}

    {/* Field overlays */}
    {fields.map(field => (
      &lt;div
        key={field.uid}
        style={{
          position: 'absolute',
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height,
          border: '1px dashed #2563EB',
          cursor: 'move'
        }}
        onMouseDown={(e) => handleDragStart(e, field)}
      &gt;
        {field.name || field.fieldId}
      &lt;/div&gt;
    ))}
  &lt;/div&gt;
);</code></pre>

<h4>ข้อดีของวิธีนี้:</h4>

<ul>
  <li>✅ ไม่มี PDF viewer controls (ไม่มี toolbar)</li>
  <li>✅ สามารถวาง overlay elements ได้อิสระ</li>
  <li>✅ ลาก resize field ได้อย่างราบรื่น</li>
  <li>✅ รองรับทั้ง PDF, PNG, JPG</li>
  <li>✅ แสดงผลคมชัด (scale 2.0)</li>
</ul>

<h4>ข้อควรระวัง:</h4>

<ul>
  <li>PDF.js ใช้ memory สูง หาก PDF มีหลายหน้า ควร render เฉพาะหน้าแรก</li>
  <li>Data URL ขนาดใหญ่อาจทำให้ component re-render ช้า ควรใช้ <code>useMemo</code> หรือ cache</li>
  <li>ควรมี loading indicator ขณะ render PDF</li>
  <li>ตรวจสอบ browser compatibility (PDF.js รองรับ modern browsers)</li>
</ul>

<h3>หน่วยพิกัด</h3>

<p>แนะนำให้ Canvas ใช้หน่วยเดียวกับ PDF point:</p>

<table>
  <thead>
    <tr>
      <th>Paper</th>
      <th>Portrait Size</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>A4</td>
      <td><code>595.28 x 841.89</code></td>
    </tr>
    <tr>
      <td>A5</td>
      <td><code>419.53 x 595.28</code></td>
    </tr>
    <tr>
      <td>Letter</td>
      <td><code>612 x 792</code></td>
    </tr>
    <tr>
      <td>Legal</td>
      <td><code>612 x 1008</code></td>
    </tr>
  </tbody>
</table>

<p>ถ้าเป็นแนวนอน ให้สลับ width/height</p>

<hr />

<h2>10. Preview, Print และ Download Flow</h2>

<ol>
  <li>ผู้ใช้เปิดหน้ารายละเอียด record เช่น ticket/order/license</li>
  <li>กดปุ่ม <strong>พิมพ์รายงาน</strong></li>
  <li>frontend เรียก <code>GET /api/records/:id/report-templates</code></li>
  <li>ถ้ามีหลาย template ให้ผู้ใช้เลือก template</li>
  <li>แสดง preview ด้วย iframe ที่ชี้ไปยัง <code>GET /api/records/:id/generate-report/:templateId</code></li>
  <li>ผู้ใช้ใช้ browser PDF toolbar เพื่อพิมพ์หรือดาวน์โหลด</li>
</ol>

<pre><code>&lt;iframe
  src={`/api/records/${recordId}/generate-report/${templateId}`}
  title="PDF Preview"
  className="w-full h-full border-0"
/&gt;</code></pre>

<hr />

<h2>11. Temporary File Flow สำหรับส่งเอกสาร</h2>

<p>ถ้าต้องส่งเอกสารผ่าน LINE, Email หรือ SMS link ให้สร้างไฟล์ PDF ชั่วคราวและคืน token</p>

<ol>
  <li>เรียก <code>generatePdf(record, template)</code></li>
  <li>สร้างชื่อไฟล์ด้วย UUID เช่น <code>uuid.pdf</code></li>
  <li>บันทึกไว้ที่ <code>/uploads/report-temp</code></li>
  <li>ส่งลิงก์ <code>/api/public/report-download/:token</code> ไปยังผู้รับ</li>
  <li>ตั้ง cron job ลบไฟล์ที่เกินอายุ เช่น 1 ชั่วโมง</li>
</ol>

<pre><code>const tempFileName = crypto.randomUUID() + '.pdf';
await fs.promises.writeFile(path.join(tempDir, tempFileName), pdfBytes);

const downloadUrl = `${process.env.PUBLIC_BASE_URL}/api/public/report-download/${tempFileName}`;</code></pre>

<h3>ข้อควรระวัง</h3>

<ul>
  <li>ตรวจ filename ว่าห้ามมี <code>/</code> หรือ <code>..</code></li>
  <li>ควรใช้ token ที่สุ่มเดายาก</li>
  <li>ควรกำหนดอายุไฟล์ชัดเจน เช่น 1 ชั่วโมง</li>
  <li>ถ้าเอกสารมีข้อมูลอ่อนไหวมาก ควรเพิ่ม signed token หรือ auth check แทน public filename</li>
</ul>

<hr />

<h2>12. Optional: แนบหน้าใบแจ้งยอดชำระเงิน</h2>

<p>ถ้า record มีข้อมูลค่าใช้จ่าย สามารถ append หน้าใหม่ท้าย PDF ได้อัตโนมัติ</p>

<pre><code>paymentInfo: {
  expenses: [
    { name: 'ค่าธรรมเนียม', quantity: 1, price: 100 }
  ],
  totalAmount: 100,
  bankAccount: 'ธนาคาร ...\nเลขบัญชี ...',
  qrCodePath: 'qrs/payment-qr.png',
  isConfigured: true
}</code></pre>

<p>หน้าแนบท้ายควรแสดง:</p>

<ul>
  <li>เลขอ้างอิง record</li>
  <li>ตารางรายการค่าใช้จ่าย</li>
  <li>ยอดรวม</li>
  <li>ข้อมูลบัญชีธนาคาร</li>
  <li>QR Code สำหรับชำระเงิน</li>
  <li>ข้อความหมายเหตุหรือคำแนะนำ</li>
</ul>

<hr />

<h2>13. Security Checklist</h2>

<ul>
  <li>ทุก endpoint จัดการ template ต้องมี auth และ role เช่น admin ขึ้นไป</li>
  <li>endpoint generate report ต้องตรวจสิทธิ์การเข้าถึง record นั้นก่อนเสมอ</li>
  <li>ห้ามส่งข้อมูล sensitive ที่ไม่ได้รับอนุญาตลง PDF เช่น national ID แบบเต็ม หาก policy ไม่อนุญาต</li>
  <li>ถ้าต้อง decrypt sensitive data เพื่อพิมพ์เอกสาร ต้องบันทึก audit log</li>
  <li>ตรวจ mimetype และขนาดไฟล์ทุก upload</li>
  <li>ใช้ UUID filename ทุกครั้ง</li>
  <li>ใช้ <code>path.resolve()</code> + prefix check ก่อนอ่าน/ลบไฟล์</li>
  <li>อย่าให้ public download อ่านไฟล์นอก temp folder ได้</li>
  <li>ตั้ง rate limit ให้ public download ถ้าเป็นเอกสารสำคัญ</li>
  <li>ตั้ง cron cleanup สำหรับไฟล์ชั่วคราว</li>
</ul>

<hr />

<h2>14. Implementation Checklist</h2>

<h3>Backend</h3>

<ul>
  <li><input type="checkbox" disabled /> สร้าง model <code>ReportTemplate</code></li>
  <li><input type="checkbox" disabled /> สร้าง CRUD API สำหรับ report templates</li>
  <li><input type="checkbox" disabled /> สร้าง upload endpoint สำหรับ background file</li>
  <li><input type="checkbox" disabled /> สร้าง delete endpoint สำหรับ template/page/background</li>
  <li><input type="checkbox" disabled /> สร้าง utility <code>generatePdf(record, template)</code></li>
  <li><input type="checkbox" disabled /> ฝังฟอนต์ภาษาไทย เช่น Sarabun หรือ TH Sarabun New</li>
  <li><input type="checkbox" disabled /> สร้าง endpoint stream PDF แบบ on-the-fly</li>
  <li><input type="checkbox" disabled /> สร้าง temp file download endpoint</li>
  <li><input type="checkbox" disabled /> สร้าง cron job cleanup temp files</li>
  <li><input type="checkbox" disabled /> เพิ่ม audit log สำหรับ action สำคัญ</li>
</ul>

<h3>Frontend</h3>

<ul>
  <li><input type="checkbox" disabled /> สร้างหน้า Report Manager</li>
  <li><input type="checkbox" disabled /> สร้างหน้า Report Designer</li>
  <li><input type="checkbox" disabled /> สร้าง Field Sidebar</li>
  <li><input type="checkbox" disabled /> สร้าง Canvas Area พร้อม background preview</li>
  <li><input type="checkbox" disabled /> ⭐ <strong>Implement PDF.js rendering สำหรับ PDF background</strong> — แปลงเป็นรูปภาพแทน iframe</li>
  <li><input type="checkbox" disabled /> สร้าง Properties Panel</li>
  <li><input type="checkbox" disabled /> รองรับ drag, resize, select, remove field</li>
  <li><input type="checkbox" disabled /> รองรับหลายหน้า</li>
  <li><input type="checkbox" disabled /> รองรับ preview PDF ใน iframe (สำหรับหน้าดูรายงานเท่านั้น)</li>
  <li><input type="checkbox" disabled /> เพิ่มปุ่ม print/download ในหน้ารายละเอียด record</li>
</ul>

<h3>Testing</h3>

<ul>
  <li><input type="checkbox" disabled /> สร้าง template ใหม่และบันทึกได้</li>
  <li><input type="checkbox" disabled /> อัปโหลด PDF background ได้</li>
  <li><input type="checkbox" disabled /> อัปโหลด PNG/JPG background ได้</li>
  <li><input type="checkbox" disabled /> ลาก field แล้วพิกัดที่พิมพ์ตรงกับ preview</li>
  <li><input type="checkbox" disabled /> ฟอนต์ไทยแสดงถูกต้องใน PDF</li>
  <li><input type="checkbox" disabled /> รายงานหลายหน้าสร้างได้ครบ</li>
  <li><input type="checkbox" disabled /> active template ถูกแสดงในหน้าพิมพ์เท่านั้น</li>
  <li><input type="checkbox" disabled /> public download หมดอายุแล้วแสดง 410 หรือ error ที่เหมาะสม</li>
</ul>

<hr />

<h2>16. Performance & Optimization Tips</h2>

<h3>Frontend Designer</h3>

<ul>
  <li><strong>ใช้ Blob URL แทน Data URL:</strong> สำหรับ PDF background ขนาดใหญ่
    <pre><code>// แทน canvas.toDataURL('image/png')
canvas.toBlob((blob) => {
  const url = URL.createObjectURL(blob);
  setPdfImageUrl(url);
  
  // Cleanup เมื่อไม่ใช้แล้ว
  return () => URL.revokeObjectURL(url);
}, 'image/png');</code></pre>
  </li>
  <li><strong>Lazy load PDF.js script:</strong> โหลดเฉพาะเมื่อต้องการ render PDF
    <pre><code>const loadPdfJs = async () => {
  if (window.pdfjsLib) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};</code></pre>
  </li>
  <li><strong>Debounce การบันทึก:</strong> ไม่ควร save ทุกครั้งที่ลาก field → ใช้ debounce 500ms</li>
  <li><strong>Virtual scrolling:</strong> ถ้ามี field เยอะ (>100 fields) ควรใช้ react-window หรือ react-virtualized</li>
  <li><strong>Memoize background image:</strong>
    <pre><code>const bgImage = useMemo(() => {
  if (!bgUrl) return null;
  return &lt;img src={bgUrl} ... /&gt;;
}, [bgUrl]);</code></pre>
  </li>
</ul>

<h3>Backend PDF Generation</h3>

<ul>
  <li><strong>Cache embedded fonts:</strong> โหลดฟอนต์ครั้งเดียวแล้วเก็บไว้ใน module-level cache
    <pre><code>let cachedFont = null;

async function getThaiFont(pdfDoc) {
  if (!cachedFont) {
    const fontBytes = await fs.readFile('path/to/THSarabunNew.ttf');
    cachedFont = fontBytes;
  }
  return await pdfDoc.embedFont(cachedFont);
}</code></pre>
  </li>
  <li><strong>Stream PDF แทนบันทึกไฟล์:</strong> สำหรับ preview/download ที่ไม่ต้องการเก็บถาวร
    <pre><code>const pdfBytes = await generatePdf(record, template);
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `inline; filename="${ticketNo}.pdf"`);
res.send(Buffer.from(pdfBytes));</code></pre>
  </li>
  <li><strong>Background worker สำหรับ bulk generation:</strong> ถ้าต้องสร้าง PDF เยอะๆ ควรใช้ queue (Bull/BullMQ)</li>
  <li><strong>Compress PDF:</strong> ใช้ pdf-lib option <code>{ compress: true }</code> เมื่อ save</li>
</ul>

<h3>File Storage</h3>

<ul>
  <li><strong>CDN:</strong> เก็บ background files ใน CDN แทน local disk (Cloudflare R2, AWS S3)</li>
  <li><strong>Image optimization:</strong> compress PNG/JPG ก่อน upload ด้วย sharp หรือ imagemin</li>
  <li><strong>Cleanup job:</strong> ลบ temp files ทุก 1 ชั่วโมง + ลบ background files ที่ orphaned</li>
</ul>

<hr />

<h2>17. Suggested Folder Structure</h2>

<pre><code>backend/
  models/
    ReportTemplate.js
  routes/
    admin/
      reportTemplates.js
    records.js
    public.js
  utils/
    reportGenerator.js
  jobs/
    tempCleanup.js
  assets/
    fonts/
      THSarabunNew.ttf
  uploads/
    report-backgrounds/
    report-temp/

frontend/
  src/
    pages/
      admin/
        ReportManagerPage.jsx
        ReportDesignerPage.jsx
        RecordDetailPage.jsx
    components/
      report/
        CanvasArea.jsx
        FieldSidebar.jsx
        PropertiesPanel.jsx</code></pre>

<hr />

<h2>18. Minimum Viable Version</h2>

<p>ถ้าต้องการทำเวอร์ชันแรกให้เร็วที่สุด ให้ทำเฉพาะสิ่งเหล่านี้ก่อน:</p>

<ol>
  <li>สร้าง <code>ReportTemplate</code> model</li>
  <li>ทำ CRUD template เฉพาะ create/read/update</li>
  <li>อัปโหลด background ได้ 1 หน้า (รองรับ PNG/JPG ก่อน PDF มาทีหลัง)</li>
  <li>Designer ลาก field ได้เฉพาะ text field</li>
  <li>⭐ <strong>Implement PDF.js rendering</strong> สำหรับ PDF background</li>
  <li>Generator วาดข้อความทับ background ได้</li>
  <li>Preview PDF ผ่าน iframe ได้</li>
</ol>

<p>หลังจากนั้นค่อยเพิ่ม multi-page, delete cleanup, send link, payment appendix, audit log และ advanced field types</p>

<hr />

<h2>19. Common Pitfalls</h2>

<ul>
  <li><strong>PDF background แสดง viewer controls:</strong> เกิดจากใช้ <code>&lt;iframe&gt;</code> หรือ <code>&lt;embed&gt;</code> โดยตรง → ต้องใช้ PDF.js แปลงเป็นรูปภาพก่อน (ดูส่วนที่ 9)</li>
  <li><strong>พิกัด Y ไม่ตรง:</strong> มักเกิดจากลืมแปลงแกน Y ระหว่าง frontend กับ PDF (<code>pdfY = pageHeight - field.y - fontSize</code>)</li>
  <li><strong>ภาษาไทยเป็นกล่อง:</strong> ต้อง embed font ภาษาไทยใน PDF เสมอ (<code>pdfDoc.embedFont(thFontBytes)</code>)</li>
  <li><strong>field ไม่ออก:</strong> ตรวจว่า <code>fieldId</code> ใน template ตรงกับ key ใน record จริง</li>
  <li><strong>PDF background ขนาดเพี้ยน:</strong> ควรใช้ขนาด page จาก background จริง หรือ normalize ให้ตรงกับ Canvas</li>
  <li><strong>ไฟล์ขยะสะสม:</strong> ต้องลบ background เก่าและมี temp cleanup job</li>
  <li><strong>ข้อมูล sensitive รั่ว:</strong> ต้องมี policy ว่า field ใดพิมพ์ได้ และต้องตรวจ role ก่อน generate</li>
  <li><strong>ปุ่มลบหน้าแล้วเลขหน้าเพี้ยน:</strong> หลังลบหน้าควรเรียง <code>pageNo</code> ใหม่เสมอ</li>
  <li><strong>PDF.js render ช้า:</strong> ถ้า PDF มีหลายหน้า ควร render เฉพาะหน้าแรกหรือใช้ Web Worker</li>
  <li><strong>Memory leak จาก Data URL:</strong> ควรใช้ <code>URL.createObjectURL(blob)</code> แทน <code>toDataURL()</code> สำหรับไฟล์ขนาดใหญ่ และ <code>URL.revokeObjectURL()</code> เมื่อไม่ใช้แล้ว</li>
</ul>

<hr />

<h2>20. Recommended Acceptance Criteria</h2>

<ul>
  <li>Admin สามารถสร้าง template และผูกกับ form/module ได้</li>
  <li>Admin สามารถอัปโหลด background (PDF/PNG/JPG) และจัดตำแหน่ง field ได้</li>
  <li>⭐ <strong>PDF background แสดงเป็นรูปภาพใน Designer</strong> ไม่มี PDF viewer controls</li>
  <li>ระบบบันทึกพิกัด field แล้วกลับมาแก้ไขต่อได้</li>
  <li>ผู้ใช้งานที่มีสิทธิ์สามารถ preview PDF จาก record จริงได้</li>
  <li>PDF ที่สร้างมีข้อมูลตรงกับ record และพิกัดตรงกับ template</li>
  <li>PDF แสดงภาษาไทยถูกต้อง</li>
  <li>ระบบไม่เปิดเผย record ที่ผู้ใช้ไม่มีสิทธิ์เข้าถึง</li>
  <li>ไฟล์ upload และ temp file ถูกจัดการอย่างปลอดภัย</li>
  <li>Field ลากวางได้ราบรื่นบน canvas โดยไม่มีสิ่งกีดขวาง</li>
</ul>
