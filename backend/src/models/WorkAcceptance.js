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

const workAcceptanceSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    inspection_photos: { type: [projectPhotoSchema], default: [] },
    // เอกสารส่งมอบ — บันทึกเป็น attachment ในเอกสาร PRJ (Document.attachments)
    delivery_doc_sub_id: { type: String, default: null }, // sub_id ของ attachment
    delivery_doc_title: { type: String, default: null },
    notes: { type: String, trim: true, maxlength: 5000, default: '' },
    accepted_by_user: { type: mongoose.Schema.Types.ObjectId, default: null },
    accepted_by_key: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectKey', default: null },
    accepted_role: { type: String, default: 'internal' },
  },
  { timestamps: true }
);

workAcceptanceSchema.index({ project_id: 1, createdAt: -1 });

module.exports = mongoose.model('WorkAcceptance', workAcceptanceSchema);
