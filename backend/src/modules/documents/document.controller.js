const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const Document = require('../../models/Document');
const Department = require('../../models/Department');
const DocType = require('../../models/DocType');
const SystemSettings = require('../../models/SystemSettings');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const { buildStoragePath } = require('./document.upload');
const logger = require('../../utils/logger');

/**
 * คำนวณ SHA-256 checksum ของไฟล์
 */
function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * GET /api/documents
 * ดึงรายการเอกสารพร้อม pagination + filter
 */
async function listDocuments(req, res) {
  try {
    const { page = 1, limit = 20, dept, type, year, q, is_public } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const filter = { deleted_at: null };
    if (dept) filter.dept_id = dept;
    if (type) filter.type_id = type;
    if (year) filter.fiscal_year = parseInt(year, 10);
    if (is_public === 'true') filter.is_public = true;
    if (q) filter.$text = { $search: q };

    // ถ้าไม่ใช่ admin/manager กรองโดยหน่วยงานตัวเอง + เอกสารสาธารณะที่ยังไม่หมดเวลา
    const userRole = req.user?.role;
    if (!['superadmin', 'admin', 'manager'].includes(userRole)) {
      const now = new Date();
      const publicActiveCond = {
        is_public: true,
        $or: [{ public_expires_at: null }, { public_expires_at: { $gt: now } }],
      };
      if (req.user?.deptId) {
        filter.$or = [{ dept_id: req.user.deptId }, publicActiveCond];
      } else {
        Object.assign(filter, publicActiveCond);
      }
    }

    const [docs, total] = await Promise.all([
      Document.find(filter)
        .populate('dept_id', 'name code')
        .populate('type_id', 'name code')
        .select('-attachments.file_path -attachments.checksum -images.file_path')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(filter),
    ]);

    // กรองเฉพาะ attachments ที่ยังไม่ถูกลบ
    docs.forEach((d) => {
      if (d.attachments) d.attachments = d.attachments.filter((a) => !a.deleted_at);
    });

    return res.json({
      success: true,
      data: docs,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Document] listDocuments error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/documents
 * สร้างเอกสารใหม่ (ไม่มีไฟล์แนบ → เพิ่มภายหลัง)
 */
async function createDocument(req, res) {
  try {
    const { title, description, dept_id, type_id, tags } = req.body;

    // ตรวจชื่อซ้ำ (case-insensitive, เฉพาะ active + ไม่ถูกลบ)
    const existing = await Document.findOne({
      title: { $regex: `^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      deleted_at: null,
    });
    if (existing) return sendError(res, 409, 'มีเอกสารชื่อนี้อยู่แล้ว');

    const doc = await Document.create({
      title,
      description,
      dept_id,
      type_id,
      tags: Array.isArray(tags) ? tags : [],
      is_public: false, // เปิด public ได้เฉพาะผ่านหน้าแก้ไขเท่านั้น
      public_expires_at: null,
      created_by: req.user.userId,
    });

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'CREATE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { title, dept_id, type_id },
    });

    return sendSuccess(res, doc, 'สร้างเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[Document] createDocument error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/documents/:id
 * ดูรายละเอียดเอกสาร + นับยอดวิว
 */
async function getDocument(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null })
      .populate('dept_id', 'name code')
      .populate('type_id', 'name code')
      .select('-attachments.file_path -attachments.checksum -images.file_path')
      .lean();

    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    // ตรวจสิทธิ์ดู
    const userRole = req.user?.role;
    const now = new Date();
    const isCurrentlyPublic =
      doc.is_public && (!doc.public_expires_at || new Date(doc.public_expires_at) > now);
    if (!isCurrentlyPublic && !['superadmin', 'admin', 'manager'].includes(userRole)) {
      if (String(doc.created_by) !== req.user?.userId) {
        return sendError(res, 403, 'คุณไม่มีสิทธิ์ดูเอกสารนี้');
      }
    }

    // กรองเฉพาะ attachments ที่ยังไม่ถูกลบ
    if (doc.attachments) doc.attachments = doc.attachments.filter((a) => !a.deleted_at);

    // นับวิว
    await Document.updateOne({ _id: doc._id }, { $inc: { views: 1 } });

    await logAction({
      userId: req.user?.userId || 'anonymous',
      username: req.user?.username || 'anonymous',
      action: 'VIEW',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, doc, 'รายละเอียดเอกสาร');
  } catch (err) {
    logger.error('[Document] getDocument error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/documents/:id
 * แก้ไขข้อมูลเอกสาร (ไม่ใช่ไฟล์)
 */
async function updateDocument(req, res) {
  try {
    const { title, description, tags, is_public } = req.body;
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null });
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    // ตรวจสิทธิ์: owner หรือ admin+
    const userRole = req.user.role;
    if (!['superadmin', 'admin'].includes(userRole) && String(doc.created_by) !== req.user.userId) {
      return sendError(res, 403, 'คุณไม่มีสิทธิ์แก้ไขเอกสารนี้');
    }

    if (title !== undefined) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (Array.isArray(tags)) doc.tags = tags;
    if (is_public !== undefined) {
      const newIsPublic = is_public === true || is_public === 'true';
      const wasPublic = doc.is_public;
      const now = new Date();
      const isCurrentlyExpired = doc.public_expires_at && new Date(doc.public_expires_at) <= now;
      const hasNoExpiry = doc.public_expires_at == null;

      doc.is_public = newIsPublic;

      if (newIsPublic && (!wasPublic || isCurrentlyExpired || hasNoExpiry)) {
        // เริ่มนับใหม่เมื่อ: เปิดครั้งแรก, หมดเวลาแล้ว, หรือ legacy doc (ไม่มี expiry)
        const setting = await SystemSettings.findOne({ key: 'public_duration_hours' }).lean();
        const rawHours = setting?.value != null && !isNaN(setting.value) ? Number(setting.value) : 24;
        const hours = Math.max(1, rawHours); // ป้องกันค่าลบหรือศูนย์
        doc.public_expires_at = new Date(Date.now() + hours * 60 * 60 * 1000);
      } else if (!newIsPublic) {
        doc.public_expires_at = null;
      }
      // wasPublic && !expired && hasExpiry → ไม่ reset: เก็บ window เดิมไว้
    }

    await doc.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'UPDATE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, doc, 'อัปเดตเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[Document] updateDocument error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/documents/:id
 * Soft delete เอกสาร
 */
async function deleteDocument(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null });
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    doc.deleted_at = new Date();
    doc.deleted_by = req.user.userId;
    await doc.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DELETE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, null, 'ลบเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[Document] deleteDocument error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/documents/:id/attachments
 * อัปโหลดไฟล์แนบ (PDF/Word/Excel/PPT)
 */
async function uploadAttachment(req, res) {
  try {
    if (!req.file) return sendError(res, 400, 'กรุณาแนบไฟล์');

    const { sub_title } = req.body;
    if (!sub_title) {
      fs.unlinkSync(req.file.path);
      return sendError(res, 400, 'กรุณาระบุชื่อเอกสารแนบ');
    }

    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null });
    if (!doc) {
      fs.unlinkSync(req.file.path);
      return sendError(res, 404, 'ไม่พบเอกสาร');
    }

    // ย้ายไฟล์จาก _tmp ไปยัง path จริง
    const { dirPath } = await buildStoragePath(doc.dept_id, doc.type_id);
    // Multer decode ชื่อไฟล์เป็น latin1 แต่ข้อมูลจริงเป็น UTF-8 → แปลงกลับ
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase() || '.pdf';
    // ใช้ docId_N เป็นชื่อไฟล์บนดิสก์ (N = ลำดับที่ของ attachment)
    const seqNo = doc.attachments.length + 1;
    const newFilename = `${String(doc._id)}_${seqNo}${ext}`;
    const destPath = path.join(dirPath, newFilename);
    fs.renameSync(req.file.path, destPath);

    const checksum = sha256File(destPath);
    const subId = uuidv4();

    doc.attachments.push({
      sub_id: subId,
      sub_title,
      file_path: destPath,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      original_name: originalName,
      checksum,
      uploaded_by: doc.created_by,
    });
    await doc.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'UPLOAD',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { sub_id: subId, filename: req.file.originalname, size: req.file.size },
    });

    // คืนข้อมูลโดยไม่รวม file_path
    const added = doc.attachments[doc.attachments.length - 1].toObject();
    delete added.file_path;
    delete added.checksum;

    return sendSuccess(res, added, 'อัปโหลดไฟล์แนบเรียบร้อย');
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    logger.error('[Document] uploadAttachment error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/documents/:id/attachments/:subId/download
 * ดาวน์โหลดไฟล์แนบ
 */
async function downloadAttachment(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null })
      .select('+attachments.file_path +attachments.checksum')
      .lean();
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    // ตรวจสิทธิ์การเข้าถึงเอกสาร
    const userRole = req.user?.role;
    if (!['superadmin', 'admin', 'manager'].includes(userRole)) {
      const now = new Date();
      const isPublicActive = doc.is_public &&
        (!doc.public_expires_at || new Date(doc.public_expires_at) > now);
      const isSameDept = req.user?.deptId &&
        String(doc.dept_id) === String(req.user.deptId);
      if (!isPublicActive && !isSameDept) {
        return sendError(res, 403, 'คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้');
      }
    }

    const att = doc.attachments.find((a) => a.sub_id === req.params.subId);
    if (!att) return sendError(res, 404, 'ไม่พบไฟล์แนบ');

    if (att.deleted_at) return sendError(res, 404, 'ไม่พบไฟล์แนบ');

    if (!fs.existsSync(att.file_path)) return sendError(res, 404, 'ไฟล์ไม่พบในระบบ');

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DOWNLOAD',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { sub_id: att.sub_id, filename: att.original_name },
    });

    res.setHeader('Content-Type', att.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(att.original_name)}`);
    res.setHeader('Content-Length', att.file_size);
    return res.sendFile(att.file_path);
  } catch (err) {
    logger.error('[Document] downloadAttachment error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/documents/:id/attachments/:subId
 * Soft-delete ไฟล์แนบ (ซ่อน ไม่ลบ disk)
 * ต้องมี active attachment >= 2 จึงจะลบได้
 */
async function deleteAttachment(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null }).lean();
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    const userRole = req.user.role;
    if (!['superadmin', 'admin'].includes(userRole) && String(doc.created_by) !== req.user.userId) {
      return sendError(res, 403, 'คุณไม่มีสิทธิ์ลบไฟล์แนบนี้');
    }

    const att = (doc.attachments || []).find((a) => a.sub_id === req.params.subId);
    if (!att) return sendError(res, 404, 'ไม่พบไฟล์แนบ');
    if (att.deleted_at) return sendError(res, 404, 'ไม่พบไฟล์แนบ');

    const activeCount = (doc.attachments || []).filter((a) => !a.deleted_at).length;
    if (activeCount <= 1) {
      return sendError(res, 400, 'ต้องมีไฟล์แนบอย่างน้อย 1 รายการ ไม่สามารถลบได้');
    }

    // atomic $set เพื่อไม่ให้ file_path หายจาก DB
    const result = await Document.updateOne(
      { _id: doc._id, 'attachments.sub_id': req.params.subId },
      { $set: { 'attachments.$.deleted_at': new Date(), 'attachments.$.deleted_by': req.user.userId } }
    );
    if (result.modifiedCount === 0) return sendError(res, 404, 'ไม่พบไฟล์แนบ');

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DELETE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { sub_id: req.params.subId, type: 'attachment_soft_delete' },
    });

    return sendSuccess(res, null, 'ลบไฟล์แนบเรียบร้อย');
  } catch (err) {
    logger.error('[Document] deleteAttachment error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/documents/:id/images
 * อัปโหลดรูปภาพประกอบ
 */
async function uploadImage(req, res) {
  try {
    if (!req.file) return sendError(res, 400, 'กรุณาแนบรูปภาพ');

    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null });
    if (!doc) {
      fs.unlinkSync(req.file.path);
      return sendError(res, 404, 'ไม่พบเอกสาร');
    }

    const maxImages = config.storage.maxImagesPerDoc;
    if (doc.images.length >= maxImages) {
      fs.unlinkSync(req.file.path);
      return sendError(res, 400, `อัปโหลดรูปได้สูงสุด ${maxImages} รูปต่อเอกสาร`);
    }

    const { dirPath } = await buildStoragePath(doc.dept_id, doc.type_id);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const newFilename = `img_${uuidv4()}${ext}`;
    const destPath = path.join(dirPath, newFilename);
    fs.renameSync(req.file.path, destPath);

    doc.images.push({
      file_path: destPath,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      original_name: req.file.originalname,
      uploaded_by: doc.created_by,
    });
    await doc.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'UPLOAD',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { type: 'image', filename: req.file.originalname },
    });

    const added = doc.images[doc.images.length - 1].toObject();
    delete added.file_path;

    return sendSuccess(res, added, 'อัปโหลดรูปภาพเรียบร้อย');
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    logger.error('[Document] uploadImage error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/documents/:id/images/:index
 * ดูรูปภาพ (inline)
 */
async function viewImage(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null })
      .select('+images.file_path')
      .lean();
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    // ตรวจสิทธิ์การเข้าถึงเอกสาร
    const userRoleImg = req.user?.role;
    if (!['superadmin', 'admin', 'manager'].includes(userRoleImg)) {
      const nowImg = new Date();
      const isPublicActiveImg = doc.is_public &&
        (!doc.public_expires_at || new Date(doc.public_expires_at) > nowImg);
      const isSameDeptImg = req.user?.deptId &&
        String(doc.dept_id) === String(req.user.deptId);
      if (!isPublicActiveImg && !isSameDeptImg) {
        return sendError(res, 403, 'คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้');
      }
    }

    const idx = parseInt(req.params.index, 10);
    const img = doc.images[idx];
    if (!img) return sendError(res, 404, 'ไม่พบรูปภาพ');
    if (!fs.existsSync(img.file_path)) return sendError(res, 404, 'รูปภาพไม่พบในระบบ');

    res.setHeader('Content-Type', img.mime_type);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(img.original_name)}`);
    return res.sendFile(img.file_path);
  } catch (err) {
    logger.error('[Document] viewImage error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/documents/search
 * Global Search: ค้นหาจากทุกฟิลด์ (title, description, tags, attachment sub_title, dept name, doctype name)
 */
async function globalSearch(req, res) {
  try {
    const { page = 1, limit = 20, q, dept, type, year, is_public, sort = 'newest' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const filter = { deleted_at: null };
    const conditions = [];

    // Access control: non-admin เห็นเฉพาะหน่วยงานตัวเอง
    const userRole = req.user?.role;
    if (!['superadmin', 'admin', 'manager'].includes(userRole)) {
      if (req.user?.deptId) {
        conditions.push({ dept_id: req.user.deptId });
      }
    }

    // Starred filter
    if (req.query.starred === 'true') {
      conditions.push({ starred_by: req.user.userId });
    }

    // Direct filters
    if (dept) filter.dept_id = dept;
    if (type) filter.type_id = type;
    if (year) filter.fiscal_year = parseInt(year, 10);
    if (is_public === 'true') filter.is_public = true;

    // Global text search via regex (ค้นหาทุกฟิลด์)
    if (q && q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      // หา dept/doctype ที่ชื่อตรงกับ keyword
      const [deptMatches, typeMatches] = await Promise.all([
        Department.find({ name: regex }).select('_id').lean(),
        DocType.find({ name: regex }).select('_id').lean(),
      ]);

      const orClauses = [
        { title: regex },
        { description: regex },
        { tags: regex },
        { attachments: { $elemMatch: { sub_title: regex, deleted_at: null } } },
      ];
      if (deptMatches.length) orClauses.push({ dept_id: { $in: deptMatches.map((d) => d._id) } });
      if (typeMatches.length) orClauses.push({ type_id: { $in: typeMatches.map((t) => t._id) } });

      conditions.push({ $or: orClauses });
    }

    if (conditions.length > 0) filter.$and = conditions;

    // Sort
    let sortQuery = { createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (sort === 'title') sortQuery = { title: 1 };
    else if (sort === 'views') sortQuery = { views: -1 };

    const [docs, total] = await Promise.all([
      Document.find(filter)
        .populate('dept_id', 'name code')
        .populate('type_id', 'name code')
        .select('-attachments.file_path -attachments.checksum -images.file_path')
        .sort(sortQuery)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(filter),
    ]);

    // เพิ่ม is_starred per user
    const userId = String(req.user?.userId);
    const docsWithStar = docs.map((d) => ({
      ...d,
      attachments: (d.attachments || []).filter((a) => !a.deleted_at),
      is_starred: (d.starred_by || []).some((id) => String(id) === userId),
    }));

    return res.json({
      success: true,
      data: docsWithStar,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Document] globalSearch error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/documents/:id/star
 * Toggle star/unstar เอกสาร
 */
async function toggleStar(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null });
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    const userId = req.user.userId;
    const alreadyStarred = doc.starred_by.some((id) => String(id) === String(userId));

    if (alreadyStarred) {
      doc.starred_by = doc.starred_by.filter((id) => String(id) !== String(userId));
    } else {
      doc.starred_by.push(userId);
    }
    await doc.save();

    return sendSuccess(res, { is_starred: !alreadyStarred }, alreadyStarred ? 'ยกเลิกการติดดาว' : 'ติดดาวเรียบร้อย');
  } catch (err) {
    logger.error('[Document] toggleStar error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/documents/trash
 * รายการเอกสารที่ถูกลบ (admin only)
 */
async function listTrash(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [docs, total] = await Promise.all([
      Document.find({ deleted_at: { $ne: null } })
        .populate('dept_id', 'name code')
        .populate('type_id', 'name code')
        .select('-attachments.file_path -attachments.checksum -images.file_path')
        .sort({ deleted_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Document.countDocuments({ deleted_at: { $ne: null } }),
    ]);

    return res.json({
      success: true,
      data: docs,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Document] listTrash error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/documents/:id/restore
 * คืนเอกสารที่ถูกลบ (admin only)
 */
async function restoreDocument(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: { $ne: null } });
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสารที่ถูกลบ');

    doc.deleted_at = null;
    doc.deleted_by = null;
    await doc.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'RESTORE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, null, 'คืนเอกสารเรียบร้อย');
  } catch (err) {
    logger.error('[Document] restoreDocument error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/documents/:id/permanent
 * ลบถาวร: ลบ DB record + ไฟล์ทั้งหมดบนดิสก์ (admin only)
 */
async function permanentDelete(req, res) {
  try {
    // lean query เพื่อดึง file_path ได้ถูกต้อง (select: false fields)
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: { $ne: null } })
      .select('+attachments.file_path +images.file_path')
      .lean();
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสารที่ถูกลบ');

    // ลบไฟล์ทั้งหมด
    const filePaths = [
      ...(doc.attachments || []).map((a) => a.file_path),
      ...(doc.images || []).map((img) => img.file_path),
    ];
    for (const fp of filePaths) {
      if (fp && fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (e) { logger.warn(`Cannot delete file: ${fp}`); }
      }
    }

    await Document.deleteOne({ _id: doc._id });

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DELETE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { title: doc.title, filesDeleted: filePaths.length },
    });

    return sendSuccess(res, null, 'ลบถาวรเรียบร้อย');
  } catch (err) {
    logger.error('[Document] permanentDelete error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/documents/trash/attachments
 * รายการไฟล์แนบที่ถูก soft-delete (admin only)
 */
async function listDeletedAttachments(req, res) {
  try {
    const docs = await Document.find({
      deleted_at: null,
      attachments: { $elemMatch: { deleted_at: { $ne: null } } },
    })
      .populate('dept_id', 'name code')
      .populate('type_id', 'name code')
      .lean();

    const items = [];
    for (const doc of docs) {
      for (const att of doc.attachments || []) {
        if (att.deleted_at) {
          items.push({
            docId: doc._id,
            docTitle: doc.title,
            dept: doc.dept_id,
            type: doc.type_id,
            subId: att.sub_id,
            subTitle: att.sub_title,
            originalName: att.original_name,
            fileSize: att.file_size,
            mimeType: att.mime_type,
            uploadedAt: att.uploaded_at,
            deletedAt: att.deleted_at,
          });
        }
      }
    }
    items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    return sendSuccess(res, items, 'รายการไฟล์แนบที่ถูกลบ');
  } catch (err) {
    logger.error('[Document] listDeletedAttachments error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/documents/:id/attachments/:subId/restore
 * คืนไฟล์แนบที่ถูก soft-delete (admin only)
 */
async function restoreAttachment(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, deleted_at: null }).lean();
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    const att = (doc.attachments || []).find((a) => a.sub_id === req.params.subId);
    if (!att) return sendError(res, 404, 'ไม่พบไฟล์แนบ');
    if (!att.deleted_at) return sendError(res, 400, 'ไฟล์แนบนี้ยังไม่ได้ถูกลบ');

    // atomic $set เพื่อไม่ให้ file_path หายจาก DB
    const result = await Document.updateOne(
      { _id: doc._id, 'attachments.sub_id': req.params.subId },
      { $set: { 'attachments.$.deleted_at': null, 'attachments.$.deleted_by': null } }
    );
    if (result.modifiedCount === 0) return sendError(res, 404, 'ไม่พบไฟล์แนบ');

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'RESTORE',
      module: 'DOCUMENT',
      resourceId: doc._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { sub_id: req.params.subId, type: 'attachment_restore' },
    });

    return sendSuccess(res, null, 'คืนไฟล์แนบเรียบร้อย');
  } catch (err) {
    logger.error('[Document] restoreAttachment error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/documents/:id/attachments/:subId/permanent
 * ลบไฟล์แนบถาวร: ต้อง soft-delete ก่อน (admin only)
 */
async function permanentDeleteAttachment(req, res) {
  try {
    // lean query เพื่อดึง file_path (select: false ใช้ lean ได้ถูกต้อง)
    const docLean = await Document.findOne({ _id: req.params.id, deleted_at: null })
      .select('+attachments.file_path +attachments.checksum')
      .lean();
    if (!docLean) return sendError(res, 404, 'ไม่พบเอกสาร');

    const att = (docLean.attachments || []).find((a) => a.sub_id === req.params.subId);
    if (!att) return sendError(res, 404, 'ไม่พบไฟล์แนบ');
    if (!att.deleted_at) {
      return sendError(res, 400, 'ไฟล์แนบนี้ยังไม่ได้ถูกลบ กรุณาลบก่อนจึงจะลบถาวรได้');
    }

    // ลบไฟล์จาก disk ก่อน (ใช้ file_path จาก lean)
    if (att.file_path && fs.existsSync(att.file_path)) {
      try { fs.unlinkSync(att.file_path); } catch (e) { logger.warn(`Cannot delete file: ${att.file_path}`); }
    } else {
      logger.warn(`[Attachment] file not found on disk: ${att.file_path}`);
    }

    // ลบ attachment ออกจาก array ด้วย $pull (atomic)
    await Document.updateOne(
      { _id: docLean._id },
      { $pull: { attachments: { sub_id: req.params.subId } } }
    );

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DELETE',
      module: 'DOCUMENT',
      resourceId: docLean._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { sub_id: req.params.subId, type: 'attachment_permanent_delete', filename: att.original_name },
    });

    return sendSuccess(res, null, 'ลบไฟล์แนบถาวรเรียบร้อย');
  } catch (err) {
    logger.error('[Document] permanentDeleteAttachment error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = {
  listDocuments,
  globalSearch,
  toggleStar,
  listTrash,
  restoreDocument,
  permanentDelete,
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
  listDeletedAttachments,
  restoreAttachment,
  permanentDeleteAttachment,
  uploadImage,
  viewImage,
};
