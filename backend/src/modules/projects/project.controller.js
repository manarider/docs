const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Project = require('../../models/Project');
const ProjectKey = require('../../models/ProjectKey');
const Document = require('../../models/Document');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const { getFiscalYear } = require('../../utils/fiscalYear');
const config = require('../../config');
const logger = require('../../utils/logger');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 char hex string
}

/**
 * GET /api/projects/by-document/:docId
 * ดึงหรือสร้าง Project ที่ผูกกับ Document(PRJ)
 * เฉพาะ internal user เท่านั้น
 */
async function getOrCreateByDocument(req, res) {
  try {
    const { docId } = req.params;

    const doc = await Document.findById(docId)
      .populate('type_id', 'code name')
      .populate('dept_id', 'code name')
      .lean();

    if (!doc || doc.deleted_at) return sendError(res, 404, 'ไม่พบเอกสาร');
    if (doc.type_id?.code?.toUpperCase() !== 'PRJ') {
      return sendError(res, 400, 'เอกสารนี้ไม่ใช่ประเภทโครงการ (PRJ)');
    }

    // ตรวจสอบว่ามีแล้วหรือยัง
    let project = await Project.findOne({ document_id: docId }).lean();
    if (project) {
      return sendSuccess(res, { projectId: String(project._id), isNew: false, title: project.title });
    }

    // สร้างใหม่ — _id ถูก generate ก่อน save
    const newProject = new Project({
      document_id: docId,
      title: doc.title,
      dept_id: doc.dept_id._id,
      fiscal_year: doc.fiscal_year || getFiscalYear(),
      created_by: req.user.userId,
      storage_base: 'pending', // placeholder
    });

    // สร้าง storage path โดยใช้ projectId ที่ generate แล้ว
    const deptCode = (doc.dept_id.code || 'unknown').toLowerCase();
    const storageBase = path.join(
      config.storage.basePath,
      deptCode,
      String(newProject.fiscal_year),
      'prj',
      String(newProject._id)
    );
    ['reports', 'equip', 'procurement', 'acceptance'].forEach((sub) => {
      fs.mkdirSync(path.join(storageBase, sub), { recursive: true });
    });

    newProject.storage_base = storageBase;
    await newProject.save();

    await logAction({
      userId: String(req.user.userId),
      username: req.user.username,
      action: 'CREATE',
      module: 'PROJECT',
      resourceId: String(newProject._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { title: newProject.title, document_id: docId },
    });

    return sendSuccess(res, { projectId: String(newProject._id), isNew: true, title: newProject.title }, 'สร้างโครงการใหม่แล้ว');
  } catch (err) {
    logger.error(`[Project] getOrCreateByDocument error: ${err.message}\n${err.stack}`);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId
 */
async function getProject(req, res) {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId)
      .populate('dept_id', 'name code')
      .select('-storage_base')
      .lean();
    if (!project) return sendError(res, 404, 'ไม่พบโครงการ');
    return sendSuccess(res, project);
  } catch (err) {
    logger.error('[Project] getProject error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/projects/:projectId
 * แก้ไขข้อมูลรายละเอียดโครงการ
 */
async function updateProject(req, res) {
  try {
    const { projectId } = req.params;
    const {
      title,
      fiscal_year,
      status,
      location,
      district,
      province,
      phone,
      work_volume,
      quantity,
      contract_no,
      contract_date,
      contract_month,
      contract_year,
      start_date,
      end_date,
      budget,
      contractor,
      duration,
      supervisor,
      committee_chairman,
      committee_member_1,
      committee_member_2,
    } = req.body;

    const updateData = {};
    if (title !== undefined) {
      if (!title.trim()) return sendError(res, 400, 'ต้องระบุชื่อโครงการ');
      updateData.title = title.trim();
    }
    if (fiscal_year !== undefined) updateData.fiscal_year = Number(fiscal_year);
    if (status !== undefined) {
      if (!['active', 'closed'].includes(status)) return sendError(res, 400, 'สถานะไม่ถูกต้อง');
      updateData.status = status;
    }
    if (location !== undefined) updateData.location = String(location).trim();
    if (district !== undefined) updateData.district = String(district).trim();
    if (province !== undefined) updateData.province = String(province).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (work_volume !== undefined) updateData.work_volume = String(work_volume).trim();
    if (quantity !== undefined) updateData.quantity = String(quantity).trim();
    if (contract_no !== undefined) updateData.contract_no = String(contract_no).trim();
    if (contract_date !== undefined) updateData.contract_date = String(contract_date).trim();
    if (contract_month !== undefined) updateData.contract_month = String(contract_month).trim();
    if (contract_year !== undefined) updateData.contract_year = String(contract_year).trim();
    if (start_date !== undefined) updateData.start_date = String(start_date).trim();
    if (end_date !== undefined) updateData.end_date = String(end_date).trim();
    if (budget !== undefined) updateData.budget = String(budget).trim();
    if (contractor !== undefined) updateData.contractor = String(contractor).trim();
    if (duration !== undefined) updateData.duration = String(duration).trim();
    if (supervisor !== undefined) updateData.supervisor = String(supervisor).trim();
    if (committee_chairman !== undefined) updateData.committee_chairman = String(committee_chairman).trim();
    if (committee_member_1 !== undefined) updateData.committee_member_1 = String(committee_member_1).trim();
    if (committee_member_2 !== undefined) updateData.committee_member_2 = String(committee_member_2).trim();

    const project = await Project.findByIdAndUpdate(
      projectId,
      updateData,
      { new: true }
    ).populate('dept_id', 'name code').select('-storage_base');

    if (!project) return sendError(res, 404, 'ไม่พบโครงการ');

    await logAction({
      userId: req.user ? String(req.user.userId) : (req.projectUser ? String(req.projectUser.userId) : 'system'),
      username: req.user ? req.user.username : (req.projectUser ? req.projectUser.username : 'system'),
      action: 'UPDATE',
      module: 'PROJECT',
      resourceId: projectId,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: updateData,
    });

    return sendSuccess(res, project, 'อัปเดตข้อมูลโครงการเรียบร้อยแล้ว');
  } catch (err) {
    logger.error('[Project] updateProject error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/projects/:projectId/status
 * admin เท่านั้น
 */
async function updateStatus(req, res) {
  try {
    const { projectId } = req.params;
    const { status } = req.body;
    if (!['active', 'closed'].includes(status)) return sendError(res, 400, 'สถานะไม่ถูกต้อง');

    const project = await Project.findByIdAndUpdate(
      projectId,
      { status },
      { new: true }
    ).populate('dept_id', 'name code').select('-storage_base');
    if (!project) return sendError(res, 404, 'ไม่พบโครงการ');

    await logAction({
      userId: String(req.user.userId),
      username: req.user.username,
      action: 'UPDATE',
      module: 'PROJECT',
      resourceId: projectId,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { status },
    });

    return sendSuccess(res, project, 'อัปเดตสถานะโครงการแล้ว');
  } catch (err) {
    logger.error('[Project] updateStatus error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

// ─── KEY Management ────────────────────────────────────────────────────────────

/**
 * GET /api/projects/:projectId/keys
 */
async function listKeys(req, res) {
  try {
    const { projectId } = req.params;
    const keys = await ProjectKey.find({ project_id: projectId })
      .select('-key_hash')
      .sort({ role: 1, createdAt: -1 })
      .lean();
    return sendSuccess(res, keys);
  } catch (err) {
    logger.error('[Project] listKeys error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/projects/:projectId/keys
 * สร้าง KEY ใหม่ — แสดง token ครั้งเดียว
 */
async function createKey(req, res) {
  try {
    const { projectId } = req.params;
    const { role, label, expires_at } = req.body;

    if (!['contractor', 'supervisor', 'project_manager'].includes(role)) {
      return sendError(res, 400, 'role ต้องเป็น contractor, supervisor หรือ project_manager');
    }
    if (!label?.trim()) return sendError(res, 400, 'กรุณาระบุชื่อกำกับ (label)');
    if (!expires_at) return sendError(res, 400, 'กรุณาระบุวันหมดอายุ');

    const expiryDate = new Date(expires_at);
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return sendError(res, 400, 'วันหมดอายุต้องเป็นวันในอนาคต');
    }

    const project = await Project.findById(projectId);
    if (!project) return sendError(res, 404, 'ไม่พบโครงการ');
    if (project.status === 'closed') return sendError(res, 403, 'โครงการปิดแล้ว ไม่สามารถสร้าง KEY ได้');

    const token = generateToken();
    const projectKey = await ProjectKey.create({
      project_id: projectId,
      role,
      label: label.trim(),
      key_hash: sha256(token),
      key_prefix: token.substring(0, 8),
      expires_at: expiryDate,
      created_by: req.projectUser.userId,
    });

    await logAction({
      userId: String(req.projectUser.userId),
      username: req.projectUser.username,
      action: 'GENERATE_KEY',
      module: 'PROJECT',
      resourceId: projectId,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { role, label: label.trim(), key_id: String(projectKey._id) },
    });

    return sendSuccess(res, {
      _id: projectKey._id,
      role: projectKey.role,
      label: projectKey.label,
      key_prefix: projectKey.key_prefix,
      expires_at: projectKey.expires_at,
      is_active: projectKey.is_active,
      token, // ← แสดงครั้งเดียว ไม่มีการเก็บ plaintext ใน DB
    }, 'สร้าง KEY เรียบร้อย กรุณาบันทึก KEY ไว้ ระบบจะไม่แสดงอีก', 201);
  } catch (err) {
    logger.error('[Project] createKey error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/projects/:projectId/keys/:keyId
 * แก้ไข label / ต่ออายุ / ยกเลิก KEY
 */
async function updateKey(req, res) {
  try {
    const { projectId, keyId } = req.params;
    const { label, expires_at, is_active } = req.body;

    const update = {};
    if (label !== undefined) update.label = String(label).trim();
    if (expires_at !== undefined) {
      const d = new Date(expires_at);
      if (isNaN(d.getTime())) return sendError(res, 400, 'วันหมดอายุไม่ถูกต้อง');
      update.expires_at = d;
    }
    if (is_active !== undefined) update.is_active = Boolean(is_active);
    if (Object.keys(update).length === 0) return sendError(res, 400, 'ไม่มีข้อมูลที่จะอัปเดต');

    const projectKey = await ProjectKey.findOneAndUpdate(
      { _id: keyId, project_id: projectId },
      update,
      { new: true }
    ).select('-key_hash');
    if (!projectKey) return sendError(res, 404, 'ไม่พบ KEY');

    let auditAction = 'UPDATE';
    if (update.is_active === false) auditAction = 'REVOKE_KEY';
    else if (update.expires_at) auditAction = 'EXTEND_KEY';

    await logAction({
      userId: String(req.projectUser.userId),
      username: req.projectUser.username,
      action: auditAction,
      module: 'PROJECT',
      resourceId: projectId,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { key_id: keyId, changes: update },
    });

    return sendSuccess(res, projectKey, 'อัปเดต KEY แล้ว');
  } catch (err) {
    logger.error('[Project] updateKey error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/projects/:projectId/keys/:keyId/regenerate
 * สร้าง token ใหม่สำหรับ KEY เดิม (token เดิมจะใช้ไม่ได้)
 */
async function regenerateKey(req, res) {
  try {
    const { projectId, keyId } = req.params;

    const projectKey = await ProjectKey.findOne({ _id: keyId, project_id: projectId });
    if (!projectKey) return sendError(res, 404, 'ไม่พบ KEY');

    const token = generateToken();
    projectKey.key_hash = sha256(token);
    projectKey.key_prefix = token.substring(0, 8);
    projectKey.is_active = true;
    await projectKey.save();

    await logAction({
      userId: String(req.projectUser.userId),
      username: req.projectUser.username,
      action: 'REGENERATE_KEY',
      module: 'PROJECT',
      resourceId: projectId,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { key_id: keyId, label: projectKey.label },
    });

    return sendSuccess(res, {
      _id: projectKey._id,
      role: projectKey.role,
      label: projectKey.label,
      key_prefix: projectKey.key_prefix,
      expires_at: projectKey.expires_at,
      is_active: projectKey.is_active,
      token, // แสดงครั้งเดียว
    }, 'สร้าง KEY ใหม่แล้ว กรุณาบันทึก KEY ไว้');
  } catch (err) {
    logger.error('[Project] regenerateKey error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/projects/:projectId/keys/:keyId
 * ลบ KEY ออกจากระบบถาวร
 */
async function deleteKey(req, res) {
  try {
    const { projectId, keyId } = req.params;
    const projectKey = await ProjectKey.findOneAndDelete({ _id: keyId, project_id: projectId });
    if (!projectKey) return sendError(res, 404, 'ไม่พบ KEY');

    await logAction({
      userId: String(req.projectUser.userId),
      username: req.projectUser.username,
      action: 'DELETE_KEY',
      module: 'PROJECT',
      resourceId: projectId,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { key_id: keyId, label: projectKey.label, role: projectKey.role },
    });

    return sendSuccess(res, null, 'ลบ KEY แล้ว');
  } catch (err) {
    logger.error('[Project] deleteKey error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = {
  getOrCreateByDocument,
  getProject,
  updateProject,
  updateStatus,
  listKeys,
  createKey,
  updateKey,
  regenerateKey,
  deleteKey,
};
