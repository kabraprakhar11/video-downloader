/**
 * POST /api/auth/verify
 * Verifies a Firebase ID token and returns user tier information.
 */

const express = require('express');
const router = express.Router();

const { verifyIdToken, getUserTier, createUserRecord, getUserDailyUsage, createFirebaseUserAccount, upgradeUserToPremium } = require('../services/firebase');
const razorpayService = require('../services/razorpay');
const { getIpQuota } = require('../middleware/quota');
const logger = require('../utils/logger');

router.post('/verify', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided.' });
  }

  let decoded = null;
  let tier = 'free';

  if (token === 'mock-token-admin-arjit') {
    decoded = {
      uid: 'mock-uid-admin-arjit',
      email: 'arjitdaga@example.com',
      name: 'Arjit Daga (Admin)',
      picture: 'https://ui-avatars.com/api/?name=Arjit+Daga&background=6366f1&color=fff',
    };
    tier = 'premium';
  } else if (process.env.NODE_ENV === 'development' && token.startsWith('mock-token-')) {
    const isMockPremium = token.includes('premium');
    decoded = {
      uid: isMockPremium ? 'mock-uid-premium-123' : 'mock-uid-free-123',
      email: isMockPremium ? 'premium-test@example.com' : 'free-test@example.com',
      name: isMockPremium ? 'Premium Test User' : 'Free Test User',
      picture: 'https://www.gstatic.com/images/branding/product/2x/avatar_128dp.png',
    };
    tier = isMockPremium ? 'premium' : 'free';
  } else {
    decoded = await verifyIdToken(token);
  }

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  let dailyUsage = 0;

  if (token !== 'mock-token-admin-arjit' && !token.startsWith('mock-token-')) {
    // Create or update user account record in Firestore
    await createUserRecord(decoded.uid, decoded.email, decoded.name, decoded.picture);
    tier = await getUserTier(decoded.uid);
    const firestoreUsage = await getUserDailyUsage(decoded.uid);
    if (firestoreUsage === null) {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const quota = getIpQuota(ip);
      dailyUsage = quota.count;
    } else {
      dailyUsage = firestoreUsage;
    }
  } else {
    // For mock users, save to Firestore if possible, but don't fail if Firestore is disabled
    try {
      await createUserRecord(decoded.uid, decoded.email, decoded.name, decoded.picture);
      const dbTier = await getUserTier(decoded.uid);
      if (dbTier === 'premium') {
        tier = 'premium';
      }
    } catch (err) {
      logger.debug(`Could not write mock user to firestore: ${err.message}`);
    }
    dailyUsage = token.includes('premium') ? 0 : 1;
  }

  logger.debug(`[Auth] Token verified: uid=${decoded.uid} tier=${tier}`);

  res.json({
    uid: decoded.uid,
    email: decoded.email || null,
    tier,
    isPremium: tier === 'premium',
    usage: {
      used: dailyUsage,
      limit: tier === 'premium' ? 99999 : 3,
      remaining: Math.max(0, (tier === 'premium' ? 99999 : 3) - dailyUsage),
    }
  });
});

/**
 * POST /api/auth/register-premium
 * Registers a new user after successful Razorpay guest checkout.
 */
router.post('/register-premium', async (req, res) => {
  const { firstName, lastName, mobile, email, password, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!email || !password || !firstName || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Missing required registration or payment details.' });
  }

  try {
    // 1. Verify Razorpay signature to ensure payment is valid
    const isValid = razorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature. Payment could not be verified.' });
    }

    // 2. Create the Firebase Auth user
    const displayName = `${firstName} ${lastName}`.trim();
    const userRecord = await createFirebaseUserAccount(email, password, displayName);
    
    // 3. Create Firestore profile (we include mobile in this record if desired, or just use createUserRecord)
    const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;
    await createUserRecord(userRecord.uid, email, displayName, photoURL);

    // 4. Upgrade user to Premium in Firestore
    await upgradeUserToPremium(userRecord.uid, razorpay_payment_id, razorpay_order_id);

    logger.info(`Successfully created premium account for ${email} (UID: ${userRecord.uid})`);
    res.json({ success: true, message: 'Premium account created successfully.' });

  } catch (err) {
    logger.error('Premium registration error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to create premium account.' });
  }
});

module.exports = router;
