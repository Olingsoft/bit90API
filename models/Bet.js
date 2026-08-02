const mongoose = require('mongoose');

const betSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Round',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    payout: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: 'placed',
      trim: true,
    },
    cashOutMultiplier: {
      type: Number,
      default: null,
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
    cashedOutAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

betSchema.index({ userId: 1, roundId: 1 }, { unique: true });
betSchema.index({ userId: 1 });
betSchema.index({ roundId: 1 });
betSchema.index({ status: 1 });
betSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Bet', betSchema);
