const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const SystemSettings = require('../../models/SystemSettings');
const AuditLog = require('../../models/AuditLog');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const { updateFileSizeLimits } = require('../documents/document.upload');

const BACKUP_DIR = '/data/backups/mongodb';
const BACKUP_SCRIPT = '/data/archives/scripts/backup-mongo.sh';

/**
 * GET /api/admin/settings
 * ดูค่า settings ทั้งหมด
 */
async function getSettings(req, res) {
  try {
    const settings = await SystemSettings.find().lean();
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    return sendSuccess(res, map, 'Settings');
  } catch (err) {
    logger.error('[Admin] getSettings error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * PUT /api/admin/settings/:key
 * ตั้งค่า setting
 */
async function setSetting(req, res) {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    // ตรวจสอบค่า numeric สำหรับ file size settings ก่อนบันทึก
    if (key === 'max_doc_size_mb' || key === 'max_img_size_mb') {
      const numVal = Number(value);
      if (!Number.isFinite(numVal) || numVal < 1) {
        return sendError(res, 400, 'ค่าต้องเป็นตัวเลขจำนวนเต็มที่มากกว่า 0');
      }
    }

    const setting = await SystemSettings.findOneAndUpdate(
      { key },
      { value, description, updatedBy: req.user.username },
      { upsert: true, new: true }
    );

    // อัปเดต in-memory file size limits ทันทีโดยไม่ต้อง restart
    if (key === 'max_doc_size_mb') updateFileSizeLimits({ docMB: Number(value) });
    if (key === 'max_img_size_mb') updateFileSizeLimits({ imgMB: Number(value) });

    return sendSuccess(res, setting, 'บันทึก setting เรียบร้อย');
  } catch (err) {
    logger.error('[Admin] setSetting error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/admin/audit
 * ดู audit logs พร้อม filter และ pagination
 */
async function getAuditLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.username) {
      const escaped = req.query.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.username = { $regex: escaped, $options: 'i' };
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return sendSuccess(res, { logs, total, page, pages: Math.ceil(total / limit) }, 'Audit logs');
  } catch (err) {
    logger.error('[Admin] getAuditLogs error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/admin/public-settings
 * ดูค่า settings ที่ใช้แสดงสาธารณะ (ไม่ต้อง admin)
 */
async function getPublicSettings(req, res) {
  try {
    const setting = await SystemSettings.findOne({ key: 'public_duration_hours' }).lean();
    return sendSuccess(res, { public_duration_hours: setting?.value ?? 24 }, 'Public settings');
  } catch (err) {
    logger.error('[Admin] getPublicSettings error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/admin/backups
 * รายการไฟล์ backup MongoDB
 */
async function listBackups(req, res) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return sendSuccess(res, [], 'ไม่พบไฟล์ backup');
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.tar.gz'))
      .map((f) => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fullPath);
        return { name: f, size: stat.size, createdAt: stat.mtime };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendSuccess(res, files, 'รายการ backup');
  } catch (err) {
    logger.error('[Admin] listBackups error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * POST /api/admin/backups/trigger
 * รัน backup ทันที (รัน script แบบไม่รอเสร็จ)
 */
async function triggerBackup(req, res) {
  try {
    if (!fs.existsSync(BACKUP_SCRIPT)) {
      return sendError(res, 500, 'ไม่พบ backup script');
    }
    // ส่ง response กลับทันที แล้วรัน script background
    res.json({ success: true, message: 'กำลัง backup ข้อมูล กรุณารอสักครู่แล้วรีเฟรช' });
    execFile('bash', [BACKUP_SCRIPT], (err) => {
      if (err) logger.error('[Admin] backup script error:', err.message);
      else logger.info('[Admin] Manual backup completed');
    });
  } catch (err) {
    logger.error('[Admin] triggerBackup error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/admin/backups/:filename/download
 * ดาวน์โหลดไฟล์ backup
 */
async function downloadBackup(req, res) {
  try {
    // ป้องกัน path traversal — ตรวจสอบชื่อไฟล์ด้วย strict regex
    const filename = path.basename(req.params.filename);
    if (!/^[a-zA-Z0-9_\-\.]{1,120}\.tar\.gz$/.test(filename)) {
      return sendError(res, 400, 'ชื่อไฟล์ไม่ถูกต้อง');
    }
    const fullPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(fullPath)) return sendError(res, 404, 'ไม่พบไฟล์');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    return res.sendFile(fullPath);
  } catch (err) {
    logger.error('[Admin] downloadBackup error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

const MIN_PURGE_DAYS = 90;
const DEFAULT_PURGE_DAYS = 120;

/**
 * GET /api/admin/audit/stats
 * สถิติการใช้พื้นที่ของ audit logs
 */
async function getAuditStats(req, res) {
  try {
    const mongoose = require('mongoose');
    const [total, oldest] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.findOne().sort({ createdAt: 1 }).select('createdAt').lean(),
    ]);

    let storageSize = 0;
    let storageSizeCompressed = 0;
    try {
      const stats = await mongoose.connection.db.command({ collStats: 'auditlogs' });
      storageSize = stats.size || 0;
      storageSizeCompressed = stats.storageSize || 0;
    } catch (_e) {
      // fallback: estimate ~500 bytes per doc
      storageSize = total * 500;
      storageSizeCompressed = total * 500;
    }

    return sendSuccess(res, {
      total,
      oldestLog: oldest ? oldest.createdAt : null,
      storageSize,
      storageSizeCompressed,
      minPurgeDays: MIN_PURGE_DAYS,
      defaultPurgeDays: DEFAULT_PURGE_DAYS,
    }, 'Audit log stats');
  } catch (err) {
    logger.error('[Admin] getAuditStats error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/admin/audit/purge
 * ลบ audit logs ที่มีอายุมากกว่า X วัน (ต่ำสุด 90 วัน)
 * Body: { days: number }
 */
async function purgeAuditLogs(req, res) {
  try {
    let days = parseInt(req.body.days) || DEFAULT_PURGE_DAYS;
    if (days < MIN_PURGE_DAYS) {
      return sendError(res, 400, `ไม่สามารถลบ log ที่มีอายุน้อยกว่า ${MIN_PURGE_DAYS} วัน`);
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });

    logger.info(`[Admin] purgeAuditLogs: deleted ${result.deletedCount} logs older than ${days} days by ${req.user.username}`);
    return sendSuccess(res, { deletedCount: result.deletedCount, days, cutoff }, `ลบ log เรียบร้อย ${result.deletedCount} รายการ`);
  } catch (err) {
    logger.error('[Admin] purgeAuditLogs error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { getSettings, setSetting, getAuditLogs, getAuditStats, purgeAuditLogs, getPublicSettings, listBackups, triggerBackup, downloadBackup };
