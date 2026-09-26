const mongoose = require('mongoose');

/**
 * กลุ่มงานสำหรับบุคคลภายนอก (Outsourced) — สร้างโดย admin/staff เท่านั้น
 */
const outsourcedGroupSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 1000, default: '' },
        isActive: { type: Boolean, default: true },
        created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
        deleted_at: { type: Date, default: null }, // soft delete
    },
    { timestamps: true }
);

outsourcedGroupSchema.index({ isActive: 1, deleted_at: 1 });

module.exports = mongoose.model('OutsourcedGroup', outsourcedGroupSchema);
