const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: false,   // null in auto mode (no seed-based hash)
      default: null,
      trim: true,
    },
    serverSeed: {
      type: String,
      default: null,
    },
    crashPoint: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      required: true,
      trim: true,
    },
    phase: {
      type: String,
      required: true,
      trim: true,
    },
    countdown: {
      type: Number,
      default: 0,
    },
    multiplier: {
      type: Number,
      default: 1,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    crashedAt: {
      type: Date,
      default: null,
    },
    revealedAt: {
      type: Date,
      default: null,
    },
    // Populated only for auto-mode rounds — records which band produced
    // the crash point, e.g. "extra_low", "high", "super_extreme".
    crashBand: {
      type: String,
      default: null,
    },
    // Records whether this round ran in "auto" or "manual" mode.
    // Useful for audit queries and analytics.
    crashMode: {
      type: String,
      enum: ['auto', 'manual', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

roundSchema.index({ createdAt: -1 });
roundSchema.index({ status: 1 });

module.exports = mongoose.model('Round', roundSchema);
