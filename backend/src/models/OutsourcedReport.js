const mongoose = require('mongoose');

const reportPhotoSchema = new mongoose.Schema(
    {
        file_path: { type: String, required: true, select: false },
        file_size: { type: Number },
        mime_type: { type: String },
        original_name: { type: String, maxlength: 255 },
        uploaded_at: { type: Date, default: Date.now },
    },
    { _id: true }
);

/**
 * รายงานการปฏิบัติงานที่กรอกจริงตามฟอร์มของกลุ่มงาน
 * values: เก็บค่าฟิลด์ตาม fieldId ของฟอร์ม ({ [fieldId]: string|number }) — ยกเว้นฟิลด์ประเภทรูปภาพเก็บใน photos แยก
 */
const outsourcedReportSchema = new mongoose.Schema(
    {
        group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OutsourcedGroup', required: true },
        form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OutsourcedReportForm', required: true },
        form_version: { type: Number, default: 1 },
        report_date: { type: Date, required: true },
        values: { type: mongoose.Schema.Types.Mixed, default: {} },
        photos: {
            type: Map,
            of: [reportPhotoSchema],
            default: {},
        }, // key = fieldId ของฟิลด์ประเภท image
        submitted_by_user: { type: mongoose.Schema.Types.ObjectId, required: true },
        submitted_by_username: { type: String, default: '' },
    },
    { timestamps: true }
);

outsourcedReportSchema.index({ group_id: 1, report_date: -1 });
outsourcedReportSchema.index({ form_id: 1 });

module.exports = mongoose.model('OutsourcedReport', outsourcedReportSchema);
