const { database, ref, set, update, push } = require('../firebase');

function isReady() {
  return Boolean(database);
}

async function publishPhase(phase) {
  if (!isReady()) return null;
  await set(ref(database, 'aviator/live/phase'), phase);
  return phase;
}

async function publishCountdown(countdown) {
  if (!isReady()) return null;
  await set(ref(database, 'aviator/live/countdown'), countdown);
  return countdown;
}

async function publishRoundStart(roundData) {
  if (!isReady()) return null;
  await set(ref(database, 'aviator/live'), {
    phase: 'waiting',
    countdown: 5,
    multiplier: 1,
    roundId: roundData.roundId,
    crashPoint: roundData.crashPoint || null,
    startedAt: roundData.startedAt || null,
    status: 'waiting'
  });
  return roundData;
}

async function publishMultiplier(multiplier, crashPoint, roundId, phase = 'flying', status = phase) {
  if (!isReady()) return null;
  await update(ref(database, 'aviator/live'), {
    multiplier,
    crashPoint,
    roundId,
    phase,
    status
  });
  return { multiplier, crashPoint, roundId, phase, status };
}

async function publishCrash(roundData) {
  if (!isReady()) return null;
  await update(ref(database, 'aviator/live'), {
    phase: 'crashed',
    multiplier: roundData.crashPoint,
    crashPoint: roundData.crashPoint,
    roundId: roundData.roundId,
    status: 'crashed',
    crashedAt: roundData.crashedAt
  });

  const historyRef = ref(database, `aviator/history/${roundData.roundId}`);
  await set(historyRef, {
    roundId: roundData.roundId,
    crashPoint: roundData.crashPoint,
    endedAt: roundData.crashedAt,
    serverSeed: roundData.serverSeed,
    hash: roundData.hash
  });

  return roundData;
}

module.exports = {
  publishPhase,
  publishCountdown,
  publishRoundStart,
  publishMultiplier,
  publishCrash
};
