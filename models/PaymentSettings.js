'use strict';

const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
  // M-Pesa Settings
  mpesa: {
    enabled: {
      type: Boolean,
      default: true
    },
    shortcode: {
      type: String,
      default: null
    },
    passkey: {
      type: String,
      default: null
    },
    consumerKey: {
      type: String,
      default: null
    },
    consumerSecret: {
      type: String,
      default: null
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox'
    },
    minDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Minimum deposit cannot be negative']
    },
    maxDeposit: {
      type: Number,
      default: 150000,
      min: [0, 'Maximum deposit cannot be negative']
    },
    minWithdrawal: {
      type: Number,
      default: 100,
      min: [0, 'Minimum withdrawal cannot be negative']
    },
    maxWithdrawal: {
      type: Number,
      default: 70000,
      min: [0, 'Maximum withdrawal cannot be negative']
    },
    transactionFee: {
      type: Number,
      default: 0,
      min: [0, 'Transaction fee cannot be negative']
    },
    processingTime: {
      type: Number,
      default: 5 // in minutes
    }
  },
  
  // Airtel Money Settings
  airtel: {
    enabled: {
      type: Boolean,
      default: false
    },
    clientId: {
      type: String,
      default: null
    },
    clientSecret: {
      type: String,
      default: null
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox'
    },
    minDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Minimum deposit cannot be negative']
    },
    maxDeposit: {
      type: Number,
      default: 150000,
      min: [0, 'Maximum deposit cannot be negative']
    },
    minWithdrawal: {
      type: Number,
      default: 100,
      min: [0, 'Minimum withdrawal cannot be negative']
    },
    maxWithdrawal: {
      type: Number,
      default: 70000,
      min: [0, 'Maximum withdrawal cannot be negative']
    },
    transactionFee: {
      type: Number,
      default: 0,
      min: [0, 'Transaction fee cannot be negative']
    },
    processingTime: {
      type: Number,
      default: 5
    }
  },
  
  // Bank Transfer Settings
  bank: {
    enabled: {
      type: Boolean,
      default: false
    },
    bankName: {
      type: String,
      default: null
    },
    accountNumber: {
      type: String,
      default: null
    },
    accountName: {
      type: String,
      default: null
    },
    minDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Minimum deposit cannot be negative']
    },
    maxDeposit: {
      type: Number,
      default: 1000000,
      min: [0, 'Maximum deposit cannot be negative']
    },
    minWithdrawal: {
      type: Number,
      default: 500,
      min: [0, 'Minimum withdrawal cannot be negative']
    },
    maxWithdrawal: {
      type: Number,
      default: 500000,
      min: [0, 'Maximum withdrawal cannot be negative']
    },
    transactionFee: {
      type: Number,
      default: 0,
      min: [0, 'Transaction fee cannot be negative']
    },
    processingTime: {
      type: Number,
      default: 60 // in minutes
    }
  },
  
  // Crypto Settings (Optional)
  crypto: {
    enabled: {
      type: Boolean,
      default: false
    },
    supportedCoins: [{
      type: String,
      enum: ['BTC', 'ETH', 'USDT', 'USDC']
    }],
    walletAddress: {
      type: String,
      default: null
    },
    minDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Minimum deposit cannot be negative']
    },
    maxDeposit: {
      type: Number,
      default: 100000,
      min: [0, 'Maximum deposit cannot be negative']
    },
    minWithdrawal: {
      type: Number,
      default: 0.001,
      min: [0, 'Minimum withdrawal cannot be negative']
    },
    maxWithdrawal: {
      type: Number,
      default: 10,
      min: [0, 'Maximum withdrawal cannot be negative']
    },
    transactionFee: {
      type: Number,
      default: 0,
      min: [0, 'Transaction fee cannot be negative']
    },
    processingTime: {
      type: Number,
      default: 30
    }
  },
  
  // Global Settings
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String,
    default: 'System under maintenance. Please try again later.'
  },
  
  // Audit
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

paymentSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);

module.exports = PaymentSettings;
