const mongoose = require('mongoose');

const projectKeySchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    role: {
      type: String,
      enum: ['contractor', 'supervisor', 'project_manager'],
      required: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    key_hash: { type: String, required: true, select: false }, // sha256 ของ token
    key_prefix: { type: String, required: true }, // 8 ตัวแรก เพื่อแสดงใน UI
    expires_at: { type: Date, required: true },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
    last_used_at: { type: Date, default: null },
  },
  { timestamps: true }
);

projectKeySchema.index({ project_id: 1 });
projectKeySchema.index({ project_id: 1, is_active: 1 });
projectKeySchema.index({ key_hash: 1, is_active: 1 }); // สำหรับ lookup ตอน login

module.exports = mongoose.model('ProjectKey', projectKeySchema);
