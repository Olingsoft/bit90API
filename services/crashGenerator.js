'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BAND DEFINITIONS
// Each band has a floor (always 1.00) and a ceiling (the upper bound).
// Names must match the keys used in the band_weights config object.
// ─────────────────────────────────────────────────────────────────────────────
const BANDS = [
  { name: 'extra_low',    floor: 1.00, ceiling:  1.90 },
  { name: 'low',          floor: 1.00, ceiling:  2.00 },
  { name: 'low_mid',      floor: 1.00, ceiling:  4.00 },
  { name: 'mid',          floor: 1.00, ceiling:  5.00 },
  { name: 'mid_high',     floor: 1.00, ceiling:  7.00 },
  { name: 'high',         floor: 1.00, ceiling: 15.00 },
  { name: 'extra_high',   floor: 1.00, ceiling: 30.00 },
  { name: 'super_high',   floor: 1.00, ceiling: 50.00 },
  { name: 'extreme',      floor: 1.00, ceiling: 90.00 },
  { name: 'super_extreme',floor: 1.00, ceiling:150.00 },
];

// ─────────────────────────────────────────────────────────────────────────────
// selectBand(band_weights)
//
// Weighted random selection over BANDS.
// band_weights is an object like { extra_low: 60, low: 30, ... }.
// Any band whose name is missing from band_weights gets weight 0 (never chosen).
//
// Implementation: build a cumulative distribution, draw uniform [0,1),
// return the first band whose CDF slot covers the draw.
// ─────────────────────────────────────────────────────────────────────────────
function selectBand(band_weights) {
  const weights = BANDS.map((b) => Math.max(0, Number(band_weights[b.name]) || 0));
  const total   = weights.reduce((s, w) => s + w, 0);

  if (total <= 0) {
    throw new Error('crashGenerator: all band weights are zero — at least one must be positive');
  }

  const draw = Math.random() * total;
  let cumulative = 0;

  for (let i = 0; i < BANDS.length; i++) {
    cumulative += weights[i];
    if (draw < cumulative) {
      return BANDS[i];
    }
  }

  // Fallback (floating-point edge case where draw === total exactly)
  return BANDS[BANDS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// sampleIntraBand(band, rtp_param)
//
// Generate a crash value within [band.floor, band.ceiling] using an
// exponential inverse-transform so results cluster near the floor.
//
// Distribution derivation:
//   Let X = floor + Exp(λ) where λ = -ln(rtp_param) / (ceiling - floor).
//   E[X] ≈ floor + 1/λ  when ceiling is large relative to 1/λ.
//   Setting λ this way means the long-run expected value tracks 1/rtp_param.
//
//   Inverse-transform: draw u ~ Uniform(0,1)
//     x = floor - (1/λ) * ln(1 - u)
//   Clamp to [floor, ceiling] to keep the value in range.
//
//   When rtp_param → 1, λ → 0 which would make 1/λ → ∞.
//   Guard: cap λ at a tiny minimum so we never divide by zero.
// ─────────────────────────────────────────────────────────────────────────────
function sampleIntraBand(band, rtp_param) {
  const { floor, ceiling } = band;
  const span = ceiling - floor;   // width of the band

  // λ controls how steeply the distribution decays toward the ceiling.
  // Derived from rtp_param so long-run mean ≈ 1/rtp_param of the bet.
  const rawLambda = -Math.log(Math.max(rtp_param, 0.001)) / Math.max(span, 0.0001);
  const lambda    = Math.max(rawLambda, 1e-9);   // guard against zero

  const u = Math.random();
  // Clamp u away from exactly 1 to avoid ln(0)
  const safeU = Math.min(u, 1 - Number.EPSILON);

  const raw = floor + (-Math.log(1 - safeU) / lambda);
  return Math.min(ceiling, Math.max(floor, raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// generate_crash_point(band_weights, rtp_param)
//
// PUBLIC API — pure function, no side-effects, no DB, no sockets.
//
// @param {Object} band_weights  e.g. { extra_low: 60, low: 30, ... }
//                               All keys are optional; missing = weight 0.
// @param {number} rtp_param     Return-to-player fraction 0 < rtp ≤ 1.
//                               Typical production value: 0.97
//
// @returns {{ value: number, band: string }}
//   value — the crash multiplier, ≥ 1.00, rounded to 2 decimal places.
//   band  — the name of the band that was chosen (for logging/audit).
// ─────────────────────────────────────────────────────────────────────────────
function generate_crash_point(band_weights, rtp_param) {
  if (!band_weights || typeof band_weights !== 'object') {
    throw new TypeError('crashGenerator: band_weights must be a non-null object');
  }
  if (typeof rtp_param !== 'number' || rtp_param <= 0 || rtp_param > 1) {
    throw new RangeError('crashGenerator: rtp_param must be a number in (0, 1]');
  }

  const band  = selectBand(band_weights);
  const raw   = sampleIntraBand(band, rtp_param);
  const value = Number(raw.toFixed(2));

  return { value, band: band.name };
}

module.exports = {
  generate_crash_point,
  BANDS,            // exported so admin UI can list available bands
};
