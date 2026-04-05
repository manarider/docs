const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../../middleware/authenticate');
const config = require('../../config');
const { login, callback, logout, me } = require('./auth.controller');

const router = Router();

const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'คำร้องขอมากเกินไป กรุณาลองใหม่อีกครั้ง' },
});

// Redirect ไป UMS login
router.get('/login', authLimiter, login);

// UMS callback พร้อม token
router.get('/callback', authLimiter, callback);

// ออกจากระบบ (ต้อง login แล้ว)
router.post('/logout', authenticate, logout);

// ดูข้อมูลตัวเอง (ต้อง login แล้ว)
router.get('/me', authenticate, me);

module.exports = router;
