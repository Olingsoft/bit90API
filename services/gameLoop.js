const { getCurrentRound, setCurrentRound, setInMemoryRound, getNextCrashThreshold, getCrashPointFromHash } = require('./gameState');
const { createRound, updateRound } = require('../models/aviatorModel');
const { emitAviator } = require('./socketService');

const ROUND_WAIT_SECONDS = 5;
const FLIGHT_STEP_MS = 150;

let countdownInterval = null;
let flightInterval = null;
let loopStarted = false;

function clearCountdownInterval() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function clearFlightInterval() {
  if (flightInterval) {
    clearInterval(flightInterval);
    flightInterval = null;
  }
}

async function beginFlight() {
  const round = getCurrentRound();
  if (!round) {
    return startNewRound();
  }

  clearCountdownInterval();

  const crashPoint = round.pendingCrashPoint ?? getCrashPointFromHash(round.hash);
  round.crashPoint = crashPoint;
  round.phase = 'flying';
  round.status = 'flying';
  round.multiplier = 1;
  setCurrentRound(round);

  await updateRound(round.id, {
    crashPoint,
    phase: round.phase,
    status: round.status,
    multiplier: round.multiplier,
  });

  emitAviator('aviator:started', {
    roundId: round.id,
    phase: round.phase,
    multiplier: round.multiplier,
    crashPoint: round.crashPoint,
    hash: round.hash,
    startedAt: round.startedAt,
  });

  const startTime = Date.now();

  flightInterval = setInterval(async () => {
    try {
      const elapsed = (Date.now() - startTime) / 1000;
      const nextMultiplier = Math.min(1 + elapsed * 0.16 + Math.pow(elapsed, 2) * 0.01, crashPoint);
      const roundedMultiplier = Number(nextMultiplier.toFixed(2));
      setInMemoryRound('multiplier', roundedMultiplier);

      emitAviator('aviator:multiplier', {
        roundId: round.id,
        multiplier: roundedMultiplier,
        crashPoint: round.crashPoint,
        phase: round.phase,
      });

      if (roundedMultiplier >= crashPoint) {
        clearFlightInterval();
        await crashRound();
      }
    } catch (error) {
      console.error('Aviator flight tick error', error);
      clearFlightInterval();
      setTimeout(() => {
        startNewRound().catch((err) => console.error(err));
      }, 1000);
    }
  }, FLIGHT_STEP_MS);
}

async function crashRound() {
  const round = getCurrentRound();
  if (!round) return;

  clearFlightInterval();

  const crashedAt = new Date().toISOString();
  round.phase = 'crashed';
  round.status = 'crashed';
  round.crashedAt = crashedAt;
  round.revealedAt = crashedAt;
  round.multiplier = round.crashPoint;
  setCurrentRound(round);

  await updateRound(round.id, {
    phase: round.phase,
    status: round.status,
    crashPoint: round.crashPoint,
    multiplier: round.crashPoint,
    crashedAt: round.crashedAt,
    serverSeed: round.serverSeed,
    revealedAt: round.revealedAt,
  });

  emitAviator('aviator:crashed', {
    roundId: round.id,
    crashPoint: round.crashPoint,
    crashedAt: round.crashedAt,
    serverSeed: round.serverSeed,
    hash: round.hash,
  });

  emitAviator('aviator:history', {
    roundId: round.id,
    crashPoint: round.crashPoint,
    endedAt: round.crashedAt,
    serverSeed: round.serverSeed,
    hash: round.hash,
  });

  setTimeout(() => {
    startNewRound().catch((err) => console.error(err));
  }, 2000);
}

async function startNewRound() {
  clearCountdownInterval();
  clearFlightInterval();

  const threshold = getNextCrashThreshold();
  const startedAt = new Date().toISOString();
  const roundData = {
    hash: threshold.hash,
    serverSeed: null,
    crashPoint: null,
    status: 'waiting',
    phase: 'waiting',
    countdown: ROUND_WAIT_SECONDS,
    multiplier: 1,
    startedAt,
  };
  const roundId = await createRound(roundData);

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
    startedAt,
    crashedAt: null,
    revealedAt: null,
  };
  setCurrentRound(round);

  emitAviator('aviator:waiting', {
    roundId: round.id,
    phase: round.phase,
    countdown: round.countdown,
    multiplier: round.multiplier,
    crashPoint: null,
    hash: round.hash,
    startedAt: round.startedAt,
  });

  let remaining = ROUND_WAIT_SECONDS;
  setInMemoryRound('countdown', remaining);

  countdownInterval = setInterval(async () => {
    try {
      remaining -= 1;
      if (remaining < 0) {
        clearCountdownInterval();
        await beginFlight();
        return;
      }

      setInMemoryRound('countdown', remaining);
      emitAviator('aviator:countdown', {
        roundId: round.id,
        countdown: remaining,
      });
    } catch (error) {
      console.error('Aviator countdown error', error);
      clearCountdownInterval();
      setTimeout(() => {
        startNewRound().catch((err) => console.error(err));
      }, 1000);
    }
  }, 1000);
}

async function startRoundLoop() {
  if (loopStarted) return;
  loopStarted = true;
  await startNewRound();
}

function stopRoundLoop() {
  clearCountdownInterval();
  clearFlightInterval();
  loopStarted = false;
}

module.exports = {
  startRoundLoop,
  stopRoundLoop,
};
