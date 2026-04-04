const DocType = require('../../models/DocType');
const Document = require('../../models/Document');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

async function listDocTypes(req, res) {
  try {
    const filter = { deletedAt: null, pendingApproval: false };
    if (req.query.active !== 'all') filter.isActive = true;
    const types = await DocType.find(filter).sort({ name: 1 }).lean();
    return sendSuccess(res, types, 'รายการประเภทเอกสาร');
  } catch (err) {
    logger.error('[DocType] list error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

// admin — รายการที่รอการอนุมัติ
async function listPending(req, res) {
  try {
    const types = await DocType.find({ deletedAt: null, pendingApproval: true }).sort({ createdAt: 1 }).lean();
    return sendSuccess(res, types, 'รายการรอการอนุมัติ');
  } catch (err) {
    logger.error('[DocType] listPending error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

async function getDocType(req, res) {
  try {
    const type = await DocType.findOne({ _id: req.params.id, deletedAt: null }).lean();
    if (!type) return sendError(res, 404, 'ไม่พบประเภทเอกสาร');
    return sendSuccess(res, type, 'รายละเอียดประเภทเอกสาร');
  } catch (err) {
    logger.error('[DocType] get error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

// admin — สร้างตรง (active ทันที)
async function createDocType(req, res) {
  try {
    const { name, code, description } = req.body;
    const existing = await DocType.findOne({ code: code.toUpperCase(), deletedAt: null });
    if (existing) return sendError(res, 409, 'รหัสประเภทเอกสารนี้มีอยู่แล้ว');

    const type = await DocType.create({ name, code, description });

    await logAction({
      userId: req.user.userId, username: req.user.username,
      action: 'CREATE', module: 'DOCTYPE', resourceId: type._id,
      ipAddress: getIp(req), userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, type, 'สร้างประเภทเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[DocType] create error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

// ผู้ใช้ทั่วไป — ขอเพิ่มประเภทใหม่ (รอ admin อนุมัติ)
async function requestDocType(req, res) {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return sendError(res, 400, 'กรุณาระบุชื่อประเภทเอกสาร');

    // auto-generate code จากชื่อ
    const baseCode = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15);
    const suffix = Date.now().toString(36).toUpperCase().slice(-4);
    const code = `${baseCode}_${suffix}`;

    const type = await DocType.create({
      name: name.trim(),
      code,
      description,
      isActive: false,
      pendingApproval: true,
      requestedBy: req.user.userId,
    });

    await logAction({
      userId: req.user.userId, username: req.user.username,
      action: 'REQUEST', module: 'DOCTYPE', resourceId: type._id,
      ipAddress: getIp(req), userAgent: req.headers['user-agent'],
      details: { name: type.name },
    });

    return sendSuccess(res, type, 'ส่งคำขอเพิ่มประเภทเอกสารเรียบร้อย รอ Admin อนุมัติ');
  } catch (err) {
    logger.error('[DocType] request error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

// admin — อนุมัติประเภทที่รอ
async function approveDocType(req, res) {
  try {
    const type = await DocType.findOne({ _id: req.params.id, deletedAt: null, pendingApproval: true });
    if (!type) return sendError(res, 404, 'ไม่พบรายการที่รอการอนุมัติ');

    type.pendingApproval = false;
    type.isActive = true;
    await type.save();

    await logAction({
      userId: req.user.userId, username: req.user.username,
      action: 'APPROVE', module: 'DOCTYPE', resourceId: type._id,
      ipAddress: getIp(req), userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, type, 'อนุมัติประเภทเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[DocType] approve error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

// admin — ดูเอกสารที่ใช้ประเภทนี้ (สำหรับก่อนลบ)
async function getDocTypeDocuments(req, res) {
  try {
    const docs = await Document.find({ type_id: req.params.id, deleted_at: null })
      .select('title dept_id fiscal_year')
      .populate('dept_id', 'name')
      .lean();
    return sendSuccess(res, docs, 'เอกสารที่ใช้ประเภทนี้');
  } catch (err) {
    logger.error('[DocType] getDocTypeDocuments error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

async function updateDocType(req, res) {
  try {
    const type = await DocType.findOne({ _id: req.params.id, deletedAt: null });
    if (!type) return sendError(res, 404, 'ไม่พบประเภทเอกสาร');

    if (req.body.name !== undefined) type.name = req.body.name;
    if (req.body.description !== undefined) type.description = req.body.description;
    if (req.body.isActive !== undefined) type.isActive = req.body.isActive;
    await type.save();

    await logAction({
      userId: req.user.userId, username: req.user.username,
      action: 'UPDATE', module: 'DOCTYPE', resourceId: type._id,
      ipAddress: getIp(req), userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, type, 'อัปเดตประเภทเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[DocType] update error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

async function deleteDocType(req, res) {
  try {
    const type = await DocType.findOne({ _id: req.params.id, deletedAt: null });
    if (!type) return sendError(res, 404, 'ไม่พบประเภทเอกสาร');

    // ตรวจสอบว่ายังมีเอกสารอยู่หรือไม่
    const count = await Document.countDocuments({ type_id: req.params.id, deleted_at: null });
    if (count > 0) {
      return sendError(res, 409, `ไม่สามารถลบได้ ยังมีเอกสาร ${count} รายการที่ใช้ประเภทนี้`);
    }

    type.deletedAt = new Date();
    type.isActive = false;
    await type.save();

    await logAction({
      userId: req.user.userId, username: req.user.username,
      action: 'DELETE', module: 'DOCTYPE', resourceId: type._id,
      ipAddress: getIp(req), userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, null, 'ลบประเภทเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[DocType] delete error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { listDocTypes, listPending, getDocType, createDocType, requestDocType, approveDocType, getDocTypeDocuments, updateDocType, deleteDocType };
