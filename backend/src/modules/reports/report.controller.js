const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Document = require('../../models/Document');
const AuditLog = require('../../models/AuditLog');
const { sendSuccess, sendError } = require('../../utils/response');
const { getFiscalYear, getFiscalYearRange } = require('../../utils/fiscalYear');
const logger = require('../../utils/logger');

/**
 * GET /api/reports/summary
 * สรุปยอดเอกสารทั้งระบบ (admin+)
 */
async function summary(req, res) {
  try {
    const fiscalYear = parseInt(req.query.year, 10) || getFiscalYear();
    const { start, end } = getFiscalYearRange(fiscalYear);

    const isAdmin = ['superadmin', 'admin', 'manager'].includes(req.user?.role);
    let deptFilter = {};
    if (!isAdmin && req.user?.deptId) {
      try {
        deptFilter = { dept_id: new mongoose.Types.ObjectId(req.user.deptId) };
      } catch (_) {
        // deptId ไม่ใช่ ObjectId ที่ valid — ใช้ filter ว่างแทน
      }
    }
    const baseFilter = { deleted_at: null, ...deptFilter };

    const [totalDocs, newThisYear, byDept, byType, topViewed] = await Promise.all([
      Document.countDocuments(baseFilter),
      Document.countDocuments({ ...baseFilter, createdAt: { $gte: start, $lte: end } }),

      Document.aggregate([
        { $match: { deleted_at: null, fiscal_year: fiscalYear, ...deptFilter } },
        { $group: { _id: '$dept_id', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $project: { deptName: { $ifNull: ['$dept.name', 'ไม่ระบุ'] }, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),

      Document.aggregate([
        { $match: { deleted_at: null, fiscal_year: fiscalYear, ...deptFilter } },
        { $group: { _id: '$type_id', count: { $sum: 1 } } },
        { $lookup: { from: 'doctypes', localField: '_id', foreignField: '_id', as: 'type' } },
        { $unwind: { path: '$type', preserveNullAndEmptyArrays: true } },
        { $project: { typeName: { $ifNull: ['$type.name', 'ไม่ระบุ'] }, count: 1 } },
        { $sort: { count: -1 } },
      ]),

      Document.find(baseFilter)
        .sort({ views: -1 })
        .limit(10)
        .populate('dept_id', 'name')
        .select('title views dept_id fiscal_year createdAt')
        .lean(),
    ]);

    return sendSuccess(res, {
      fiscalYear,
      isAdmin,
      totalDocs,
      newThisYear,
      byDept,
      byType,
      topViewed,
    }, 'สถิติเอกสาร');
  } catch (err) {
    logger.error(`[Report] summary error: ${err.stack || err.message}`);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/reports/audit
 * ดูรายการ Audit Log (admin+)
 */
async function auditLog(req, res) {
  try {
    const { page = 1, limit = 50, user, action, module: mod, from, to } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));

    const filter = {};
    if (user) {
      const escaped = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.username = { $regex: escaped, $options: 'i' };
    }
    if (action) filter.action = action;
    if (mod) filter.module = mod;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: logs,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Report] auditLog error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/reports/downloads
 * รายงานการดาวน์โหลด (manager+)
 */
async function downloadReport(req, res) {
  try {
    const fiscalYear = parseInt(req.query.year, 10) || getFiscalYear();
    const { start, end } = getFiscalYearRange(fiscalYear);

    const logs = await AuditLog.aggregate([
      {
        $match: {
          action: 'DOWNLOAD',
          module: 'DOCUMENT',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$resource_id',
          downloadCount: { $sum: 1 },
          users: { $addToSet: '$username' },
        },
      },
      { $sort: { downloadCount: -1 } },
      { $limit: 50 },
    ]);

    return sendSuccess(res, { fiscalYear, logs }, 'รายงานการดาวน์โหลด');
  } catch (err) {
    logger.error('[Report] downloadReport error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

const config = require('../../config');

/**
 * คำนวณขนาดไฟล์ทั้งหมดในโฟลเดอร์ (recursive)
 */
function getDirStats(dirPath) {
  if (!fs.existsSync(dirPath)) return { totalSize: 0, fileCount: 0, byExt: {} };
  let totalSize = 0;
  let fileCount = 0;
  const byExt = {};

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
        fileCount++;
        const ext = path.extname(entry.name).toLowerCase() || 'ไม่มีนามสกุล';
        byExt[ext] = (byExt[ext] || 0) + 1;
      }
    }
  };
  walk(dirPath);
  return { totalSize, fileCount, byExt };
}

/**
 * GET /api/reports/storage
 * ข้อมูลพื้นที่จัดเก็บไฟล์ (admin only)
 */
async function storageStats(req, res) {
  try {
    const storagePath = config.storage.basePath;
    const { totalSize, fileCount, byExt } = getDirStats(storagePath);

    // หาพื้นที่ดิสก์รวมด้วย statvfs-like approach ผ่าน /proc
    let diskTotal = null;
    let diskFree = null;
    try {
      const { execSync } = require('child_process');
      const dfOut = execSync(`df -B1 "${storagePath}" 2>/dev/null | tail -1`, { timeout: 3000 }).toString().trim();
      const parts = dfOut.split(/\s+/);
      if (parts.length >= 4) {
        diskTotal = parseInt(parts[1], 10);
        diskFree = parseInt(parts[3], 10);
      }
    } catch (_) { /* ไม่บังคับ */ }

    return sendSuccess(res, {
      storagePath,
      totalSize,
      fileCount,
      byExt,
      disk: diskTotal != null ? { total: diskTotal, free: diskFree, used: diskTotal - diskFree } : null,
    }, 'storage stats');
  } catch (err) {
    logger.error('[Report] storageStats error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { summary, auditLog, downloadReport, storageStats };
