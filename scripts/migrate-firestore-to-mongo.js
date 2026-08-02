/**
 * One-time migration script: Firestore -> MongoDB
 *
 * Prerequisites:
 *   1. Set MONGODB_URI in .env
 *   2. Set Firebase env vars for the source Firestore project
 *   3. npm install (firebase is a devDependency for this script only)
 *
 * Usage:
 *   npm run migrate:firestore
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const User = require('../models/User');
const Round = require('../models/Round');
const Bet = require('../models/Bet');
const { connectMongo } = require('../config/mongodb');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const idMap = new Map();

function resolveObjectId(firestoreId) {
  if (
    mongoose.Types.ObjectId.isValid(firestoreId) &&
    String(new mongoose.Types.ObjectId(firestoreId)) === firestoreId
  ) {
    return new mongoose.Types.ObjectId(firestoreId);
  }

  if (idMap.has(firestoreId)) {
    return idMap.get(firestoreId);
  }

  const newId = new mongoose.Types.ObjectId();
  idMap.set(firestoreId, newId);
  return newId;
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

async function migrateCollection(db, collectionName, transform, Model) {
  console.log(`Migrating ${collectionName}...`);
  const snapshot = await getDocs(collection(db, collectionName));
  let count = 0;

  for (const docSnap of snapshot.docs) {
    const payload = transform(docSnap.id, docSnap.data());
    await Model.findByIdAndUpdate(payload._id, { $set: payload }, { upsert: true, runValidators: true });
    count += 1;
  }

  console.log(`  Migrated ${count} documents from ${collectionName}`);
  return count;
}

async function migrate() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error('FIREBASE_PROJECT_ID is required for migration.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  await connectMongo();

  const userCount = await migrateCollection(
    db,
    'users',
    (id, data) => ({
      _id: resolveObjectId(id),
      phone: data.phone,
      username: data.username || null,
      email: data.email || null,
      password: data.password,
      balance: Number(data.balance || 0),
      isAdmin: Boolean(data.isAdmin),
      role: data.role || null,
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    }),
    User
  );

  const roundCount = await migrateCollection(
    db,
    'aviator_rounds',
    (id, data) => ({
      _id: resolveObjectId(id),
      hash: data.hash,
      serverSeed: data.serverSeed ?? null,
      crashPoint: data.crashPoint ?? null,
      status: data.status,
      phase: data.phase,
      countdown: data.countdown ?? 0,
      multiplier: data.multiplier ?? 1,
      startedAt: toDate(data.startedAt) || new Date(),
      crashedAt: toDate(data.crashedAt),
      revealedAt: toDate(data.revealedAt),
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    }),
    Round
  );

  const betCount = await migrateCollection(
    db,
    'aviator_bets',
    (id, data) => ({
      _id: resolveObjectId(id),
      userId: resolveObjectId(data.userId),
      roundId: resolveObjectId(data.roundId),
      amount: Number(data.amount),
      payout: Number(data.payout || 0),
      status: data.status || 'placed',
      cashOutMultiplier: data.cashOutMultiplier ?? null,
      placedAt: toDate(data.placedAt) || toDate(data.createdAt) || new Date(),
      cashedOutAt: toDate(data.cashedOutAt),
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    }),
    Bet
  );

  console.log('\nMigration complete.');
  console.log(`  Users:  ${userCount}`);
  console.log(`  Rounds: ${roundCount}`);
  console.log(`  Bets:   ${betCount}`);
  console.log(`  ID mappings created: ${idMap.size}`);

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
