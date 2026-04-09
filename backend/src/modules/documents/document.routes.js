const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const { uploadDoc, uploadImg, handleMulterError } = require('./document.upload');
const {
  listDocuments,
  globalSearch,
  toggleStar,
  listTrash,
  restoreDocument,
  permanentDelete,
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
  listDeletedAttachments,
  restoreAttachment,
  permanentDeleteAttachment,
  uploadImage,
  viewImage,
  createShare,
  deleteShare,
  getShare,
} = require('./document.controller');
const { validateCreate, validateUpdate, validateUploadAtt } = require('./document.validation');
const config = require('../../config');

const router = Router();

// Rate limit สำหรับ download (เพื่อป้องกัน abuse)
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'ดาวน์โหลดบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Documents ────────────────────────────────────────────────────────────────

// รายการเอกสาร
router.get('/', authenticate, listDocuments);

// Global Search (ต้องอยู่ก่อน /:id)
router.get('/search', authenticate, globalSearch);

// Trash (admin only) — ต้องอยู่ก่อน /:id
router.get('/trash', authenticate, requireRole('admin'), listTrash);

// ไฟล์แนบที่ถูกลบ (admin only) — ต้องอยู่ก่อน /:id
router.get('/trash/attachments', authenticate, requireRole('admin'), listDeletedAttachments);

// สร้างเอกสาร (member ขึ้นไป)
router.post('/', authenticate, requireRole('member'), validateCreate, createDocument);

// รายละเอียดเอกสาร
router.get('/:id', authenticate, getDocument);

// แก้ไขเอกสาร
router.patch('/:id', authenticate, requireRole('member'), validateUpdate, updateDocument);

// ลบเอกสาร (soft) - ทุก role
router.delete('/:id', authenticate, requireRole('member'), deleteDocument);

// Toggle Star
router.post('/:id/star', authenticate, toggleStar);

// Restore จาก trash (admin only)
router.post('/:id/restore', authenticate, requireRole('admin'), restoreDocument);

// Permanent delete (admin only)
router.delete('/:id/permanent', authenticate, requireRole('admin'), permanentDelete);

// ─── Attachments ──────────────────────────────────────────────────────────────

// อัปโหลดไฟล์แนบ
router.post(
  '/:id/attachments',
  authenticate,
  requireRole('member'),
  (req, res, next) => uploadDoc(req, res, (err) => { if (err) return handleMulterError(err, req, res, next); next(); }),
  validateUploadAtt,
  uploadAttachment
);

// ดาวน์โหลดไฟล์แนบ
router.get('/:id/attachments/:subId/download', authenticate, downloadLimiter, downloadAttachment);

// ลบไฟล์แนบ (soft delete)
router.delete('/:id/attachments/:subId', authenticate, requireRole('member'), deleteAttachment);

// Restore ไฟล์แนบ (admin only)
router.post('/:id/attachments/:subId/restore', authenticate, requireRole('admin'), restoreAttachment);

// ลบไฟล์แนบถาวร (admin only)
router.delete('/:id/attachments/:subId/permanent', authenticate, requireRole('admin'), permanentDeleteAttachment);

// ─── Images ────────────────────────────────────────────────────────────────────

// อัปโหลดรูปภาพ
router.post(
  '/:id/images',
  authenticate,
  requireRole('member'),
  (req, res, next) => uploadImg(req, res, (err) => { if (err) return handleMulterError(err, req, res, next); next(); }),
  uploadImage
);

// ดูรูปภาพ
router.get('/:id/images/:index', authenticate, viewImage);

// ─── DOW Share ────────────────────────────────────────────────────────────────

// ดึงข้อมูล share link + QR (owner/admin)
router.get('/:id/share', authenticate, requireRole('member'), getShare);

// สร้าง/อัปเดต share link
router.post('/:id/share', authenticate, requireRole('member'), createShare);

// ลบ share link
router.delete('/:id/share', authenticate, requireRole('member'), deleteShare);

module.exports = router;
