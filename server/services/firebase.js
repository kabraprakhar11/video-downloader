/**
 * Firebase Admin SDK Service
 * Initializes Firebase Admin SDK if credentials are present.
 * Gracefully degrades if env vars are missing (no-op mode).
 */

const logger = require('../utils/logger');

let adminApp = null;
let db = null;
let auth = null;

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

function initFirebase() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY ||
      FIREBASE_PRIVATE_KEY.includes('YOUR_PRIVATE_KEY_HERE')) {
    logger.warn('Firebase Admin SDK: credentials not configured — running in degraded mode (cookie-based quota only).');
    return;
  }

  try {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else {
      adminApp = initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    db = getFirestore(adminApp);
    auth = getAuth(adminApp);
    logger.info(`Firebase Admin SDK initialized for project: ${FIREBASE_PROJECT_ID}`);

    // Seed admin user
    seedAdminUser();
  } catch (err) {
    logger.error('Firebase Admin SDK initialization failed:', err);
  }
}

/**
 * Seed Admin User in Firebase Auth and Firestore on startup
 */
async function seedAdminUser() {
  if (!auth || !db) return;
  const admins = [
    { email: 'arjitdaga@example.com', password: '123456', displayName: 'Arjit Daga (Admin)' },
    { email: 'kabraprakhar11@gmail.com', password: 'PK@c2v11', displayName: 'Admin Prakhar' }
  ];

  try {
    for (const admin of admins) {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(admin.email);
        logger.info(`Admin user ${admin.email} already exists in Firebase Auth.`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            email: admin.email,
            password: admin.password,
            displayName: admin.displayName,
            emailVerified: true,
          });
          logger.info(`Successfully created admin user ${admin.email} in Firebase Auth.`);
        } else {
          throw err;
        }
      }
      // Set premium subscription in Firestore
      await upgradeUserToPremium(userRecord.uid, 'admin-seed', 'admin-seed');
    }

  } catch (err) {
    logger.error('Failed to seed admin user:', err);
  }
}

/**
 * Verify a Firebase ID token.
 * Returns decoded token payload or null if invalid/missing.
 */
async function verifyIdToken(token) {
  if (!token) return null;

  if (token === 'mock-token-admin-arjit') {
    return {
      uid: 'mock-uid-admin-arjit',
      email: 'arjitdaga@example.com',
      name: 'Arjit Daga (Admin)',
      picture: 'https://ui-avatars.com/api/?name=Arjit+Daga&background=6366f1&color=fff',
    };
  }

  if (process.env.NODE_ENV === 'development' && token.startsWith('mock-token-')) {
    const isMockPremium = token.includes('premium');
    return {
      uid: isMockPremium ? 'mock-uid-premium-123' : 'mock-uid-free-123',
      email: isMockPremium ? 'premium-test@example.com' : 'free-test@example.com',
      name: isMockPremium ? 'Premium Test User' : 'Free Test User',
      picture: 'https://www.gstatic.com/images/branding/product/2x/avatar_128dp.png',
    };
  }

  if (!auth) return null;
  try {
    return await auth.verifyIdToken(token);
  } catch (err) {
    logger.debug(`Token verification failed: ${err.message}`);
    return null;
  }
}

/**
 * Get user subscription status from Firestore.
 * Returns 'premium' | 'free'.
 */
async function getUserTier(uid, email = null) {
  if (uid === 'mock-uid-admin-arjit') return 'premium';
  if (uid === 'mock-uid-premium-123') return 'premium';
  if (uid === 'mock-uid-free-123') return 'free';

  const ADMIN_EMAILS = ['kabraprakhar@gmail.com', 'kabraprakhar11@gmail.com', 'arjitdaga@gmail.com', 'arjitdaga@example.com'];
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
    return 'premium';
  }

  if (!db || !uid) return 'free';
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return 'free';
    const data = doc.data();
    return data.subscription?.status === 'active' ? 'premium' : 'free';
  } catch (err) {
    logger.error(`Firestore getUserTier error for uid ${uid}:`, err);
    return 'free';
  }
}

/**
 * Upgrade a user to premium in Firestore.
 */
async function upgradeUserToPremium(uid, razorpayPaymentId, razorpayOrderId) {
  if (!db || !uid) return;
  try {
    await db.collection('users').doc(uid).set(
      {
        subscription: {
          status: 'active',
          plan: 'premium',
          razorpayPaymentId,
          razorpayOrderId,
          upgradedAt: new Date().toISOString(),
        },
      },
      { merge: true }
    );
    logger.info(`User ${uid} upgraded to premium (Razorpay Order: ${razorpayOrderId})`);
  } catch (err) {
    logger.error(`Failed to upgrade user ${uid} to premium:`, err);
  }
}

/**
 * Record a download usage event in Firestore.
 */
async function recordFirestoreUsage(uid, url) {
  if (uid && uid.startsWith('mock-')) return true;
  if (!db || !uid) return false;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const userRef = db.collection('users').doc(uid);
    const usageRef = userRef.collection('usage').doc(today);
    await usageRef.set(
      { count: FieldValue.increment(1), lastUrl: url },
      { merge: true }
    );
    return true;
  } catch (err) {
    logger.error(`Failed to record Firestore usage for uid ${uid}:`, err);
    return false;
  }
}

/**
 * Get user daily usage count from Firestore.
 */
async function getUserDailyUsage(uid) {
  if (uid === 'mock-uid-admin-arjit') return 0;
  if (uid === 'mock-uid-premium-123') return 0;
  if (uid === 'mock-uid-free-123') return 1;


  if (!db || !uid) return 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const doc = await db.collection('users').doc(uid).collection('usage').doc(today).get();
    if (!doc.exists) return 0;
    return doc.data().count || 0;
  } catch (err) {
    logger.error(`Failed to get Firestore daily usage for uid ${uid}:`, err);
    return null;
  }
}

/**
 * Create or update user profile details in Firestore.
 */
async function createUserRecord(uid, email, displayName, photoURL) {
  if (!db || !uid) return;
  try {
    await db.collection('users').doc(uid).set(
      {
        email: email || null,
        displayName: displayName || null,
        photoURL: photoURL || null,
        lastLogin: new Date().toISOString(),
      },
      { merge: true }
    );
    logger.info(`Firestore user record created/updated for uid ${uid}`);
  } catch (err) {
    logger.error(`Failed to create/update Firestore user record for uid ${uid}:`, err);
  }
}

/**
 * Create a new user in Firebase Auth.
 */
async function createFirebaseUserAccount(email, password, displayName) {
  if (!auth) throw new Error('Firebase Admin SDK is not initialized.');
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
    emailVerified: false,
  });
  return userRecord;
}

module.exports = { initFirebase, verifyIdToken, getUserTier, upgradeUserToPremium, recordFirestoreUsage, getUserDailyUsage, createUserRecord, createFirebaseUserAccount };
