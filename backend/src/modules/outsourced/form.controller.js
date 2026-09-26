const { v4: uuidv4 } = require('uuid');
const OutsourcedGroup = require('../../models/OutsourcedGroup');
const OutsourcedReportForm = require('../../models/OutsourcedReportForm');
const OutsourcedReport = require('../../models/OutsourcedReport');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const OutsourcedReportFormVersion = require('../../models/OutsourcedReportFormVersion');
const { ensureFormVersion } = require('./formVersionHelper');

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'location', 'image', 'table'];
const SUB_FIELD_TYPES = ['text', 'textarea', 'number'];
const MAX_FORM_DEPTH = 3;

function normalizeSubField(raw) {
    if (!raw || !raw.label?.trim()) return null;
    return {
        fieldId: raw.fieldId?.trim() || uuidv4(),
        label: raw.label.trim(),
        type: SUB_FIELD_TYPES.includes(raw.type) ? raw.type : 'textarea',
        required: !!raw.required,
    };
}

function normalizeFields(rawFields, depth = 0) {
    if (!Array.isArray(rawFields)) return null;
    if (depth >= MAX_FORM_DEPTH && rawFields.length > 0) return null;
    const normalized = rawFields.map((f) => {
        const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
        const options = Array.isArray(f.options) ? [...new Set(f.options.map((o) => String(o).trim()).filter(Boolean))] : [];

        const tableColumns = type === 'table' && Array.isArray(f.tableColumns)
            ? f.tableColumns.map((column) => ({
                columnId: String(column.columnId || '').trim() || uuidv4(),
                label: String(column.label || '').trim(),
                type: ['number', 'select'].includes(column.type) ? column.type : 'text',
                options: column.type === 'select' && Array.isArray(column.options)
                    ? [...new Set(column.options.map((option) => String(option).trim()).filter(Boolean))]
                    : [],
                required: !!column.required,
            })).filter((column) => column.label)
            : [];

        const existingOptions = new Map((Array.isArray(f.radioOptions) ? f.radioOptions : []).map((option) => [String(option.value).trim(), option]));
        const radioOptions = type === 'radio' ? options.map((value) => {
            const current = existingOptions.get(value);
            let fields = Array.isArray(current?.fields) ? current.fields : [];
            if (!current && f.radioSubFields?.[value]) {
                const legacy = normalizeSubField(f.radioSubFields[value]);
                if (legacy) fields = [{ ...legacy, options: [], tableColumns: [], radioOptions: [] }];
            }
            const nestedFields = normalizeFields(fields, depth + 1);
            return nestedFields === null ? null : { value, fields: nestedFields };
        }) : [];

        if (radioOptions.some((option) => option === null)) return null;

        return {
            fieldId: f.fieldId?.trim() || uuidv4(),
            sourceFieldId: depth > 0 && f.sourceFieldId ? String(f.sourceFieldId).trim() : null,
            label: f.label?.trim() || '',
            type,
            options,
            radioSubFields: type === 'radio' ? (f.radioSubFields || {}) : {},
            radioOptions,
            tableColumns,
            required: !!f.required,
            maxImages: Math.min(10, Math.max(1, parseInt(f.maxImages, 10) || 4)),
        };
    });

    if (normalized.some((field) => field === null)) return null;
    const fields = normalized.filter((field) => field.label);

    if (fields.some((field) =>
        (field.type === 'table' && (field.tableColumns.length === 0 || field.tableColumns.some((column) => column.type === 'select' && column.options.length === 0)))
        || (field.type === 'radio' && field.options.length === 0)
    )) return null;

    if (depth !== 0) return fields;
    const rootFields = new Map(fields.map((field) => [field.fieldId, field]));
    const syncReferences = (fields) => fields.map((field) => {
        const source = field.sourceFieldId ? rootFields.get(field.sourceFieldId) : null;
        const result = source
            ? { ...field, label: source.label, type: source.type, options: source.options, required: source.required, maxImages: source.maxImages, tableColumns: source.tableColumns }
            : field;
        result.radioOptions = (result.radioOptions || []).map((option) => ({ ...option, fields: syncReferences(option.fields || []) }));
        return result;
    });
    return syncReferences(fields);
}

/**
 * GET /api/outsourced/groups/:groupId/forms
 * ต้องเลือกกลุ่มงานก่อนเสมอ (groupId มาจาก path)
 */
async function listForms(req, res) {
    try {
        const { groupId } = req.params;
        const filter = { group_id: groupId };
        if (req.user.role === 'outsourced') filter.status = 'active';
        const forms = await OutsourcedReportForm.find(filter).sort({ createdAt: -1 }).lean();
        return sendSuccess(res, forms, 'รายการฟอร์มการรายงาน');
    } catch (err) {
        logger.error('[Outsourced] listForms error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function getForm(req, res) {
    try {
        const form = await OutsourcedReportForm.findOne({ _id: req.params.formId, group_id: req.params.groupId }).lean();
        if (!form) return sendError(res, 404, 'ไม่พบฟอร์มการรายงาน');
        return sendSuccess(res, form, 'รายละเอียดฟอร์มการรายงาน');
    } catch (err) {
        logger.error('[Outsourced] getForm error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

// admin/staff เท่านั้น — ต้องเลือกกลุ่มงาน (:groupId) ก่อนสร้างเสมอ
async function createForm(req, res) {
    try {
        const { groupId } = req.params;
        const group = await OutsourcedGroup.findOne({ _id: groupId, deleted_at: null });
        if (!group) return sendError(res, 404, 'ไม่พบกลุ่มงาน กรุณาเลือกกลุ่มงานก่อนสร้างฟอร์ม');

        const { name } = req.body;
        if (!name?.trim()) return sendError(res, 400, 'กรุณาระบุชื่อฟอร์ม');

        const fields = normalizeFields(req.body.fields);
        if (!fields || fields.length === 0) return sendError(res, 400, 'กรุณาระบุฟิลด์อย่างน้อย 1 ฟิลด์');

        const form = await OutsourcedReportForm.create({
            group_id: groupId,
            name: name.trim(),
            fields,
            created_by: req.user.userId,
        });
        await OutsourcedReportFormVersion.create({ form_id: form._id, version: form.version, name: form.name, fields: form.fields });

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'CREATE', module: 'OUTSOURCED', resourceId: form._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'form', groupId, name: form.name },
        });

        return sendSuccess(res, form, 'สร้างฟอร์มการรายงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] createForm error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function updateForm(req, res) {
    try {
        const form = await OutsourcedReportForm.findOne({ _id: req.params.formId, group_id: req.params.groupId });
        if (!form) return sendError(res, 404, 'ไม่พบฟอร์มการรายงาน');

        const previousVersion = form.version || 1;
        if (req.body.name !== undefined || req.body.fields !== undefined) await ensureFormVersion(form, previousVersion);

        let definitionChanged = false;
        if (req.body.name !== undefined && form.name !== req.body.name.trim()) {
            form.name = req.body.name.trim();
            definitionChanged = true;
        }
        if (req.body.fields !== undefined) {
            const fields = normalizeFields(req.body.fields);
            if (!fields || fields.length === 0) return sendError(res, 400, 'กรุณาระบุฟิลด์อย่างน้อย 1 ฟิลด์');
            form.fields = fields;
            definitionChanged = true;
        }
        if (req.body.status !== undefined) form.status = req.body.status;
        if (definitionChanged) form.version = previousVersion + 1;
        form.updated_by = req.user.userId;
        await form.save();
        if (definitionChanged) {
            await OutsourcedReportFormVersion.create({ form_id: form._id, version: form.version, name: form.name, fields: form.fields });
        }

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'UPDATE', module: 'OUTSOURCED', resourceId: form._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'form' },
        });

        return sendSuccess(res, form, 'อัปเดตฟอร์มการรายงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] updateForm error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function deleteForm(req, res) {
    try {
        const form = await OutsourcedReportForm.findOne({ _id: req.params.formId, group_id: req.params.groupId });
        if (!form) return sendError(res, 404, 'ไม่พบฟอร์มการรายงาน');

        const reportCount = await OutsourcedReport.countDocuments({ form_id: form._id });
        if (reportCount > 0) {
            return sendError(res, 409, `ไม่สามารถลบได้ ยังมีรายงาน ${reportCount} รายการที่ใช้ฟอร์มนี้`);
        }

        await form.deleteOne();

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'DELETE', module: 'OUTSOURCED', resourceId: form._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'form' },
        });

        return sendSuccess(res, null, 'ลบฟอร์มการรายงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] deleteForm error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

module.exports = { listForms, getForm, createForm, updateForm, deleteForm, normalizeFields };
