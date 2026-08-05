'use strict';
/**
 * One-shot script — run once to push the correct config to MongoDB.
 *
 *   node scripts/resetConfig.js
 */

const dotenv = require('dotenv');
dotenv.config();

const { connectMongo } = require('../config/mongodb');
const { GameConfig }   = require('../models/GameConfig');

const NEW_WEIGHTS = {
  extra_low:    54,   // 1.00–1.90  ~36.5%
  low:          32,   // 1.00–2.00
  low_mid:      24,   // 1.00–4.00
  mid:          18,   // 1.00–5.00
  mid_high:     8,    // 1.00–7.00
  high:         5,    // 1.00–15.0
  extra_high:   3,    // 1.00–30.0
  super_high:   2,    // 1.00–50.0
  extreme:      1.2,  // 1.00–90.0
  super_extreme: 0.8, // 1.00–150.0
};

async function main() {
  await connectMongo();

  const result = await GameConfig.findOneAndUpdate(
    { key: 'global' },
    {
      $set: {
        crash_mode:   'auto',   // KEY: enables band_weights
        rtp_param:    0.97,
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
