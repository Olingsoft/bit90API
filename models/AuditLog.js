'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Admin is required']
  },
  adminName: {
    type: String,
    required: [true, 'Admin name is required']
  },
  adminRole: {
    type: String,
    required: [true, 'Admin role is required']
  },
  
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      'login',
      'logout',
      'create_admin',
      'update_admin',
      'delete_admin',
      'suspend_user',
      'activate_user',
      'freeze_user',
      'reset_user_password',
      'approve_withdrawal',
      'reject_withdrawal',
      'approve_kyc',
      'reject_kyc',
      'request_kyc_resubmission',
      'create_bonus',
      'update_bonus',
      'delete_bonus',
      'update_payment_settings',
      'delete_promotion',
      'resolve_ticket',
      'update_game_config',
      'enable_maintenance_mode',
      'disable_maintenance_mode',
      'export_report',
      'other'
    ]
  },
  actionDetails: {
    type: String,
    default: null
  },
  
  // Target Information
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  targetAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  targetType: {
    type: String,
    enum: ['user', 'admin', 'kyc', 'withdrawal', 'deposit', 'bonus', 'ticket', 'setting', 'other'],
    default: null
  },
  targetId: {
    type: String,
    default: null
  },
  
  // Request Information
  ipAddress: {
    type: String,
    required: [true, 'IP address is required']
  },
  userAgent: {
    type: String,
    default: null
  },
  browser: {
    type: String,
    default: null
  },
  device: {
    type: String,
    default: null
  },
  
  // Additional Data
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Indexes for efficient querying
auditLogSchema.index({ admin: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetUser: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ ipAddress: 1 });

// Ensure audit logs cannot be modified or deleted
auditLogSchema.pre('save', function(next) {
  if (this.isNew) {
    return next();
  }
  const err = new Error('Audit logs cannot be modified');
  return next(err);
});

auditLogSchema.pre('deleteOne', function(next) {
  const err = new Error('Audit logs cannot be deleted');
  return next(err);
});

auditLogSchema.pre('deleteMany', function(next) {
  const err = new Error('Audit logs cannot be deleted');
  return next(err);
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
