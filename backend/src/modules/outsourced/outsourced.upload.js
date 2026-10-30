const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');

const ALLOWED_IMG_MIMES = config.storage.allowedImgMimes;
const ALLOWED_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const HEIC_EXTS = ['.heic', '.heif'];

const outsourcedImgStorage = multer.diskStorage({
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
    // HEIC/HEIF ยอมรับตามนามสกุลไฟล์เสมอ เพราะ OS/browser มักส่ง mimetype มาไม่ตรงมาตรฐาน
    if (HEIC_EXTS.includes(ext) || (ALLOWED_IMG_MIMES.includes(file.mimetype) && ALLOWED_IMG_EXTS.includes(ext))) {
        return cb(null, true);
    }
    cb(new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP, HEIC, HEIF'));
};

/**
 * multer สำหรับรูปภาพของฟิลด์ type: image ในรายงาน — รับได้หลายฟิลด์พร้อมกัน (ชื่อ field = fieldId)
 * ใช้ .any() เพราะชื่อฟิลด์ image เป็น dynamic ตามฟอร์มที่ admin กำหนด
 */
function uploadOutsourcedReportFiles(req, res, cb) {
    const instance = multer({
        storage: outsourcedImgStorage,
        limits: { fileSize: config.storage.maxOutsourcedImgSizeMB * 1024 * 1024 },
        fileFilter: imgFileFilter,
    }).any();
    instance(req, res, cb);
}

function handleOutsourcedMulterError(err, req, res, next) {
    const { sendError } = require('../../utils/response');
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, 400, `ไฟล์มีขนาดใหญ่เกิน ${config.storage.maxOutsourcedImgSizeMB}MB ต่อรูป`);
        }
        return sendError(res, 400, 'อัปโหลดไฟล์ไม่สำเร็จ');
    }
    if (err) return sendError(res, 400, err.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
    next();
}

module.exports = { uploadOutsourcedReportFiles, handleOutsourcedMulterError };
