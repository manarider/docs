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
 * superadmin > admin > manager > staff > member > viewer
 */
const ROLE_LEVEL = {
  superadmin: 50,
  admin: 40,
  manager: 30,
  staff: 25,
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

/**
 * middleware: เฉพาะ role 'outsourced' หรือ internal staff/admin ขึ้นไป
 * ใช้กับเมนู Outsourced ที่แยกอิสระจาก hierarchy ปกติ
 */
function requireOutsourcedAccess(req, res, next) {
  if (!req.user) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
  const isOutsourced = req.user.role === 'outsourced';
  const isStaffUp = (ROLE_LEVEL[req.user.role] || 0) >= ROLE_LEVEL.staff;
  if (!isOutsourced && !isStaffUp) {
    return sendError(res, 403, 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }
  next();
}

/**
 * middleware: เฉพาะ internal staff/admin ขึ้นไป (จัดการกลุ่มงาน/ฟอร์ม)
 */
function requireOutsourcedManage(req, res, next) {
  if (!req.user) return sendError(res, 401, 'กรุณาเข้าสู่ระบบ');
  const isStaffUp = (ROLE_LEVEL[req.user.role] || 0) >= ROLE_LEVEL.staff;
  if (!isStaffUp) {
    return sendError(res, 403, 'ต้องการสิทธิ์ระดับ staff ขึ้นไป');
  }
  next();
}

module.exports = { authenticate, requireRole, ROLE_LEVEL, requireOutsourcedAccess, requireOutsourcedManage };
