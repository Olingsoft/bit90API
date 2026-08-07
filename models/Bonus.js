'use strict';

const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Bonus name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['welcome', 'deposit', 'cashback', 'referral', 'vip', 'promo_code'],
    required: [true, 'Bonus type is required']
  },
  
  // Bonus Amount
  amount: {
    type: Number,
    required: [true, 'Bonus amount is required'],
    min: [0, 'Bonus amount cannot be negative']
  },
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100']
  },
  
  // Requirements
  minDeposit: {
    type: Number,
    default: 0,
    min: [0, 'Minimum deposit cannot be negative']
  },
  maxBonus: {
    type: Number,
    default: null
  },
  wagerRequirement: {
    type: Number,
    required: [true, 'Wager requirement is required'],
    min: [1, 'Wager requirement must be at least 1x']
  },
  
  // Eligibility
  eligibleUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  eligibleRoles: [{
    type: String
  }],
  isNewUsersOnly: {
    type: Boolean,
    default: false
  },
  
  // Time Limits
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  validityPeriod: {
    type: Number, // in hours
    default: 72
  },
  
  // Promo Code (if applicable)
  promoCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },
  
  // Usage Tracking
  totalIssued: {
    type: Number,
    default: 0
  },
  totalUsed: {
    type: Number,
    default: 0
  },
  maxUses: {
    type: Number,
    default: null
  },
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
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

bonusSchema.index({ type: 1 });
bonusSchema.index({ status: 1 });
bonusSchema.index({ promoCode: 1 });
bonusSchema.index({ expiryDate: 1 });

bonusSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Bonus = mongoose.model('Bonus', bonusSchema);

module.exports = Bonus;
