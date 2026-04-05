const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const { getSettings, setSetting, getAuditLogs, getAuditStats, purgeAuditLogs, getPublicSettings, listBackups, triggerBackup, downloadBackup } = require('./admin.controller');

const router = Router();

router.get('/public-settings', authenticate, getPublicSettings);
router.get('/settings', authenticate, requireRole('admin'), getSettings);
router.put('/settings/:key', authenticate, requireRole('admin'), setSetting);
router.get('/audit', authenticate, requireRole('admin'), getAuditLogs);
router.get('/audit/stats', authenticate, requireRole('admin'), getAuditStats);
router.delete('/audit/purge', authenticate, requireRole('admin'), purgeAuditLogs);

// Backup
router.get('/backups', authenticate, requireRole('admin'), listBackups);
router.post('/backups/trigger', authenticate, requireRole('admin'), triggerBackup);
router.get('/backups/:filename/download', authenticate, requireRole('admin'), downloadBackup);

module.exports = router;
