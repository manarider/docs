const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * บันทึก Audit Log โดยไม่ throw error ถ้า DB ล้มเหลว
 */
async function logAction({ userId, username, action, module: mod, resourceId = null, ipAddress, userAgent, details = null }) {
  try {
    await AuditLog.create({
      user_id: userId,
      username,
      action,
      module: mod,
      resource_id: resourceId ? String(resourceId) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      details,
    });
  } catch (err) {
    logger.error(`[AuditLog] Failed to write log: ${err.message}`, { userId, action, module: mod });
  }
}

/**
 * ดึง IP จริงของ request (รองรับ reverse proxy)
 */
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = { logAction, getIp };
