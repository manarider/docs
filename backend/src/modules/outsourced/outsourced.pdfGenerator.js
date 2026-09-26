const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { isSafeOutsourcedPath } = require('./outsourced.fileHelper');

const PAGE_SIZE = [595.28, 841.89]; // A4 portrait, points
const MARGIN = 50;
const LINE_HEIGHT = 22;
const FONT_SIZE = 14;
const TITLE_SIZE = 20;

async function embedImageFromFile(pdfDoc, filePath) {
    const buffer = await fs.readFile(filePath);
    try {
        return await pdfDoc.embedJpg(buffer);
    } catch {
        return await pdfDoc.embedPng(buffer);
    }
}

/**
 * สร้าง PDF แบบอัตโนมัติ (label: value เรียงเป็นบรรทัด) จากรายงาน Outsourced
 * @param {Object} report - OutsourcedReport (plain object)
 * @param {Object} form - OutsourcedReportForm (plain object)
 * @param {Object} group - OutsourcedGroup (plain object)
 * @returns {Promise<Buffer>}
 */
async function generateOutsourcedReportPdf(report, form, group) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(__dirname, '../../assets/fonts/THSarabunNew.ttf');
    let font;
    try {
        const fontBytes = await fs.readFile(fontPath);
        font = await pdfDoc.embedFont(fontBytes);
    } catch (err) {
        logger.warn('[Outsourced PDF] Cannot load Thai font, using Helvetica:', err.message);
        font = await pdfDoc.embedFont('Helvetica');
    }

    let page = pdfDoc.addPage(PAGE_SIZE);
    let y = PAGE_SIZE[1] - MARGIN;

    const drawLine = (text, size = FONT_SIZE, color = rgb(0, 0, 0)) => {
        if (y < MARGIN + LINE_HEIGHT) {
            page = pdfDoc.addPage(PAGE_SIZE);
            y = PAGE_SIZE[1] - MARGIN;
        }
        page.drawText(String(text), { x: MARGIN, y, size, font, color });
        y -= size + 8;
    };

    const drawTable = (field, rows) => {
        const columns = field.tableColumns || [];
        if (!columns.length) return;
        const usableWidth = PAGE_SIZE[0] - MARGIN * 2;
        const colWidth = usableWidth / columns.length;
        const rowHeight = 24;
        const drawRow = (values, header = false) => {
            if (y < MARGIN + rowHeight) {
                page = pdfDoc.addPage(PAGE_SIZE);
                y = PAGE_SIZE[1] - MARGIN;
            }
            columns.forEach((column, index) => {
                const x = MARGIN + index * colWidth;
                page.drawRectangle({ x, y: y - 5, width: colWidth, height: rowHeight, borderColor: rgb(0.65, 0.65, 0.65), borderWidth: 0.5, color: header ? rgb(0.94, 0.94, 0.94) : undefined });
                const text = String(values[index] ?? '').slice(0, 45);
                page.drawText(text, { x: x + 4, y: y + 2, size: 11, font, maxWidth: colWidth - 8 });
            });
            y -= rowHeight;
        };
        drawRow(columns.map((column) => column.label), true);
        for (const row of rows) drawRow(columns.map((column) => row[column.columnId] ?? ''));
        y -= 12;
    };

    const drawFields = (fields, values, depth = 0) => {
        for (const field of fields || []) {
            if (field.type === 'image') continue;
            const value = values[field.fieldId];
            if (field.type === 'table') {
                if (Array.isArray(value) && value.length) {
                    drawLine(`${'  '.repeat(depth)}${field.label}:`, FONT_SIZE);
                    drawTable(field, value);
                }
                continue;
            }
            const formatted = formatFieldValue(field, value);
            if (formatted !== undefined && formatted !== null && formatted !== '') drawLine(`${'  '.repeat(depth)}${field.label}: ${formatted}`, FONT_SIZE);
            if (field.type === 'radio') {
                const option = (field.radioOptions || []).find((candidate) => candidate.value === value);
                let children = option?.fields || [];
                if (!children.length) {
                    const legacy = field.radioSubFields?.get ? field.radioSubFields.get(value) : field.radioSubFields?.[value];
                    if (legacy) children = [legacy];
                }
                drawFields(children, values, depth + 1);
            }
        }
    };

    drawLine(`รายงานการปฏิบัติงาน — ${group?.name || ''}`, TITLE_SIZE);
    drawLine(`ฟอร์ม: ${form?.name || ''}`, FONT_SIZE);
    drawLine(`วันที่/เวลา: ${report.report_date ? new Date(report.report_date).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) : ''}`, FONT_SIZE);
    drawLine(`ผู้บันทึก: ${report.submitted_by_username || ''}`, FONT_SIZE);
    y -= 10;

    /**
     * แปลงค่าตามชนิดฟิลด์ให้เป็นข้อความอ่านง่าย
     */
    function formatFieldValue(field, val) {
        if (field.type === 'checkbox') return Array.isArray(val) ? val.join(', ') : '';
        if (field.type === 'location') {
            return (val && typeof val.lat === 'number' && typeof val.lng === 'number')
                ? `${val.lat.toFixed(6)}, ${val.lng.toFixed(6)}`
                : '';
        }
        return val;
    }

    const values = report.values || {};
    drawFields(form?.fields, values);

    // วาดรูปภาพของฟิลด์ type: image (ถ้ามี) เรียงเป็นแกลเลอรีต่อท้าย
    const photosMap = report.photos || {};
    const imageFields = [];
    const collectImageFields = (fields, currentValues) => {
        for (const field of fields || []) {
            if (field.type === 'image') imageFields.push(field);
            if (field.type === 'radio') {
                const selected = currentValues[field.fieldId];
                const option = (field.radioOptions || []).find((candidate) => candidate.value === selected);
                if (option) collectImageFields(option.fields, currentValues);
            }
        }
    };
    collectImageFields(form?.fields, values);
    for (const field of imageFields) {
        if (field.type !== 'image') continue;
        const metas = photosMap[field.fieldId] || [];
        if (metas.length === 0) continue;

        if (y < MARGIN + 160) {
            page = pdfDoc.addPage(PAGE_SIZE);
            y = PAGE_SIZE[1] - MARGIN;
        }
        drawLine(`${field.label}:`, FONT_SIZE);

        const imgW = 150;
        const imgH = 110;
        const gap = 10;
        const perRow = Math.floor((PAGE_SIZE[0] - MARGIN * 2) / (imgW + gap));
        let col = 0;
        let rowTopY = y;

        for (const meta of metas) {
            if (!meta?.file_path || !isSafeOutsourcedPath(meta.file_path)) continue;
            let embedded;
            try {
                embedded = await embedImageFromFile(pdfDoc, meta.file_path);
            } catch (err) {
                logger.warn(`[Outsourced PDF] Cannot embed image ${meta.file_path}: ${err.message}`);
                continue;
            }

            if (rowTopY - imgH < MARGIN) {
                page = pdfDoc.addPage(PAGE_SIZE);
                rowTopY = PAGE_SIZE[1] - MARGIN;
                y = rowTopY;
                col = 0;
            }

            const scale = Math.min(imgW / embedded.width, imgH / embedded.height, 1);
            const drawW = embedded.width * scale;
            const drawH = embedded.height * scale;
            const x = MARGIN + col * (imgW + gap);
            page.drawImage(embedded, { x, y: rowTopY - imgH, width: drawW, height: drawH });

            col++;
            if (col >= perRow) {
                col = 0;
                rowTopY -= imgH + gap;
            }
        }
        y = rowTopY - imgH - gap;
    }

    return pdfDoc.save();
}

module.exports = { generateOutsourcedReportPdf };
