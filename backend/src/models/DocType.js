const mongoose = require('mongoose');

const docTypeSchema = new mongoose.Schema(
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
    description: { type: String, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    pendingApproval: { type: Boolean, default: false }, // user-requested types รอ admin อนุมัติ
    requestedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DocType', docTypeSchema);
