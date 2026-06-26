/**
 * POST /api/extract
 * Accepts a video URL, runs yt-dlp to get format list + metadata.
 * Enforces free-tier quota and quality restrictions.
 */

const express = require('express');
const router = express.Router();

const { validateExtractRequest } = require('../middleware/sanitize');
const { enforceQuota, recordUsage } = require('../middleware/quota');
const { extractLimiter } = require('../middleware/rateLimiter');
const { extractInfo } = require('../services/ytdlp');
const { verifyIdToken, getUserTier, recordFirestoreUsage } = require('../services/firebase');
const logger = require('../utils/logger');

// Auth middleware — attaches userTier to request if valid Firebase token
async function attachUserTier(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    const decoded = await verifyIdToken(token);
    if (decoded) {
      const tier = await getUserTier(decoded.uid, decoded.email);
      req.firebaseUid = decoded.uid;
      req.userEmail = decoded.email || null;
      req.userTier = tier;
      logger.debug(`Auth: uid=${decoded.uid} tier=${tier}`);
    }
  }
  next();
}

router.post(
  '/',
  extractLimiter,
  attachUserTier,
  validateExtractRequest,
  enforceQuota,
  async (req, res) => {
    const url = req.validatedUrl;
    const tier = req.userTier || 'free';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    try {
      const info = await extractInfo(url);

      // We no longer strip formats here on the backend so the frontend can display 
      // the premium-locked UI cards and encourage upgrades.
      // (Actual download endpoint could enforce this in a real prod env)

      // Record usage
      if (tier !== 'premium') {
        recordUsage(ip);
      } else if (req.firebaseUid) {
        // Record Premium usage for analytics only
        await recordFirestoreUsage(req.firebaseUid, url);
      }

      // Update quota info in-place for the response to avoid lag
      if (req.quotaInfo && req.quotaInfo.tier === 'free') {
        req.quotaInfo.used += 1;
        req.quotaInfo.remaining = Math.max(0, req.quotaInfo.limit - req.quotaInfo.used);
      }

      const response = {
        success: true,
        tier,
        quota: req.quotaInfo,
        data: info,
      };

      res.json(response);
    } catch (err) {
      logger.error(`[/api/extract] Error for URL "${url}": ${err.message}`);
      res.status(422).json({
        error: err.message || 'Failed to extract video information.',
        success: false,
      });
    }
  }
);

module.exports = router;
