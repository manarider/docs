const { Router } = require('express');
const { authenticate } = require('../../middleware/authenticate');
const { login, callback, logout, me } = require('./auth.controller');

const router = Router();

// Redirect ไป UMS login
router.get('/login', login);

// UMS callback พร้อม token
router.get('/callback', callback);

// ออกจากระบบ (ต้อง login แล้ว)
router.post('/logout', authenticate, logout);

// ดูข้อมูลตัวเอง (ต้อง login แล้ว)
router.get('/me', authenticate, me);

module.exports = router;
