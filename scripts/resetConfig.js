'use strict';
/**
 * One-shot script — run once to push the correct config to MongoDB.
 *
 *   node scripts/resetConfig.js
 */

const dotenv = require('dotenv');
dotenv.config();

const { connectMongo } = require('../config/mongodb');
const { GameConfig } = require('../models/GameConfig');

// Total weight ≈ 125  →  approximate frequencies:
//   extra_low  28/125 = 22%
//   low        28/125 = 22%
//   low_mid    26/125 = 21%
//   mid        20/125 = 16%
//   mid_high   10/125 =  8%
//   high+       ~11%  split across remaining bands
const NEW_WEIGHTS = {
  extra_low: 28,   // 1.00–1.90  ~22%
  low: 28,   // 1.00–2.00  ~22%
  low_mid: 26,   // 1.00–4.00  ~21%
  mid: 20,   // 1.00–5.00  ~16%
  mid_high: 10,   // 1.00–7.00   ~8%
  high: 6,    // 1.00–15.0   ~5%
  extra_high: 3,    // 1.00–30.0  ~2.4%
  super_high: 2,    // 1.00–50.0  ~1.6%
  extreme: 1.2,  // 1.00–90.0   ~1%
  super_extreme: 0.8, // 1.00–150.0 ~0.6%
};

async function main() {
  await connectMongo();

  const result = await GameConfig.findOneAndUpdate(
    { key: 'global' },
    {
      $set: {
        crash_mode: 'auto',   // KEY: enables band_weights
        rtp_param: 0.97,
        band_weights: NEW_WEIGHTS,
      },
    },
    { upsert: true, new: true }
  );

  console.log('Config updated:');
  console.log('  crash_mode :', result.crash_mode);
  console.log('  band_weights:', JSON.stringify(result.band_weights, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
