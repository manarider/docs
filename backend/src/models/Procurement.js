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

const issuanceSchema = new mongoose.Schema(
  {
    issued_date: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 1 },
    purpose: { type: String, trim: true, maxlength: 500, default: '' },
    issued_by_user: { type: mongoose.Schema.Types.ObjectId, default: null },
    issued_by_key: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectKey', default: null },
    issued_role: { type: String, default: 'internal' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const procurementSchema = new mongoose.Schema(
  {
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    receive_date: { type: Date, required: true },
    item_type: { type: String, enum: ['equipment', 'material', 'other'], required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    quantity: { type: Number, required: true, min: 1 },
    equipment_no: { type: String, trim: true, maxlength: 200, default: '' },
    equipment_serial_list: {
      type: [{
        serial_no: { type: String, trim: true, maxlength: 200, default: '' },
        equipment_no: { type: String, trim: true, maxlength: 200, default: '' },
      }],
      default: [],
    },
    receive_photos: { type: [projectPhotoSchema], default: [] },
    inspection_photos: { type: [projectPhotoSchema], default: [] },
    issued_items: { type: [issuanceSchema], default: [] },
    created_by_user: { type: mongoose.Schema.Types.ObjectId, default: null },
    created_by_key: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectKey', default: null },
    created_role: { type: String, default: 'internal' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: จำนวนที่เหลือ
procurementSchema.virtual('remaining_quantity').get(function () {
  const issued = this.issued_items.reduce((sum, i) => sum + i.quantity, 0);
  return this.quantity - issued;
});

procurementSchema.index({ project_id: 1, receive_date: -1 });

module.exports = mongoose.model('Procurement', procurementSchema);
