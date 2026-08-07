'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Recipient is required']
  },
  
  type: {
    type: String,
    enum: [
      'large_deposit',
      'large_withdrawal',
      'failed_payment',
      'suspicious_login',
      'fraud_detection',
      'kyc_submission',
      'support_ticket',
      'server_down',
      'maintenance_mode',
      'system_alert',
      'other'
    ],
    required: [true, 'Notification type is required']
  },
  
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Related Data
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  relatedId: {
    type: String,
    default: null
  },
  relatedType: {
    type: String,
    default: null
  },
  
  // Additional Data
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Status
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  
  // Actions
  actionRequired: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String,
    default: null
  },
  
  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
