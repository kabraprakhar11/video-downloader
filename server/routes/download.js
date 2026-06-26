'use strict';
/**
 * Download API
 *
 * POST /api/download          — Validates, re-extracts fresh URLs, stores session
 * GET  /api/download/stream/:jobId — Streams the video to browser (with FFmpeg for merges)
 */

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const { proxyLimiter } = require('../middleware/rateLimiter');
const { sanitizeFilename, validateUrl } = require('../middleware/sanitize');
const { verifyIdToken, getUserTier } = require('../services/firebase');
const { extractFormatUrl } = require('../services/ytdlp');
const logger = require('../utils/logger');

const JOB_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── In-memory session store ──────────────────────────────────────────────────
const downloadSessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of downloadSessions) {
    if (now - session.createdAt > JOB_TTL_MS) downloadSessions.delete(id);
  }
}, 5 * 60 * 1000);

// ── POST /api/download ────────────────────────────────────────────────────────
router.post('/', proxyLimiter, async (req, res) => {
  const { pageUrl, formatId, title, ext } = req.body;

  if (!pageUrl || typeof pageUrl !== 'string') {
    return res.status(400).json({ error: 'pageUrl is required.' });
  }
  if (!formatId || typeof formatId !== 'string') {
    return res.status(400).json({ error: 'formatId is required.' });
  }

  // Validate URL (SSRF protection)
  try {
    await validateUrl(pageUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Premium check for merge operations with HD formats
  const isMerge = formatId.includes('+');
  if (isMerge) {
    const PREMIUM_VIDEO_IDS = new Set(['137','248','216','270','271','272','313','315','400','401','264','266','308','394','395','396','397','398','399']);
    const videoPartId = formatId.split('+')[0];
    if (PREMIUM_VIDEO_IDS.has(videoPartId)) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      let tier = 'free';
      if (token) {
        const decoded = await verifyIdToken(token);
        if (decoded) tier = await getUserTier(decoded.uid, decoded.email);
      }
      if (tier !== 'premium') {
        return res.status(403).json({
          error: 'High-definition merging is a Premium feature. Please upgrade.',
          upgradeRequired: true,
        });
      }
    }
  }

  // Re-extract fresh stream URLs from the platform
  let streamInfo;
  try {
    streamInfo = await extractFormatUrl(pageUrl, formatId);
  } catch (err) {
    logger.error(`[Download] extractFormatUrl failed: ${err.message}`);
    return res.status(422).json({ error: err.message });
  }

  const safeTitle = sanitizeFilename(title || 'download');
  const safeExt = (ext || 'mp4').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  const displayName = `${safeTitle}.${safeExt}`;
  const jobId = crypto.randomBytes(14).toString('hex');

  downloadSessions.set(jobId, {
    ...streamInfo,
    formatId,
    jobId,
    pageUrl,
    displayName,
    createdAt: Date.now(),
  });

  const downloadUrl = `/api/download/stream/${jobId}?filename=${encodeURIComponent(displayName)}`;
  res.json({ jobId, downloadUrl });
});

// ── GET /api/download/stream/:jobId ──────────────────────────────────────────
router.get('/stream/:jobId', (req, res) => {
  const session = downloadSessions.get(req.params.jobId);
  if (!session) {
    return res.status(404).send('Download session not found or expired. Please try again.');
  }

  downloadSessions.delete(req.params.jobId);

  const safeAsciiName = session.displayName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
  const encodedName = encodeURIComponent(session.displayName);

  const setDownloadHeaders = (size) => {
    if (!res.headersSent) {
      res.setHeader('Content-Disposition', `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      if (size) res.setHeader('Content-Length', size);
    }
  };

  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const targetPath = path.join(os.tmpdir(), `${session.jobId}.mp4`);

  logger.info(`[Stream] yt-dlp disk download starting: ${session.displayName} format=${session.formatId}`);

  const args = [
    '-f', session.formatId,
    '--no-playlist',
    '--no-warnings',
    '--merge-output-format', 'mp4',
    '-o', targetPath
  ];

  if (process.env.YTDLP_PROXY) {
    args.push('--proxy', process.env.YTDLP_PROXY);
  }

  const cookiesPath = path.join(__dirname, '../../cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    args.push('--cookies', cookiesPath);
  }

  args.push(session.pageUrl);

  const proc = spawn('yt-dlp', args);
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d.toString(); });
  
  // Heartbeat to prevent Render 100s timeout if download takes a while?
  // We can't send headers early, so we just have to hope it finishes within 100s.
  // For most short videos, it takes < 10s.

  proc.on('close', code => {
    if (code !== 0 || !fs.existsSync(targetPath)) {
      logger.error(`[Stream] yt-dlp disk download failed code=${code}. Stderr: ${stderr}`);
      if (!res.headersSent) {
        return res.status(502).send(`Platform download error. yt-dlp exited with code ${code}.`);
      }
      return res.end();
    }

    try {
      const stat = fs.statSync(targetPath);
      setDownloadHeaders(stat.size);
      const readStream = fs.createReadStream(targetPath);
      readStream.pipe(res);
      readStream.on('end', () => {
        try { fs.unlinkSync(targetPath); } catch (_) {}
      });
      readStream.on('error', () => {
        try { fs.unlinkSync(targetPath); res.end(); } catch (_) {}
      });
    } catch (err) {
      logger.error(`[Stream] Error piping file: ${err.message}`);
      try { res.end(); } catch (_) {}
    }
  });

  req.on('close', () => {
    proc.kill('SIGKILL');
    setTimeout(() => {
      try { if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath); } catch (_) {}
    }, 2000);
  });
});

module.exports = router;
