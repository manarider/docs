const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'UPLOAD',
  'DOWNLOAD',
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'SEARCH',
];

const auditLogSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true }, // UMS user ID (string)
    username: { type: String, required: true },
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    module: {
      type: String,
      required: true,
      enum: ['AUTH', 'DOCUMENT', 'DEPARTMENT', 'DOCTYPE', 'ADMIN', 'REPORT'],
    },
    resource_id: { type: String, default: null },
    ip_address: { type: String, required: true },
    user_agent: { type: String },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only — ไม่มี updatedAt
  }
);

// ป้องกัน update/delete (append-only)
auditLogSchema.pre(['updateOne', 'updateMany', 'deleteOne', 'deleteMany'], function () {
  throw new Error('AuditLog is append-only and cannot be modified or deleted');
});

auditLogSchema.index({ user_id: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ resource_id: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
