'use strict';

const express              = require('express');
const { adminAuthMiddleware } = require('../middleware/auth');
const {
  getPublicState,
  getCrashQueue,
  getCrashRange,
  setCrashRange,
  invalidateConfigCache,
  loadGameConfig,
}                          = require('../services/aviatorEngine');
const { GameConfig, DEFAULT_BAND_WEIGHTS } = require('../models/GameConfig');
const { BANDS }            = require('../services/crashGenerator');

const router = express.Router();

// ─── Validation helpers ────────────────────────────────────────────────────────
const VALID_BAND_NAMES = new Set(BANDS.map((b) => b.name));

function validateBandWeights(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    return 'band_weights must be a plain object';
  }
  for (const [key, val] of Object.entries(weights)) {
    if (!VALID_BAND_NAMES.has(key)) {
      return `Unknown band name "${key}". Valid bands: ${[...VALID_BAND_NAMES].join(', ')}`;
    }
    if (typeof val !== 'number' || val < 0 || !isFinite(val)) {
      return `band_weights.${key} must be a non-negative finite number`;
    }
  }
  return null;   // valid
}

// ─── GET /admin/ ─────────────────────────────────────────────────────────────
// Existing dashboard endpoint — now also returns game_config.
router.get('/', adminAuthMiddleware, async (req, res) => {
  try {
    const publicState  = getPublicState();
    const crashQueue   = getCrashQueue();
    const crashRange   = getCrashRange();
    const game_config  = await loadGameConfig();

    return res.json({
      title: 'Aviator Admin Dashboard',
      publicState,
      crashQueue,
      crashRange,
      game_config: {
        crash_mode:   game_config.crash_mode,
        rtp_param:    game_config.rtp_param,
        band_weights: game_config.band_weights,
      },
      available_bands: BANDS.map((b) => ({
        name:    b.name,
        ceiling: b.ceiling,
        default_weight: DEFAULT_BAND_WEIGHTS[b.name],
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load dashboard' });
  }
});

// ─── GET /admin/config ────────────────────────────────────────────────────────
// Read the current GameConfig.
router.get('/config', adminAuthMiddleware, async (req, res) => {
  try {
    const config = await loadGameConfig(true);   // force-refresh from DB
    return res.json({
      crash_mode:   config.crash_mode,
      rtp_param:    config.rtp_param,
      band_weights: config.band_weights,
      updated_at:   config.updatedAt,
      available_bands: BANDS.map((b) => ({
        name:    b.name,
        floor:   b.floor,
        ceiling: b.ceiling,
        default_weight: DEFAULT_BAND_WEIGHTS[b.name],
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load config' });
  }
});

// ─── PUT /admin/config ────────────────────────────────────────────────────────
// Update crash_mode, rtp_param, and/or band_weights (partial updates OK).
// Changes take effect on the NEXT round start (not mid-flight).
router.put('/config', adminAuthMiddleware, async (req, res) => {
  try {
    const { crash_mode, rtp_param, band_weights } = req.body;
    const update = {};

    // ── crash_mode validation ────────────────────────────────────────────────
    if (crash_mode !== undefined) {
      if (!['auto', 'manual'].includes(crash_mode)) {
        return res.status(400).json({ message: 'crash_mode must be "auto" or "manual"' });
      }
      update.crash_mode = crash_mode;
    }

    // ── rtp_param validation ─────────────────────────────────────────────────
    if (rtp_param !== undefined) {
      const rtp = Number(rtp_param);
      if (isNaN(rtp) || rtp <= 0 || rtp > 1) {
        return res.status(400).json({ message: 'rtp_param must be a number in (0, 1]' });
      }
      update.rtp_param = rtp;
    }

    // ── band_weights validation ──────────────────────────────────────────────
    if (band_weights !== undefined) {
      const err = validateBandWeights(band_weights);
      if (err) return res.status(400).json({ message: err });

      // Merge with the existing weights so the admin can update a subset.
      const existing = await loadGameConfig();
      const merged   = { ...existing.band_weights.toObject?.() ?? existing.band_weights, ...band_weights };
      update.band_weights = merged;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided. Send crash_mode, rtp_param, and/or band_weights.' });
    }

    // Persist to MongoDB.
    const saved = await GameConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { new: true, upsert: true }
    );

    // Invalidate in-memory cache so the next round picks up the new values.
    invalidateConfigCache();

    return res.json({
      message: 'Game config updated successfully. Changes take effect on the next round.',
      config: {
        crash_mode:   saved.crash_mode,
        rtp_param:    saved.rtp_param,
        band_weights: saved.band_weights,
        updated_at:   saved.updatedAt,
      },
    });
  } catch (err) {
    console.error('[adminRoutes] PUT /config error:', err);
    return res.status(500).json({ message: err.message || 'Failed to update config' });
  }
});

// ─── PUT /admin/crash-range ───────────────────────────────────────────────────
// Existing manual crash-range endpoint — unchanged.
router.put('/crash-range', adminAuthMiddleware, (req, res) => {
  try {
    const min         = Number(req.body.min);
    const max         = Number(req.body.max);
    const updatedRange = setCrashRange({ min, max });
    return res.json({ message: 'Crash range updated', crashRange: updatedRange });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Invalid crash range' });
  }
});

module.exports = router;
