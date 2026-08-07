'use strict';

const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
    enum: ['super_admin', 'finance_admin', 'support_admin', 'kyc_admin', 'marketing_admin', 'system_admin']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: [{
    type: String,
    required: true
  }],
  isSystemRole: {
    type: Boolean,
    default: false
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

roleSchema.index({ name: 1 });

roleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
