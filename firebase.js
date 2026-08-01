const dotenv = require('dotenv');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  orderBy,
  limit,
  getDoc
} = require('firebase/firestore');
const { getDatabase, ref, set, update, push } = require('firebase/database');

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'demo-project.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '0000000000',
  appId: process.env.FIREBASE_APP_ID || '1:0000000:web:demo',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-DEMO',
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://demo-project-default-rtdb.firebaseio.com'
};

if (!process.env.FIREBASE_DATABASE_URL) {
  console.warn('[Firebase] FIREBASE_DATABASE_URL is missing; using fallback demo RTDB URL.');
} else {
  console.log('[Firebase] RTDB URL configured as', process.env.FIREBASE_DATABASE_URL);
}

let app = null;
let db = null;
let database = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  database = getDatabase(app);
} catch (error) {
  console.warn('Firebase initialization warning:', error.message);
}

module.exports = {
  app,
  db,
  database,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  orderBy,
  limit,
  getDoc,
  ref,
  set,
  update,
  push
};
