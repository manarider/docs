const mongoose = require('mongoose');

/**
 * รายชื่อคณะกรรมการตรวจรับงานของแต่ละกลุ่มงาน Outsourced — จัดการได้เฉพาะ admin
 * ใช้แสดงผล/อ้างอิงในรายงานการส่งมอบงาน (PDF)
 */
const outsourcedCommitteeMemberSchema = new mongoose.Schema(
    {
        group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OutsourcedGroup', required: true },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        order: { type: Number, default: 0 },
        created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
    },
    { timestamps: true }
);

outsourcedCommitteeMemberSchema.index({ group_id: 1, order: 1, createdAt: 1 });

module.exports = mongoose.model('OutsourcedCommitteeMember', outsourcedCommitteeMemberSchema);
