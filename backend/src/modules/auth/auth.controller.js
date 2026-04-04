const axios = require('axios');
const config = require('../../config');
const Department = require('../../models/Department');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

const UMS_PROJECT_ID = config.ums.projectId;

/**
 * GET /api/auth/login
 * Redirect ไปยัง UMS login พร้อมส่ง callback URL
 */
async function login(req, res) {
  try {
    const callbackUrl = encodeURIComponent(config.ums.callbackUrl);
    const loginPath = (config.ums.loginPath || '/login').replace(/^\//, '');
    const loginUrl = `${config.ums.baseUrl}/${loginPath}?redirect=${callbackUrl}`;
    return res.redirect(loginUrl);
  } catch (err) {
    logger.error('[Auth] login redirect error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

/**
 * GET /api/auth/callback?token=<jwt>
 * รับ token จาก UMS redirect → ยืนยันกับ UMS → สร้าง session
 */
async function callback(req, res) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.redirect(`/docs/?error=missing_token`);
  }

  try {
    // ยืนยัน token กับ UMS
    const meUrl = `${config.ums.baseUrl}${config.ums.meEndpoint}`;
    const { data } = await axios.get(meUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    if (data.status !== 'success' || !data.user) {
      logger.warn('[Auth] UMS returned invalid response');
      return res.redirect('/docs/?error=auth_failed');
    }

    const umsUser = data.user;

    // ตรวจสอบว่าผู้ใช้มีสิทธิ์ในโปรเจกต์นี้
    const permission = (umsUser.projectPermissions || []).find(
      (p) => p.project === UMS_PROJECT_ID
    );

    if (!permission) {
      logger.warn(`[Auth] User ${umsUser.username} has no permission for project ${UMS_PROJECT_ID}`);
      return res.redirect('/docs/?error=no_permission');
    }

    // หา dept_id จากชื่อหน่วยงาน
    let deptId = null;
    if (permission.subDepartment) {
      const dept = await Department.findOne({ name: permission.subDepartment }).select('_id').lean();
      if (dept) deptId = String(dept._id);
    }

    // สร้าง session
    req.session.user = {
      userId: umsUser._id,
      username: umsUser.username,
      email: umsUser.email || '',
      firstName: umsUser.firstName || '',
      lastName: umsUser.lastName || '',
      systemRole: umsUser.systemRole || 'member',
      role: permission.role || 'member',
      subDepartment: permission.subDepartment || null,
      deptId, // ObjectId string ของหน่วยงาน
    };

    await logAction({
      userId: umsUser._id,
      username: umsUser.username,
      action: 'LOGIN',
      module: 'AUTH',
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { role: permission.role, subDepartment: permission.subDepartment },
    });

    logger.info(`[Auth] User ${umsUser.username} logged in (role: ${permission.role})`);

    // Redirect ไปหน้าหลัก
    return res.redirect('/docs/');
  } catch (err) {
    if (err.response?.status === 401) {
      return res.redirect('/docs/?error=invalid_token');
    }
    logger.error('[Auth] callback error:', err.message);
    return res.redirect('/docs/?error=server_error');
  }
}

/**
 * POST /api/auth/logout
 * ทำลาย session ฝั่ง app
 */
async function logout(req, res) {
  const user = req.session?.user;

  if (user) {
    await logAction({
      userId: user.userId,
      username: user.username,
      action: 'LOGOUT',
      module: 'AUTH',
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });
  }

  req.session.destroy((err) => {
    if (err) logger.error('[Auth] session destroy error:', err.message);
    res.clearCookie(config.session.cookieName);
    return sendSuccess(res, null, 'ออกจากระบบเรียบร้อย');
  });
}

/**
 * GET /api/auth/me
 * คืนข้อมูล session ปัจจุบัน
 */
async function me(req, res) {
  return sendSuccess(res, req.user, 'ข้อมูลผู้ใช้');
}

module.exports = { login, callback, logout, me };
