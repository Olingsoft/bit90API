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
    panelIndex: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

betSchema.index({ userId: 1, roundId: 1, panelIndex: 1 }, { unique: true });
betSchema.index({ userId: 1 });
betSchema.index({ roundId: 1 });
betSchema.index({ status: 1 });
betSchema.index({ createdAt: -1 });

const Bet = mongoose.model('Bet', betSchema);

// Drop legacy single-bet index { userId: 1, roundId: 1 } if it exists in MongoDB
Bet.init()
  .then(() => {
    Bet.collection.dropIndex('userId_1_roundId_1').catch(() => {
      // Legacy index already dropped or not present
    });
  })
  .catch(() => {});

module.exports = Bet;
