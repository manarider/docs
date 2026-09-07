const fs = require('fs');
const logger = require('./logger');

/**
 * Resize รูปภาพ in-place ด้วย sharp ไม่ให้เกิน 1920×1080 (1080p) ก่อนจัดเก็บถาวร
 */
async function resizeImageFile(filePath, { maxWidth = 1920, maxHeight = 1080, quality = 80 } = {}) {
    try {
        const sharp = require('sharp');
        const resized = await sharp(filePath)
            .rotate()
            .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality, progressive: true })
            .toBuffer();
        fs.writeFileSync(filePath, resized);
        return { size: resized.length, mime_type: 'image/jpeg' };
    } catch (err) {
        logger.warn(`[ImageResize] resizeImageFile error: ${filePath} ${err.message}`);
        return null;
    }
}

module.exports = { resizeImageFile };
