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
 * @param {Object} [dailySections] - { summary, problems, followUps, entries } รวมจากทุกรายงานวันเดียวกัน
 * @param {Object} [committee] - OutsourcedCommitteeMember คนที่ 1 ของกลุ่มงาน (plain object) — name / position
 * @returns {Promise<Buffer>}
 */
async function generateOutsourcedReportPdf(report, form, group, profile, dailySections, committee) {
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

    const drawDivider = () => {
        if (y < CONTENT_BOTTOM + 20) addPage();
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_SIZE[0] - MARGIN, y }, thickness: 0.8, color: rgb(0.65, 0.65, 0.65) });
        y -= 20;
    };

    const values = report.values || {};
    const normalizeLabel = (label) => String(label || '').replace(/\s+/g, '');
    const findField = (matcher) => (form?.fields || []).find((field) => matcher(field));

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

    // ─── ฟิลด์เดิมของฟอร์มงานกล้องฯ ที่ไม่แสดงในหน้าแรกแล้ว — คงไว้เพื่อตัดออกจาก fallback ด้านล่างเท่านั้น ───
    const typeField = findField((field) => normalizeLabel(field.label) === 'ประเภทงาน');
    const placeField = findField((field) => normalizeLabel(field.label) === 'ชื่อสถานที่หรือจุดปฏิบัติงาน');
    const projectField = findField((field) => normalizeLabel(field.label) === 'โครงการ');
    const coordField = findField((field) => field.type === 'location') || findField((field) => normalizeLabel(field.label).includes('ตำแหน่งพื้นที่ปฏิบัติงาน'));
    const networkField = findField((field) => normalizeLabel(field.label) === 'สถานะเครือข่าย');
    const powerField = findField((field) => normalizeLabel(field.label) === 'สถานะไฟฟ้า');
    const actionField = findField((field) => normalizeLabel(field.label).startsWith('การดำเนินการ'));
    const equipField = findField((field) => field.type === 'radio' && (field.options || []).includes('มี') && (field.options || []).includes('ไม่มี'));
    const remarkField = findField((field) => field.type === 'textarea') || findField((field) => normalizeLabel(field.label).includes('หมายเหตุ'));
    const summaryField = findField((field) => field.type === 'table' && normalizeLabel(field.label) === 'สรุปการปฏิบัติงาน');
    const problemsField = findField((field) => field.type === 'table' && normalizeLabel(field.label).startsWith('ปัญหา/อุปสรรค'));
    const followUpField = findField((field) => field.type === 'table' && normalizeLabel(field.label).startsWith('งานที่ต้องติดตาม'));

    // ─── สรุปการปฏิบัติงาน / ปัญหา-อุปสรรค / งานที่ต้องติดตาม — รวมจากทุกรายงานวันเดียวกัน เรียงเลขลำดับ ───
    const drawDottedPlaceholder = () => {
        const prefix = '1. ';
        const maxWidth = PAGE_SIZE[0] - 2 * MARGIN;
        const prefixWidth = font.widthOfTextAtSize(prefix, FONT_SIZE);
        const dotWidth = font.widthOfTextAtSize('.', FONT_SIZE);
        const dotsCount = Math.max(0, Math.floor((maxWidth - prefixWidth) / dotWidth));
        drawLine(prefix + '.'.repeat(dotsCount), FONT_SIZE, rgb(0, 0, 0));
    };

    const drawNumberedSection = (title, rows, { placeholderWhenEmpty = false } = {}) => {
        drawLine(title, FONT_SIZE, rgb(0, 0, 0), true);
        if (!rows.length) {
            if (placeholderWhenEmpty) drawDottedPlaceholder();
            return;
        }
        rows.forEach((text, index) => drawLine(`${index + 1}. ${text}`, FONT_SIZE, rgb(0, 0, 0), true));
    };

    drawNumberedSection('สรุปการปฏิบัติงาน:', dailySections?.summary || [], { placeholderWhenEmpty: true });
    y -= 6;
    drawNumberedSection('ปัญหา/อุปสรรค(ถ้ามี):', dailySections?.problems || [], { placeholderWhenEmpty: true });
    y -= 6;
    drawNumberedSection('งานที่ต้องติดตามต่อในวันพรุ่งนี้:', dailySections?.followUps || [], { placeholderWhenEmpty: true });
    y -= 14;

    // ─── ช่องลงชื่อ (จัดกลางหน้า และชิดขอบล่างของหน้าเสมอ) ──────────────────────
    const drawCentered = (text, bold = false) => {
        const width = fontFor(bold).widthOfTextAtSize(text, FONT_SIZE);
        drawText(text, { x: (PAGE_SIZE[0] - width) / 2, y, size: FONT_SIZE, color: rgb(0, 0, 0) }, bold);
        y -= FONT_SIZE + 8;
    };
    const signatureLine = (roleLabel) => `ลงชื่อ${'.'.repeat(40)}${roleLabel}`;

    const committeeName = committee?.name || '';
    const committeePositionLines = String(committee?.position || '').split('\n').map((line) => line.trim()).filter((line) => line !== '');

    const lineStep = FONT_SIZE + 8;
    const staffLines = 2; // ลงชื่อ...ผู้รับจ้าง / (ชื่อเจ้าหน้าที่)
    const committeeLines = 2 + committeePositionLines.length; // ลงชื่อ...คณะกรรมการ / (ชื่อ) / ตำแหน่ง (0-2 บรรทัด)
    const blockGap = 28;
    const totalSignatureHeight = staffLines * lineStep + blockGap + committeeLines * lineStep;

    // บังคับให้ช่องลงชื่อชิดขอบล่างของหน้าเสมอ ไม่ว่าเนื้อหาก่อนหน้าจะยาวแค่ไหน
    const anchorY = CONTENT_BOTTOM + totalSignatureHeight;
    if (y < anchorY) addPage();
    y = anchorY;

    drawCentered(signatureLine('ผู้รับจ้าง'));
    drawCentered(`(${submitterName || ''})`);
    y -= blockGap;
    drawCentered(signatureLine('คณะกรรมการ'));
    drawCentered(committeeName ? `(${committeeName})` : '(                              )');
    committeePositionLines.forEach((line) => drawCentered(line));

    // ─── ฟิลด์อื่นที่ไม่ตรงกับแบบฟอร์มงานกล้องฯ (เผื่อแก้ไขฟอร์มในอนาคต) — แสดงต่อท้ายแบบทั่วไป ───
    const consumedFieldIds = new Set(
        [typeField, placeField, projectField, coordField, networkField, powerField, actionField, equipField, remarkField, summaryField, problemsField, followUpField]
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

    const collectFieldImages = async (fields) => {
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
        return images;
    };

    const drawImageGrid = (images, cols, rows, gridTop, gridBottom, gap) => {
        const cellWidth = (PAGE_SIZE[0] - 2 * MARGIN - gap * (cols - 1)) / cols;
        const cellHeight = (gridTop - gridBottom - gap * (rows - 1)) / rows;
        images.forEach((image, index) => {
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
    };

    const drawPhotoSection = async (title, fields) => {
        const images = await collectFieldImages(fields);
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
            drawImageGrid(pageImages, cols, rows, gridTop, CONTENT_BOTTOM, gap);
        }
    };

    // ─── หน้า "ข้อมูลการรายงานแต่ละครั้งของวันนั้น" — แทนที่หน้าภาพก่อนการปฏิบัติงานเดิม ───
    const drawTwoColPlain = (leftText, rightText, fontSize) => {
        const maxWidth = PAGE_SIZE[0] - 2 * MARGIN;
        const gap = 24;
        const colWidth = (maxWidth - gap) / 2;
        const leftLines = wrapText(leftText, colWidth, fontSize);
        const rightLines = wrapText(rightText, colWidth, fontSize);
        const lineStep = fontSize + 6;
        const lineCount = Math.max(leftLines.length, rightLines.length, 1);
        if (y < CONTENT_BOTTOM + lineCount * lineStep) addPage();
        const startY = y;
        leftLines.forEach((line, index) => drawText(line, { x: MARGIN, y: startY - index * lineStep, size: fontSize, color: rgb(0, 0, 0) }));
        rightLines.forEach((line, index) => drawText(line, { x: MARGIN + colWidth + gap, y: startY - index * lineStep, size: fontSize, color: rgb(0, 0, 0) }));
        y -= lineCount * lineStep;
    };
    const drawFullWidthPlain = (text, fontSize) => {
        const maxWidth = PAGE_SIZE[0] - 2 * MARGIN;
        const lines = wrapText(text, maxWidth, fontSize);
        const lineStep = fontSize + 6;
        lines.forEach((line) => {
            if (y < CONTENT_BOTTOM + lineStep) addPage();
            drawText(line, { x: MARGIN, y, size: fontSize, color: rgb(0, 0, 0) });
            y -= lineStep;
        });
    };

    const drawDailyEntriesPage = (entries) => {
        if (!entries?.length) return;
        addPage();
        drawLine('ข้อมูลการรายงานแต่ละครั้งของวันนั้น', FONT_SIZE, rgb(0, 0, 0), true);
        y -= 4;

        const maxWidth = PAGE_SIZE[0] - 2 * MARGIN;
        const colWidth = (maxWidth - 24) / 2;
        const measureEntryLines = (entry, size) => {
            const row1 = Math.max(
                wrapText(`ประเภทงาน : ${entry.type || '-'}`, colWidth, size).length,
                wrapText(`โครงการ: ${entry.project || '-'}`, colWidth, size).length
            );
            const row2 = wrapText(`ชื่อสถานที่หรือจุดปฏิบัติงาน : ${entry.place || '-'}`, maxWidth, size).length;
            const row3 = Math.max(
                wrapText(`สถานะเครือข่าย : ${entry.network || '-'}`, colWidth, size).length,
                wrapText(`สถานะไฟฟ้า : ${entry.power || '-'}`, colWidth, size).length
            );
            return row1 + row2 + row3;
        };

        const dividerGap = 10;
        const availableHeight = y - CONTENT_BOTTOM;
        const totalHeightFor = (fontSize) => {
            const lineStep = fontSize + 6;
            const linesTotal = entries.reduce((sum, entry) => sum + measureEntryLines(entry, fontSize), 0);
            return linesTotal * lineStep + (entries.length - 1) * dividerGap;
        };
        let size = FONT_SIZE;
        while (size > 6 && totalHeightFor(size) > availableHeight) size -= 0.5;

        entries.forEach((entry, index) => {
            drawTwoColPlain(`ประเภทงาน : ${entry.type || '-'}`, `โครงการ: ${entry.project || '-'}`, size);
            drawFullWidthPlain(`ชื่อสถานที่หรือจุดปฏิบัติงาน : ${entry.place || '-'}`, size);
            drawTwoColPlain(`สถานะเครือข่าย : ${entry.network || '-'}`, `สถานะไฟฟ้า : ${entry.power || '-'}`, size);
            if (index < entries.length - 1) {
                y -= dividerGap / 2;
                page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_SIZE[0] - MARGIN, y }, thickness: 0.8, dashArray: [4, 3], color: rgb(0.6, 0.6, 0.6) });
                y -= dividerGap / 2;
            }
        });
    };

    // ─── หน้าภาพก่อน/หลังดำเนินการ — รวมในหน้าเดียว แบ่งบน-ล่าง แทนหน้าแยกเดิม ───
    const getHalfPhotoGrid = (count) => {
        if (count <= 1) return { cols: 1, rows: 1 };
        if (count <= 4) return { cols: 2, rows: 2 };
        return { cols: 3, rows: 2 }; // สูงสุด 6 ภาพต่อครึ่งหน้า
    };

    const drawBeforeAfterPhotoPages = (beforeImages, afterImages) => {
        const perHalf = 6;
        const totalPages = Math.max(Math.ceil(beforeImages.length / perHalf), Math.ceil(afterImages.length / perHalf), 1);
        if (!beforeImages.length && !afterImages.length) return;

        const gap = 10;
        const halfGap = 24;
        const contentHeight = CONTENT_TOP - CONTENT_BOTTOM;
        const halfHeight = (contentHeight - halfGap) / 2;

        const drawHalf = (title, images, topY) => {
            drawText(title, { x: MARGIN, y: topY, size: FONT_SIZE, color: rgb(0, 0, 0) }, true);
            const gridTop = topY - FONT_SIZE - 10;
            const gridBottom = topY - halfHeight;
            if (!images.length) return;
            const { cols, rows } = getHalfPhotoGrid(images.length);
            drawImageGrid(images, cols, rows, gridTop, gridBottom, gap);
        };

        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
            const beforeChunk = beforeImages.slice(pageIndex * perHalf, pageIndex * perHalf + perHalf);
            const afterChunk = afterImages.slice(pageIndex * perHalf, pageIndex * perHalf + perHalf);
            if (!beforeChunk.length && !afterChunk.length) continue;

            addPage();
            drawHalf('ภาพก่อนดำเนินการ', beforeChunk, CONTENT_TOP);
            drawHalf('ภาพหลังดำเนินการ', afterChunk, CONTENT_TOP - halfHeight - halfGap);
        }
    };

    const beforeFields = imageFields.filter((field) => field.label.includes('ก่อนการปฏิบัติงาน'));
    const afterFields = imageFields.filter((field) => field.label.includes('หลังการปฏิบัติงาน'));

    drawDailyEntriesPage(dailySections?.entries || []);
    drawBeforeAfterPhotoPages(await collectFieldImages(beforeFields), await collectFieldImages(afterFields));
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
