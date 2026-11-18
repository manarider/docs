const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const { validateCreateMeeting, validateUpdateMeeting } = require('./meeting.validation');
const {
  getMeetingDocType,
  listMeetings,
  createMeeting,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  getPublicCurrent,
  streamPublicFile,
} = require('./meeting.controller');

const router = Router();

// Rate limit สำหรับ endpoint /public/current (polling ทุก 10 วิ — โหลดไม่สูง)
const currentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: 'เรียกบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit สำหรับ endpoint /public/file — ต้องสูงกว่ามาก เพราะ:
// 1) pdf.js ดึงไฟล์แบบ range request หลายครั้งต่อการเปิดเอกสาร 1 ครั้ง
// 2) ผู้เข้าร่วมประชุมหลายคนในห้องเดียวกันมักใช้ Wi-Fi/IP สาธารณะเดียวกัน
//    ทำให้ request ของทุกคนถูกนับรวมในโควต้าเดียวกัน (key ตาม IP)
const fileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { success: false, message: 'เรียกบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Public — หน้าจอแสดงผล /docs/meet (ไม่ต้อง login) ──────────────────────────
router.get('/public/current', currentLimiter, getPublicCurrent);
router.get('/public/file/:meetingId/:docId/:subId', fileLimiter, streamPublicFile);

// ─── Management — Tab "จัดการการแสดงผล" ───────────────────────────────────────
router.get('/doctype', authenticate, getMeetingDocType);
router.get('/', authenticate, listMeetings);
router.post('/', authenticate, requireRole('member'), validateCreateMeeting, createMeeting);
router.get('/:id', authenticate, getMeeting);
router.patch('/:id', authenticate, requireRole('member'), validateUpdateMeeting, updateMeeting);
router.delete('/:id', authenticate, requireRole('member'), deleteMeeting);

module.exports = router;
