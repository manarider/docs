const ReportTemplate = require('../../models/ReportTemplate');
const DailyReport = require('../../models/DailyReport');
const Procurement = require('../../models/Procurement');
const WorkAcceptance = require('../../models/WorkAcceptance');
const Project = require('../../models/Project');
const { sendSuccess, sendError } = require('../../utils/response');
const { generatePdf } = require('../../utils/pdfGenerator');
const logger = require('../../utils/logger');
const config = require('../../config');

// file_path ของรูปภาพถูกกำหนด select:false ในสกีมา ต้องระบุ select เพิ่มเพื่อดึงมาใช้วาดใน PDF
const PHOTO_SELECT_BY_MODULE = {
  daily_report: '+photos.file_path +equipment_items.photo.file_path',
  procurement: '+receive_photos.file_path +inspection_photos.file_path',
  acceptance: '+inspection_photos.file_path',
};


/**
 * GET /api/projects/:projectId/reports/:module/:recordId/templates
 * ดึง template ที่ active และตรงกับ module
 */
async function getAvailableTemplates(req, res) {
  try {
    const { projectId, module } = req.params;

    const templates = await ReportTemplate.find({
      module,
      status: 'active',
      $or: [
        { project_id: projectId, scope: 'project' },
        { scope: 'global' },
      ],
    })
      .select('name module scope')
      .sort({ scope: -1, name: 1 });

    return sendSuccess(res, templates);
  } catch (err) {
    logger.error('[ReportGen] getAvailableTemplates error:', err.message);
    return sendError(res, 500, 'ไม่สามารถโหลด template ได้');
  }
}

/**
 * GET /api/projects/:projectId/reports/:module/:recordId/generate/:templateId
 * สร้าง PDF และ stream กลับไปแบบ on-the-fly
 */
async function generateReport(req, res) {
  try {
    const { projectId, module, recordId, templateId } = req.params;

    // โหลด template
    const template = await ReportTemplate.findById(templateId);
    if (!template || (template.status !== 'active' && req.query.preview !== 'true')) {
      return sendError(res, 404, 'ไม่พบ template หรือ template ไม่ได้เปิดใช้งาน');
    }

    if (template.module !== module) {
      return sendError(res, 400, 'Template ไม่ตรงกับ module');
    }

    // โหลด project
    const project = await Project.findById(projectId).populate('dept_id', 'name');
    if (!project) {
      return sendError(res, 404, 'ไม่พบโครงการ');
    }

    // โหลด record ตาม module
    let record;
    let Model;
    switch (module) {
      case 'daily_report':
        Model = DailyReport;
        break;
      case 'procurement':
        Model = Procurement;
        break;
      case 'acceptance':
        Model = WorkAcceptance;
        break;
      default:
        return sendError(res, 400, 'Module ไม่ถูกต้อง');
    }

    record = await Model.findById(recordId).select(PHOTO_SELECT_BY_MODULE[module] || '').lean();
    if (!record) {
      return sendError(res, 404, 'ไม่พบข้อมูล record');
    }

    // ตรวจสอบว่า record อยู่ใน project นี้
    if (String(record.project_id) !== String(projectId)) {
      return sendError(res, 403, 'Record ไม่อยู่ในโครงการนี้');
    }

    // สร้าง PDF
    const pdfBytes = await generatePdf(record, template, project, config.storage.basePath);

    // Stream PDF กลับ
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(template.name)}-${recordId.slice(-6)}.pdf"`
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error('[ReportGen] generateReport error:', err);
    return sendError(res, 500, 'ไม่สามารถสร้าง PDF ได้');
  }
}

module.exports = {
  getAvailableTemplates,
  generateReport,
};
