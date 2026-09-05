const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'rejected', 'on_hold', 'failed'],
      default: 'completed',
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    reference: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    checkoutRequestId: {
      type: String,
      default: null,
    },
    merchantRequestId: {
      type: String,
      default: null,
    },
    mpesaReceiptNumber: {
      type: String,
      default: null,
    },
    resultCode: {
      type: Number,
      default: null,
    },
    resultDesc: {
      type: String,
      default: null,
    },
    transactionDate: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    credited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

transactionSchema.index({ userId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index(
  { checkoutRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutRequestId: { $type: 'string' } },
  }
);
transactionSchema.index(
  { mpesaReceiptNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { mpesaReceiptNumber: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);

