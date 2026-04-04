const Department = require('../../models/Department');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * GET /api/departments
 */
async function listDepartments(req, res) {
  try {
    const filter = { deletedAt: null };
    if (req.query.active !== 'all') filter.isActive = true;

    const depts = await Department.find(filter).sort({ name: 1 }).lean();
    return sendSuccess(res, depts, 'รายการหน่วยงาน');
  } catch (err) {
    logger.error('[Dept] list error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/departments/:id
 */
async function getDepartment(req, res) {
  try {
    const dept = await Department.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!dept) return sendError(res, 404, 'ไม่พบหน่วยงาน');
    return sendSuccess(res, dept, 'รายละเอียดหน่วยงาน');
  } catch (err) {
    logger.error('[Dept] get error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/departments  (admin+)
 */
async function createDepartment(req, res) {
  try {
    const { name, code } = req.body;
    const existing = await Department.findOne({ code: code.toUpperCase(), deletedAt: null });
    if (existing) return sendError(res, 409, 'รหัสหน่วยงานนี้มีอยู่แล้ว');

    const dept = await Department.create({ name, code, createdBy: req.user.userId });

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'CREATE',
      module: 'DEPARTMENT',
      resourceId: dept._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, dept, 'สร้างหน่วยงานเรียบร้อย');
  } catch (err) {
    logger.error('[Dept] create error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/departments/:id  (admin+)
 */
async function updateDepartment(req, res) {
  try {
    const dept = await Department.findOne({ _id: req.params.id, deletedAt: null });
    if (!dept) return sendError(res, 404, 'ไม่พบหน่วยงาน');

    if (req.body.name !== undefined) dept.name = req.body.name;
    if (req.body.isActive !== undefined) dept.isActive = req.body.isActive;
    await dept.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'UPDATE',
      module: 'DEPARTMENT',
      resourceId: dept._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, dept, 'อัปเดตหน่วยงานเรียบร้อย');
  } catch (err) {
    logger.error('[Dept] update error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/departments/:id  (admin+) — soft delete
 */
async function deleteDepartment(req, res) {
  try {
    const dept = await Department.findOne({ _id: req.params.id, deletedAt: null });
    if (!dept) return sendError(res, 404, 'ไม่พบหน่วยงาน');

    dept.deletedAt = new Date();
    dept.isActive = false;
    await dept.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DELETE',
      module: 'DEPARTMENT',
      resourceId: dept._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, null, 'ลบหน่วยงานเรียบร้อย');
  } catch (err) {
    logger.error('[Dept] delete error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment };
