const OutsourcedGroup = require('../../models/OutsourcedGroup');
const OutsourcedCommitteeMember = require('../../models/OutsourcedCommitteeMember');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * GET /api/outsourced/groups/:groupId/committee
 * รายชื่อคณะกรรมการตรวจรับของกลุ่มงาน — จัดการได้เฉพาะ admin (บังคับที่ route)
 */
async function listCommitteeMembers(req, res) {
    try {
        const { groupId } = req.params;
        const group = await OutsourcedGroup.findOne({ _id: groupId, deleted_at: null }).lean();
        if (!group) return sendError(res, 404, 'ไม่พบกลุ่มงาน');

        const members = await OutsourcedCommitteeMember.find({ group_id: groupId }).sort({ order: 1, createdAt: 1 }).lean();
        return sendSuccess(res, members, 'รายชื่อคณะกรรมการตรวจรับ');
    } catch (err) {
        logger.error('[Outsourced] listCommitteeMembers error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * POST /api/outsourced/groups/:groupId/committee
 */
async function createCommitteeMember(req, res) {
    try {
        const { groupId } = req.params;
        const name = String(req.body.name || '').trim();
        if (!name) return sendError(res, 400, 'กรุณาระบุชื่อคณะกรรมการตรวจรับ');

        const group = await OutsourcedGroup.findOne({ _id: groupId, deleted_at: null }).lean();
        if (!group) return sendError(res, 404, 'ไม่พบกลุ่มงาน');

        const lastOrder = await OutsourcedCommitteeMember.findOne({ group_id: groupId }).sort({ order: -1 }).lean();
        const member = await OutsourcedCommitteeMember.create({
            group_id: groupId,
            name,
            order: (lastOrder?.order ?? -1) + 1,
            created_by: req.user.userId,
        });

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'CREATE', module: 'OUTSOURCED', resourceId: member._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'committee_member', name: member.name, group_id: groupId },
        });

        return sendSuccess(res, member, 'เพิ่มคณะกรรมการตรวจรับเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] createCommitteeMember error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * PATCH /api/outsourced/groups/:groupId/committee/:memberId
 */
async function updateCommitteeMember(req, res) {
    try {
        const { groupId, memberId } = req.params;
        const member = await OutsourcedCommitteeMember.findOne({ _id: memberId, group_id: groupId });
        if (!member) return sendError(res, 404, 'ไม่พบรายชื่อคณะกรรมการตรวจรับ');

        const name = String(req.body.name || '').trim();
        if (!name) return sendError(res, 400, 'กรุณาระบุชื่อคณะกรรมการตรวจรับ');
        member.name = name;
        await member.save();

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'UPDATE', module: 'OUTSOURCED', resourceId: member._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'committee_member', group_id: groupId },
        });

        return sendSuccess(res, member, 'อัปเดตคณะกรรมการตรวจรับเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] updateCommitteeMember error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * DELETE /api/outsourced/groups/:groupId/committee/:memberId
 */
async function deleteCommitteeMember(req, res) {
    try {
        const { groupId, memberId } = req.params;
        const member = await OutsourcedCommitteeMember.findOne({ _id: memberId, group_id: groupId });
        if (!member) return sendError(res, 404, 'ไม่พบรายชื่อคณะกรรมการตรวจรับ');

        await member.deleteOne();

        await logAction({
            userId: req.user.userId, username: req.user.username,
            action: 'DELETE', module: 'OUTSOURCED', resourceId: member._id,
            ipAddress: getIp(req), userAgent: req.headers['user-agent'],
            details: { type: 'committee_member', group_id: groupId },
        });

        return sendSuccess(res, null, 'ลบคณะกรรมการตรวจรับเรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] deleteCommitteeMember error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

module.exports = { listCommitteeMembers, createCommitteeMember, updateCommitteeMember, deleteCommitteeMember };
