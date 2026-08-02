const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
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
  },
  {
    timestamps: true,
  }
);

roundSchema.index({ createdAt: -1 });
roundSchema.index({ status: 1 });

module.exports = mongoose.model('Round', roundSchema);
