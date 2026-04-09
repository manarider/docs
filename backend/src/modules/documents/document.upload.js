const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const Department = require('../../models/Department');
const DocType = require('../../models/DocType');
const { getFiscalYear } = require('../../utils/fiscalYear');

/**
 * In-memory file size limits — อัปเดตได้โดยไม่ต้อง restart server
 * ค่าเริ่มต้นมาจาก ENV/config, จะถูก override จาก DB ตอน startup
 */
const fileLimits = {
  docMB: config.storage.maxDocSizeMB,
  imgMB: config.storage.maxImgSizeMB,
};

/**
 * อัปเดต file size limits (เรียกจาก admin.controller เมื่อบันทึก settings)
 */
function updateFileSizeLimits({ docMB, imgMB } = {}) {
  if (docMB != null && !isNaN(docMB)) fileLimits.docMB = Number(docMB);
  if (imgMB != null && !isNaN(imgMB)) fileLimits.imgMB = Number(imgMB);
}

/**
 * โหลดค่าจาก DB ตอน startup (เรียกจาก app.js หลัง connectDB)
 */
async function initFileSizeLimitsFromDb() {
  try {
    const SystemSettings = require('../../models/SystemSettings');
    const settings = await SystemSettings.find({
      key: { $in: ['max_doc_size_mb', 'max_img_size_mb'] },
    }).lean();
    settings.forEach((s) => {
      if (s.key === 'max_doc_size_mb') fileLimits.docMB = Number(s.value);
      if (s.key === 'max_img_size_mb') fileLimits.imgMB = Number(s.value);
    });
  } catch (_e) {
    // ถ้าโหลดไม่ได้ ใช้ค่า ENV ต่อไป
  }
}

/**
 * สร้างโฟลเดอร์เก็บไฟล์:
 * - ประเภท DOW → {downloadPath}/{deptCode}/{fiscalYear}/
 * - ประเภทอื่น  → {basePath}/{deptCode}/{fiscalYear}/{docTypeCode}/
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

  // ประเภท DOW → เก็บในโฟลเดอร์ download แยกต่างหาก (ไม่ให้ผู้อื่น access โดยตรง)
  if (docType.code.toUpperCase() === 'DOW') {
    const dirPath = path.join(config.storage.downloadPath, deptCode, String(fiscalYear));
    fs.mkdirSync(dirPath, { recursive: true });
    return { dirPath, deptCode, typeCode, fiscalYear };
  }

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

const ALLOWED_DOC_EXTENSIONS = ['.pdf'];
const ALLOWED_DOW_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const ALLOWED_IMG_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const maxDocBytes = config.storage.maxDocSizeMB * 1024 * 1024;
const maxImgBytes = config.storage.maxImgSizeMB * 1024 * 1024;

/**
 * multer instance สำหรับอัปโหลดเอกสาร (1 ไฟล์ ครั้งละครั้ง)
 * สร้าง multer ใหม่ทุกครั้งที่เรียก เพื่อใช้ fileLimits ปัจจุบัน
 * ถ้าเอกสารเป็นประเภท DOW จะรองรับ PDF + Word + Excel ด้วย
 */
function uploadDoc(req, res, cb) {
  const instance = multer({
    storage: docStorage,
    limits: { fileSize: fileLimits.docMB * 1024 * 1024, files: 1 },
    fileFilter: async (req, file, next) => {
      const ext = path.extname(file.originalname).toLowerCase();
      try {
        // ตรวจว่าเอกสารนี้เป็นประเภท DOW หรือไม่ (lookup จาก :id)
        if (req.params.id) {
          const Document = require('../../models/Document');
          const DocType = require('../../models/DocType');
          const doc = await Document.findById(req.params.id).select('type_id').lean();
          if (doc) {
            const docType = await DocType.findById(doc.type_id).select('code').lean();
            if (docType?.code?.toUpperCase() === 'DOW') {
              if (
                config.storage.allowedDowMimes.includes(file.mimetype) &&
                ALLOWED_DOW_EXTENSIONS.includes(ext)
              ) {
                return next(null, true);
              }
              return next(
                new multer.MulterError(
                  'LIMIT_UNEXPECTED_FILE',
                  'ชนิดไฟล์ไม่รองรับ สำหรับ DOW รองรับ PDF, Word (.doc/.docx), Excel (.xls/.xlsx) เท่านั้น'
                )
              );
            }
          }
        }
      } catch (_e) {
        // ถ้า lookup ไม่สำเร็จ fallback ไป PDF-only
      }
      // Default: PDF เท่านั้น
      if (
        config.storage.allowedDocMimes.includes(file.mimetype) &&
        ALLOWED_DOC_EXTENSIONS.includes(ext)
      ) {
        next(null, true);
      } else {
        next(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'ชนิดไฟล์ไม่รองรับ (PDF เท่านั้น)'));
      }
    },
  }).single('file');
  return instance(req, res, cb);
}

/**
 * multer instance สำหรับอัปโหลดรูปภาพ (1 ไฟล์ ครั้งละครั้ง)
 * สร้าง multer ใหม่ทุกครั้งที่เรียก เพื่อใช้ fileLimits ปัจจุบัน
 */
function uploadImg(req, res, cb) {
  const instance = multer({
    storage: imgStorage,
    limits: { fileSize: fileLimits.imgMB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, next) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (
        config.storage.allowedImgMimes.includes(file.mimetype) &&
        ALLOWED_IMG_EXTENSIONS.includes(ext)
      ) {
        next(null, true);
      } else {
        next(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'ชนิดไฟล์ไม่รองรับ (JPG, PNG, WEBP เท่านั้น)'));
      }
    },
  }).single('image');
  return instance(req, res, cb);
}

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

module.exports = { uploadDoc, uploadImg, handleMulterError, buildStoragePath, updateFileSizeLimits, initFileSizeLimitsFromDb };
