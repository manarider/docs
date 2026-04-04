const { sendError } = require('../utils/response');

/**
 * middleware: ต้อง login แล้วเท่านั้น
 */
function authenticate(req, res, next) {
  if (!req.session?.user) {
    return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
  }
  req.user = req.session.user;
  next();
}

/**
 * RBAC roles hierarchy
 * superadmin > admin > manager > member > viewer
 */
const ROLE_LEVEL = {
  superadmin: 50,
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
};

/**
 * middleware: ต้อง role >= minRole
 */
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    const requiredLevel = ROLE_LEVEL[minRole] || 0;
    if (userLevel < requiredLevel) {
      return sendError(res, 403, 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
    }
    next();
  };
}

module.exports = { authenticate, requireRole, ROLE_LEVEL };
