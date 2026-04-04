const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId },
    deletedAt: { type: Date, default: null }, // soft delete
  },
  { timestamps: true }
);

// ห้ามลบถ้ายังมีเอกสารอ้างถึง — จัดการใน controller
departmentSchema.index({ isActive: 1 });

module.exports = mongoose.model('Department', departmentSchema);
