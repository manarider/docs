const { Router } = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireOutsourcedAccess, requireOutsourcedManage } = require('../../middleware/authenticate');
const { uploadOutsourcedReportFiles, handleOutsourcedMulterError } = require('./outsourced.upload');
const { listGroups, getGroup, createGroup, updateGroup, deleteGroup } = require('./group.controller');
const { listForms, getForm, createForm, updateForm, deleteForm } = require('./form.controller');
const {
    listReports,
    getReport,
    createReport,
    deleteReport,
    viewReportPhoto,
    downloadReportPdf,
} = require('./report.controller');

const router = Router();

// ─── Groups (กลุ่มงาน) ─────────────────────────────────────────────────────────
// สร้าง/แก้ไข/ลบ — เฉพาะ admin/staff, ดูรายการ — ทุกคนที่มีสิทธิ์เข้าเมนู Outsourced
router.get('/groups', authenticate, requireOutsourcedAccess, listGroups);
router.get('/groups/:groupId', authenticate, requireOutsourcedAccess, getGroup);
router.post('/groups', authenticate, requireOutsourcedManage, createGroup);
router.patch('/groups/:groupId', authenticate, requireOutsourcedManage, updateGroup);
router.delete('/groups/:groupId', authenticate, requireOutsourcedManage, deleteGroup);

// ─── Report Forms (ฟอร์มการรายงาน) — ต้องเลือกกลุ่มงานก่อนเสมอ (:groupId) ────────
router.get('/groups/:groupId/forms', authenticate, requireOutsourcedAccess, listForms);
router.get('/groups/:groupId/forms/:formId', authenticate, requireOutsourcedAccess, getForm);
router.post('/groups/:groupId/forms', authenticate, requireOutsourcedManage, createForm);
router.patch('/groups/:groupId/forms/:formId', authenticate, requireOutsourcedManage, updateForm);
router.delete('/groups/:groupId/forms/:formId', authenticate, requireOutsourcedManage, deleteForm);

// ─── Reports (รายงาน) — ต้องเลือกกลุ่มงานก่อนเสมอ (:groupId) ─────────────────────
router.get('/groups/:groupId/reports', authenticate, requireOutsourcedAccess, listReports);
router.get('/groups/:groupId/reports/:reportId', authenticate, requireOutsourcedAccess, getReport);
router.post(
    '/groups/:groupId/reports',
    authenticate,
    requireOutsourcedAccess,
    (req, res, next) => uploadOutsourcedReportFiles(req, res, (err) => { if (err) return handleOutsourcedMulterError(err, req, res, next); next(); }),
    createReport
);
router.delete('/groups/:groupId/reports/:reportId', authenticate, requireOutsourcedAccess, deleteReport);
router.get('/groups/:groupId/reports/:reportId/photos/:fieldId/:index', authenticate, requireOutsourcedAccess, viewReportPhoto);
router.get('/groups/:groupId/reports/:reportId/pdf', authenticate, requireOutsourcedAccess, downloadReportPdf);

module.exports = router;
