const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const { summary, auditLog, downloadReport } = require('./report.controller');

const router = Router();

// สถิติเอกสาร (ทุกคนเข้าถึงได้ — scoped ตามหน่วยงานสำหรับ non-admin)
router.get('/summary', authenticate, summary);

// Audit log (admin+)
router.get('/audit', authenticate, requireRole('admin'), auditLog);

// รายงานการดาวน์โหลด (manager+)
router.get('/downloads', authenticate, requireRole('manager'), downloadReport);

module.exports = router;
