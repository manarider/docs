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
    if (user) filter.username = { $regex: user, $options: 'i' };
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

module.exports = { summary, auditLog, downloadReport };
