/**
 * POST /api/checkout/*
 * Razorpay Payment Endpoints
 */

const express = require('express');
const router = express.Router();
const razorpayService = require('../services/razorpay');
const { verifyIdToken, upgradeUserToPremium } = require('../services/firebase');
const logger = require('../utils/logger');

// Auth middleware for checkout
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

/**
 * Creates a new Razorpay Order
 */
router.post('/create-order', requireAuth, async (req, res) => {
  if (!razorpayService.isConfigured) {
    return res.status(503).json({ error: 'Payments are currently disabled.' });
  }

  try {
    const order = await razorpayService.createOrder(req.user.uid, req.user.email);
    res.json({ success: true, order });
  } catch (err) {
    logger.error('Create order error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Creates a new Razorpay Guest Order (No auth required)
 */
router.post('/create-guest-order', async (req, res) => {
  if (!razorpayService.isConfigured) {
    return res.status(503).json({ error: 'Payments are currently disabled.' });
  }

  try {
    const order = await razorpayService.createOrder('guest', null);
    res.json({ success: true, order });
  } catch (err) {
    logger.error('Create guest order error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Verifies the Razorpay payment signature
 */
router.post('/verify-payment', requireAuth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification details' });
  }

  try {
    const isValid = razorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Upgrade the user in Firebase
    await upgradeUserToPremium(req.user.uid, razorpay_payment_id, razorpay_order_id);

    res.json({ success: true, message: 'Payment verified successfully. Welcome to Premium!' });
  } catch (err) {
    logger.error('Verify payment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
