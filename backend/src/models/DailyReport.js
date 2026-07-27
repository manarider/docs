const mongoose = require('mongoose');

const projectPhotoSchema = new mongoose.Schema(
  {
    file_path: { type: String, required: true, select: false },
    file_size: { type: Number },
    mime_type: { type: String },
    original_name: { type: String, maxlength: 255 },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const equipmentItemSchema = new mongoose.Schema(
  {
    equipment_type: { type: String, trim: true, maxlength: 200, default: '' },
    equipment_no: { type: String, trim: true, maxlength: 200, default: '' },
    serial_no: { type: String, trim: true, maxlength: 200, default: '' },
    photo: { type: projectPhotoSchema, default: null },
  },
  { _id: true }
);

const dailyReportSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    report_date: { type: Date, required: true },
    morning_description: { type: String, maxlength: 5000, trim: true, default: '' },
    afternoon_description: { type: String, maxlength: 5000, trim: true, default: '' },
    position: { type: String, maxlength: 200, trim: true, default: '' },
    work_description: { type: String, maxlength: 10000, default: '' },
    photos: {
      type: [projectPhotoSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 6,
        message: 'รูปภาพได้สูงสุด 6 รูปต่อรายงาน',
      },
    },
    equipment_items: { type: [equipmentItemSchema], default: [] },
    
    // ข้อมูลสภาพอากาศ อุปสรรค คำสั่งการ และบุคลากร
    weather: { type: String, default: 'ท้องฟ้าแจ่มใส', trim: true },
    obstacles: { type: String, default: '---', trim: true },
    other_instructions: { type: String, default: '---', trim: true },
    engineer_count: { type: Number, default: 0 },
    foreman_count: { type: Number, default: 0 },
    laborer_count: { type: Number, default: 0 },

    submitted_by_user: { type: mongoose.Schema.Types.ObjectId, default: null },
    submitted_by_key: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectKey', default: null },
    submitted_role: { type: String, default: 'internal' },
  },
  { timestamps: true }
);

dailyReportSchema.index({ project_id: 1, report_date: -1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
