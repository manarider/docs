const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { resizeImageFile } = require('../../utils/imageResize');

/**
 * Storage แยกเฉพาะของโมดูล Outsourced — ไม่ปะปนกับ storage โครงการเดิม
 */
function getGroupStorageBase(groupId) {
    return path.join(config.storage.basePath, '_outsourced', String(groupId));
}

function isSafeOutsourcedPath(filePath) {
    if (!filePath) return false;
    const base = path.join(config.storage.basePath, '_outsourced');
    return path.resolve(filePath).startsWith(path.resolve(base));
}

/**
 * ย้ายไฟล์จาก tmp ไปยังโฟลเดอร์กลุ่มงาน แยกตาม fieldId
 * @returns {Object} map ของ fieldId -> array photo metadata
 */
function moveFilesByField(files, groupId) {
    const grouped = {};
    if (!files || files.length === 0) return grouped;
    const base = getGroupStorageBase(groupId);

    for (const file of files) {
        const fieldId = file.fieldname;
        const dirPath = path.join(base, fieldId);
        fs.mkdirSync(dirPath, { recursive: true });
        const dest = path.join(dirPath, file.filename);
        fs.renameSync(file.path, dest);
        const meta = {
            file_path: dest,
            file_size: file.size,
            mime_type: file.mimetype,
            original_name: file.originalname,
        };
        if (!grouped[fieldId]) grouped[fieldId] = [];
        grouped[fieldId].push(meta);
    }
    return grouped;
}

function cleanupTmpFiles(files) {
    if (!files) return;
    const allFiles = Array.isArray(files) ? files : Object.values(files).flat();
    allFiles.forEach((f) => {
        try { fs.unlinkSync(f.path); } catch { /* ignore */ }
    });
}

async function resizePhotoMetas(photosByField) {
    for (const metas of Object.values(photosByField)) {
        for (const meta of metas) {
            const result = await resizeImageFile(meta.file_path);
            if (result) {
                meta.file_size = result.size;
                meta.mime_type = result.mime_type;
            }
        }
    }
    return photosByField;
}

module.exports = {
    getGroupStorageBase,
    isSafeOutsourcedPath,
    moveFilesByField,
    cleanupTmpFiles,
    resizePhotoMetas,
};
