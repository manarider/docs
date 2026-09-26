const path = require('path');
const OutsourcedGroup = require('../../models/OutsourcedGroup');
const OutsourcedReportForm = require('../../models/OutsourcedReportForm');
const OutsourcedReportFormVersion = require('../../models/OutsourcedReportFormVersion');
const { ensureFormVersion } = require('./formVersionHelper');
const OutsourcedReport = require('../../models/OutsourcedReport');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const { moveFilesByField, cleanupTmpFiles, resizePhotoMetas, isSafeOutsourcedPath } = require('./outsourced.fileHelper');
const { generateOutsourcedReportPdf } = require('./outsourced.pdfGenerator');

const MAX_TABLE_ROWS = 50;

function validateAndCleanFields(fields, values, uploadedFiles, cleanValues, allowedImageFields = new Map(), depth = 0) {
    if (depth > 3) return 'ฟอร์มย่อยซ้อนกันลึกเกินกำหนด';
    for (const field of fields || []) {
        const value = values[field.fieldId];
        if (field.type === 'image') {
            allowedImageFields.set(field.fieldId, field.maxImages || 4);
            if (field.required && !uploadedFiles.some((file) => file.fieldname === field.fieldId)) return `กรุณากรอก "${field.label}"`;
            continue;
        }
        if (field.type === 'table') {
            const rows = value === undefined ? [] : value;
            if (!(field.tableColumns || []).length) return `ตาราง "${field.label}" ต้องมีอย่างน้อย 1 คอลัมน์`;
            if (!Array.isArray(rows) || rows.length > MAX_TABLE_ROWS) return `ข้อมูลตาราง "${field.label}" ไม่ถูกต้อง (สูงสุด ${MAX_TABLE_ROWS} แถว)`;
            if (field.required && rows.length === 0) return `กรุณาเพิ่มข้อมูลในตาราง "${field.label}"`;
            const columns = field.tableColumns || [];
            const cleanRows = [];
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                if (!row || typeof row !== 'object' || Array.isArray(row)) return `แถวที่ ${rowIndex + 1} ใน "${field.label}" ไม่ถูกต้อง`;
                const cleanRow = {};
                for (const column of columns) {
                    const cell = row[column.columnId];
                    if (column.required && (cell === undefined || cell === null || String(cell).trim() === '')) return `กรุณากรอก "${column.label}" ในแถวที่ ${rowIndex + 1}`;
                    if (cell === undefined || cell === null || cell === '') continue;
                    if (column.type === 'select' && !(column.options || []).includes(String(cell))) return `ค่าของ "${column.label}" ในแถวที่ ${rowIndex + 1} ไม่อยู่ในตัวเลือก`;
                    if (column.type === 'number') {
                        const number = Number(cell);
                        if (!Number.isFinite(number)) return `ค่า "${column.label}" ในแถวที่ ${rowIndex + 1} ต้องเป็นตัวเลข`;
                        cleanRow[column.columnId] = number;
                    } else {
                        cleanRow[column.columnId] = String(cell).trim();
                    }
                }
                cleanRows.push(cleanRow);
            }
            if (rows.length > 0 || field.required) cleanValues[field.fieldId] = cleanRows;
            continue;
        }
        if (field.type === 'checkbox') {
            if (field.required && (!Array.isArray(value) || value.length === 0)) return `กรุณาเลือก "${field.label}" อย่างน้อย 1 ตัวเลือก`;
            if (Array.isArray(value)) cleanValues[field.fieldId] = value.filter((item) => field.options.includes(item));
            continue;
        }
        if (field.type === 'location') {
            if (field.required && !(value && typeof value.lat === 'number' && typeof value.lng === 'number')) return `กรุณาปักหมุด "${field.label}"`;
            if (value && typeof value.lat === 'number' && typeof value.lng === 'number') cleanValues[field.fieldId] = { lat: value.lat, lng: value.lng };
            continue;
        }
        if (field.type === 'radio') {
            if (field.required && (value === undefined || value === '')) return `กรุณาเลือก "${field.label}"`;
            if (value !== undefined && value !== '' && !(field.options || []).includes(value)) return `ตัวเลือกของ "${field.label}" ไม่ถูกต้อง`;
            if (value !== undefined) cleanValues[field.fieldId] = value;
            const option = (field.radioOptions || []).find((candidate) => candidate.value === value);
            let children = option?.fields || [];
            if (!children.length) {
                const legacy = field.radioSubFields?.get ? field.radioSubFields.get(value) : field.radioSubFields?.[value];
                if (legacy) children = [legacy];
            }
            const error = validateAndCleanFields(children, values, uploadedFiles, cleanValues, allowedImageFields, depth + 1);
            if (error) return error;
            continue;
        }
        if (field.type === 'select' && value !== undefined && value !== '' && !(field.options || []).includes(value)) return `ตัวเลือกของ "${field.label}" ไม่ถูกต้อง`;
        if (field.required && (value === undefined || value === '')) return `กรุณากรอก "${field.label}"`;
        if (value !== undefined && value !== null && value !== '') cleanValues[field.fieldId] = value;
    }
    return null;
}

/**
 * GET /api/outsourced/groups/:groupId/reports
 * ต้องเลือกกลุ่มงานก่อนเสมอ (groupId มาจาก path)
 */
async function listReports(req, res) {
    try {
        const { groupId } = req.params;
        const { page = 1, limit = 20, formId } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const filter = { group_id: groupId };
        if (formId) filter.form_id = formId;

        const [reports, total] = await Promise.all([
            OutsourcedReport.find(filter)
                .select('-photos')
                .populate('form_id', 'name')
                .sort({ report_date: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            OutsourcedReport.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            data: reports,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (err) {
        logger.error('[Outsourced] listReports error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function getReport(req, res) {
    try {
        const report = await OutsourcedReport.findOne({ _id: req.params.reportId, group_id: req.params.groupId })
            .select('-photos')
            .populate('form_id', 'name fields')
            .lean();
        if (!report) return sendError(res, 404, 'ไม่พบรายงาน');
        return sendSuccess(res, report, 'รายละเอียดรายงาน');
    } catch (err) {
        logger.error('[Outsourced] getReport error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * POST /api/outsourced/groups/:groupId/reports
 * multipart/form-data: values (JSON string), form_id, และไฟล์รูปตามชื่อ fieldId
 * วันที่/เวลา ถูกกำหนดจากเวลาของ server ตอนบันทึกเสมอ (ไม่รับค่าจาก client เพื่อความถูกต้อง)
 */
async function createReport(req, res) {
    const uploadedFiles = req.files || [];
    try {
        const { groupId } = req.params;
        const { form_id, values } = req.body;

        if (!form_id) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, 'กรุณาเลือกฟอร์มการรายงาน'); }

        const group = await OutsourcedGroup.findOne({ _id: groupId, deleted_at: null });
        if (!group) { cleanupTmpFiles(uploadedFiles); return sendError(res, 404, 'ไม่พบกลุ่มงาน'); }

        const form = await OutsourcedReportForm.findOne({ _id: form_id, group_id: groupId, status: 'active' });
        if (!form) { cleanupTmpFiles(uploadedFiles); return sendError(res, 404, 'ไม่พบฟอร์มการรายงาน กรุณาเลือกกลุ่มงานและฟอร์มให้ถูกต้อง'); }

        let parsedValues = {};
        try {
            parsedValues = typeof values === 'string' ? JSON.parse(values) : (values || {});
        } catch {
            cleanupTmpFiles(uploadedFiles);
            return sendError(res, 400, 'รูปแบบข้อมูลฟอร์มไม่ถูกต้อง');
        }

        const cleanValues = {};
        const allowedImageFields = new Map();
        const validationError = validateAndCleanFields(form.fields, parsedValues, uploadedFiles, cleanValues, allowedImageFields);
        if (validationError) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, validationError); }
        const uploadCounts = new Map();
        for (const file of uploadedFiles) {
            const maxImages = allowedImageFields.get(file.fieldname);
            if (!maxImages) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, 'พบรูปภาพที่ไม่ได้อยู่ในฟอร์มย่อยที่เลือก'); }
            const count = (uploadCounts.get(file.fieldname) || 0) + 1;
            if (count > maxImages) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, `แนบรูปได้ไม่เกิน ${maxImages} รูปสำหรับฟิลด์นี้`); }
            uploadCounts.set(file.fieldname, count);
        }

        await ensureFormVersion(form);
        const photosByField = moveFilesByField(uploadedFiles, groupId);
        await resizePhotoMetas(photosByField);

        const report = await OutsourcedReport.create({
            group_id: groupId,
            form_id: form._id,
            form_version: form.version || 1,
            report_date: new Date(),
            values: cleanValues,
            photos: photosByField,
            submitted_by_user: req.user.userId,
            submitted_by_username: req.user.username,
        });

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'CREATE', module: 'OUTSOURCED', resourceId: report._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'report', groupId },
        });

        const result = report.toObject();
        delete result.photos;
        return sendSuccess(res, result, 'บันทึกรายงานเรียบร้อย');
    } catch (err) {
        cleanupTmpFiles(uploadedFiles);
        logger.error('[Outsourced] createReport error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function deleteReport(req, res) {
    try {
        const report = await OutsourcedReport.findOne({ _id: req.params.reportId, group_id: req.params.groupId });
        if (!report) return sendError(res, 404, 'ไม่พบรายงาน');

        // เจ้าของรายงานหรือ staff/admin เท่านั้นที่ลบได้
        const isOwner = String(report.submitted_by_user) === String(req.user.userId);
        const isStaffUp = req.user.role !== 'outsourced';
        if (!isOwner && !isStaffUp) return sendError(res, 403, 'คุณไม่มีสิทธิ์ลบรายงานนี้');

        await report.deleteOne();

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'DELETE', module: 'OUTSOURCED', resourceId: report._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'report' },
        });

        return sendSuccess(res, null, 'ลบรายงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] deleteReport error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * GET /api/outsourced/groups/:groupId/reports/:reportId/photos/:fieldId/:index
 */
async function viewReportPhoto(req, res) {
    try {
        const { reportId, groupId, fieldId, index } = req.params;
        const report = await OutsourcedReport.findOne({ _id: reportId, group_id: groupId })
            .select(`photos.${fieldId}.file_path photos.${fieldId}.mime_type`)
            .lean();
        if (!report) return sendError(res, 404, 'ไม่พบรายงาน');

        const metas = report.photos?.[fieldId] || [];
        const meta = metas[parseInt(index, 10)];
        if (!meta?.file_path || !isSafeOutsourcedPath(meta.file_path)) return sendError(res, 404, 'ไม่พบรูปภาพ');

        return res.sendFile(path.resolve(meta.file_path));
    } catch (err) {
        logger.error('[Outsourced] viewReportPhoto error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * GET /api/outsourced/groups/:groupId/reports/:reportId/pdf
 */
async function downloadReportPdf(req, res) {
    try {
        const { groupId, reportId } = req.params;
        const [group, report] = await Promise.all([
            OutsourcedGroup.findOne({ _id: groupId, deleted_at: null }).lean(),
            OutsourcedReport.findOne({ _id: reportId, group_id: groupId }).lean(),
        ]);
        if (!group || !report) return sendError(res, 404, 'ไม่พบข้อมูล');

        const formVersion = report.form_version
            ? await OutsourcedReportFormVersion.findOne({ form_id: report.form_id, version: report.form_version }).lean()
            : null;
        const form = formVersion || await OutsourcedReportForm.findOne({ _id: report.form_id, group_id: groupId }).lean();
        if (!form) return sendError(res, 404, 'ไม่พบฟอร์มการรายงาน');

        const pdfBytes = await generateOutsourcedReportPdf(report, form, group);

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'DOWNLOAD', module: 'OUTSOURCED', resourceId: report._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'report_pdf' },
        });

        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `inline; filename="outsourced-report-${reportId}.pdf"`);
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        logger.error('[Outsourced] downloadReportPdf error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

module.exports = { listReports, getReport, createReport, deleteReport, viewReportPhoto, downloadReportPdf, validateAndCleanFields };
