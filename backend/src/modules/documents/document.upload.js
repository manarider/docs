const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const Department = require('../../models/Department');
const DocType = require('../../models/DocType');
const { getFiscalYear } = require('../../utils/fiscalYear');

/**
 * สร้างโฟลเดอร์เก็บไฟล์:
 * {basePath}/{deptCode}/{fiscalYear(พ.ศ.)}/{docTypeCode}/
 */
async function buildStoragePath(deptId, typeId) {
  const [dept, docType] = await Promise.all([
    Department.findById(deptId).select('code').lean(),
    DocType.findById(typeId).select('code').lean(),
  ]);
  if (!dept) throw new Error('ไม่พบหน่วยงาน');
  if (!docType) throw new Error('ไม่พบประเภทเอกสาร');
  const deptCode = dept.code.toLowerCase();
  const typeCode = docType.code.toLowerCase();
  const fiscalYear = getFiscalYear();
  const dirPath = path.join(config.storage.basePath, deptCode, String(fiscalYear), typeCode);
  fs.mkdirSync(dirPath, { recursive: true });
  return { dirPath, deptCode, typeCode, fiscalYear };
}

/**
 * สร้าง multer storage สำหรับ documents (PDF, Word, Excel, PPT)
 */
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ใช้ tmp folder ก่อน แล้วย้ายหลัง create document succeeded
    const tmpDir = path.join(config.storage.basePath, '_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

/**
 * สร้าง multer storage สำหรับ images (JPG, PNG, WEBP)
 */
const imgStorage = multer.diskStorage({
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

const maxDocBytes = config.storage.maxDocSizeMB * 1024 * 1024;
const maxImgBytes = config.storage.maxImgSizeMB * 1024 * 1024;

/**
 * multer instance สำหรับอัปโหลดเอกสาร (1 ไฟล์ ครั้งละครั้ง)
 */
const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: maxDocBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (config.storage.allowedDocMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'ชนิดไฟล์ไม่รองรับ'));
    }
  },
}).single('file');

/**
 * multer instance สำหรับอัปโหลดรูปภาพ (1 ไฟล์ ครั้งละครั้ง)
 */
const uploadImg = multer({
  storage: imgStorage,
  limits: { fileSize: maxImgBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (config.storage.allowedImgMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'ชนิดไฟล์ไม่รองรับ'));
    }
  },
}).single('image');

/**
 * Multer error handler middleware
 */
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `ไฟล์ใหญ่เกินกำหนด`
        : err.message || 'เกิดข้อผิดพลาดในการอัปโหลด';
    return res.status(400).json({ success: false, message: msg });
  }
  next(err);
}

module.exports = { uploadDoc, uploadImg, handleMulterError, buildStoragePath };
