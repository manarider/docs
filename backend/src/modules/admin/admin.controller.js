const SystemSettings = require('../../models/SystemSettings');
const AuditLog = require('../../models/AuditLog');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/settings
 * ดูค่า settings ทั้งหมด
 */
async function getSettings(req, res) {
  try {
    const settings = await SystemSettings.find().lean();
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    return sendSuccess(res, map, 'Settings');
  } catch (err) {
    logger.error('[Admin] getSettings error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PUT /api/admin/settings/:key
 * ตั้งค่า setting
 */
async function setSetting(req, res) {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const setting = await SystemSettings.findOneAndUpdate(
      { key },
      { value, description, updatedBy: req.user.username },
      { upsert: true, new: true }
    );

    return sendSuccess(res, setting, 'บันทึก setting เรียบร้อย');
  } catch (err) {
    logger.error('[Admin] setSetting error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/admin/audit
 * ดู audit logs พร้อม filter และ pagination
 */
async function getAuditLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.username) filter.username = { $regex: req.query.username, $options: 'i' };

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return sendSuccess(res, { logs, total, page, pages: Math.ceil(total / limit) }, 'Audit logs');
  } catch (err) {
    logger.error('[Admin] getAuditLogs error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/admin/public-settings
 * ดูค่า settings ที่ใช้แสดงสาธารณะ (ไม่ต้อง admin)
 */
async function getPublicSettings(req, res) {
  try {
    const setting = await SystemSettings.findOne({ key: 'public_duration_hours' }).lean();
    return sendSuccess(res, { public_duration_hours: setting?.value ?? 24 }, 'Public settings');
  } catch (err) {
    logger.error('[Admin] getPublicSettings error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { getSettings, setSetting, getAuditLogs, getPublicSettings };
