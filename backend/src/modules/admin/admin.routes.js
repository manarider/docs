const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const { getSettings, setSetting, getAuditLogs, getPublicSettings } = require('./admin.controller');

const router = Router();

router.get('/public-settings', authenticate, getPublicSettings);
router.get('/settings', authenticate, requireRole('admin'), getSettings);
router.put('/settings/:key', authenticate, requireRole('admin'), setSetting);
router.get('/audit', authenticate, requireRole('admin'), getAuditLogs);

module.exports = router;
