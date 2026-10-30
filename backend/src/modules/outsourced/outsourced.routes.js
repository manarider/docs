const { Router } = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { requireOutsourcedAccess, requireOutsourcedManage, requireOutsourcedRole, requireRole } = require('../../middleware/authenticate');
const { uploadOutsourcedReportFiles, handleOutsourcedMulterError } = require('./outsourced.upload');
const { listGroups, getGroup, createGroup, updateGroup, deleteGroup } = require('./group.controller');
const { listForms, getForm, createForm, updateForm, deleteForm } = require('./form.controller');
const { getMyProfile, updateMyProfile, listGroupProfiles, updateProfileForUser } = require('./profile.controller');
const { listCommitteeMembers, createCommitteeMember, updateCommitteeMember, deleteCommitteeMember } = require('./committee.controller');
const {
    listReports,
    getReport,
    createReport,
    previewReportImage,
    deleteReport,
    viewReportPhoto,
    downloadReportPdf,
} = require('./report.controller');

const router = Router();

// ─── โปรไฟล์ผู้ใช้ (ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง) — เฉพาะ role 'outsourced' ────
router.get('/profile', authenticate, requireOutsourcedRole, getMyProfile);
router.put('/profile', authenticate, requireOutsourcedRole, updateMyProfile);

// ─── Groups (กลุ่มงาน) ─────────────────────────────────────────────────────────
// สร้าง/แก้ไข/ลบ — เฉพาะ admin/staff, ดูรายการ — ทุกคนที่มีสิทธิ์เข้าเมนู Outsourced
router.get('/groups', authenticate, requireOutsourcedAccess, listGroups);
router.get('/groups/:groupId', authenticate, requireOutsourcedAccess, getGroup);
router.post('/groups', authenticate, requireOutsourcedManage, createGroup);
router.patch('/groups/:groupId', authenticate, requireOutsourcedManage, updateGroup);
router.delete('/groups/:groupId', authenticate, requireOutsourcedManage, deleteGroup);

// ─── คณะกรรมการตรวจรับ (ต่อกลุ่มงาน) — เฉพาะ admin ขึ้นไปเท่านั้น ───────────────
router.get('/groups/:groupId/committee', authenticate, requireRole('admin'), listCommitteeMembers);
router.post('/groups/:groupId/committee', authenticate, requireRole('admin'), createCommitteeMember);
router.patch('/groups/:groupId/committee/:memberId', authenticate, requireRole('admin'), updateCommitteeMember);
router.delete('/groups/:groupId/committee/:memberId', authenticate, requireRole('admin'), deleteCommitteeMember);

// ─── โปรไฟล์เจ้าหน้าที่ (ต่อกลุ่มงาน) — admin แก้ไขตำแหน่ง/เลขที่บันทึกตกลงจ้างของผู้อื่นได้ ───
router.get('/groups/:groupId/profiles', authenticate, requireRole('admin'), listGroupProfiles);
router.patch('/groups/:groupId/profiles/:userId', authenticate, requireRole('admin'), updateProfileForUser);

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
    '/groups/:groupId/report-image-preview',
    authenticate,
    requireOutsourcedAccess,
    (req, res, next) => uploadOutsourcedReportFiles(req, res, (err) => { if (err) return handleOutsourcedMulterError(err, req, res, next); next(); }),
    previewReportImage
);
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
