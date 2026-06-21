'use strict';
/**
 * Download API — Zero-Data-Storage Streaming Architecture
 *
 * POST /api/download         — Validates request/auth, re-extracts URLs, and generates a download session.
 * GET  /api/download/stream/:jobId — Streams the video directly from the host (or via FFmpeg pipe) to the client.
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
const ytdlp = require('../services/ytdlp');
const logger = require('../utils/logger');

const JOB_TTL_MS = 10 * 60 * 1000; // 10 min for session validity before starting stream

// ── In-memory session store ──────────────────────────────────────────────────
const downloadSessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of downloadSessions) {
    if (now - session.createdAt > JOB_TTL_MS) {
      downloadSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ── POST /api/download (Start Session) ────────────────────────────────────────
router.post('/', proxyLimiter, async (req, res) => {
  const { pageUrl, formatId, title, ext } = req.body;

  if (!pageUrl || typeof pageUrl !== 'string') {
    return res.status(400).json({ error: 'pageUrl is required.' });
  }
  if (!formatId || typeof formatId !== 'string') {
    return res.status(400).json({ error: 'formatId is required.' });
  }

  // Validate URL (SSRF, allowed platform check, format validation)
  let validatedPageUrl;
  try {
    const parsed = await validateUrl(pageUrl);
    validatedPageUrl = parsed.href;
  } catch (err) {
    logger.warn(`Download URL validation failed: ${err.message} | Input: ${pageUrl}`);
    return res.status(400).json({ error: err.message });
  }

  let actualFormatId = formatId;
  let extractAudio = false;

  if (formatId.endsWith('-audio')) {
    actualFormatId = formatId.replace('-audio', '');
    extractAudio = true;
  } else if (formatId.endsWith('-video')) {
    actualFormatId = formatId.replace('-video', '');
  }

  const isMerge = actualFormatId.includes('+');

  function isMergePremiumQuality(fmtId) {
    const PREMIUM_VIDEO_IDS = new Set(['137','248','216','270','271','272','313','315','400','401','264','266','308','394','395','396','397','398','399']);
    const videoPartId = fmtId.split('+')[0];
    return PREMIUM_VIDEO_IDS.has(videoPartId);
  }

  if (isMerge && isMergePremiumQuality(actualFormatId)) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let tier = 'free';

    if (token) {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        tier = await getUserTier(decoded.uid);
      }
    }

    if (tier !== 'premium') {
      return res.status(403).json({
        error: 'High-definition video merging is a Premium feature. Please upgrade to unlock.',
        upgradeRequired: true
      });
    }
  }

  let info;
  try {
    info = await ytdlp.extractInfo(validatedPageUrl);
  } catch (err) {
    logger.error(`[Download Session] Error extracting info: ${err.message}`);
    return res.status(422).json({ error: err.message });
  }

  let targetVideoUrl = null;
  let targetAudioUrl = null;

  if (isMerge) {
    const videoFmt = info.formats.videoOnly.find(f => f.format_id === actualFormatId);
    if (!videoFmt) {
      return res.status(422).json({ error: 'Requested video format not found' });
    }
    targetVideoUrl = videoFmt.url;
    
    if (info.formats.audioOnly.length > 0) {
      targetAudioUrl = info.formats.audioOnly.sort((a,b) => (b.bitrate||0) - (a.bitrate||0))[0].url;
    }
  } else if (extractAudio) {
    const audioFmt = info.formats.audioOnly.find(f => f.format_id === actualFormatId) || info.formats.audioOnly[0];
    if (audioFmt) targetAudioUrl = audioFmt.url;
  } else {
    const fmt = info.formats.combined.find(f => f.format_id === actualFormatId) || info.formats.videoOnly.find(f => f.format_id === actualFormatId);
    if (fmt) targetVideoUrl = fmt.url;
  }

  if (!targetVideoUrl && !targetAudioUrl) {
    return res.status(422).json({ error: 'Could not find stream URLs for the requested format.' });
  }

  const safeTitle = sanitizeFilename(title || 'download');
  const safeExt = extractAudio ? 'mp3' : (ext || 'mp4').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  const displayName = `${safeTitle}.${safeExt}`;
  const jobId = crypto.randomBytes(14).toString('hex');

  downloadSessions.set(jobId, {
    targetVideoUrl,
    targetAudioUrl,
    extractAudio,
    isMerge,
    displayName,
    createdAt: Date.now()
  });

  const downloadUrl = `/api/download/stream/${jobId}?filename=${encodeURIComponent(displayName)}`;
  res.json({ jobId, downloadUrl });
});

// ── GET /api/download/stream/:jobId ──────────────────────────────────────────
router.get('/stream/:jobId', (req, res) => {
  const session = downloadSessions.get(req.params.jobId);
  if (!session) {
    return res.status(404).send('Download session not found or expired.');
  }

  // Delete session to prevent reuse
  downloadSessions.delete(req.params.jobId);

  const safeAsciiName = session.displayName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
  const encodedName = encodeURIComponent(session.displayName);
  
  res.setHeader('Content-Disposition', `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`);
  // Use octet-stream to force download
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');

  logger.info(`[Download Stream] Starting stream for: ${session.displayName}`);

  // Scenario 1: Audio Extraction (requires FFmpeg transcoding to MP3)
  // Scenario 2: Video+Audio Merging (requires FFmpeg muxing)
  if (session.extractAudio || session.isMerge) {
    const FFMPEG_PATH = require('ffmpeg-static');
    const args = [];

    if (session.targetVideoUrl) {
      args.push('-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
      args.push('-i', session.targetVideoUrl);
    }
    
    if (session.targetAudioUrl) {
      args.push('-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
      args.push('-i', session.targetAudioUrl);
    }

    if (session.extractAudio) {
      args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3');
    } else {
      // Merge: copy codecs, use faststart/frag_keyframe for streaming MP4
      args.push('-c:v', 'copy', '-c:a', 'copy', '-strict', 'experimental', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4');
    }

    args.push('pipe:1'); // output to stdout

    const proc = spawn(FFMPEG_PATH, args, { shell: false });

    // Pipe FFmpeg stdout directly to response
    proc.stdout.pipe(res);

    proc.stderr.on('data', (chunk) => {
      // ffmpeg logs to stderr, just consume it so buffer doesn't fill up
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[Download Stream] FFmpeg exited with code ${code}`);
      }
      res.end();
    });

    req.on('close', () => {
      proc.kill('SIGKILL');
    });

  } else {
    // Scenario 3: Single stream (Combined format or Video-only). 
    // We can just pipe the HTTP response directly to the client without FFmpeg!
    const targetUrl = session.targetVideoUrl || session.targetAudioUrl;
    const client = targetUrl.startsWith('https') ? https : http;
    
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      }
    };

    const proxyReq = client.get(targetUrl, requestOptions, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        // Handle redirect
        const redirectUrl = proxyRes.headers.location;
        const redirectClient = redirectUrl.startsWith('https') ? https : http;
        redirectClient.get(redirectUrl, requestOptions, (redirectRes) => {
          if (redirectRes.headers['content-length']) res.setHeader('Content-Length', redirectRes.headers['content-length']);
          redirectRes.pipe(res);
        }).on('error', (err) => {
          logger.error(`[Download Stream] Redirect Error: ${err.message}`);
          res.end();
        });
        return;
      }

      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      logger.error(`[Download Stream] Proxy Error: ${err.message}`);
      res.end();
    });

    req.on('close', () => {
      proxyReq.destroy();
    });
  }
});

module.exports = router;
