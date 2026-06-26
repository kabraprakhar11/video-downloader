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

  res.setHeader('Content-Disposition', `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');

  logger.info(`[Stream] Starting: ${session.displayName} | merge=${session.isMerge} | video=${!!session.videoUrl} | audio=${!!session.audioUrl}`);

  const buildHeadersArg = (headersObj) => {
    let headersStr = '';
    const referer = headersObj?.['Referer'] || headersObj?.['referer'] || session.pageUrl || '';
    if (referer) headersStr += `Referer: ${referer}\r\n`;
    if (headersObj) {
      for (const [k, v] of Object.entries(headersObj)) {
        if (k.toLowerCase() !== 'referer' && k.toLowerCase() !== 'user-agent') {
          headersStr += `${k}: ${v}\r\n`;
        }
      }
    }
    return headersStr ? ['-headers', headersStr] : [];
  };

  const getUserAgent = (headersObj) => {
    return headersObj?.['User-Agent'] || headersObj?.['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  };

  const buildProxyArgs = () => {
    return process.env.YTDLP_PROXY ? ['-http_proxy', process.env.YTDLP_PROXY] : [];
  };

  // ── FFmpeg merge (video + audio separate streams) ─────────────────────────
  if (session.isMerge && session.videoUrl && session.audioUrl) {
    const FFMPEG_PATH = require('ffmpeg-static');
    const args = [
      '-user_agent', getUserAgent(session.videoHeaders),
      ...buildHeadersArg(session.videoHeaders),
      ...buildProxyArgs(),
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
      '-i', session.videoUrl,
      '-user_agent', getUserAgent(session.audioHeaders),
      ...buildHeadersArg(session.audioHeaders),
      ...buildProxyArgs(),
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
      '-i', session.audioUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      'pipe:1',
    ];
    const proc = spawn(FFMPEG_PATH, args);
    proc.stdout.pipe(res);
    let ffmpegStderr = '';
    proc.stderr.on('data', d => { ffmpegStderr += d.toString(); }); // capture stderr
    proc.on('close', code => {
      if (code !== 0) logger.error(`[Stream] FFmpeg exited code=${code}. Stderr: ${ffmpegStderr}`);
      try { res.end(); } catch (_) {}
    });
    req.on('close', () => proc.kill('SIGKILL'));
    return;
  }

  // ── Audio-only extraction via FFmpeg ─────────────────────────────────────
  if (session.audioUrl && !session.videoUrl) {
    const FFMPEG_PATH = require('ffmpeg-static');
    const args = [
      '-user_agent', getUserAgent(session.headers),
      ...buildHeadersArg(session.headers),
      ...buildProxyArgs(),
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
      '-i', session.audioUrl,
      '-vn',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      '-f', 'mp3',
      'pipe:1',
    ];
    const proc = spawn(FFMPEG_PATH, args);
    proc.stdout.pipe(res);
    proc.stderr.on('data', () => {});
    proc.on('close', () => { try { res.end(); } catch (_) {} });
    req.on('close', () => proc.kill('SIGKILL'));
    return;
  }

  // ── Direct stream proxy (combined format) ─────────────────────────────────
  const targetUrl = session.videoUrl || session.audioUrl;
  if (!targetUrl) {
    return res.status(422).send('No stream URL available.');
  }

  if (targetUrl.includes('.m3u8') || targetUrl.includes('.mpd') || targetUrl.includes('m3u8')) {
    const FFMPEG_PATH = require('ffmpeg-static');
    const args = [
      '-user_agent', getUserAgent(session.headers),
      ...buildHeadersArg(session.headers),
      ...buildProxyArgs(),
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
      '-i', targetUrl,
      '-c', 'copy',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      'pipe:1',
    ];
    const proc = spawn(FFMPEG_PATH, args);
    proc.stdout.pipe(res);
    let ffmpegStderr = '';
    proc.stderr.on('data', d => { ffmpegStderr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) logger.error(`[Stream] FFmpeg (m3u8) exited code=${code}. Stderr: ${ffmpegStderr}`);
      try { res.end(); } catch (_) {}
    });
    req.on('close', () => proc.kill('SIGKILL'));
    return;
  }

  function proxyStream(url, depth = 0) {
    if (depth > 3) {
      logger.error('[Stream] Too many redirects');
      return res.status(502).send('Too many redirects from platform.');
    }

    const client = url.startsWith('https') ? https : http;
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    const reqHeaders = {
      'User-Agent': getUserAgent(session.headers),
      'Accept': '*/*',
      'Referer': session.headers?.['Referer'] || session.headers?.['referer'] || session.pageUrl || url,
      ...(session.headers || {})
    };

    const reqOptions = {
      headers: reqHeaders,
      timeout: 30000,
    };
    if (process.env.YTDLP_PROXY) {
      reqOptions.agent = new HttpsProxyAgent(process.env.YTDLP_PROXY);
    }

    const proxyReq = client.get(url, reqOptions, (proxyRes) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        proxyRes.resume();
        const nextUrl = new URL(proxyRes.headers.location, url).href;
        return proxyStream(nextUrl, depth + 1);
      }

      if (proxyRes.statusCode !== 200) {
        logger.error(`[Stream] Upstream returned ${proxyRes.statusCode}`);
        proxyRes.resume();
        return res.status(502).send(`Platform returned error ${proxyRes.statusCode}.`);
      }

      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }

      proxyRes.pipe(res);
      proxyRes.on('error', (err) => {
        logger.error(`[Stream] Proxy read error: ${err.message}`);
        try { res.end(); } catch (_) {}
      });
    });

    proxyReq.on('error', (err) => {
      logger.error(`[Stream] Proxy request error: ${err.message}`);
      try { res.status(502).send('Stream proxy error.'); } catch (_) {}
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      try { res.status(504).send('Stream timeout.'); } catch (_) {}
    });

    req.on('close', () => proxyReq.destroy());
  }

  proxyStream(targetUrl);
});

module.exports = router;
