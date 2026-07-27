const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const WorkAcceptance = require('../../models/WorkAcceptance');
const Project = require('../../models/Project');
const Document = require('../../models/Document');
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
  const normalized = path.resolve(filePath);
  return normalized.startsWith(config.storage.basePath);
}

/**
 * GET /api/projects/:projectId/acceptance
 */
async function listAcceptance(req, res) {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [items, total] = await Promise.all([
      WorkAcceptance.find({ project_id: projectId })
        .select('-inspection_photos.file_path')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      WorkAcceptance.countDocuments({ project_id: projectId }),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Acceptance] listAcceptance error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/projects/:projectId/acceptance
 * multipart/form-data:
 *   inspection_photos[]   (ไม่จำกัด)
 *   notes
 *   delivery_doc_title    (ถ้าต้องการ upload เอกสารส่งมอบด้วย)
 *   delivery_doc          (file เอกสาร PDF/Word ไฟล์เดียว)
 */
async function createAcceptance(req, res) {
  const uploadedPhotos = req.files?.inspection_photos || [];
  const uploadedDoc = req.files?.delivery_doc?.[0] || null;
  try {
    const { projectId } = req.params;
    const { notes, delivery_doc_title } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      cleanupTmpFiles([...uploadedPhotos, ...(uploadedDoc ? [uploadedDoc] : [])]);
      return sendError(res, 404, 'ไม่พบโครงการ');
    }
    if (project.status === 'closed') {
      cleanupTmpFiles([...uploadedPhotos, ...(uploadedDoc ? [uploadedDoc] : [])]);
      return sendError(res, 403, 'โครงการปิดแล้ว');
    }

    // ย้ายรูปตรวจรับ + resize
    const movedPhotos = moveFilesToProjectFolder(uploadedPhotos, project.storage_base, 'acceptance');
    await resizeProjectPhotos(movedPhotos);

    // ถ้ามีเอกสารส่งมอบ → บันทึกเป็น attachment ใน Document (PRJ)
    let delivery_doc_sub_id = null;
    let delivery_doc_title_saved = null;

    if (uploadedDoc && delivery_doc_title?.trim()) {
      try {
        const doc = await Document.findById(project.document_id);
        if (doc) {
          // หา storage path ของ Document
          const Department = require('../../models/Department');
          const DocType = require('../../models/DocType');
          const [dept, docType] = await Promise.all([
            Department.findById(doc.dept_id).select('code').lean(),
            DocType.findById(doc.type_id).select('code').lean(),
          ]);

          let destDir;
          if (dept && docType) {
            const config = require('../../config');
            const { getFiscalYear } = require('../../utils/fiscalYear');
            destDir = path.join(
              config.storage.basePath,
              dept.code.toLowerCase(),
              String(doc.fiscal_year || getFiscalYear()),
              docType.code.toLowerCase()
            );
            fs.mkdirSync(destDir, { recursive: true });
          } else {
            destDir = path.join(project.storage_base, 'acceptance');
          }

          const ext = path.extname(uploadedDoc.originalname).toLowerCase();
          const savedName = `${uuidv4()}${ext}`;
          const destPath = path.join(destDir, savedName);
          fs.renameSync(uploadedDoc.path, destPath);

          const sub_id = uuidv4();
          doc.attachments.push({
            sub_id,
            sub_title: delivery_doc_title.trim(),
            att_type: 'file',
            file_path: destPath,
            file_size: uploadedDoc.size,
            mime_type: uploadedDoc.mimetype,
            original_name: uploadedDoc.originalname,
            uploaded_by: req.projectUser.isKeyUser
              ? project.created_by
              : (req.projectUser.userId),
          });
          await doc.save();

          delivery_doc_sub_id = sub_id;
          delivery_doc_title_saved = delivery_doc_title.trim();
        } else {
          // ถ้าหา Document ไม่เจอ → ทิ้ง tmp
          try { fs.unlinkSync(uploadedDoc.path); } catch {}
        }
      } catch (docErr) {
        logger.error('[Acceptance] delivery_doc upload error:', docErr.message);
        try { fs.unlinkSync(uploadedDoc.path); } catch {}
      }
    } else if (uploadedDoc) {
      // มีไฟล์แต่ไม่มีชื่อ → ลบ tmp
      try { fs.unlinkSync(uploadedDoc.path); } catch {}
    }

    const { isKeyUser, keyId, userId } = req.projectUser;

    const acceptance = await WorkAcceptance.create({
      project_id: projectId,
      inspection_photos: movedPhotos,
      delivery_doc_sub_id,
      delivery_doc_title: delivery_doc_title_saved,
      notes: notes?.trim() || '',
      accepted_by_user: isKeyUser ? null : userId,
      accepted_by_key: isKeyUser ? keyId : null,
      accepted_role: req.projectUser.role,
    });

    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : req.projectUser.username,
      action: 'CREATE',
      module: 'WORK_ACCEPTANCE',
      resourceId: String(acceptance._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { project_id: projectId, has_delivery_doc: !!delivery_doc_sub_id },
    });

    return sendSuccess(res, acceptance, 'บันทึกการตรวจรับงานแล้ว', 201);
  } catch (err) {
    cleanupTmpFiles([...uploadedPhotos, ...(uploadedDoc ? [uploadedDoc] : [])]);
    logger.error('[Acceptance] createAcceptance error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/acceptance/:acceptId
 */
async function getAcceptance(req, res) {
  try {
    const { acceptId } = req.params;
    const item = await WorkAcceptance.findById(acceptId)
      .select('-inspection_photos.file_path')
      .lean();
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูลการตรวจรับ');
    return sendSuccess(res, item);
  } catch (err) {
    logger.error('[Acceptance] getAcceptance error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/projects/:projectId/acceptance/:acceptId
 * แก้ไข notes + เพิ่มรูปภาพ (ทุกคนที่ access โครงการแก้ไขได้)
 */
async function updateAcceptance(req, res) {
  const uploadedFiles = req.files || {};
  try {
    const { projectId, acceptId } = req.params;
    const { notes } = req.body;
    const update = {};
    if (notes !== undefined) update.notes = String(notes).trim();

    // เพิ่มรูปภาพใหม่ (ถ้ามี)
    const newPhotos = uploadedFiles.inspection_photos || [];
    if (newPhotos.length > 0) {
      const project = await Project.findById(projectId).select('storage_base').lean();
      if (project) {
        const movedPhotos = moveFilesToProjectFolder(newPhotos, project.storage_base, 'acceptance');
        await resizeProjectPhotos(movedPhotos);
        // push ต่อท้าย inspection_photos เดิม
        const existing = await WorkAcceptance.findOne({ _id: acceptId, project_id: projectId }).select('inspection_photos').lean();
        if (existing) {
          update.$push = { inspection_photos: { $each: movedPhotos } };
        }
      }
    }

    if (Object.keys(update).length === 0) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 400, 'ไม่มีข้อมูลที่จะอัปเดต');
    }

    const item = await WorkAcceptance.findOneAndUpdate(
      { _id: acceptId, project_id: projectId },
      update,
      { new: true }
    ).select('-inspection_photos.file_path').lean();
    if (!item) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 404, 'ไม่พบข้อมูลการตรวจรับ');
    }
    return sendSuccess(res, item, 'อัปเดตแล้ว');
  } catch (err) {
    cleanupTmpFiles(uploadedFiles);
    logger.error('[Acceptance] updateAcceptance error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/projects/:projectId/acceptance/:acceptId
 */
async function deleteAcceptance(req, res) {
  try {
    const { projectId, acceptId } = req.params;
    const item = await WorkAcceptance.findOneAndDelete({ _id: acceptId, project_id: projectId });
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูลการตรวจรับ');

    // ลบรูปภาพ
    for (const p of item.inspection_photos || []) {
      if (p?.file_path && isSafePath(p.file_path)) {
        try { fs.unlinkSync(p.file_path); } catch {}
      }
    }

    const { isKeyUser, keyId, userId } = req.projectUser;
    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : req.projectUser.username,
      action: 'DELETE',
      module: 'WORK_ACCEPTANCE',
      resourceId: String(item._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { project_id: projectId },
    });

    return sendSuccess(res, null, 'ลบรายการตรวจรับแล้ว');
  } catch (err) {
    logger.error('[Acceptance] deleteAcceptance error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/acceptance/:acceptId/photos/:index
 */
async function viewAcceptancePhoto(req, res) {
  try {
    const { acceptId } = req.params;
    const idx = parseInt(req.params.index, 10);
    const item = await WorkAcceptance.findById(acceptId)
      .select('+inspection_photos.file_path')
      .lean();
    if (!item) return sendError(res, 404, 'ไม่พบข้อมูล');
    const photo = item.inspection_photos?.[idx];
    if (!photo?.file_path || !isSafePath(photo.file_path) || !fs.existsSync(photo.file_path)) return sendError(res, 404, 'ไม่พบรูปภาพ');
    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(photo.file_path).pipe(res);
  } catch (err) {
    logger.error('[Acceptance] viewAcceptancePhoto error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = {
  listAcceptance,
  createAcceptance,
  getAcceptance,
  updateAcceptance,
  viewAcceptancePhoto,
  deleteAcceptance,
};
