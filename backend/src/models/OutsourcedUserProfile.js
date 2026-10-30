const mongoose = require('mongoose');

/**
 * ข้อมูลโปรไฟล์เพิ่มเติมของผู้ใช้ role 'outsourced' (เจ้าหน้าที่จ้างเหมาบริการ)
 * ผูกกับ userId จากระบบ UMS — ไม่มี User model ภายในแอปนี้
 * ใช้แสดงผลในรายงาน PDF (ตำแหน่งหน้าที่ / เลขที่บันทึกตกลงจ้าง)
 */
const outsourcedUserProfileSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, // UMS userId
        username: { type: String, trim: true, default: '' },
        position: { type: String, trim: true, maxlength: 200, default: '' }, // ตำแหน่งหน้าที่
        contract_number: { type: String, trim: true, maxlength: 200, default: '' }, // บันทึกตกลงจ้างเลขที่
    },
    { timestamps: true }
);

module.exports = mongoose.model('OutsourcedUserProfile', outsourcedUserProfileSchema);
