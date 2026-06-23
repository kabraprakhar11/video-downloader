/**
 * POST /api/merge
 * Merges video and audio streams on the fly using FFmpeg.
 * Streams the resulting MP4 directly to the client without temp files.
 *
 * Body params:
 *   videoUrl — extracted video stream URL
 *   audioUrl — extracted audio stream URL
 *   filename — desired output filename
 *   token     — Firebase ID token (required, must be premium tier)
 */

const express = require('express');
const router = express.Router();
const { validateCdnUrl, sanitizeFilename } = require('../middleware/sanitize');
const { mergeLimiter } = require('../middleware/rateLimiter');
const { mergeStreams } = require('../services/ffmpeg');
const { verifyIdToken, getUserTier } = require('../services/firebase');
const logger = require('../utils/logger');

router.post('/', mergeLimiter, async (req, res) => {
  // --- Enforce Auth & Premium Tier ---
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const bodyToken = req.body.token || req.query.token || null;
  const token = headerToken || bodyToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  const tier = await getUserTier(decoded.uid, decoded.email);
  if (tier !== 'premium') {
    return res.status(403).json({ error: 'FFmpeg stream merging is a Premium-only feature. Please upgrade.' });
  }

  // --- Validate inputs ---
  let videoUrl, audioUrl;
  try {
    const rawVideoUrl = decodeURIComponent(req.body.videoUrl || '');
    const rawAudioUrl = decodeURIComponent(req.body.audioUrl || '');
    videoUrl = (await validateCdnUrl(rawVideoUrl)).href;
    audioUrl = (await validateCdnUrl(rawAudioUrl)).href;
  } catch (err) {
    return res.status(400).json({ error: `Invalid stream URL: ${err.message}` });
  }

  const filename = sanitizeFilename(req.body.filename || 'merged_video');

  logger.info(`[/api/merge] Starting merge: "${filename}"`);

  try {
    await mergeStreams(videoUrl, audioUrl, res, filename);
  } catch (err) {
    logger.error(`[/api/merge] Error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
