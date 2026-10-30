const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { isSafeOutsourcedPath } = require('./outsourced.fileHelper');

const PAGE_SIZE = [595.28, 841.89]; // A4 portrait, points
const MARGIN = 50;
const LINE_HEIGHT = 22;
const FONT_SIZE = 15.5;
const CONTENT_BOTTOM = 78;
const CONTENT_TOP = PAGE_SIZE[1] - MARGIN - 95;
const HEADER_TITLE = 'รายงานการส่งมอบงานประจำวัน (Daily Report)';
const FOOTER_TEXT = 'รายงานพิมพ์จากระบบบันทึกการปฏิบัติงานของเจ้าหน้าที่จ้างเหมาบริการ เทศบาลนครนครสวรรค์';
const BLUE = rgb(0.06, 0.36, 0.72);

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
 * @param {Object} [profile] - OutsourcedUserProfile ของผู้ส่งมอบงาน (plain object) — ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง
 * @returns {Promise<Buffer>}
 */
async function generateOutsourcedReportPdf(report, form, group, profile) {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontsDir = path.join(__dirname, '../../assets/fonts');
    let font;
    let boldFont;
    try {
        const [regularBytes, boldBytes] = await Promise.all([
            fs.readFile(path.join(fontsDir, 'THSarabunPSK.ttf')),
            fs.readFile(path.join(fontsDir, 'THSarabunPSK-Bold.ttf')),
        ]);
        font = await pdfDoc.embedFont(regularBytes);
        boldFont = await pdfDoc.embedFont(boldBytes);
    } catch (err) {
        logger.warn('[Outsourced PDF] Cannot load Thai font, using Helvetica:', err.message);
        font = await pdfDoc.embedFont('Helvetica');
        boldFont = await pdfDoc.embedFont('Helvetica-Bold');
    }

    let page = pdfDoc.addPage(PAGE_SIZE);
    let y = CONTENT_TOP;

    const addPage = () => {
        page = pdfDoc.addPage(PAGE_SIZE);
        y = CONTENT_TOP;
    };

    const fontFor = (bold) => (bold ? boldFont : font);

    const drawText = (text, options, bold = false) => {
        page.drawText(text, { ...options, font: fontFor(bold) });
    };

    const wrapText = (text, maxWidth, size, bold = false) => {
        const measureFont = fontFor(bold);
        return String(text).split('\n').flatMap((paragraph) => {
            const lines = [];
            let line = '';
            for (const { segment } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(paragraph)) {
                if (line && measureFont.widthOfTextAtSize(line + segment, size) > maxWidth) {
                    lines.push(line);
                    line = '';
                }
                line += segment;
            }
            lines.push(line);
            return lines;
        });
    };

    const drawLine = (text, size = FONT_SIZE, color = rgb(0, 0, 0), bold = false) => {
        for (const line of wrapText(text, PAGE_SIZE[0] - 2 * MARGIN, size, bold)) {
            if (y < CONTENT_BOTTOM + LINE_HEIGHT) addPage();
            if (line) drawText(line, { x: MARGIN, y, size, color }, bold);
            y -= size + 8;
        }
    };

    const drawTable = (field, rows) => {
        const columns = field.tableColumns || [];
        if (!columns.length) return;
        const usableWidth = PAGE_SIZE[0] - MARGIN * 2;
        const colWidth = usableWidth / columns.length;
        const rowHeight = 24;
        const drawRow = (values, header = false) => {
            if (y < CONTENT_BOTTOM + rowHeight) addPage();
            columns.forEach((column, index) => {
                const x = MARGIN + index * colWidth;
                page.drawRectangle({ x, y: y - 5, width: colWidth, height: rowHeight, borderColor: rgb(0.65, 0.65, 0.65), borderWidth: 0.5, color: header ? rgb(0.94, 0.94, 0.94) : undefined });
                const text = String(values[index] ?? '').slice(0, 45);
                drawText(text, { x: x + 4, y: y + 2, size: FONT_SIZE, color: header ? rgb(0, 0, 0) : BLUE }, header);
            });
            y -= rowHeight;
        };
        drawRow(columns.map((column) => column.label), true);
        for (const row of rows) drawRow(columns.map((column) => row[column.columnId] ?? ''));
        y -= 28;
    };

    const selectedChildren = (field, value) => {
        const option = (field.radioOptions || []).find((candidate) => candidate.value === value);
        if (option?.fields?.length) return option.fields;
        const legacy = field.radioSubFields?.get ? field.radioSubFields.get(value) : field.radioSubFields?.[value];
        return legacy ? [legacy] : [];
    };

    const drawSubformTable = (fields, values) => {
        const rows = [];
        const nestedTables = [];
        const collectRows = (items) => {
            for (const field of items) {
                if (field.type === 'image') continue;
                const value = values[field.fieldId];
                if (field.type === 'table') {
                    if (Array.isArray(value) && value.length) nestedTables.push({ field, value });
                    continue;
                }
                const formatted = formatFieldValue(field, value);
                if (formatted !== undefined && formatted !== null && formatted !== '') rows.push([field.label, formatted]);
                if (field.type === 'radio') collectRows(selectedChildren(field, value));
            }
        };
        collectRows(fields);

        for (let offset = 0; offset < rows.length; offset += 4) {
            const columns = rows.slice(offset, offset + 4);
            const width = (PAGE_SIZE[0] - 2 * MARGIN) / columns.length;
            const lineStep = FONT_SIZE + 4;
            const headers = columns.map(([label]) => wrapText(label, width - 16, FONT_SIZE, true));
            const answers = columns.map(([, value]) => wrapText(value, width - 16, FONT_SIZE));
            const headerHeight = Math.max(...headers.map((lines) => lines.length)) * lineStep + 12;
            const drawRow = (cells, height, header = false) => {
                cells.forEach((lines, index) => {
                    const x = MARGIN + index * width;
                    page.drawRectangle({ x, y: y - height, width, height, borderColor: rgb(0.72, 0.77, 0.82), borderWidth: 0.6, color: header ? rgb(0.94, 0.96, 0.98) : undefined });
                    lines.forEach((line, lineIndex) => {
                        drawText(line, { x: x + 8, y: y - lineStep - lineIndex * lineStep, size: FONT_SIZE, color: header ? rgb(0, 0, 0) : BLUE }, header);
                    });
                });
                y -= height;
            };
            if (y < CONTENT_BOTTOM + headerHeight + 30) addPage();
            drawRow(headers, headerHeight, true);
            while (answers.some((lines) => lines.length)) {
                if (y < CONTENT_BOTTOM + 30) {
                    addPage();
                    drawRow(headers, headerHeight, true);
                }
                const count = Math.min(Math.floor((y - CONTENT_BOTTOM - 12) / lineStep), Math.max(...answers.map((lines) => lines.length)));
                drawRow(answers.map((lines) => lines.splice(0, count)), count * lineStep + 12);
            }
            y -= 12;
        }

        for (const { field, value } of nestedTables) {
            drawLine(`${field.label}:`, FONT_SIZE, rgb(0, 0, 0), true);
            drawTable(field, value);
        }
    };

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

    // วาดบรรทัดเดียวที่มีทั้งข้อความคงที่ (ปรกติ) และข้อมูลที่ดึงจากระบบ (ตัวหนา) ปนกัน พร้อมตัดบรรทัดอัตโนมัติ
    const drawRichLine = (x, startY, maxWidth, segments, size = FONT_SIZE) => {
        const fullText = segments.map((segment) => segment.text).join('');

        // กรณีปรกติ — ข้อความทั้งบรรทัดพอดีกับความกว้าง วาดทีละ segment เป็นคำเต็ม (ค้นหา/ทดสอบข้อความได้ตรงไปตรงมา)
        if (font.widthOfTextAtSize(fullText, size) <= maxWidth) {
            let xx = x;
            for (const segment of segments) {
                if (!segment.text) continue;
                drawText(segment.text, { x: xx, y: startY, size, color: rgb(0, 0, 0) }, !!segment.value);
                xx += fontFor(!!segment.value).widthOfTextAtSize(segment.text, size);
            }
            return 1;
        }

        // ข้อความยาวเกินบรรทัดเดียว — ตัดบรรทัดแบบอักขระต่ออักขระเพื่อคงความหนาของแต่ละส่วนไว้
        const lines = wrapText(fullText, maxWidth, size);
        const chars = [];
        for (const segment of segments) {
            for (const ch of segment.text) chars.push({ ch, bold: !!segment.value });
        }
        let idx = 0;
        lines.forEach((line, lineIndex) => {
            let xx = x;
            const yy = startY - lineIndex * (size + 8);
            for (const ch of line) {
                const info = chars[idx];
                idx += 1;
                if (!info) continue;
                drawText(info.ch, { x: xx, y: yy, size, color: rgb(0, 0, 0) }, info.bold);
                xx += fontFor(info.bold).widthOfTextAtSize(info.ch, size);
            }
        });
        return lines.length;
    };

    const drawInfoLine = (segments, size = FONT_SIZE) => {
        const maxWidth = PAGE_SIZE[0] - 2 * MARGIN;
        const lineCount = wrapText(segments.map((segment) => segment.text).join(''), maxWidth, size).length || 1;
        if (y < CONTENT_BOTTOM + lineCount * (size + 8)) addPage();
        drawRichLine(MARGIN, y, maxWidth, segments, size);
        y -= lineCount * (size + 8);
    };

    const COL_GAP = 24;
    const COL_WIDTH = (PAGE_SIZE[0] - 2 * MARGIN - COL_GAP) / 2;
    const drawInfoRow = (leftSegments, rightSegments, size = FONT_SIZE) => {
        const leftCount = wrapText(leftSegments.map((segment) => segment.text).join(''), COL_WIDTH, size).length || 1;
        const rightCount = wrapText(rightSegments.map((segment) => segment.text).join(''), COL_WIDTH, size).length || 1;
        const lineCount = Math.max(leftCount, rightCount);
        if (y < CONTENT_BOTTOM + lineCount * (size + 8)) addPage();
        drawRichLine(MARGIN, y, COL_WIDTH, leftSegments, size);
        drawRichLine(MARGIN + COL_WIDTH + COL_GAP, y, COL_WIDTH, rightSegments, size);
        y -= lineCount * (size + 8);
    };

    const drawDivider = () => {
        if (y < CONTENT_BOTTOM + 20) addPage();
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_SIZE[0] - MARGIN, y }, thickness: 0.8, color: rgb(0.65, 0.65, 0.65) });
        y -= 20;
    };

    const values = report.values || {};
    const normalizeLabel = (label) => String(label || '').replace(/\s+/g, '');
    const findField = (matcher) => (form?.fields || []).find((field) => matcher(field));
    const valueFor = (field) => {
        if (!field) return '-';
        const formatted = formatFieldValue(field, values[field.fieldId]);
        return (formatted === undefined || formatted === null || formatted === '') ? '-' : String(formatted);
    };

    const submitterName = report.submitted_by_name || report.submitted_by_username || '';
    const positionText = profile?.position || '-';
    const contractText = profile?.contract_number || '-';
    const reportDateText = report.report_date
        ? new Date(report.report_date).toLocaleDateString('th-TH', { dateStyle: 'long' })
        : '-';

    // ─── ส่วนหัวจดหมาย ─────────────────────────────────────────────────────
    drawLine('เรียน : คณะกรรมการตรวจรับ', FONT_SIZE, rgb(0, 0, 0), true);
    y -= 6;
    drawInfoLine([{ text: 'ผู้ส่งมอบงาน : ' }, { text: submitterName, value: true }]);
    drawInfoLine([
        { text: 'ตำแหน่ง/หน้าที่ : ' },
        { text: positionText, value: true },
        { text: ' (ตามบันทึกตกลงจ้างเลขที่ ' },
        { text: contractText, value: true },
        { text: ' )' },
    ]);
    drawInfoLine([{ text: 'ประจำวันที่ : ' }, { text: reportDateText, value: true }]);
    y -= 6;
    drawDivider();

    // ─── สรุปการปฏิบัติงาน — เขียนผูกกับ field label ของฟอร์มงานกล้องโทรทัศน์วงจรปิด ───
    drawLine('สรุปการปฏิบัติงาน:', FONT_SIZE, rgb(0, 0, 0), true);
    y -= 2;

    const typeField = findField((field) => normalizeLabel(field.label) === 'ประเภทงาน');
    const placeField = findField((field) => normalizeLabel(field.label) === 'ชื่อสถานที่หรือจุดปฏิบัติงาน');
    const projectField = findField((field) => normalizeLabel(field.label) === 'โครงการ');
    const coordField = findField((field) => field.type === 'location') || findField((field) => normalizeLabel(field.label).includes('ตำแหน่งพื้นที่ปฏิบัติงาน'));
    const networkField = findField((field) => normalizeLabel(field.label) === 'สถานะเครือข่าย');
    const powerField = findField((field) => normalizeLabel(field.label) === 'สถานะไฟฟ้า');
    const actionField = findField((field) => normalizeLabel(field.label).startsWith('การดำเนินการ'));
    const equipField = findField((field) => field.type === 'radio' && (field.options || []).includes('มี') && (field.options || []).includes('ไม่มี'));
    const remarkField = findField((field) => field.type === 'textarea') || findField((field) => normalizeLabel(field.label).includes('หมายเหตุ'));

    drawInfoLine([{ text: 'ประเภทงาน : ' }, { text: valueFor(typeField), value: true }]);
    drawInfoLine([{ text: 'สถานที่หรือจุดปฏิบัติงาน ' }, { text: valueFor(placeField), value: true }]);
    drawInfoRow(
        [{ text: 'โครงการ : ' }, { text: valueFor(projectField), value: true }],
        [{ text: 'พิกัด ' }, { text: valueFor(coordField), value: true }]
    );
    drawInfoRow(
        [{ text: 'สถานะเครือข่าย : ' }, { text: valueFor(networkField), value: true }],
        [{ text: 'สถานะไฟฟ้า : ' }, { text: valueFor(powerField), value: true }]
    );
    drawInfoLine([{ text: 'การดำเนินการ : ' }, { text: valueFor(actionField), value: true }]);
    y -= 4;

    drawLine('รายละเอียดการติดตั้งครุภัณฑ์', FONT_SIZE, rgb(0, 0, 0), true);
    drawLine(valueFor(equipField), FONT_SIZE, rgb(0, 0, 0), true);
    if (equipField) {
        const children = selectedChildren(equipField, values[equipField.fieldId]);
        if (children.length) drawSubformTable(children, values);
    }

    drawLine('หมายเหตุ', FONT_SIZE, rgb(0, 0, 0), true);
    drawLine(valueFor(remarkField), FONT_SIZE, rgb(0, 0, 0), true);
    y -= 14;

    // ─── ฟิลด์อื่นที่ไม่ตรงกับแบบฟอร์มงานกล้องฯ (เผื่อแก้ไขฟอร์มในอนาคต) — แสดงต่อท้ายแบบทั่วไป ───
    const consumedFieldIds = new Set(
        [typeField, placeField, projectField, coordField, networkField, powerField, actionField, equipField, remarkField]
            .filter(Boolean)
            .map((field) => field.fieldId)
    );
    const leftoverFields = (form?.fields || []).filter((field) => field.type !== 'image' && !consumedFieldIds.has(field.fieldId));
    for (const field of leftoverFields) {
        const value = values[field.fieldId];
        if (field.type === 'table') {
            if (Array.isArray(value) && value.length) {
                drawLine(`${field.label}:`, FONT_SIZE, rgb(0, 0, 0), true);
                drawTable(field, value);
            }
            continue;
        }
        const formatted = formatFieldValue(field, value);
        if (formatted !== undefined && formatted !== null && formatted !== '') {
            drawLine(`${field.label}:`, FONT_SIZE, rgb(0, 0, 0), true);
            drawLine(String(formatted), FONT_SIZE, BLUE);
        }
        if (field.type === 'radio') drawSubformTable(selectedChildren(field, value), values);
    }

    // เก็บภาพเฉพาะสาขา radio ที่เลือก
    const photosMap = report.photos || {};
    const imageFields = [];
    const collectImageFields = (fields, currentValues) => {
        for (const field of fields || []) {
            if (field.type === 'image') imageFields.push(field);
            if (field.type === 'radio') {
                const selected = currentValues[field.fieldId];
                const option = (field.radioOptions || []).find((candidate) => candidate.value === selected);
                let children = option?.fields || [];
                if (!children.length) {
                    const legacy = field.radioSubFields?.get ? field.radioSubFields.get(selected) : field.radioSubFields?.[selected];
                    if (legacy) children = [legacy];
                }
                collectImageFields(children, currentValues);
            }
        }
    };
    collectImageFields(form?.fields, values);

    // เลือกรูปแบบตารางภาพตามจำนวนภาพที่เหลือในแต่ละหน้า: 2 ภาพ=2x1, 3 ภาพ=1x3 (ซ้อน), 4 ภาพ=2x2, 5 ภาพขึ้นไป=3x4 (สูงสุด 12 ภาพ/หน้า)
    const getPhotoGrid = (count) => {
        if (count <= 1) return { cols: 1, rows: 1 };
        if (count === 2) return { cols: 2, rows: 1 };
        if (count === 3) return { cols: 1, rows: 3 };
        if (count === 4) return { cols: 2, rows: 2 };
        return { cols: 3, rows: 4 };
    };

    const drawPhotoSection = async (title, fields) => {
        const images = [];
        for (const field of fields) {
            for (const meta of photosMap[field.fieldId] || []) {
                if (!meta?.file_path || !isSafeOutsourcedPath(meta.file_path)) continue;
                try {
                    images.push(await embedImageFromFile(pdfDoc, meta.file_path));
                } catch (err) {
                    logger.warn(`[Outsourced PDF] Cannot embed image ${meta.file_path}: ${err.message}`);
                }
            }
        }

        if (!images.length) return;

        const gap = 12;
        const gridTop = CONTENT_TOP - 42;
        let offset = 0;
        while (offset < images.length) {
            const remaining = images.length - offset;
            const { cols, rows } = getPhotoGrid(Math.min(remaining, 12));
            const perPage = cols * rows;
            const pageImages = images.slice(offset, offset + perPage);
            offset += perPage;

            addPage();
            drawLine(title, FONT_SIZE, rgb(0, 0, 0), true);
            const cellWidth = (PAGE_SIZE[0] - 2 * MARGIN - gap * (cols - 1)) / cols;
            const cellHeight = (gridTop - CONTENT_BOTTOM - gap * (rows - 1)) / rows;
            pageImages.forEach((image, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = MARGIN + col * (cellWidth + gap);
                const top = gridTop - row * (cellHeight + gap);
                page.drawRectangle({ x, y: top - cellHeight, width: cellWidth, height: cellHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
                const scale = Math.min((cellWidth - 12) / image.width, (cellHeight - 12) / image.height);
                const width = image.width * scale;
                const height = image.height * scale;
                page.drawImage(image, { x: x + (cellWidth - width) / 2, y: top - (cellHeight + height) / 2, width, height });
            });
        }
    };

    const beforeFields = imageFields.filter((field) => field.label.includes('ก่อนการปฏิบัติงาน'));
    const afterFields = imageFields.filter((field) => field.label.includes('หลังการปฏิบัติงาน'));
    await drawPhotoSection('ภาพก่อนการปฏิบัติงาน', beforeFields);
    await drawPhotoSection('ภาพหลังการปฏิบัติงาน', afterFields);
    for (const field of imageFields.filter((item) => !beforeFields.includes(item) && !afterFields.includes(item))) {
        await drawPhotoSection(field.label, [field]);
    }

    const pages = pdfDoc.getPages();
    const headerLines = [HEADER_TITLE, positionText !== '-' ? positionText : ''];
    pages.forEach((currentPage, index) => {
        headerLines.forEach((line, lineIndex) => {
            const x = (PAGE_SIZE[0] - boldFont.widthOfTextAtSize(line, FONT_SIZE)) / 2;
            const yy = PAGE_SIZE[1] - MARGIN - lineIndex * (FONT_SIZE + 6);
            currentPage.drawText(line, { x, y: yy, size: FONT_SIZE, font: boldFont, color: rgb(0, 0, 0) });
        });
        currentPage.drawLine({ start: { x: MARGIN, y: 65 }, end: { x: PAGE_SIZE[0] - MARGIN, y: 65 }, thickness: 0.7, color: rgb(0.7, 0.7, 0.7) });
        const pageNumber = `หน้า ${index + 1} / ${pages.length}`;
        const pageNumberWidth = font.widthOfTextAtSize(pageNumber, FONT_SIZE);
        const footerWidth = PAGE_SIZE[0] - 2 * MARGIN - pageNumberWidth - 12;
        const footerSize = Math.min(FONT_SIZE, FONT_SIZE * footerWidth / font.widthOfTextAtSize(FOOTER_TEXT, FONT_SIZE));
        currentPage.drawText(FOOTER_TEXT, { x: MARGIN, y: 45, size: footerSize, font });
        currentPage.drawText(pageNumber, { x: PAGE_SIZE[0] - MARGIN - pageNumberWidth, y: 45, size: FONT_SIZE, font });
    });

    return pdfDoc.save();
}

module.exports = { generateOutsourcedReportPdf };
