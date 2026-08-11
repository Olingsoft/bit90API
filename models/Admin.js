'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  super_admin: [
    'view_dashboard', 'view_users', 'manage_users', 'freeze_users', 'view_deposits',
    'view_withdrawals', 'approve_withdrawals', 'reject_withdrawals', 'export_finance_reports',
    'view_kyc', 'approve_kyc', 'reject_kyc', 'request_kyc_resubmission',
    'create_bonuses', 'manage_bonuses', 'view_tickets', 'resolve_tickets',
    'configure_payment_gateways', 'view_server_health', 'view_logs', 'configure_maintenance_mode',
    'manage_admins', 'assign_roles', 'view_admins', 'delete_admins', 'change_system_settings'
  ],
  finance_admin: [
    'view_dashboard', 'view_deposits', 'view_withdrawals', 'approve_withdrawals',
    'reject_withdrawals', 'export_finance_reports'
  ],
  support_admin: [
    'view_dashboard', 'view_users', 'manage_users', 'freeze_users', 'view_tickets', 'resolve_tickets'
  ],
  kyc_admin: [
    'view_dashboard', 'view_kyc', 'approve_kyc', 'reject_kyc', 'request_kyc_resubmission'
  ],
  marketing_admin: [
    'view_dashboard', 'create_bonuses', 'manage_bonuses', 'view_referrals', 'create_promo_codes', 'send_notifications'
  ],
  system_admin: [
    'view_dashboard', 'configure_payment_gateways', 'view_server_health', 'view_logs', 'configure_maintenance_mode'
  ],
  unassigned: []
};

const adminSchema = new mongoose.Schema({
  // Basic Information
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^\+?[0-9]\d{6,14}$/, 'Please provide a valid phone number']
  },

  // Role & Permissions
  role: {
    type: String,
    enum: ['super_admin', 'finance_admin', 'support_admin', 'kyc_admin', 'marketing_admin', 'system_admin', 'unassigned'],
    default: 'support_admin',
    required: true
  },
  permissions: [{
    type: String
  }],

  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },

  // Security
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },

  // Session Management
  sessions: [{
    token: String,
    device: String,
    browser: String,
    ip: String,
    loginAt: Date,
    lastActivity: Date,
    isActive: Boolean
  }],

  // Audit Fields
  lastLogin: {
    type: Date,
    default: null
  },
  lastLoginIP: {
    type: String,
    default: null
  },
  lastLoginDevice: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ username: 1 });
adminSchema.index({ status: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ createdAt: -1 });

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp on save
adminSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate password reset token
adminSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Method to generate 2FA secret
adminSchema.methods.generateTwoFactorSecret = function() {
  this.twoFactorSecret = crypto.randomBytes(20).toString('base32');
  return this.twoFactorSecret;
};

// Method to check if account is locked
adminSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment failed login attempts
adminSchema.methods.incrementFailedLogin = function() {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
  }
  return this.save();
};

// Method to reset failed login attempts
adminSchema.methods.resetFailedLogin = function() {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

// Method to add session
adminSchema.methods.addSession = function(sessionData) {
  this.sessions.push({
    ...sessionData,
    loginAt: Date.now(),
    lastActivity: Date.now(),
    isActive: true
  });
  return this.save();
};

// Method to remove session
adminSchema.methods.removeSession = function(token) {
  this.sessions = this.sessions.filter(session => session.token !== token);
  return this.save();
};

// Method to logout from all devices
adminSchema.methods.logoutAllDevices = function() {
  this.sessions = [];
  return this.save();
};

// Static method to get role permissions
adminSchema.statics.getRolePermissions = function(role) {
  const ROLE_PERMISSIONS = {
    super_admin: ['*'], // Full access
    finance_admin: [
      'view_deposits',
      'view_withdrawals',
      'approve_withdrawals',
      'reject_withdrawals',
      'export_finance_reports',
      'view_dashboard'
    ],
    support_admin: [
      'view_users',
      'freeze_users',
      'chat_customers',
      'resolve_tickets',
      'view_tickets',
      'view_dashboard'
    ],
    kyc_admin: [
      'view_kyc',
      'approve_kyc',
      'reject_kyc',
      'request_kyc_resubmission',
      'view_dashboard'
    ],
    marketing_admin: [
      'create_bonuses',
      'manage_referrals',
      'create_promo_codes',
      'send_notifications',
      'view_dashboard'
    ],
    system_admin: [
      'configure_payment_gateways',
      'view_server_health',
      'view_logs',
      'configure_maintenance_mode',
      'view_dashboard'
    ]
  };
  return rolePermissions[role] || [];
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
