const { Router } = require('express');
const { authenticateProject } = require('../../middleware/authenticateProject');
const { getAvailableTemplates, generateReport } = require('./generator.controller');

const router = Router();

// Report Generation
router.get('/:projectId/reports/:module/:recordId/templates', authenticateProject, getAvailableTemplates);
router.get('/:projectId/reports/:module/:recordId/generate/:templateId', authenticateProject, generateReport);

module.exports = router;
