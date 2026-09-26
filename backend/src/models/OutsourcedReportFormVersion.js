const mongoose = require('mongoose');

const outsourcedReportFormVersionSchema = new mongoose.Schema(
    {
        form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OutsourcedReportForm', required: true },
        version: { type: Number, required: true },
        name: { type: String, required: true },
        fields: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    { timestamps: true }
);

outsourcedReportFormVersionSchema.index({ form_id: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('OutsourcedReportFormVersion', outsourcedReportFormVersionSchema);