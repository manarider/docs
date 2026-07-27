const fs = require('fs');
const Procurement = require('../../models/Procurement');
const Project = require('../../models/Project');
const config = require('../../config');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const {
  moveFilesToProjectFolder,
  cleanupTmpFiles,
  resizeProjectPhotos,
} = require('./project.upload');
const logger = require('../../utils/logger');

function isSafePath(filePath) {
  if (!filePath) return false;
  const normalized = require('path').resolve(filePath);
  return normalized.startsWith(config.storage.basePath);
}

/**
 * GET /api/projects/:projectId/procurement
 */
async function listProcurement(req, res) {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      Procurement.find({ project_id: projectId })
        .select('-receive_photos.file_path -inspection_photos.file_path')
        .sort({ receive_date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean({ virtuals: true }),
      Procurement.countDocuments({ project_id: projectId }),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Procurement] listProcurement error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/projects/:projectId/procurement
 * multipart/form-data:
 *   receive_photos[]      (รูปการรับพัสดุ)
 *   inspection_photos[]   (รูปการตรวจรับ)
 *   receive_date
 *   item_type             (equipment | material | other)
 *   description
 *   quantity
 *   equipment_no          (optional)
 */
async function createProcurement(req, res) {
  const uploadedFiles = req.files || {};
  try {
    const { projectId } = req.params;
    const { receive_date, item_type, description, quantity, equipment_no, equipment_serial_list } = req.body;

    if (!receive_date) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, 'กรุณาระบุวันที่รับ'); }
    if (!['equipment', 'material', 'other'].includes(item_type)) {
      cleanupTmpFiles(uploadedFiles); return sendError(res, 400, 'ประเภทพัสดุไม่ถูกต้อง');
    }
    if (!description?.trim()) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, 'กรุณาระบุรายละเอียดพัสดุ'); }
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) { cleanupTmpFiles(uploadedFiles); return sendError(res, 400, 'จำนวนต้องมากกว่า 0'); }

    const project = await Project.findById(projectId);
    if (!project) { cleanupTmpFiles(uploadedFiles); return sendError(res, 404, 'ไม่พบโครงการ'); }
    if (project.status === 'closed') { cleanupTmpFiles(uploadedFiles); return sendError(res, 403, 'โครงการปิดแล้ว'); }

    const receivePhotos = moveFilesToProjectFolder(
      uploadedFiles.receive_photos || [],
      project.storage_base,
      'procurement'
    );
    const inspectPhotos = moveFilesToProjectFolder(
      uploadedFiles.inspection_photos || [],
      project.storage_base,
      'procurement'
    );

    // resize photos
    await resizeProjectPhotos(receivePhotos);
    await resizeProjectPhotos(inspectPhotos);

    // parse equipment_serial_list
    let parsedSerialList = [];
    if (item_type === 'equipment' && equipment_serial_list) {
      try {
        const list = typeof equipment_serial_list === 'string'
          ? JSON.parse(equipment_serial_list)
          : equipment_serial_list;
        if (Array.isArray(list)) {
          parsedSerialList = list.slice(0, qty).map((e) => ({
            serial_no: String(e.serial_no || '').trim(),
            equipment_no: String(e.equipment_no || '').trim(),
          }));
        }
      } catch { /* ignore parse error */ }
    }

    const { isKeyUser, keyId, userId } = req.projectUser;

    const item = await Procurement.create({
      project_id: projectId,
      receive_date: new Date(receive_date),
      item_type,
      description: description.trim(),
      quantity: qty,
      equipment_no: equipment_no?.trim() || '',
      equipment_serial_list: parsedSerialList,
      receive_photos: receivePhotos,
      inspection_photos: inspectPhotos,
      created_by_user: isKeyUser ? null : userId,
      created_by_key: isKeyUser ? keyId : null,
      created_role: req.projectUser.role,
    });

    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : req.projectUser.username,
      action: 'CREATE',
      module: 'PROCUREMENT',
      resourceId: String(item._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { project_id: projectId, item_type, description: description.trim(), quantity: qty },
    });

    return sendSuccess(res, item, 'บันทึกการรับพัสดุแล้ว', 201);
  } catch (err) {
    cleanupTmpFiles(uploadedFiles);
    logger.error('[Procurement] createProcurement error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/procurement/:itemId
 */
async function getProcurement(req, res) {
  try {
    const { itemId } = req.params;
    const item = await Procurement.findById(itemId)
      .select('-receive_photos.file_path -inspection_photos.file_path')
      .lean({ virtuals: true });
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูลพัสดุ');
    return sendSuccess(res, item);
  } catch (err) {
    logger.error('[Procurement] getProcurement error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/projects/:projectId/procurement/:itemId
 * แก้ไขข้อมูลพัสดุ (equipment_no แก้ไขได้)
 */
async function updateProcurement(req, res) {
  try {
    const { projectId, itemId } = req.params;
    const { equipment_no, description, receive_date } = req.body;

    const update = {};
    if (equipment_no !== undefined) update.equipment_no = String(equipment_no).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (receive_date !== undefined) update.receive_date = new Date(receive_date);
    // update equipment_serial_list
    const { equipment_serial_list } = req.body;
    if (equipment_serial_list !== undefined) {
      try {
        const list = typeof equipment_serial_list === 'string'
          ? JSON.parse(equipment_serial_list)
          : equipment_serial_list;
        if (Array.isArray(list)) {
          update.equipment_serial_list = list.map((e) => ({
            serial_no: String(e.serial_no || '').trim(),
            equipment_no: String(e.equipment_no || '').trim(),
          }));
        }
      } catch { /* ignore */ }
    }
    if (Object.keys(update).length === 0) return sendError(res, 400, 'ไม่มีข้อมูลที่จะอัปเดต');

    const item = await Procurement.findOneAndUpdate(
      { _id: itemId, project_id: projectId },
      update,
      { new: true }
    ).select('-receive_photos.file_path -inspection_photos.file_path').lean({ virtuals: true });
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูลพัสดุ');

    return sendSuccess(res, item, 'อัปเดตข้อมูลพัสดุแล้ว');
  } catch (err) {
    logger.error('[Procurement] updateProcurement error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/projects/:projectId/procurement/:itemId/issue
 * บันทึกการเบิกจ่ายพัสดุ
 * body: { issued_date, quantity, purpose }
 */
async function issueProcurement(req, res) {
  try {
    const { projectId, itemId } = req.params;
    const { issued_date, quantity, purpose } = req.body;

    if (!issued_date) return sendError(res, 400, 'กรุณาระบุวันที่จ่าย');
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) return sendError(res, 400, 'จำนวนต้องมากกว่า 0');

    const item = await Procurement.findOne({ _id: itemId, project_id: projectId });
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูลพัสดุ');

    // ตรวจสอบจำนวนคงเหลือ
    const totalIssued = item.issued_items.reduce((sum, i) => sum + i.quantity, 0);
    const remaining = item.quantity - totalIssued;
    if (qty > remaining) {
      return sendError(res, 400, `จำนวนเกินคงเหลือ (คงเหลือ: ${remaining} ${item.item_type === 'equipment' ? 'เครื่อง' : 'รายการ'})`);
    }

    const { isKeyUser, keyId, userId } = req.projectUser;

    item.issued_items.push({
      issued_date: new Date(issued_date),
      quantity: qty,
      purpose: purpose?.trim() || '',
      issued_by_user: isKeyUser ? null : userId,
      issued_by_key: isKeyUser ? keyId : null,
      issued_role: req.projectUser.role,
    });
    await item.save();

    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : req.projectUser.username,
      action: 'UPDATE',
      module: 'PROCUREMENT',
      resourceId: String(item._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { action: 'issue', quantity: qty, purpose: purpose?.trim(), remaining: remaining - qty },
    });

    const updated = await Procurement.findById(itemId)
      .select('-receive_photos.file_path -inspection_photos.file_path')
      .lean({ virtuals: true });
    return sendSuccess(res, updated, 'บันทึกการเบิกจ่ายแล้ว');
  } catch (err) {
    logger.error('[Procurement] issueProcurement error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/procurement/:itemId/receive-photos/:index
 */
async function viewReceivePhoto(req, res) {
  try {
    const { itemId } = req.params;
    const idx = parseInt(req.params.index, 10);
    const item = await Procurement.findById(itemId).select('+receive_photos.file_path').lean();
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูล');
    const photo = item.receive_photos?.[idx];
    if (!photo?.file_path || !isSafePath(photo.file_path) || !fs.existsSync(photo.file_path)) return sendError(res, 404, 'ไม่พบรูปภาพ');
    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(photo.file_path).pipe(res);
  } catch (err) {
    logger.error('[Procurement] viewReceivePhoto error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/procurement/:itemId/inspect-photos/:index
 */
async function viewInspectPhoto(req, res) {
  try {
    const { itemId } = req.params;
    const idx = parseInt(req.params.index, 10);
    const item = await Procurement.findById(itemId).select('+inspection_photos.file_path').lean();
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูล');
    const photo = item.inspection_photos?.[idx];
    if (!photo?.file_path || !isSafePath(photo.file_path) || !fs.existsSync(photo.file_path)) return sendError(res, 404, 'ไม่พบรูปภาพ');
    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(photo.file_path).pipe(res);
  } catch (err) {
    logger.error('[Procurement] viewInspectPhoto error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/projects/:projectId/procurement/:itemId
 */
async function deleteProcurement(req, res) {
  try {
    const { projectId, itemId } = req.params;
    const item = await Procurement.findOneAndDelete({ _id: itemId, project_id: projectId });
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูลพัสดุ');

    // ลบไฟล์รูปภาพ
    const allPhotoPaths = [
      ...(item.receive_photos || []).map((p) => p.file_path),
      ...(item.inspection_photos || []).map((p) => p.file_path),
    ].filter(Boolean);
    for (const fp of allPhotoPaths) {
      if (isSafePath(fp)) { try { fs.unlinkSync(fp); } catch {} }
    }

    const { isKeyUser, keyId, userId } = req.projectUser;
    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : req.projectUser.username,
      action: 'DELETE',
      module: 'PROCUREMENT',
      resourceId: String(item._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { project_id: projectId },
    });

    return sendSuccess(res, null, 'ลบรายการพัสดุแล้ว');
  } catch (err) {
    logger.error('[Procurement] deleteProcurement error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = {
  listProcurement,
  createProcurement,
  getProcurement,
  updateProcurement,
  issueProcurement,
  viewReceivePhoto,
  viewInspectPhoto,
  deleteProcurement,
};
