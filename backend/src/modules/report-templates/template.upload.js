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
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('อัปโหลดได้เฉพาะ PDF, PNG, JPG'), false);
    }
    cb(null, true);
  },
});

/**
 * Middleware สำหรับ handle multer error
 */
function handleBgUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'ไฟล์ใหญ่เกิน 10 MB' });
    }
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}

module.exports = {
  uploadBackground: bgUpload.single('background'),
  handleBgUploadError,
};
