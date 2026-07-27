const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const { searchEquipment } = require('./equipment.controller');

const router = Router();

// ต้อง login เป็น internal user ระดับ member ขึ้นไป
router.get('/search', authenticate, requireRole('member'), searchEquipment);

module.exports = router;
