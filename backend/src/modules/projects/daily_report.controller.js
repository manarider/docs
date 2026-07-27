const fs = require('fs');
const DailyReport = require('../../models/DailyReport');
const Project = require('../../models/Project');
const config = require('../../config');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const {
  moveFilesToProjectFolder,
  moveSingleFile,
  cleanupTmpFiles,
  resizeProjectPhotos,
} = require('./project.upload');
const logger = require('../../utils/logger');

/**
 * ตรวจสอบว่า filePath อยู่ภายใน storage directory (ป้องกัน path traversal)
 */
function isSafePath(filePath) {
  if (!filePath) return false;
  const normalized = require('path').resolve(filePath);
  return normalized.startsWith(config.storage.basePath);
}

/**
 * GET /api/projects/:projectId/daily-reports
 */
async function listReports(req, res) {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [reports, total] = await Promise.all([
      DailyReport.find({ project_id: projectId })
        .select('-photos.file_path -equipment_items.photo.file_path')
        .sort({ report_date: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      DailyReport.countDocuments({ project_id: projectId }),
    ]);

    return res.json({
      success: true,
      data: reports,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[DailyReport] listReports error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/projects/:projectId/daily-reports
 * multipart/form-data:
 *   photos[]        (max 4 images)
 *   equip_photos[]  (max 20 images, one per equipment item)
 *   report_date     (ISO date string)
 *   work_description
 *   equipment_items (JSON string array [{equipment_type, serial_no},...])
 */
async function createReport(req, res) {
  const uploadedFiles = req.files || {};
  try {
    const { projectId } = req.params;
    const {
      report_date,
      work_description,
      morning_description,
      afternoon_description,
      position,
      equipment_items,
      weather,
      obstacles,
      other_instructions,
      engineer_count,
      foreman_count,
      laborer_count,
    } = req.body;

    const morning = morning_description?.trim() || '';
    const afternoon = afternoon_description?.trim() || '';
    const workDesc = work_description?.trim() || '';

    if (!morning && !workDesc) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 400, 'กรุณาระบุรายละเอียดการทำงาน');
    }
    if (!report_date) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 400, 'กรุณาระบุวันที่');
    }

    const photoFiles = uploadedFiles.photos || [];
    const equipPhotoFiles = uploadedFiles.equip_photos || [];

    if (photoFiles.length > 6) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 400, 'รูปภาพการทำงานได้สูงสุด 6 รูป');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 404, 'ไม่พบโครงการ');
    }
    if (project.status === 'closed') {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 403, 'โครงการปิดแล้ว ไม่สามารถบันทึกรายงานได้');
    }

    // ย้ายรูปการทำงาน + resize
    const movedPhotos = moveFilesToProjectFolder(photoFiles, project.storage_base, 'reports');
    await resizeProjectPhotos(movedPhotos);

    // แปลง equipment_items + ย้ายรูปครุภัณฑ์
    let parsedEquipItems = [];
    if (equipment_items) {
      try {
        const items = typeof equipment_items === 'string'
          ? JSON.parse(equipment_items)
          : equipment_items;
        const equipPhotosArr = [];
        parsedEquipItems = items
          .filter((i) => i.equipment_type?.trim() || i.equipment_no?.trim())
          .map((item, idx) => {
            const photoMeta = equipPhotoFiles[idx]
              ? moveSingleFile(equipPhotoFiles[idx], project.storage_base, 'equip')
              : null;
            if (photoMeta) equipPhotosArr.push({ idx, meta: photoMeta });
            return {
              equipment_type: item.equipment_type?.trim() || '',
              equipment_no: item.equipment_no?.trim() || '',
              serial_no: item.serial_no?.trim() || '',
              photo: photoMeta,
            };
          });
        // resize equip photos
        for (const { meta } of equipPhotosArr) {
          await resizeProjectPhotos([meta]);
        }
      } catch {
        // equipment_items ไม่ถูกต้อง → ข้ามไป
      }
    }

    const { isKeyUser, keyId, userId, username } = req.projectUser;

    // combined work_description for backward compat
    const combinedDesc = morning
      ? morning + (afternoon ? '\n\n[ภาคบ่าย]\n' + afternoon : '')
      : workDesc;

    const report = await DailyReport.create({
      project_id: projectId,
      report_date: new Date(report_date),
      morning_description: morning,
      afternoon_description: afternoon,
      position: position?.trim() || '',
      work_description: combinedDesc,
      photos: movedPhotos,
      equipment_items: parsedEquipItems,
      weather: weather?.trim() || 'ท้องฟ้าแจ่มใส',
      obstacles: obstacles?.trim() || '---',
      other_instructions: other_instructions?.trim() || '---',
      engineer_count: Number(engineer_count) || 0,
      foreman_count: Number(foreman_count) || 0,
      laborer_count: Number(laborer_count) || 0,
      submitted_by_user: isKeyUser ? null : userId,
      submitted_by_key: isKeyUser ? keyId : null,
      submitted_role: req.projectUser.role,
    });

    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : username,
      action: 'CREATE',
      module: 'DAILY_REPORT',
      resourceId: String(report._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { project_id: projectId, report_date },
    });

    return sendSuccess(res, report, 'บันทึกรายงานประจำวันแล้ว', 201);
  } catch (err) {
    cleanupTmpFiles(uploadedFiles);
    logger.error('[DailyReport] createReport error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/daily-reports/:reportId
 */
async function getReport(req, res) {
  try {
    const { reportId } = req.params;
    const report = await DailyReport.findById(reportId)
      .select('-photos.file_path -equipment_items.photo.file_path')
      .lean();
    if (!report) return sendError(res, 404, 'ไม่พบรายงาน');
    return sendSuccess(res, report);
  } catch (err) {
    logger.error('[DailyReport] getReport error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/daily-reports/:reportId/photos/:index
 * แสดงรูปการทำงาน
 */
async function viewReportPhoto(req, res) {
  try {
    const { reportId } = req.params;
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) return sendError(res, 400, 'index ไม่ถูกต้อง');

    const report = await DailyReport.findById(reportId)
      .select('photos project_id')
      .lean();
    if (!report) return sendError(res, 404, 'ไม่พบรายงาน');

    // ดึง file_path ด้วย select
    const full = await DailyReport.findById(reportId)
      .select('+photos.file_path')
      .lean();

    const photo = full?.photos?.[idx];
    if (!photo?.file_path) return sendError(res, 404, 'ไม่พบรูปภาพ');
    if (!isSafePath(photo.file_path) || !fs.existsSync(photo.file_path)) return sendError(res, 404, 'ไม่พบไฟล์');

    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(photo.file_path).pipe(res);
  } catch (err) {
    logger.error('[DailyReport] viewReportPhoto error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/daily-reports/:reportId/equip-photos/:equipIdx
 * แสดงรูปครุภัณฑ์
 */
async function viewEquipPhoto(req, res) {
  try {
    const { reportId } = req.params;
    const idx = parseInt(req.params.equipIdx, 10);
    if (isNaN(idx) || idx < 0) return sendError(res, 400, 'index ไม่ถูกต้อง');

    const full = await DailyReport.findById(reportId)
      .select('+equipment_items.photo.file_path')
      .lean();
    if (!full) return sendError(res, 404, 'ไม่พบรายงาน');

    const equip = full.equipment_items?.[idx];
    if (!equip?.photo?.file_path) return sendError(res, 404, 'ไม่พบรูปภาพ');
    if (!isSafePath(equip.photo.file_path) || !fs.existsSync(equip.photo.file_path)) return sendError(res, 404, 'ไม่พบไฟล์');

    res.setHeader('Content-Type', equip.photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(equip.photo.file_path).pipe(res);
  } catch (err) {
    logger.error('[DailyReport] viewEquipPhoto error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PATCH /api/projects/:projectId/daily-reports/:reportId
 * แก้ไขรายละเอียดรายงาน + จัดการรูปภาพ (ทุกคนที่ access โครงการแก้ไขได้)
 * multipart/form-data:
 *   morning_description, afternoon_description, position  (optional text)
 *   keep_photo_indices  JSON array of existing photo indices to keep
 *   photos[]            new photo files to add
 */
async function updateReport(req, res) {
  const uploadedFiles = req.files || {};
  try {
    const { projectId, reportId } = req.params;
    const {
      morning_description,
      afternoon_description,
      position,
      keep_photo_indices,
      weather,
      obstacles,
      other_instructions,
      engineer_count,
      foreman_count,
      laborer_count,
    } = req.body;

    const update = {};

    // text fields
    if (morning_description !== undefined) {
      update.morning_description = String(morning_description).trim();
    }
    if (afternoon_description !== undefined) update.afternoon_description = String(afternoon_description).trim();
    if (position !== undefined) update.position = String(position).trim();
    if (weather !== undefined) update.weather = String(weather).trim() || 'ท้องฟ้าแจ่มใส';
    if (obstacles !== undefined) update.obstacles = String(obstacles).trim() || '---';
    if (other_instructions !== undefined) update.other_instructions = String(other_instructions).trim() || '---';
    if (engineer_count !== undefined) update.engineer_count = Number(engineer_count) || 0;
    if (foreman_count !== undefined) update.foreman_count = Number(foreman_count) || 0;
    if (laborer_count !== undefined) update.laborer_count = Number(laborer_count) || 0;

    // recompute combined work_description
    if (morning_description !== undefined || afternoon_description !== undefined) {
      const morning = update.morning_description ?? '';
      const afternoon = update.afternoon_description ?? '';
      update.work_description = morning + (afternoon ? '\n\n[ภาคบ่าย]\n' + afternoon : '');
    }

    // photo management (only if keep_photo_indices is sent OR new photos provided)
    const newPhotoFiles = uploadedFiles.photos || [];
    if (keep_photo_indices !== undefined || newPhotoFiles.length > 0) {
      // fetch current report with file_path
      const currentReport = await DailyReport.findOne({ _id: reportId, project_id: projectId })
        .select('+photos.file_path')
        .lean();

      if (!currentReport) {
        cleanupTmpFiles(uploadedFiles);
        return sendError(res, 404, 'ไม่พบรายงาน');
      }

      // parse keep_photo_indices
      let keepSet = null;
      if (keep_photo_indices !== undefined) {
        try {
          const parsed = typeof keep_photo_indices === 'string'
            ? JSON.parse(keep_photo_indices)
            : keep_photo_indices;
          if (Array.isArray(parsed)) keepSet = new Set(parsed.map(Number));
        } catch { keepSet = null; }
      }

      const photosToKeep = [];
      const photosToDelete = [];
      (currentReport.photos || []).forEach((p, i) => {
        if (keepSet === null || keepSet.has(i)) {
          photosToKeep.push(p);
        } else {
          photosToDelete.push(p);
        }
      });

      // delete removed photo files
      for (const p of photosToDelete) {
        if (p.file_path && isSafePath(p.file_path)) {
          try { fs.unlinkSync(p.file_path); } catch {}
        }
      }

      // move + resize new photos
      let movedNewPhotos = [];
      if (newPhotoFiles.length > 0) {
        const project = await Project.findById(projectId).select('storage_base').lean();
        if (project) {
          movedNewPhotos = moveFilesToProjectFolder(newPhotoFiles, project.storage_base, 'reports');
          await resizeProjectPhotos(movedNewPhotos);
        } else {
          cleanupTmpFiles(uploadedFiles);
        }
      }

      const allPhotos = [...photosToKeep, ...movedNewPhotos].slice(0, 6);
      update.photos = allPhotos;
    }

    if (Object.keys(update).length === 0) {
      cleanupTmpFiles(uploadedFiles);
      return sendError(res, 400, 'ไม่มีข้อมูลที่จะอัปเดต');
    }

    const report = await DailyReport.findOneAndUpdate(
      { _id: reportId, project_id: projectId },
      update,
      { new: true }
    ).select('-photos.file_path -equipment_items.photo.file_path').lean();
    if (!report) return sendError(res, 404, 'ไม่พบรายงาน');

    return sendSuccess(res, report, 'อัปเดตรายงานแล้ว');
  } catch (err) {
    cleanupTmpFiles(uploadedFiles);
    logger.error('[DailyReport] updateReport error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/projects/:projectId/daily-reports/:reportId
 * ลบรายงานประจำวัน (ทุกคนที่ access โครงการลบได้)
 */
async function deleteReport(req, res) {
  try {
    const { projectId, reportId } = req.params;
    const report = await DailyReport.findOneAndDelete({ _id: reportId, project_id: projectId });
    if (!report) return sendError(res, 404, 'ไม่พบรายงาน');

    // ลบไฟล์รูปภาพ
    const allPhotoPaths = [
      ...(report.photos || []).map((p) => p.file_path),
      ...(report.equipment_items || []).map((e) => e.photo?.file_path).filter(Boolean),
    ];
    for (const fp of allPhotoPaths) {
      if (fp && isSafePath(fp)) {
        try { fs.unlinkSync(fp); } catch {}
      }
    }

    const { isKeyUser, keyId, userId, username } = req.projectUser;
    await logAction({
      userId: isKeyUser ? keyId : userId,
      username: isKeyUser ? `KEY:${req.projectUser.label || keyId}` : username,
      action: 'DELETE',
      module: 'DAILY_REPORT',
      resourceId: String(report._id),
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { project_id: projectId },
    });

    return sendSuccess(res, null, 'ลบรายงานแล้ว');
  } catch (err) {
    logger.error('[DailyReport] deleteReport error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/projects/:projectId/used-equipment-nos
 * คืน array ของ equipment_no ที่มีการบันทึกไว้แล้วในรายงานประจำวันของโครงการนี้
 */
async function getUsedEquipmentNos(req, res) {
  try {
    const { projectId } = req.params;
    const nos = await DailyReport.distinct('equipment_items.equipment_no', { project_id: projectId });
    return sendSuccess(res, nos.filter((n) => n && n.trim() !== ''), 'ok');
  } catch (err) {
    logger.error('[DailyReport] getUsedEquipmentNos error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { listReports, createReport, getReport, viewReportPhoto, viewEquipPhoto, updateReport, deleteReport, getUsedEquipmentNos };
