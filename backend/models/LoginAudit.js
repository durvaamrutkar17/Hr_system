const mongoose = require('mongoose');

// One row per login attempt (success or failure), written from
// controllers/authController.js login(). `user` is null for attempts against
// an email that doesn't exist, so failed-login attempts against unknown
// addresses are still auditable.
const loginAuditSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  success: {
    type: Boolean,
    required: true
  },
  reason: {
    type: String,
    enum: ['success', 'invalid_credentials', 'inactive_account', 'not_found'],
    required: true
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

loginAuditSchema.index({ email: 1, createdAt: -1 });
loginAuditSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('LoginAudit', loginAuditSchema);
