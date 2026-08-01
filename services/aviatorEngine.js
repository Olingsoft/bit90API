const crypto = require('crypto');
const { createRound, updateRound, getBetByUserAndRound, createBet, updateBet, adjustBalance } = require('../models/aviatorModel');
const { publishCountdown, publishRoundStart, publishMultiplier, publishCrash } = require('./aviatorRealtime');

const ROUND_WAIT_SECONDS = 5;
const HOUSE_EDGE = 0.03;
const INSTANT_CRASH_THRESHOLD = 1.0;

let currentRound = null;
let roundTimer = null;
let loopRunning = false;

function getCrashPointFromHash(hash) {
  const bytes = Buffer.from(hash, 'hex');
  const value = bytes.readUInt32BE(0) / 0xffffffff;
  const base = 1 + (value * 100);
  const multiplier = 1 + (base - 1) * (1 - HOUSE_EDGE);
  const capped = Math.min(multiplier, 1000);

  if (value < 0.01) {
    return INSTANT_CRASH_THRESHOLD;
  }

  return Number(capped.toFixed(2));
}

function createServerSeed() {
  return crypto.randomBytes(16).toString('hex');
}

function getPublicState() {
  return {
    phase: currentRound?.phase || 'waiting',
    countdown: currentRound?.countdown ?? ROUND_WAIT_SECONDS,
    multiplier: currentRound?.multiplier ?? 1,
    roundId: currentRound?.id || null,
    crashPoint: currentRound?.crashPoint || null,
    hash: currentRound?.hash || null,
    startedAt: currentRound?.startedAt || null,
    crashedAt: currentRound?.crashedAt || null
  };
}

async function startRoundLoop() {
  if (loopRunning) return;
  loopRunning = true;

  const startNewRound = async () => {
    const serverSeed = createServerSeed();
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const roundId = await createRound({
      hash,
      serverSeed: null,
      crashPoint: null,
      status: 'waiting',
      phase: 'waiting',
      countdown: ROUND_WAIT_SECONDS,
      multiplier: 1,
      startedAt: new Date().toISOString()
    });

    currentRound = {
      id: roundId,
      hash,
      serverSeed,
      crashPoint: null,
      status: 'waiting',
      phase: 'waiting',
      countdown: ROUND_WAIT_SECONDS,
      multiplier: 1,
      startedAt: new Date().toISOString()
    };

    await publishRoundStart({ roundId, startedAt: currentRound.startedAt, crashPoint: null });
    await publishCountdown(ROUND_WAIT_SECONDS);

    let remaining = ROUND_WAIT_SECONDS;
    const countdownInterval = setInterval(async () => {
      remaining -= 1;
      currentRound.countdown = Math.max(remaining, 0);
      currentRound.phase = 'waiting';
      currentRound.status = 'waiting';
      await publishCountdown(currentRound.countdown);
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        void beginFlight();
      }
    }, 1000);

    roundTimer = countdownInterval;
  };

  const beginFlight = async () => {
    if (!currentRound) return;
    const crashPoint = getCrashPointFromHash(currentRound.hash);
    currentRound.crashPoint = crashPoint;
    currentRound.phase = 'flying';
    currentRound.status = 'flying';
    currentRound.multiplier = 1;

    await updateRound(currentRound.id, {
      crashPoint,
      phase: 'flying',
      status: 'flying',
      multiplier: 1,
      startedAt: currentRound.startedAt
    });
    await publishMultiplier(1, crashPoint, currentRound.id);

    const flightDurationMs = 1200;
    const stepMs = 100;
    const startTime = Date.now();

    const flightInterval = setInterval(async () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const multiplier = Math.min(1 + (elapsed * 0.75) + (elapsed * elapsed * 0.05), crashPoint);
      currentRound.multiplier = Number(multiplier.toFixed(2));
      await publishMultiplier(currentRound.multiplier, crashPoint, currentRound.id);

      if (currentRound.multiplier >= crashPoint) {
        clearInterval(flightInterval);
        await crashRound();
      }
    }, stepMs);
  };

  const crashRound = async () => {
    if (!currentRound) return;
    const crashedAt = new Date().toISOString();
    currentRound.phase = 'crashed';
    currentRound.status = 'crashed';
    currentRound.crashedAt = crashedAt;
    currentRound.serverSeed = currentRound.serverSeed || null;

    await updateRound(currentRound.id, {
      phase: 'crashed',
      status: 'crashed',
      crashPoint: currentRound.crashPoint,
      multiplier: currentRound.crashPoint,
      crashedAt,
      serverSeed: currentRound.serverSeed
    });
    await publishCrash({
      roundId: currentRound.id,
      crashPoint: currentRound.crashPoint,
      crashedAt,
      serverSeed: currentRound.serverSeed,
      hash: currentRound.hash
    });

    setTimeout(() => {
      void startNewRound();
    }, 2000);
  };

  await startNewRound();
}

async function placeBet(userId, amount, roundId) {
  if (!currentRound || currentRound.id !== roundId) {
    throw new Error('Round is not active');
  }

  if (currentRound.phase !== 'waiting') {
    throw new Error('Bets are only accepted during the waiting phase');
  }

  if (!userId || !amount || Number(amount) <= 0) {
    throw new Error('A valid amount is required');
  }

  const numericAmount = Number(amount);
  await adjustBalance(userId, -numericAmount);
  const betId = await createBet({
    userId,
    roundId,
    amount: numericAmount,
    status: 'placed',
    cashOutMultiplier: null,
    payout: 0
  });

  return { betId, roundId: currentRound.id, amount: numericAmount };
}

async function cashOutBet(userId, roundId) {
  if (!currentRound || currentRound.id !== roundId) {
    throw new Error('Round is not active');
  }

  if (currentRound.phase !== 'flying') {
    throw new Error('Cashout is only available during the flying phase');
  }

  const bet = await getBetByUserAndRound(userId, roundId);
  if (!bet || bet.status !== 'placed') {
    throw new Error('Bet not found');
  }

  const multiplier = currentRound.multiplier || 1;
  const payout = Number(bet.amount * multiplier).toFixed(2);
  const numericPayout = Number(payout);

  await adjustBalance(userId, numericPayout);
  await updateBet(bet.id, {
    status: 'cashed_out',
    cashOutMultiplier: multiplier,
    payout: numericPayout,
    cashedOutAt: new Date().toISOString()
  });

  return { payout: numericPayout, multiplier };
}

module.exports = {
  startRoundLoop,
  placeBet,
  cashOutBet,
  getPublicState
};
