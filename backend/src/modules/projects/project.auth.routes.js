const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { keyLogin, keyLogout, keyMe, getProjectPublicInfo } = require('./project.auth.controller');

const router = Router();

const keyLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 10, // ป้องกัน brute force KEY
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'ลองใหม่หลายครั้งเกินไป กรุณารอสักครู่' },
});

// Login ด้วย KEY
router.post('/login', keyLoginLimiter, keyLogin);

// Logout
router.post('/logout', keyLogout);

// ดูข้อมูล session ปัจจุบัน
router.get('/me', keyMe);

// ดึงชื่อโครงการ (public — ใช้ในหน้า login ก่อน auth)
router.get('/project/:projectId/info', getProjectPublicInfo);

module.exports = router;
