const mongoose = require('mongoose');
const { getFiscalYear } = require('../utils/fiscalYear');

const attachmentSchema = new mongoose.Schema(
  {
    sub_id: { type: String, required: true }, // uuid
    sub_title: { type: String, required: true, maxlength: 500 },
    file_path: { type: String, required: true, select: false },
    file_size: { type: Number, required: true }, // bytes
    mime_type: { type: String, required: true },
    original_name: { type: String, required: true, maxlength: 500 },
    checksum: { type: String, required: true, select: false }, // SHA-256
    uploaded_at: { type: Date, default: Date.now },
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, required: true },
    deleted_at: { type: Date, default: null },
    deleted_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    file_path: { type: String, required: true, select: false },
    file_size: { type: Number, required: true }, // bytes
    mime_type: { type: String, required: true },
    original_name: { type: String, required: true, maxlength: 255 },
    uploaded_at: { type: Date, default: Date.now },
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 1000 },
    description: { type: String, maxlength: 2000 },
    dept_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocType',
      required: true,
    },
    fiscal_year: { type: Number }, // พ.ศ. คำนวณอัตโนมัติ
    tags: [{ type: String, maxlength: 100 }],
    is_public: { type: Boolean, default: false },
    public_expires_at: { type: Date, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    images: { type: [imageSchema], default: [] },
    views: { type: Number, default: 0 },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    starred_by: [{ type: mongoose.Schema.Types.ObjectId }], // userId ที่ติดดาว
    deleted_at: { type: Date, default: null },
    deleted_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// คำนวณ fiscal_year อัตโนมัติก่อนบันทึก
documentSchema.pre('save', function (next) {
  if (!this.fiscal_year) {
    this.fiscal_year = getFiscalYear(this.createdAt || new Date());
  }
  next();
});

documentSchema.index({ dept_id: 1, fiscal_year: -1 });
documentSchema.index({ type_id: 1 });
documentSchema.index({ created_by: 1 });
documentSchema.index({ deleted_at: 1 });
documentSchema.index({ title: 'text', description: 'text', tags: 'text' });
documentSchema.index({ starred_by: 1 });

module.exports = mongoose.model('Document', documentSchema);
