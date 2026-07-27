const mongoose = require('mongoose');

/**
 * ReportTemplate Model
 * Template สำหรับสร้างรายงาน PDF จากข้อมูลบันทึกต่าง ๆ ของโครงการ
 */

const fieldSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true, trim: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, default: 200 },
    height: { type: Number, default: 20 },
    fontSize: { type: Number, default: 16 },
    fontFamily: { type: String, default: 'THSarabunNew' },
    color: { type: String, default: '#000000' },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
  },
  { _id: false }
);

const pageSchema = new mongoose.Schema(
  {
    pageNo: { type: Number, required: true, min: 1 },
    backgroundFile: { type: String, default: null }, // filename ใน storage
    paperSize: { type: String, enum: ['A4', 'A5', 'Letter', 'Legal'], default: 'A4' },
    orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
    fields: { type: [fieldSchema], default: [] },
  },
  { _id: false }
);

const reportTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    module: {
      type: String,
      enum: ['daily_report', 'procurement', 'acceptance'],
      required: true,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    scope: {
      type: String,
      enum: ['global', 'project'],
      default: 'project',
    },
    pages: {
      type: [pageSchema],
      default: [],
      validate: {
        validator: (v) => v.length > 0,
        message: 'Template ต้องมีอย่างน้อย 1 หน้า',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
    },
    created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

reportTemplateSchema.index({ project_id: 1, module: 1, status: 1 });
reportTemplateSchema.index({ scope: 1, module: 1 });

module.exports = mongoose.model('ReportTemplate', reportTemplateSchema);
