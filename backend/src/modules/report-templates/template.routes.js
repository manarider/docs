const { Router } = require('express');
const {
  authenticateProject,
  requireInternalStaff,
} = require('../../middleware/authenticateProject');
const {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  uploadBackground,
  deleteBackground,
  serveBackground,
} = require('./template.controller');
const { uploadBackground: uploadBgMiddleware, handleBgUploadError } = require('./template.upload');

const router = Router();

// Template CRUD
router.get('/:projectId/report-templates', authenticateProject, listTemplates);
router.get('/:projectId/report-templates/:templateId', authenticateProject, getTemplate);
router.post('/:projectId/report-templates', authenticateProject, requireInternalStaff, createTemplate);
router.put('/:projectId/report-templates/:templateId', authenticateProject, requireInternalStaff, updateTemplate);
router.delete('/:projectId/report-templates/:templateId', authenticateProject, requireInternalStaff, deleteTemplate);

// Background upload
router.post(
  '/:projectId/report-templates/:templateId/background/:pageNo',
  authenticateProject,
  requireInternalStaff,
  uploadBgMiddleware,
  handleBgUploadError,
  uploadBackground
);
router.delete(
  '/:projectId/report-templates/:templateId/background/:pageNo',
  authenticateProject,
  requireInternalStaff,
  deleteBackground
);
router.get(
  '/:projectId/report-templates/:templateId/background/:pageNo/file',
  authenticateProject,
  serveBackground
);

module.exports = router;
