const ROUND_WAIT_SECONDS = 5;
const CRASH_QUEUE_SIZE = 10;

let currentRound = null;
let crashThresholdQueue = [];
let crashRange = { min: 1.0, max: 10.0 };

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
  crashThresholdQueue = createCrashThresholdQueue();

  return getCrashRange();
}

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

function getCrashQueue() {
  if (crashThresholdQueue.length === 0) {
    crashThresholdQueue = createCrashThresholdQueue();
  }

  return crashThresholdQueue.map((item, index) => ({
    position: index + 1,
    hash: item.hash,
    crashPoint: item.crashPoint,
  }));
}

function createCrashThresholdQueue(size = CRASH_QUEUE_SIZE) {
  const queue = [];
  for (let i = 0; i < size; i += 1) {
    const serverSeed = createServerSeed();
    const hash = createHash(serverSeed);
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

  const bytes = Buffer.from(hash, 'hex');
  const value = bytes.readUInt32BE(0) / 0xffffffff;
  const crashPoint = min + value * (max - min);

  return Number(Math.min(max, Math.max(min, crashPoint)).toFixed(2));
}

function initializeCurrentRound() {
  const threshold = getNextCrashThreshold();
  const startAt = new Date().toISOString();
  const roundId = `round-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const round = {
    id: roundId,
    hash: threshold.hash,
    serverSeed: threshold.serverSeed,
    crashPoint: null,
    pendingCrashPoint: threshold.crashPoint,
    status: 'waiting',
    phase: 'waiting',
    multiplier: 1,
    countdown: ROUND_WAIT_SECONDS,
    startedAt: startAt,
    crashedAt: null,
    revealedAt: null,
  };
  setCurrentRound(round);
  return round;
}

function getNextCrashThreshold() {
  if (crashThresholdQueue.length === 0) {
    crashThresholdQueue = createCrashThresholdQueue();
  }
  return crashThresholdQueue.shift();
}

function getPublicState() {
  const round = getCurrentRound();
  if (!round) {
    return {
      phase: 'waiting',
      countdown: ROUND_WAIT_SECONDS,
      multiplier: 1,
      roundId: null,
      crashPoint: null,
      hash: null,
      startedAt: null,
      crashedAt: null,
    };
  }

  return {
    phase: round.phase,
    countdown: round.countdown,
    multiplier: round.multiplier,
    roundId: round.id,
    crashPoint: round.crashPoint,
    hash: round.hash,
    startedAt: round.startedAt,
    crashedAt: round.crashedAt,
  };
}

module.exports = {
  getCrashRange,
  setCrashRange,
  getPublicState,
  getCrashQueue,
  getCurrentRound,
  setCurrentRound,
  setInMemoryRound,
  initializeCurrentRound,
  getCrashPointFromHash,
  getCrashRangeFromHash: getCrashPointFromHash,
  getNextCrashThreshold,
};
