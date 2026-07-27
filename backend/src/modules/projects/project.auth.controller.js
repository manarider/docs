const crypto = require('crypto');
const mongoose = require('mongoose');
const ProjectKey = require('../../models/ProjectKey');
const Project = require('../../models/Project');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

const KEY_SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // fallback 7 วัน

function sha256(str) {
  return crypto.createHash('sha256').update(str.trim()).digest('hex');
}

/**
 * POST /api/project-auth/login
 * Login ด้วย KEY สำหรับผู้ใช้ภายนอก
 */
async function keyLogin(req, res) {
  try {
    const { key, project_id } = req.body;
    if (!key || !project_id) return sendError(res, 400, 'กรุณาระบุ KEY และรหัสโครงการ');
    if (!mongoose.Types.ObjectId.isValid(project_id)) return sendError(res, 400, 'รหัสโครงการไม่ถูกต้อง');

    const project = await Project.findById(project_id).lean();
    if (!project) return sendError(res, 404, 'ไม่พบโครงการ');
    if (project.status === 'closed') return sendError(res, 403, 'โครงการนี้ปิดแล้ว');

    const keyHash = sha256(key);
    const projectKey = await ProjectKey.findOne({
      project_id,
      key_hash: keyHash,
      is_active: true,
    }).select('+key_hash');

    if (!projectKey) return sendError(res, 401, 'KEY ไม่ถูกต้องหรือถูกยกเลิกแล้ว');
    if (new Date(projectKey.expires_at) < new Date()) {
      return sendError(res, 401, 'KEY หมดอายุแล้ว กรุณาติดต่อผู้ดูแลโครงการ');
    }

    // บันทึก session KEY
    req.session.project_user = {
      keyId: String(projectKey._id),
      projectId: String(project._id),
      role: projectKey.role,
      label: projectKey.label,
      expiresAt: projectKey.expires_at,
    };
    // session มีอายุตาม KEY expires_at (หลายคนใช้ key เดียวกันได้)
    const msUntilExpiry = new Date(projectKey.expires_at).getTime() - Date.now();
    req.session.cookie.maxAge = msUntilExpiry;

    // อัปเดต last_used_at
    await ProjectKey.findByIdAndUpdate(projectKey._id, { last_used_at: new Date() });

    await logAction({
      userId: String(projectKey._id),
      username: `KEY:${projectKey.label}`,
      action: 'KEY_ACCESS',
      module: 'PROJECT',
      resourceId: String(project._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { role: projectKey.role, project_title: project.title },
    });

    return sendSuccess(res, {
      projectId: String(project._id),
      projectTitle: project.title,
      role: projectKey.role,
      label: projectKey.label,
      expiresAt: projectKey.expires_at,
    }, 'เข้าสู่ระบบสำเร็จ');
  } catch (err) {
    logger.error('[ProjectAuth] keyLogin error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/project-auth/logout
 */
async function keyLogout(req, res) {
  try {
    delete req.session.project_user;
    return sendSuccess(res, null, 'ออกจากระบบแล้ว');
  } catch (err) {
    logger.error('[ProjectAuth] keyLogout error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/project-auth/me
 * ดูข้อมูล KEY session ปัจจุบัน
 */
async function keyMe(req, res) {
  try {
    const pk = req.session?.project_user;
    if (!pk) return sendSuccess(res, null); // ไม่มี session — ไม่ใช่ error
    if (new Date(pk.expiresAt) < new Date()) {
      delete req.session.project_user;
      return sendSuccess(res, null);
    }
    return sendSuccess(res, pk);
  } catch (err) {
    logger.error('[ProjectAuth] keyMe error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/project-auth/project/:projectId/info
 * Public — ดึงชื่อโครงการสำหรับแสดงในหน้า login (ไม่ต้อง auth)
 */
async function getProjectPublicInfo(req, res) {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) return sendError(res, 400, 'รหัสโครงการไม่ถูกต้อง');
    const project = await Project.findById(projectId)
      .select('title status dept_id fiscal_year')
      .populate('dept_id', 'name')
      .lean();
    if (!project) return sendError(res, 404, 'ไม่พบโครงการ');
    return sendSuccess(res, {
      title: project.title,
      dept: project.dept_id?.name || '',
      fiscal_year: project.fiscal_year,
      status: project.status,
    });
  } catch (err) {
    logger.error('[ProjectAuth] getProjectPublicInfo error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { keyLogin, keyLogout, keyMe, getProjectPublicInfo };
