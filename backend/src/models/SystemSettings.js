const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, maxlength: 500 },
    updatedBy: { type: String }, // UMS username
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
