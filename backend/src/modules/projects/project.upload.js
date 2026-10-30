const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { resizeImageFile } = require('../../utils/imageResize');

const ALLOWED_IMG_MIMES = config.storage.allowedImgMimes;
const ALLOWED_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const HEIC_EXTS = ['.heic', '.heif'];

/**
 * multer diskStorage — บันทึกลง tmp ก่อนเสมอ
 */
const projectImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(config.storage.basePath, '_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imgFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (HEIC_EXTS.includes(ext) || (ALLOWED_IMG_MIMES.includes(file.mimetype) && ALLOWED_IMG_EXTS.includes(ext))) {
    return cb(null, true);
  }
  cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP, HEIC, HEIF'));
};

/**
 * สร้าง multer instance สำหรับ daily report
 * fields: photos (max 4), equip_photos (max 20)
 */
function uploadDailyReportFiles(req, res, cb) {
  const instance = multer({
    storage: projectImgStorage,
    limits: { fileSize: config.storage.maxImgSizeMB * 1024 * 1024 },
    fileFilter: imgFileFilter,
  }).fields([
    { name: 'photos', maxCount: 6 },
    { name: 'equip_photos', maxCount: 20 },
  ]);
  instance(req, res, cb);
}

/**
 * สร้าง multer instance สำหรับ procurement receive
 * fields: receive_photos (ไม่จำกัด), inspection_photos (ไม่จำกัด)
 */
function uploadProcurementPhotos(req, res, cb) {
  const instance = multer({
    storage: projectImgStorage,
    limits: { fileSize: config.storage.maxImgSizeMB * 1024 * 1024 },
    fileFilter: imgFileFilter,
  }).fields([
    { name: 'receive_photos', maxCount: 30 },
    { name: 'inspection_photos', maxCount: 30 },
  ]);
  instance(req, res, cb);
}

const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_DOC_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

// เอกสารส่งมอบงาน (delivery_doc) มักเป็นไฟล์สแกนหลายหน้า จึงกำหนดขีดจำกัดแยกจาก maxDocSizeMB ทั่วไป
const DELIVERY_DOC_MAX_MB = 100;

/**
 * สร้าง multer instance สำหรับ acceptance
 * fields: inspection_photos (รูปภาพ, จำกัดแยกที่ maxImgSizeMB), delivery_doc (PDF/Word 1 ไฟล์, จำกัดแยกที่ DELIVERY_DOC_MAX_MB)
 */
function uploadAcceptancePhotos(req, res, cb) {
  // multer รองรับ limit เดียวสำหรับทั้ง instance จึงต้องใช้ค่าสูงสุดก่อน แล้วตรวจสอบแยกตามชนิดไฟล์ทีหลัง
  const instance = multer({
    storage: projectImgStorage,
    limits: { fileSize: Math.max(config.storage.maxImgSizeMB, DELIVERY_DOC_MAX_MB) * 1024 * 1024 },
    fileFilter: (req, file, next) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.fieldname === 'delivery_doc') {
        if (ALLOWED_DOC_MIMES.includes(file.mimetype) && ALLOWED_DOC_EXTS.includes(ext)) {
          return next(null, true);
        }
        return next(new Error('delivery_doc รองรับเฉพาะ PDF, Word, Excel'));
      }
      // inspection_photos → image only (HEIC/HEIF ยอมรับตามนามสกุลไฟล์เสมอ)
      if (HEIC_EXTS.includes(ext) || (ALLOWED_IMG_MIMES.includes(file.mimetype) && ALLOWED_IMG_EXTS.includes(ext))) {
        return next(null, true);
      }
      next(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP, HEIC, HEIF'));
    },
  }).fields([
    { name: 'inspection_photos', maxCount: 50 },
    { name: 'delivery_doc', maxCount: 1 },
  ]);
  instance(req, res, (err) => {
    if (err) return cb(err);
    // ตรวจสอบขนาดแยกตามชนิดไฟล์ (รูปภาพ ≤ maxImgSizeMB, delivery_doc ≤ DELIVERY_DOC_MAX_MB)
    const files = req.files || {};
    const imgLimitBytes = config.storage.maxImgSizeMB * 1024 * 1024;
    const docLimitBytes = DELIVERY_DOC_MAX_MB * 1024 * 1024;
    const oversizedImg = (files.inspection_photos || []).find((f) => f.size > imgLimitBytes);
    const oversizedDoc = (files.delivery_doc || []).find((f) => f.size > docLimitBytes);
    if (oversizedImg || oversizedDoc) {
      cleanupTmpFiles(files);
      const msg = oversizedDoc
        ? `delivery_doc ใหญ่เกินกำหนด (สูงสุด ${DELIVERY_DOC_MAX_MB} MB)`
        : `รูปภาพใหญ่เกินกำหนด (สูงสุด ${config.storage.maxImgSizeMB} MB ต่อรูป)`;
      return cb(new multer.MulterError('LIMIT_FILE_SIZE', msg));
    }
    cb();
  });
}

/**
 * Error handler สำหรับ multer
 */
function handleProjectMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      // err.field เก็บข้อความ custom จากการตรวจสอบขนาดแยกชนิดไฟล์ (ถ้ามี)
      return res.status(413).json({
        success: false,
        message: err.field || `ไฟล์ใหญ่เกินกำหนด (สูงสุด ${config.storage.maxImgSizeMB} MB)`,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'จำนวนไฟล์เกินกำหนด' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) return res.status(400).json({ success: false, message: err.message });
  next();
}

/**
 * ย้ายไฟล์หลายไฟล์จาก tmp ไปยัง projectFolder
 * @param {Express.Multer.File[]} files
 * @param {string} projectStorageBase - path โฟลเดอร์โครงการ
 * @param {string} subFolder - เช่น 'reports', 'procurement', 'acceptance'
 * @returns {Array} array of photo metadata (ไม่มี file_path — เก็บแยกใน DB field select:false)
 */
function moveFilesToProjectFolder(files, projectStorageBase, subFolder) {
  if (!files || files.length === 0) return [];
  const dirPath = path.join(projectStorageBase, subFolder);
  fs.mkdirSync(dirPath, { recursive: true });

  return files.map((file) => {
    const dest = path.join(dirPath, file.filename);
    fs.renameSync(file.path, dest);
    return {
      file_path: dest,
      file_size: file.size,
      mime_type: file.mimetype,
      original_name: file.originalname,
    };
  });
}

/**
 * ย้ายไฟล์เดียวจาก tmp ไปยัง projectFolder
 */
function moveSingleFile(file, projectStorageBase, subFolder) {
  if (!file) return null;
  const dirPath = path.join(projectStorageBase, subFolder);
  fs.mkdirSync(dirPath, { recursive: true });
  const dest = path.join(dirPath, file.filename);
  fs.renameSync(file.path, dest);
  return {
    file_path: dest,
    file_size: file.size,
    mime_type: file.mimetype,
    original_name: file.originalname,
  };
}

/**
 * ลบไฟล์ tmp ที่ค้างอยู่ (กรณีเกิด error ระหว่าง upload)
 */
function cleanupTmpFiles(files) {
  if (!files) return;
  const allFiles = Array.isArray(files)
    ? files
    : Object.values(files).flat();
  allFiles.forEach((f) => {
    try { fs.unlinkSync(f.path); } catch { /* ignore */ }
  });
}

/**
 * Resize ภาพทุกไฟล์ใน array photo metadata (แก้ไข in-place)
 */
async function resizeProjectPhotos(photoMetas) {
  if (!photoMetas || photoMetas.length === 0) return photoMetas;
  for (const meta of photoMetas) {
    if (!meta?.file_path) continue;
    const result = await resizeImageFile(meta.file_path);
    if (result) {
      meta.file_path = result.filePath;
      meta.file_size = result.size;
      meta.mime_type = result.mime_type;
    }
  }
  return photoMetas;
}

module.exports = {
  uploadDailyReportFiles,
  uploadProcurementPhotos,
  uploadAcceptancePhotos,
  handleProjectMulterError,
  moveFilesToProjectFolder,
  moveSingleFile,
  cleanupTmpFiles,
  resizeProjectPhotos,
};
