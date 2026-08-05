'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BAND DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const BANDS = [
  { name: 'extra_low',     floor: 1.00, ceiling: 1.90 },
  { name: 'low',           floor: 1.00, ceiling: 2.00 },
  { name: 'low_mid',       floor: 1.00, ceiling: 4.00 },
  { name: 'mid',           floor: 1.00, ceiling: 5.00 },
  { name: 'mid_high',      floor: 1.00, ceiling: 7.00 },
  { name: 'high',          floor: 1.00, ceiling: 15.00 },
  { name: 'extra_high',    floor: 1.00, ceiling: 30.00 },
  { name: 'super_high',    floor: 1.00, ceiling: 50.00 },
  { name: 'extreme',       floor: 1.00, ceiling: 90.00 },
  { name: 'super_extreme', floor: 1.00, ceiling: 150.00 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Select a band using weights
// ─────────────────────────────────────────────────────────────────────────────
function selectBand(band_weights) {
  const weights = BANDS.map(
    b => Math.max(0, Number(band_weights[b.name]) || 0)
  );

  const total = weights.reduce((a, b) => a + b, 0);

  if (total <= 0) {
    throw new Error('At least one band must have a positive weight.');
  }

  const draw = Math.random() * total;

  let cumulative = 0;

  for (let i = 0; i < BANDS.length; i++) {
    cumulative += weights[i];

    if (draw < cumulative) {
      return BANDS[i];
    }
  }

  return BANDS[BANDS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate a multiplier inside a band.
//
// Higher skew values = more results close to the floor.
//
// Examples:
//
// skew = 1     uniform
// skew = 2     slight bias
// skew = 3     Aviator-like
// skew = 4     strong bias
// skew = 5     very strong bias
// ─────────────────────────────────────────────────────────────────────────────
function sampleIntraBand(band, skew = 3) {
  const { floor, ceiling } = band;

  const r = Math.pow(Math.random(), skew);

  return floor + r * (ceiling - floor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
function generate_crash_point(
  band_weights,
  rtp_param = 0.97 // kept only for compatibility
) {
  if (!band_weights || typeof band_weights !== 'object') {
    throw new TypeError('band_weights must be an object.');
  }

  const band = selectBand(band_weights);

  // Adjust this number if you want
  const SKEW = 3;

  const raw = sampleIntraBand(band, SKEW);

  return {
    value: Number(raw.toFixed(2)),
    band: band.name,
  };
}

module.exports = {
  generate_crash_point,
  BANDS,
};