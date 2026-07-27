const { sendError } = require('../utils/response');

/**
 * สิทธิ์ของแต่ละ role ในระบบโครงการ
 */
const PROJECT_ROLE_PERMISSIONS = {
  contractor: ['read', 'daily_report:write'],
  supervisor: ['read', 'daily_report:write', 'procurement:write', 'acceptance:write'],
  project_manager: ['read', 'acceptance:write'],
  internal: ['read', 'daily_report:write', 'procurement:write', 'acceptance:write', 'keys:manage'],
};

const INTERNAL_ROLE_LEVEL = {
  superadmin: 50,
  admin: 40,
  manager: 30,
  staff: 25,
  member: 20,
  viewer: 10,
};

/**
 * Middleware: ตรวจสอบ session ผู้ใช้ระบบโครงการ
 * รองรับทั้ง internal user (req.session.user) และ KEY user (req.session.project_user)
 */
function authenticateProject(req, res, next) {
  // Internal user มีสิทธิ์สูงกว่า KEY → ตรวจก่อน
  if (req.session?.user) {
    const u = req.session.user;
    req.projectUser = {
      userId: u.userId,
      username: u.username,
      role: 'internal',
      internalRole: u.role || 'member',
      isKeyUser: false,
      permissions: PROJECT_ROLE_PERMISSIONS.internal,
    };
    return next();
  }

  // KEY user
  const pk = req.session?.project_user;
  if (!pk) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');

  // Double-check expiry ทุก request
  if (new Date(pk.expiresAt) < new Date()) {
    delete req.session.project_user;
    return sendError(res, 401, 'KEY หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่');
  }

  // ถ้า projectId อยู่ใน params ให้ตรวจสอบว่าตรงกัน
  if (req.params.projectId && pk.projectId !== req.params.projectId) {
    return sendError(res, 403, 'ไม่มีสิทธิ์เข้าถึงโครงการนี้');
  }

  req.projectUser = {
    keyId: pk.keyId,
    projectId: pk.projectId,
    role: pk.role,
    label: pk.label,
    isKeyUser: true,
    permissions: PROJECT_ROLE_PERMISSIONS[pk.role] || ['read'],
  };
  next();
}

/**
 * Middleware: ตรวจสอบสิทธิ์การดำเนินการ
 * @param {string} permission - เช่น 'daily_report:write', 'procurement:write', 'keys:manage'
 */
function requireProjectPermission(permission) {
  return (req, res, next) => {
    if (!req.projectUser) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
    if (!req.projectUser.permissions.includes(permission)) {
      return sendError(res, 403, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
    }
    next();
  };
}

/**
 * Middleware: เฉพาะ internal user ที่มี role ≥ staff
 * ใช้สำหรับการจัดการ KEY
 */
function requireInternalStaff(req, res, next) {
  if (!req.projectUser) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
  if (req.projectUser.isKeyUser) return sendError(res, 403, 'เฉพาะผู้ใช้ภายในเท่านั้น');
  const level = INTERNAL_ROLE_LEVEL[req.projectUser.internalRole] || 0;
  if (level < INTERNAL_ROLE_LEVEL.staff) {
    return sendError(res, 403, 'ต้องการสิทธิ์ระดับ staff ขึ้นไป');
  }
  next();
}

/**
 * Middleware: เฉพาะ internal user ที่มี role ≥ admin
 */
function requireInternalAdmin(req, res, next) {
  if (!req.projectUser) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
  if (req.projectUser.isKeyUser) return sendError(res, 403, 'เฉพาะผู้ใช้ภายในเท่านั้น');
  const level = INTERNAL_ROLE_LEVEL[req.projectUser.internalRole] || 0;
  if (level < INTERNAL_ROLE_LEVEL.admin) {
    return sendError(res, 403, 'ต้องการสิทธิ์ระดับ admin ขึ้นไป');
  }
  next();
}

module.exports = {
  authenticateProject,
  requireProjectPermission,
  requireInternalStaff,
  requireInternalAdmin,
  PROJECT_ROLE_PERMISSIONS,
};
