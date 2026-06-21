/**
 * Razorpay Service
 * Handles creation of checkout orders and signature verification.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

const isRazorpayConfigured = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_ID.includes('YOUR_RAZORPAY');

let razorpay = null;
if (isRazorpayConfigured) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
} else {
  logger.warn('Razorpay: API keys not configured — payment features disabled.');
}

/**
 * Create a new Razorpay Order for a premium subscription
 */
async function createOrder(userId, email) {
  if (!razorpay) {
    throw new Error('Payments are currently disabled.');
  }

  const options = {
    amount: 4900, // Amount is in currency subunits (4900 cents = $49 USD)
    currency: 'USD',
    receipt: `rcpt_${userId.slice(0, 10)}_${Date.now().toString().slice(-6)}`,
    notes: {
      userId,
      email: email || 'unknown',
    },
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (err) {
    logger.error('Failed to create Razorpay order:', err);
    throw new Error('Could not initialize payment. Please try again.');
  }
}

function verifySignature(orderId, paymentId, signature) {
  if (!razorpay) return false;

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (err) {
    return false;
  }
}

module.exports = {
  isConfigured: isRazorpayConfigured,
  createOrder,
  verifySignature,
};
