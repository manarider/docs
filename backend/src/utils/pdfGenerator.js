const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * PDF Generator Utility
 * สร้าง PDF จาก template + record data
 */

// ค่าคงที่สำหรับขนาดกระดาษ (points)
const PAPER_SIZES = {
  A4: { portrait: [595.28, 841.89], landscape: [841.89, 595.28] },
  A5: { portrait: [419.53, 595.28], landscape: [595.28, 419.53] },
  Letter: { portrait: [612, 792], landscape: [792, 612] },
  Legal: { portrait: [612, 1008], landscape: [1008, 612] },
};

/**
 * แปลง hex color เป็น RGB object
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return rgb(0, 0, 0);
  return rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  );
}

/**
 * คำนวณ x position สำหรับ text alignment
 */
function calculateAlignedX(font, text, field, fontSize) {
  const textWidth = font.widthOfTextAtSize(String(text), fontSize);
  switch (field.textAlign) {
    case 'center':
      return field.x + (field.width - textWidth) / 2;
    case 'right':
      return field.x + field.width - textWidth;
    default:
      return field.x;
  }
}

/**
 * สร้าง PDF page พร้อม background
 */
async function createPageWithBackground(pdfDoc, pageTemplate, font, storageBase) {
  const size = PAPER_SIZES[pageTemplate.paperSize || 'A4'][pageTemplate.orientation || 'portrait'];
  const page = pdfDoc.addPage(size);

  // โหลด background ถ้ามี
  if (pageTemplate.backgroundFile) {
    const bgPath = path.join(storageBase, '_report_backgrounds', pageTemplate.backgroundFile);
    try {
      const bgBuffer = await fs.readFile(bgPath);
      const ext = path.extname(pageTemplate.backgroundFile).toLowerCase();

      if (ext === '.pdf') {
        // Embed PDF page
        const bgPdf = await PDFDocument.load(bgBuffer);
        const [embeddedPage] = await pdfDoc.embedPages([bgPdf.getPages()[0]]);
        page.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
      } else if (ext === '.png') {
        const bgImage = await pdfDoc.embedPng(bgBuffer);
        page.drawImage(bgImage, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
      } else if (ext === '.jpg' || ext === '.jpeg') {
        const bgImage = await pdfDoc.embedJpg(bgBuffer);
        page.drawImage(bgImage, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
      }
    } catch (err) {
      logger.warn('[PDF Generator] Cannot load background:', err.message);
      // fallback: ใช้หน้าว่าง
    }
  }

  return page;
}

/**
 * ดึงค่าจาก record ตาม fieldId
 */
function getFieldValue(record, fieldId, module) {
  // System fields
  if (fieldId.startsWith('_project.')) {
    const key = fieldId.replace('_project.', '');
    if (key === 'title') return record.project?.title || '';
    if (key === 'department') return record.project?.dept_id?.name || '';
    if (key === 'fiscalYear') return record.project?.fiscal_year || '';
    if (key === 'supervisor') return record.project?.supervisor || '';
    if (key === 'committeeChairman') return record.project?.committee_chairman || '';
    if (key === 'committeeMember1') return record.project?.committee_member_1 || '';
    if (key === 'committeeMember2') return record.project?.committee_member_2 || '';
    if (key === 'location') return record.project?.location || '';
    if (key === 'district') return record.project?.district || '';
    if (key === 'province') return record.project?.province || '';
    if (key === 'phone') return record.project?.phone || '';
    if (key === 'workVolume') return record.project?.work_volume || '';
    if (key === 'quantity') return record.project?.quantity || '';
    if (key === 'contractNo') return record.project?.contract_no || '';
    if (key === 'contractDate') return record.project?.contract_date || '';
    if (key === 'contractMonth') return record.project?.contract_month || '';
    if (key === 'contractYear') return record.project?.contract_year || '';
    if (key === 'startDate') return record.project?.start_date || '';
    if (key === 'endDate') return record.project?.end_date || '';
    if (key === 'budget') return record.project?.budget || '';
    if (key === 'contractor') return record.project?.contractor || '';
    if (key === 'duration') return record.project?.duration || '';
  }

  // Module-specific fields
  if (module === 'daily_report') {
    if (fieldId === 'report.reportDate') {
      return record.report_date
        ? new Date(record.report_date).toLocaleDateString('th-TH', { dateStyle: 'long' })
        : '';
    }
    if (fieldId === 'report.position') return record.position || '';
    if (fieldId === 'report.morningDescription') return record.morning_description || '';
    if (fieldId === 'report.afternoonDescription') return record.afternoon_description || '';
    if (fieldId === 'report.workDescription') return record.work_description || '';
    if (fieldId === 'report.submittedRole') return record.submitted_role || '';
    if (fieldId === 'report.photoCount') return record.photos?.length || 0;
    if (fieldId === 'report.equipmentCount') return record.equipment_items?.length || 0;
    if (fieldId === 'report.weather') return record.weather || 'ท้องฟ้าแจ่มใส';
    if (fieldId === 'report.obstacles') return record.obstacles || '---';
    if (fieldId === 'report.otherInstructions') return record.other_instructions || '---';
    if (fieldId === 'report.engineerCount') return record.engineer_count || 0;
    if (fieldId === 'report.foremanCount') return record.foreman_count || 0;
    if (fieldId === 'report.laborerCount') return record.laborer_count || 0;
  }

  if (module === 'procurement') {
    if (fieldId === 'procurement.receiveDate') {
      return record.receive_date
        ? new Date(record.receive_date).toLocaleDateString('th-TH', { dateStyle: 'long' })
        : '';
    }
    if (fieldId === 'procurement.itemType') {
      const types = { equipment: 'ครุภัณฑ์', material: 'วัสดุ', other: 'อื่นๆ' };
      return types[record.item_type] || record.item_type || '';
    }
    if (fieldId === 'procurement.description') return record.description || '';
    if (fieldId === 'procurement.quantity') return record.quantity || 0;
    const issued = (record.issued_items || []).reduce((sum, i) => sum + i.quantity, 0);
    if (fieldId === 'procurement.issuedQuantity') return issued;
    if (fieldId === 'procurement.remainingQuantity') return (record.quantity || 0) - issued;
    if (fieldId === 'procurement.serialCount') return record.equipment_serial_list?.length || 0;
  }

  if (module === 'acceptance') {
    if (fieldId === 'acceptance.createdAt') {
      return record.createdAt
        ? new Date(record.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })
        : '';
    }
    if (fieldId === 'acceptance.notes') return record.notes || '';
    if (fieldId === 'acceptance.acceptedRole') return record.accepted_role || '';
    if (fieldId === 'acceptance.deliveryDocTitle') return record.delivery_doc_title || '';
    if (fieldId === 'acceptance.photoCount') return record.inspection_photos?.length || 0;
  }

  return '';
}

/**
 * สร้าง PDF จาก template และ record
 * @param {Object} record - ข้อมูล record (daily report / procurement / acceptance)
 * @param {Object} template - ReportTemplate document
 * @param {Object} project - Project document (optional)
 * @param {string} storageBase - path ไปยัง storage folder
 * @returns {Promise<Buffer>} PDF bytes
 */
async function generatePdf(record, template, project, storageBase) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // โหลดฟอนต์ไทย (ตัวอย่างใช้ THSarabunNew — ต้องมีไฟล์ .ttf ใน assets)
  const fontPath = path.join(__dirname, '../assets/fonts/THSarabunNew.ttf');
  let thaiFont;
  try {
    const fontBytes = await fs.readFile(fontPath);
    thaiFont = await pdfDoc.embedFont(fontBytes);
  } catch (err) {
    logger.warn('[PDF Generator] Cannot load Thai font, using Helvetica:', err.message);
    thaiFont = await pdfDoc.embedFont('Helvetica');
  }

  // เตรียม context สำหรับ field resolver
  const plainRecord = (record && typeof record.toObject === 'function') ? record.toObject() : record;
  const plainProject = (project && typeof project.toObject === 'function') ? project.toObject() : project;
  const context = {
    ...plainRecord,
    project: plainProject,
  };

  // สร้างแต่ละหน้า
  for (const pageTemplate of template.pages) {
    const page = await createPageWithBackground(pdfDoc, pageTemplate, thaiFont, storageBase);
    const pageHeight = page.getHeight();

    // วาง field ทั้งหมด
    for (const field of pageTemplate.fields) {
      const text = field.fieldId === 'static_text'
        ? (field.customText || '')
        : getFieldValue(context, field.fieldId, template.module);
      if (!text && text !== 0) continue;

      const fontSize = field.fontSize || 16;
      const pdfY = pageHeight - field.y - fontSize; // แปลง y จาก top → bottom
      const x = calculateAlignedX(thaiFont, text, field, fontSize);

      page.drawText(String(text), {
        x,
        y: pdfY,
        size: fontSize,
        font: thaiFont,
        color: hexToRgb(field.color || '#000000'),
      });
    }
  }

  return await pdfDoc.save();
}

module.exports = {
  generatePdf,
};
