const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const {
  authenticateProject,
  requireProjectPermission,
  requireInternalStaff,
  requireInternalAdmin,
} = require('../../middleware/authenticateProject');
const {
  uploadDailyReportFiles,
  uploadProcurementPhotos,
  uploadAcceptancePhotos,
  handleProjectMulterError,
} = require('./project.upload');
const {
  getOrCreateByDocument,
  getProject,
  updateProject,
  updateStatus,
  listKeys,
  createKey,
  updateKey,
  regenerateKey,
  deleteKey,
} = require('./project.controller');
const {
  listReports,
  createReport,
  getReport,
  viewReportPhoto,
  viewEquipPhoto,
  updateReport,
  deleteReport,
  getUsedEquipmentNos,
} = require('./daily_report.controller');
const {
  listProcurement,
  createProcurement,
  getProcurement,
  updateProcurement,
  issueProcurement,
  viewReceivePhoto,
  viewInspectPhoto,
  deleteProcurement,
} = require('./procurement.controller');
const {
  listAcceptance,
  createAcceptance,
  getAcceptance,
  updateAcceptance,
  viewAcceptancePhoto,
  deleteAcceptance,
} = require('./acceptance.controller');

const router = Router();

// ─── Project Bootstrap ────────────────────────────────────────────────────────
// สร้าง/ดึง Project จาก Document PRJ (internal user เท่านั้น)
// POST เพราะมี side-effect (สร้าง project ถ้ายังไม่มี)
router.post('/by-document/:docId', authenticate, requireRole('member'), getOrCreateByDocument);

// ─── Project Info ─────────────────────────────────────────────────────────────
router.get('/:projectId', authenticateProject, getProject);
router.patch('/:projectId', authenticateProject, updateProject);
router.patch('/:projectId/status', authenticate, requireRole('admin'), updateStatus);

// ─── KEY Management (internal staff+ เท่านั้น) ────────────────────────────────
router.get('/:projectId/keys', authenticateProject, requireInternalStaff, listKeys);
router.post('/:projectId/keys', authenticateProject, requireInternalStaff, createKey);
router.patch('/:projectId/keys/:keyId', authenticateProject, requireInternalStaff, updateKey);
router.post('/:projectId/keys/:keyId/regenerate', authenticateProject, requireInternalStaff, regenerateKey);
router.delete('/:projectId/keys/:keyId', authenticateProject, requireInternalStaff, deleteKey);

// ─── Daily Reports ────────────────────────────────────────────────────────────
router.get('/:projectId/daily-reports', authenticateProject, listReports);
router.post(
  '/:projectId/daily-reports',
  authenticateProject,
  requireProjectPermission('daily_report:write'),
  (req, res, next) => uploadDailyReportFiles(req, res, next),
  handleProjectMulterError,
  createReport
);
router.get('/:projectId/used-equipment-nos', authenticateProject, getUsedEquipmentNos);
router.get('/:projectId/daily-reports/:reportId', authenticateProject, getReport);
router.patch(
  '/:projectId/daily-reports/:reportId',
  authenticateProject,
  (req, res, next) => uploadDailyReportFiles(req, res, next),
  handleProjectMulterError,
  updateReport
);
router.delete('/:projectId/daily-reports/:reportId', authenticateProject, deleteReport);
router.get('/:projectId/daily-reports/:reportId/photos/:index', authenticateProject, viewReportPhoto);
router.get('/:projectId/daily-reports/:reportId/equip-photos/:equipIdx', authenticateProject, viewEquipPhoto);

// ─── Procurement ──────────────────────────────────────────────────────────────
router.get('/:projectId/procurement', authenticateProject, listProcurement);
router.post(
  '/:projectId/procurement',
  authenticateProject,
  requireProjectPermission('procurement:write'),
  (req, res, next) => uploadProcurementPhotos(req, res, next),
  handleProjectMulterError,
  createProcurement
);
router.get('/:projectId/procurement/:itemId', authenticateProject, getProcurement);
router.patch(
  '/:projectId/procurement/:itemId',
  authenticateProject,
  updateProcurement
);
router.delete('/:projectId/procurement/:itemId', authenticateProject, deleteProcurement);
router.post(
  '/:projectId/procurement/:itemId/issue',
  authenticateProject,
  requireProjectPermission('procurement:write'),
  issueProcurement
);
router.get('/:projectId/procurement/:itemId/receive-photos/:index', authenticateProject, viewReceivePhoto);
router.get('/:projectId/procurement/:itemId/inspect-photos/:index', authenticateProject, viewInspectPhoto);

// ─── Work Acceptance ──────────────────────────────────────────────────────────
router.get('/:projectId/acceptance', authenticateProject, listAcceptance);
router.post(
  '/:projectId/acceptance',
  authenticateProject,
  requireProjectPermission('acceptance:write'),
  (req, res, next) => uploadAcceptancePhotos(req, res, next),
  handleProjectMulterError,
  createAcceptance
);
router.get('/:projectId/acceptance/:acceptId', authenticateProject, getAcceptance);
router.patch(
  '/:projectId/acceptance/:acceptId',
  authenticateProject,
  (req, res, next) => uploadAcceptancePhotos(req, res, next),
  handleProjectMulterError,
  updateAcceptance
);
router.delete('/:projectId/acceptance/:acceptId', authenticateProject, deleteAcceptance);
router.get('/:projectId/acceptance/:acceptId/photos/:index', authenticateProject, viewAcceptancePhoto);

module.exports = router;
