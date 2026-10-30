const mongoose = require('mongoose');
const OutsourcedUserProfile = require('../../models/OutsourcedUserProfile');
const OutsourcedReport = require('../../models/OutsourcedReport');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * GET /api/outsourced/profile
 * ดึงโปรไฟล์เพิ่มเติม (ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง) ของผู้ใช้ปัจจุบัน
 */
async function getMyProfile(req, res) {
    try {
        const profile = await OutsourcedUserProfile.findOne({ user_id: req.user.userId }).lean();
        return sendSuccess(res, profile || { position: '', contract_number: '' }, 'ข้อมูลโปรไฟล์');
    } catch (err) {
        logger.error('[Outsourced] getMyProfile error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * PUT /api/outsourced/profile
 * สร้าง/แก้ไขโปรไฟล์เพิ่มเติมของผู้ใช้ปัจจุบัน
 */
async function updateMyProfile(req, res) {
    try {
        const position = String(req.body.position || '').trim();
        const contractNumber = String(req.body.contract_number || '').trim();

        if (!position) return sendError(res, 400, 'กรุณาระบุตำแหน่งหน้าที่');
        if (!contractNumber) return sendError(res, 400, 'กรุณาระบุเลขที่บันทึกตกลงจ้าง');

        const profile = await OutsourcedUserProfile.findOneAndUpdate(
            { user_id: req.user.userId },
            { username: req.user.username, position, contract_number: contractNumber },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).lean();

        await logAction({
            userId: req.user.userId,
            username: req.user.username,
            action: 'UPDATE',
            module: 'OUTSOURCED',
            resourceId: profile._id,
            ipAddress: getIp(req),
            userAgent: req.headers['user-agent'],
            details: { type: 'user_profile' },
        });

        return sendSuccess(res, profile, 'บันทึกโปรไฟล์เรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] updateMyProfile error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * GET /api/outsourced/groups/:groupId/profiles
 * รายชื่อเจ้าหน้าที่ (เฉพาะผู้ที่เคยส่งรายงานในกลุ่มงานนี้) พร้อมโปรไฟล์ปัจจุบัน — สำหรับ admin จัดการ
 */
async function listGroupProfiles(req, res) {
    try {
        const { groupId } = req.params;
        const submitters = await OutsourcedReport.aggregate([
            { $match: { group_id: new mongoose.Types.ObjectId(groupId) } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$submitted_by_user',
                    username: { $first: '$submitted_by_username' },
                    name: { $first: '$submitted_by_name' },
                },
            },
        ]);

        const userIds = submitters.map((s) => s._id);
        const profiles = await OutsourcedUserProfile.find({ user_id: { $in: userIds } }).lean();
        const profileMap = new Map(profiles.map((p) => [String(p.user_id), p]));

        const result = submitters
            .map((s) => ({
                user_id: s._id,
                username: s.username || '',
                name: s.name || s.username || '',
                position: profileMap.get(String(s._id))?.position || '',
                contract_number: profileMap.get(String(s._id))?.contract_number || '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'th'));

        return sendSuccess(res, result, 'รายชื่อเจ้าหน้าที่');
    } catch (err) {
        logger.error('[Outsourced] listGroupProfiles error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

/**
 * PATCH /api/outsourced/groups/:groupId/profiles/:userId
 * admin แก้ไขโปรไฟล์ (ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง) ของเจ้าหน้าที่คนอื่น
 */
async function updateProfileForUser(req, res) {
    try {
        const { groupId, userId } = req.params;
        const position = String(req.body.position || '').trim();
        const contractNumber = String(req.body.contract_number || '').trim();

        if (!position) return sendError(res, 400, 'กรุณาระบุตำแหน่งหน้าที่');
        if (!contractNumber) return sendError(res, 400, 'กรุณาระบุเลขที่บันทึกตกลงจ้าง');

        const latestReport = await OutsourcedReport.findOne({ group_id: groupId, submitted_by_user: userId })
            .sort({ createdAt: -1 })
            .select('submitted_by_username')
            .lean();
        if (!latestReport) return sendError(res, 404, 'ไม่พบเจ้าหน้าที่นี้ในกลุ่มงาน');

        const profile = await OutsourcedUserProfile.findOneAndUpdate(
            { user_id: userId },
            { username: latestReport.submitted_by_username || '', position, contract_number: contractNumber },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).lean();

        await logAction({
            userId: req.user.userId,
            username: req.user.username,
            action: 'UPDATE',
            module: 'OUTSOURCED',
            resourceId: profile._id,
            ipAddress: getIp(req),
            userAgent: req.headers['user-agent'],
            details: { type: 'user_profile_by_admin', target_user: userId, group_id: groupId },
        });

        return sendSuccess(res, profile, 'บันทึกโปรไฟล์เรียบร้อย');
    } catch (err) {
        logger.error('[Outsourced] updateProfileForUser error:', err.message);
        return sendError(res, 500, 'เกิดข้อผิดพลาด');
    }
}

module.exports = { getMyProfile, updateMyProfile, listGroupProfiles, updateProfileForUser };
