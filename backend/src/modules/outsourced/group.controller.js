const OutsourcedGroup = require('../../models/OutsourcedGroup');
const OutsourcedReportForm = require('../../models/OutsourcedReportForm');
const OutsourcedReport = require('../../models/OutsourcedReport');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * GET /api/outsourced/groups
 * outsourced role เห็นเฉพาะกลุ่มที่ active, staff/admin เห็นทั้งหมด
 */
async function listGroups(req, res) {
    try {
        const isStaffUp = (req.user.role !== 'outsourced');
        const filter = { deleted_at: null };
        if (!isStaffUp || req.query.active === 'true') filter.isActive = true;
        const groups = await OutsourcedGroup.find(filter).sort({ name: 1 }).lean();
        return sendSuccess(res, groups, 'รายการกลุ่มงาน');
    } catch (err) {
        logger.error('[Outsourced] listGroups error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function getGroup(req, res) {
    try {
        const group = await OutsourcedGroup.findOne({ _id: req.params.groupId, deleted_at: null }).lean();
        if (!group) return sendError(res, 404, 'ไม่พบกลุ่มงาน');
        return sendSuccess(res, group, 'รายละเอียดกลุ่มงาน');
    } catch (err) {
        logger.error('[Outsourced] getGroup error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

// admin/staff เท่านั้น (บังคับที่ route ด้วย requireOutsourcedManage)
async function createGroup(req, res) {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) return sendError(res, 400, 'กรุณาระบุชื่อกลุ่มงาน');

        const group = await OutsourcedGroup.create({
            name: name.trim(),
            description: description?.trim() || '',
            created_by: req.user.userId,
        });

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'CREATE', module: 'OUTSOURCED', resourceId: group._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'group', name: group.name },
        });

        return sendSuccess(res, group, 'สร้างกลุ่มงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] createGroup error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function updateGroup(req, res) {
    try {
        const group = await OutsourcedGroup.findOne({ _id: req.params.groupId, deleted_at: null });
        if (!group) return sendError(res, 404, 'ไม่พบกลุ่มงาน');

        if (req.body.name !== undefined) group.name = req.body.name.trim();
        if (req.body.description !== undefined) group.description = req.body.description.trim();
        if (req.body.isActive !== undefined) group.isActive = req.body.isActive;
        await group.save();

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'UPDATE', module: 'OUTSOURCED', resourceId: group._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'group' },
        });

        return sendSuccess(res, group, 'อัปเดตกลุ่มงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] updateGroup error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

async function deleteGroup(req, res) {
    try {
        const group = await OutsourcedGroup.findOne({ _id: req.params.groupId, deleted_at: null });
        if (!group) return sendError(res, 404, 'ไม่พบกลุ่มงาน');

        const [formCount, reportCount] = await Promise.all([
            OutsourcedReportForm.countDocuments({ group_id: group._id }),
            OutsourcedReport.countDocuments({ group_id: group._id }),
        ]);
        if (formCount > 0 || reportCount > 0) {
            return sendError(res, 409, 'ไม่สามารถลบได้ ยังมีฟอร์ม/รายงานที่ผูกกับกลุ่มงานนี้');
        }

        group.deleted_at = new Date();
        group.isActive = false;
        await group.save();

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'DELETE', module: 'OUTSOURCED', resourceId: group._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'group' },
        });

        return sendSuccess(res, null, 'ลบกลุ่มงานเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] deleteGroup error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

module.exports = { listGroups, getGroup, createGroup, updateGroup, deleteGroup };
