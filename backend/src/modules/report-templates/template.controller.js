const ReportTemplate = require('../../models/ReportTemplate');
const Project = require('../../models/Project');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const config = require('../../config');

/**
 * GET /api/projects/:projectId/report-templates
 * ดึงรายการ template ทั้งหมดของโครงการ + global templates
 */
async function listTemplates(req, res) {
  try {
    const { projectId } = req.params;
    const { module } = req.query;

    const query = {
      $or: [
        { project_id: projectId, scope: 'project' },
        { scope: 'global' },
      ],
    };

    if (module) {
      query.module = module;
    }

    const templates = await ReportTemplate.find(query)
      .populate('project_id', 'title')
      .populate('created_by', 'username displayName')
      .sort({ status: -1, updatedAt: -1 });

    return sendSuccess(res, templates);
  } catch (err) {
    logger.error('[ReportTemplate] listTemplates error:', err.message);
    return sendError(res, 500, 'ไม่สามารถโหลด template ได้');
  }
}

/**
 * GET /api/projects/:projectId/report-templates/:templateId
 * ดึงรายละเอียด template
 */
async function getTemplate(req, res) {
  try {
    const { templateId } = req.params;

    const template = await ReportTemplate.findById(templateId)
      .populate('project_id', 'title')
      .populate('created_by', 'username displayName')
      .populate('updated_by', 'username displayName');

    if (!template) {
      return sendError(res, 404, 'ไม่พบ template');
    }

    return sendSuccess(res, template);
  } catch (err) {
    logger.error('[ReportTemplate] getTemplate error:', err.message);
    return sendError(res, 500, 'ไม่สามารถโหลด template ได้');
  }
}

/**
 * POST /api/projects/:projectId/report-templates
 * สร้าง template ใหม่
 */
async function createTemplate(req, res) {
  try {
    const { projectId } = req.params;
    const { name, module, scope = 'project' } = req.body;

    if (!name || !module) {
      return sendError(res, 400, 'กรุณาระบุชื่อและ module');
    }

    // ตรวจสอบว่า project มีอยู่จริง
    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 404, 'ไม่พบโครงการ');
    }

    // สร้าง template พร้อมหน้าเปล่า 1 หน้า
    const template = await ReportTemplate.create({
      name,
      module,
      project_id: scope === 'project' ? projectId : null,
      scope,
      pages: [
        {
          pageNo: 1,
          paperSize: 'A4',
          orientation: 'portrait',
          backgroundFile: null,
          fields: [],
        },
      ],
      status: 'inactive',
      created_by: req.projectUser.userId,
    });

    return sendSuccess(res, template, 'สร้าง template แล้ว', 201);
  } catch (err) {
    logger.error('[ReportTemplate] createTemplate error:', err.message);
    return sendError(res, 500, 'ไม่สามารถสร้าง template ได้');
  }
}

/**
 * PUT /api/projects/:projectId/report-templates/:templateId
 * อัปเดต template (ชื่อ, status, pages, fields)
 */
async function updateTemplate(req, res) {
  try {
    const { templateId } = req.params;
    const { name, status, pages } = req.body;

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return sendError(res, 404, 'ไม่พบ template');
    }

    if (name) template.name = name;
    if (status) template.status = status;
    if (pages) template.pages = pages;
    template.updated_by = req.projectUser.userId;

    await template.save();

    return sendSuccess(res, template, 'อัปเดต template แล้ว');
  } catch (err) {
    logger.error('[ReportTemplate] updateTemplate error:', err.message);
    return sendError(res, 500, 'ไม่สามารถอัปเดต template ได้');
  }
}

/**
 * DELETE /api/projects/:projectId/report-templates/:templateId
 * ลบ template และ background files ที่เกี่ยวข้อง
 */
async function deleteTemplate(req, res) {
  try {
    const { templateId } = req.params;

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return sendError(res, 404, 'ไม่พบ template');
    }

    // ลบ background files ทั้งหมด
    const storageBase = config.storage.basePath;
    const bgFolder = path.join(storageBase, '_report_backgrounds');

    for (const page of template.pages) {
      if (page.backgroundFile) {
        const filePath = path.join(bgFolder, page.backgroundFile);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          logger.warn('[ReportTemplate] Cannot delete background:', filePath);
        }
      }
    }

    await ReportTemplate.findByIdAndDelete(templateId);

    return sendSuccess(res, null, 'ลบ template แล้ว');
  } catch (err) {
    logger.error('[ReportTemplate] deleteTemplate error:', err.message);
    return sendError(res, 500, 'ไม่สามารถลบ template ได้');
  }
}

/**
 * POST /api/projects/:projectId/report-templates/:templateId/background/:pageNo
 * อัปโหลด background ของหน้า
 */
async function uploadBackground(req, res) {
  try {
    const { templateId, pageNo } = req.params;

    if (!req.file) {
      return sendError(res, 400, 'กรุณาอัปโหลดไฟล์');
    }

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return sendError(res, 404, 'ไม่พบ template');
    }

    const pageIndex = template.pages.findIndex((p) => p.pageNo === Number(pageNo));
    if (pageIndex === -1) {
      return sendError(res, 404, 'ไม่พบหน้าที่ระบุ');
    }

    // ลบ background เดิมถ้ามี
    const oldFile = template.pages[pageIndex].backgroundFile;
    if (oldFile) {
      const storageBase = config.storage.basePath;
      const bgFolder = path.join(storageBase, '_report_backgrounds');
      const oldPath = path.join(bgFolder, oldFile);
      try {
        await fs.unlink(oldPath);
      } catch (err) {
        logger.warn('[ReportTemplate] Cannot delete old background:', oldPath);
      }
    }

    // บันทึกชื่อไฟล์ใหม่
    template.pages[pageIndex].backgroundFile = path.basename(req.file.path);
    template.updated_by = req.projectUser.userId;
    await template.save();

    return sendSuccess(res, template, 'อัปโหลด background แล้ว');
  } catch (err) {
    logger.error('[ReportTemplate] uploadBackground error:', err.message);
    return sendError(res, 500, 'ไม่สามารถอัปโหลดไฟล์ได้');
  }
}

/**
 * DELETE /api/projects/:projectId/report-templates/:templateId/background/:pageNo
 * ลบ background ของหน้า
 */
async function deleteBackground(req, res) {
  try {
    const { templateId, pageNo } = req.params;

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return sendError(res, 404, 'ไม่พบ template');
    }

    const pageIndex = template.pages.findIndex((p) => p.pageNo === Number(pageNo));
    if (pageIndex === -1) {
      return sendError(res, 404, 'ไม่พบหน้าที่ระบุ');
    }

    const bgFile = template.pages[pageIndex].backgroundFile;
    if (bgFile) {
      const storageBase = config.storage.basePath;
      const bgFolder = path.join(storageBase, '_report_backgrounds');
      const filePath = path.join(bgFolder, bgFile);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        logger.warn('[ReportTemplate] Cannot delete background:', filePath);
      }
    }

    template.pages[pageIndex].backgroundFile = null;
    template.updated_by = req.projectUser.userId;
    await template.save();

    return sendSuccess(res, template, 'ลบ background แล้ว');
  } catch (err) {
    logger.error('[ReportTemplate] deleteBackground error:', err.message);
    return sendError(res, 500, 'ไม่สามารถลบ background ได้');
  }
}

/**
 * GET /api/projects/:projectId/report-templates/:templateId/background/:pageNo/file
 * ดาวน์โหลด background file
 */
async function serveBackground(req, res) {
  try {
    const { templateId, pageNo } = req.params;

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return sendError(res, 404, 'ไม่พบ template');
    }

    const page = template.pages.find((p) => p.pageNo === Number(pageNo));
    if (!page || !page.backgroundFile) {
      return sendError(res, 404, 'ไม่พบ background');
    }

    const storageBase = config.storage.basePath;
    const bgFolder = path.join(storageBase, '_report_backgrounds');
    const filePath = path.join(bgFolder, page.backgroundFile);

    // ตรวจสอบว่าไฟล์มีอยู่จริง
    try {
      await fs.access(filePath);
    } catch (err) {
      return sendError(res, 404, 'ไม่พบไฟล์');
    }

    // กำหนด content-type ตาม extension
    const ext = path.extname(page.backgroundFile).toLowerCase();
    const contentType = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    }[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 day
    res.sendFile(filePath);
  } catch (err) {
    logger.error('[ReportTemplate] serveBackground error:', err.message);
    return sendError(res, 500, 'ไม่สามารถดาวน์โหลดไฟล์ได้');
  }
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  uploadBackground,
  deleteBackground,
  serveBackground,
};
