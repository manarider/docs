const mongoose = require('mongoose');

/**
 * Meeting — คิวการแสดงผลเอกสารประชุม (MeetingDocs Tab 2)
 * กำหนดว่าเอกสารประชุมชุดใดจะแสดงบนหน้าจอสาธารณะ (/docs/meet) ในช่วงเวลาใด
 */
const meetingSchema = new mongoose.Schema(
  {
    // หัวข้อ/รายละเอียดการประชุม — ใช้เป็นข้อความแสดงผลหลัก ถ้าไม่ระบุจะดึงจากชื่อเอกสารแทน
    description: { type: String, maxlength: 500, trim: true, default: '' },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
      },
    ],
    starts_at: { type: Date, required: true },
    ends_at: { type: Date, required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

meetingSchema.index({ starts_at: 1 });
meetingSchema.index({ ends_at: 1 });
meetingSchema.index({ deleted_at: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
