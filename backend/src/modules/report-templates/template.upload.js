const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');

/**
 * Multer storage สำหรับ background files
 * รองรับ PDF, PNG, JPG
 */

const ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg'];

const bgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const storageBase = config.storage.basePath;
    const bgFolder = path.join(storageBase, '_report_backgrounds');

    // สร้าง folder ถ้ายังไม่มี
    if (!fs.existsSync(bgFolder)) {
      fs.mkdirSync(bgFolder, { recursive: true, mode: 0o750 });
    }

    cb(null, bgFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const bgUpload = multer({
  storage: bgStorage,
  // multer รองรับ limit เดียวสำหรับทั้ง instance จึงใช้ค่าสูงสุดก่อน แล้วตรวจสอบแยกตามชนิดไฟล์ใน uploadBackground
  limits: { fileSize: Math.max(config.storage.maxDocSizeMB, config.storage.maxImgSizeMB) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('อัปโหลดได้เฉพาะ PDF, PNG, JPG'), false);
    }
    cb(null, true);
  },
});

/**
 * Middleware อัปโหลด background — ตรวจสอบขนาดแยกตามชนิดไฟล์
 * PDF ≤ maxDocSizeMB, PNG/JPG ≤ maxImgSizeMB
 */
function uploadBackground(req, res, next) {
  bgUpload.single('background')(req, res, (err) => {
    if (err) return next(err);
    const file = req.file;
    if (file && file.mimetype !== 'application/pdf') {
      const imgLimitBytes = config.storage.maxImgSizeMB * 1024 * 1024;
      if (file.size > imgLimitBytes) {
        fs.unlink(file.path, () => { });
        return res.status(400).json({
          success: false,
          message: `รูปภาพใหญ่เกินกำหนด (สูงสุด ${config.storage.maxImgSizeMB} MB)`,
        });
      }
    }
    next();
  });
}

/**
 * Middleware สำหรับ handle multer error
 */
function handleBgUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `ไฟล์ใหญ่เกินกำหนด (PDF สูงสุด ${config.storage.maxDocSizeMB} MB, รูปภาพสูงสุด ${config.storage.maxImgSizeMB} MB)`,
      });
    }
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}

module.exports = {
  uploadBackground,
  handleBgUploadError,
};
