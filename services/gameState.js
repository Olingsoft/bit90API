'use strict';

const { GameConfig }         = require('../models/GameConfig');
const { generate_crash_point } = require('./crashGenerator');

const ROUND_WAIT_SECONDS = 5;
const CRASH_QUEUE_SIZE   = 10;

let currentRound         = null;
let crashThresholdQueue  = [];
let crashRange           = { min: 1.0, max: 10.0 };

// ─── Game config cache ────────────────────────────────────────────────────────
// Loaded from DB on first call, refreshed when the admin saves new config.
let _gameConfig       = null;    // in-memory cache
let _configLoadedAt   = 0;      // epoch ms of last load
const CONFIG_TTL_MS   = 5_000;  // re-read from DB if cache is older than 5 s

/**
 * Returns the cached GameConfig document.
 * Silently falls back to a safe in-memory default if the DB is unreachable.
 */
async function loadGameConfig(force = false) {
  const age = Date.now() - _configLoadedAt;
  if (!force && _gameConfig && age < CONFIG_TTL_MS) {
    return _gameConfig;
  }

  try {
    _gameConfig     = await GameConfig.findOrCreate();
    _configLoadedAt = Date.now();
  } catch (err) {
    console.error('[gameState] Failed to load GameConfig from DB — using cache or defaults:', err.message);
    if (!_gameConfig) {
      // First-ever boot with no DB connectivity — use safe in-memory defaults.
      _gameConfig = {
        crash_mode:   'manual',
        rtp_param:    0.97,
        band_weights: {
          extra_low: 60, low: 30, low_mid: 18, mid: 12, mid_high: 8,
          high: 5, extra_high: 3, super_high: 2, extreme: 1.2, super_extreme: 0.8,
        },
      };
    }
  }

  return _gameConfig;
}

/** Force-invalidate the config cache (call after admin saves new settings). */
function invalidateConfigCache() {
  _configLoadedAt = 0;
}

// ─── Crash range (manual mode) ────────────────────────────────────────────────
function getCrashRange() {
  return { ...crashRange };
}

function setCrashRange({ min, max }) {
  if (typeof min !== 'number' || typeof max !== 'number') {
    throw new Error('Crash range values must be numbers');
  }
  if (Number.isNaN(min) || Number.isNaN(max)) {
    throw new Error('Crash range values must be valid numbers');
  }
  if (min < 1 || max < 1) {
    throw new Error('Crash range must be at least 1.00');
  }
  if (min > max) {
    throw new Error('Minimum crash point must be less than or equal to maximum crash point');
  }

  crashRange = {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
  };
  // Rebuild the manual hash queue with the new range.
  crashThresholdQueue = createCrashThresholdQueue();

  return getCrashRange();
}

// ─── Round accessors ──────────────────────────────────────────────────────────
function getCurrentRound() {
  return currentRound ? { ...currentRound } : null;
}

function setCurrentRound(round) {
  currentRound = { ...round };
}

function setInMemoryRound(key, value) {
  if (!currentRound) return;
  currentRound[key] = value;
}

// ─── Crash queue (manual / hash mode) ────────────────────────────────────────
function getCrashQueue() {
  if (crashThresholdQueue.length === 0) {
    crashThresholdQueue = createCrashThresholdQueue();
  }

  return crashThresholdQueue.map((item, index) => ({
    position:   index + 1,
    hash:       item.hash,
    crashPoint: item.crashPoint,
  }));
}

function createCrashThresholdQueue(size = CRASH_QUEUE_SIZE) {
  const queue = [];
  for (let i = 0; i < size; i += 1) {
    const serverSeed = createServerSeed();
    const hash       = createHash(serverSeed);
    const crashPoint = getCrashPointFromHash(hash);
    queue.push({ serverSeed, hash, crashPoint });
  }
  return queue;
}

function createServerSeed() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

function createHash(serverSeed) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

function getCrashPointFromHash(hash) {
  const { min, max } = crashRange;

  if (min >= max) {
    return Number(min.toFixed(2));
  }

  const bytes      = Buffer.from(hash, 'hex');
  const value      = bytes.readUInt32BE(0) / 0xffffffff;
  const crashPoint = min + value * (max - min);

  return Number(Math.min(max, Math.max(min, crashPoint)).toFixed(2));
}

// ─── Next crash threshold ─────────────────────────────────────────────────────
/**
 * Returns the next crash-point descriptor for a new round.
 *
 * AUTO MODE  → calls generate_crash_point() with config from DB.
 *              Returns { crashPoint, crashBand, crashMode: 'auto',
 *                        hash: null, serverSeed: null }
 *
 * MANUAL MODE → existing hash-based path, untouched.
 *               Returns { crashPoint, hash, serverSeed, crashBand: null,
 *                         crashMode: 'manual' }
 *
 * @returns {Promise<Object>}
 */
async function getNextCrashThreshold() {
  const config = await loadGameConfig();

  // ── AUTO MODE ────────────────────────────────────────────────────────────
  if (config.crash_mode === 'auto') {
    const { value, band } = generate_crash_point(
      config.band_weights,
      config.rtp_param,
    );

    return {
      crashPoint:  value,
      crashBand:   band,
      crashMode:   'auto',
      hash:        null,   // no hash in auto mode
      serverSeed:  null,
    };
  }

  // ── MANUAL MODE (existing path — unchanged) ──────────────────────────────
  if (crashThresholdQueue.length === 0) {
    crashThresholdQueue = createCrashThresholdQueue();
  }

  const entry = crashThresholdQueue.shift();
  return {
    crashPoint: entry.crashPoint,
    crashBand:  null,
    crashMode:  'manual',
    hash:       entry.hash,
    serverSeed: entry.serverSeed,
  };
}

// ─── Public state ─────────────────────────────────────────────────────────────
function initializeCurrentRound() {
  // Note: this synchronous initialiser is only used as a legacy helper.
  // The game loop always calls the async getNextCrashThreshold() directly.
  const serverSeed = createServerSeed();
  const hash       = createHash(serverSeed);
  const crashPoint = getCrashPointFromHash(hash);

  const startAt  = new Date().toISOString();
  const roundId  = `round-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const round    = {
    id:                roundId,
    hash,
    serverSeed,
    crashPoint:        null,
    pendingCrashPoint: crashPoint,
    status:            'waiting',
    phase:             'waiting',
    multiplier:        1,
    countdown:         ROUND_WAIT_SECONDS,
    startedAt:         startAt,
    crashedAt:         null,
    revealedAt:        null,
    crashBand:         null,
    crashMode:         'manual',
  };
  setCurrentRound(round);
  return round;
}

function getPublicState() {
  const round = getCurrentRound();
  if (!round) {
    return {
      phase:     'waiting',
      countdown: ROUND_WAIT_SECONDS,
      multiplier: 1,
      roundId:   null,
      crashPoint: null,
      hash:       null,
      startedAt:  null,
      crashedAt:  null,
    };
  }

  return {
    phase:      round.phase,
    countdown:  round.countdown,
    multiplier: round.multiplier,
    roundId:    round.id,
    crashPoint: round.crashPoint,
    hash:       round.hash,
    startedAt:  round.startedAt,
    crashedAt:  round.crashedAt,
  };
}

module.exports = {
  // crash range (manual)
  getCrashRange,
  setCrashRange,
  // round accessors
  getPublicState,
  getCrashQueue,
  getCurrentRound,
  setCurrentRound,
  setInMemoryRound,
  initializeCurrentRound,
  // crash point helpers
  getCrashPointFromHash,
  getCrashRangeFromHash: getCrashPointFromHash,  // legacy alias
  // async threshold — used by gameLoop
  getNextCrashThreshold,
  // config cache
  loadGameConfig,
  invalidateConfigCache,
};
