const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const logger = require('../../utils/logger');

// ขีดจำกัดขนาดไฟล์รูปภาพโครงการ (อนุญาตไฟล์ใหญ่ เพราะ backend จะ resize)
const PROJECT_IMG_MAX_MB = 20;

const ALLOWED_IMG_MIMES = config.storage.allowedImgMimes;
const ALLOWED_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

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
  if (ALLOWED_IMG_MIMES.includes(file.mimetype) && ALLOWED_IMG_EXTS.includes(ext)) {
    return cb(null, true);
  }
  cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP'));
};

/**
 * สร้าง multer instance สำหรับ daily report
 * fields: photos (max 4), equip_photos (max 20)
 */
function uploadDailyReportFiles(req, res, cb) {
  const instance = multer({
    storage: projectImgStorage,
    limits: { fileSize: PROJECT_IMG_MAX_MB * 1024 * 1024 },
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
    limits: { fileSize: PROJECT_IMG_MAX_MB * 1024 * 1024 },
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

/**
 * สร้าง multer instance สำหรับ acceptance
 * fields: inspection_photos (ไม่จำกัด), delivery_doc (PDF/Word 1 ไฟล์)
 */
function uploadAcceptancePhotos(req, res, cb) {
  const instance = multer({
    storage: projectImgStorage,
    limits: { fileSize: Math.max(PROJECT_IMG_MAX_MB, config.storage.maxDocSizeMB) * 1024 * 1024 },
    fileFilter: (req, file, next) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.fieldname === 'delivery_doc') {
        if (ALLOWED_DOC_MIMES.includes(file.mimetype) && ALLOWED_DOC_EXTS.includes(ext)) {
          return next(null, true);
        }
        return next(new Error('delivery_doc รองรับเฉพาะ PDF, Word, Excel'));
      }
      // inspection_photos → image only
      if (ALLOWED_IMG_MIMES.includes(file.mimetype) && ALLOWED_IMG_EXTS.includes(ext)) {
        return next(null, true);
      }
      next(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP'));
    },
  }).fields([
    { name: 'inspection_photos', maxCount: 50 },
    { name: 'delivery_doc', maxCount: 1 },
  ]);
  instance(req, res, cb);
}

/**
 * Error handler สำหรับ multer
 */
function handleProjectMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: `ไฟล์ใหญ่เกินกำหนด (สูงสุด ${config.storage.maxImgSizeMB} MB)`,
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
 * Resize รูปภาพไฟล์เดียว in-place ด้วย sharp
 * Max: 1280×720 (HD), JPEG quality 80 → ~< 500 KB
 */
async function resizeImageFile(filePath) {
  try {
    const sharp = require('sharp');
    const resized = await sharp(filePath)
      .rotate()
      .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
    fs.writeFileSync(filePath, resized);
    return { size: resized.length, mime_type: 'image/jpeg' };
  } catch (err) {
    logger.warn('[Upload] resizeImageFile error:', filePath, err.message);
    return null;
  }
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
