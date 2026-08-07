'use strict';

const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true
  },
  
  // Document Types
  documentType: {
    type: String,
    enum: ['national_id', 'passport', 'driving_license'],
    required: [true, 'Document type is required']
  },
  
  // Document Images
  frontImage: {
    type: String,
    required: [true, 'Front image is required']
  },
  backImage: {
    type: String,
    required: false
  },
  selfieImage: {
    type: String,
    required: [true, 'Selfie image is required']
  },
  
  // Document Details
  documentNumber: {
    type: String,
    required: [true, 'Document number is required'],
    trim: true
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  issuingCountry: {
    type: String,
    required: [true, 'Issuing country is required'],
    trim: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resubmission_requested'],
    default: 'pending'
  },
  
  // Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  
  // Audit
  submittedAt: {
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

kycSchema.index({ user: 1 });
kycSchema.index({ status: 1 });
kycSchema.index({ submittedAt: -1 });

kycSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const KYC = mongoose.model('KYC', kycSchema);

module.exports = KYC;
