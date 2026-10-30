const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * ตรวจสอบว่าไฟล์เป็น HEIC/HEIF จาก magic bytes ของ ISOBMFF container (ftyp box)
 * เพราะ browser/OS มักส่ง mimetype มาไม่ตรง (เช่น application/octet-stream) จึงเชื่อ ext ไม่ได้อย่างเดียว
 */
function isHeicBuffer(buf) {
    if (!buf || buf.length < 12) return false;
    if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
    const brand = buf.toString('ascii', 8, 12);
    return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand);
}

/**
 * Resize รูปภาพ in-place ด้วย sharp ไม่ให้เกิน 1920×1080 (1080p) คุณภาพ 80% ก่อนจัดเก็บถาวร
 * รองรับ HEIC/HEIF (แปลงเป็น JPEG ก่อนด้วย heic-convert เพราะ sharp/libvips มาตรฐานถอดรหัส HEIC ไม่ได้)
 * ทุกไฟล์ output จะถูกแปลงเป็น JPEG เสมอ — ถ้านามสกุลไฟล์เดิมไม่ใช่ .jpg/.jpeg จะ rename ไฟล์ใหม่ให้ตรงกับเนื้อหาจริง
 * @returns {Promise<{size:number, mime_type:string, filePath:string}|null>}
 */
async function resizeImageFile(filePath, { maxWidth = 1920, maxHeight = 1080, quality = 80 } = {}) {
    try {
        const sharp = require('sharp');
        let inputBuffer = fs.readFileSync(filePath);

        const ext = path.extname(filePath).toLowerCase();
        if (['.heic', '.heif'].includes(ext) || isHeicBuffer(inputBuffer)) {
            const convert = require('heic-convert');
            inputBuffer = await convert({ buffer: inputBuffer, format: 'JPEG', quality: 1 });
        }

        const resized = await sharp(inputBuffer)
            .rotate()
            .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality, progressive: true })
            .toBuffer();

        // เนื้อหาไฟล์เป็น JPEG เสมอ — เปลี่ยนนามสกุลให้ตรงถ้าจำเป็น กันสับสนตอนดาวน์โหลด/เปิดไฟล์
        let finalPath = filePath;
        if (!['.jpg', '.jpeg'].includes(ext)) {
            finalPath = filePath.slice(0, -ext.length || filePath.length) + '.jpg';
            fs.unlinkSync(filePath);
        }
        fs.writeFileSync(finalPath, resized);

        return { size: resized.length, mime_type: 'image/jpeg', filePath: finalPath };
    } catch (err) {
        logger.warn(`[ImageResize] resizeImageFile error: ${filePath} ${err.message}`);
        return null;
    }
}

module.exports = { resizeImageFile };
