/**
 * Enterprise Video Downloader — Express Server Entry Point
 *
 * Security stack: Helmet + CORS + rate limiting + input sanitization
 * Routes: /api/extract | /api/proxy-download | /api/merge | /api/stripe | /api/auth
 */

'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimiter');
const { initFirebase } = require('./services/firebase');
const { checkYtdlpAvailable, autoUpdateYtdlp } = require('./services/ytdlp');
const { checkFfmpegAvailable } = require('./services/ffmpeg');

// ── Route imports ──────────────────────────────────────────────────────────────
const extractRoute  = require('./routes/extract');
const downloadRoute = require('./routes/download');
const mergeRoute    = require('./routes/merge');
const razorpayRoute = require('./routes/razorpay');
const authRoute     = require('./routes/auth');

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust downstream proxy (GCR / Vercel load balancer)
app.set('trust proxy', 1);

// ── Security Headers (Helmet) ──────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",  // needed for inline script in SPA
          'https://www.gstatic.com',
          'https://apis.google.com',
          'https://accounts.google.com',
          'https://*.googleapis.com',
          'https://www.googleapis.com',
          'https://checkout.razorpay.com',
          'https://firebase.googleapis.com',
          'https://pagead2.googlesyndication.com',
          'https://*.googlesyndication.com',
          'https://adservice.google.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:  ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:   [
          "'self'", 
          'data:', 
          'https:', 
          'blob:',
          'https://pagead2.googlesyndication.com',
          'https://adservice.google.com',
          'https://*.doubleclick.net',
        ],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://firestore.googleapis.com',
          'https://www.googleapis.com',
          'https://accounts.google.com',
          'https://checkout.razorpay.com',
          'https://api.razorpay.com',
          'wss://*.firebaseio.com',
          'https://*.firebaseapp.com',
          'https://*.googlesyndication.com',
          'https://pagead2.googlesyndication.com',
          'https://adservice.google.com',
        ],
        frameSrc: [
          "'self'", 
          'https://api.razorpay.com', 
          'https://accounts.google.com', 
          'https://*.firebaseapp.com',
          'https://googleads.g.doubleclick.net',
          'https://*.doubleclick.net',
          'https://tpc.googlesyndication.com',
          'https://*.googlesyndication.com',
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false, // Allow media proxying
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow frontend on Firebase to trigger downloads from Cloud Run
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGIN || true
        : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Global Rate Limiter ────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Request logging ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
    logger[level](`${req.method} ${req.path} ${res.statusCode} ${ms}ms — ${req.ip}`);
  });
  next();
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoute);
app.use('/api/extract', extractRoute);
app.use('/api/download', downloadRoute);
app.use('/api/merge', mergeRoute);
app.use('/api/checkout', razorpayRoute);

// ── Thumbnail Proxy ────────────────────────────────────────────────────────────
// Proxies external thumbnail images to avoid CORS/CSP issues in the browser
app.get('/api/thumbnail', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).send('Missing url');

  let parsed;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
  } catch {
    return res.status(400).send('Invalid url');
  }

  // Block private IPs (basic SSRF guard)
  const hostname = parsed.hostname.toLowerCase();
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(hostname)) {
    return res.status(403).send('Forbidden');
  }

  const client = parsed.protocol === 'https:' ? require('https') : require('http');
  const proxyReq = client.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Click2VideoBot/1.0)',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    },
    timeout: 8000,
  }, (proxyRes) => {
    // Follow redirects once
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const nextUrl = new URL(proxyRes.headers.location, url).href;
      const redirectClient = nextUrl.startsWith('https') ? require('https') : require('http');
      return redirectClient.get(nextUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r2) => {
        res.setHeader('Content-Type', r2.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        r2.pipe(res);
      }).on('error', () => res.status(502).send('Proxy error'));
    }
    if (proxyRes.statusCode !== 200) return res.status(proxyRes.statusCode).send('Upstream error');
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => res.status(502).send('Proxy error'));
  proxyReq.on('timeout', () => { proxyReq.destroy(); res.status(504).send('Timeout'); });
  req.on('close', () => proxyReq.destroy());
});

// ── Config Endpoint ────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    env: process.env.NODE_ENV || 'development',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || null,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com` : null),
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app` : null),
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
      appId: process.env.FIREBASE_APP_ID || null,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || null,
    }
  });
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── Serve Static Frontend ──────────────────────────────────────────────────────
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: '1d',
    etag: true,
  })
);

// SPA fallback — serve index.html for any unmatched GET (Express 5 wildcard syntax)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Startup ────────────────────────────────────────────────────────────────────
async function startup() {
  // Initialize services
  initFirebase();

  // Check binary dependencies
  const [ytdlpVersion, ffmpegVersion] = await Promise.all([
    checkYtdlpAvailable(),
    checkFfmpegAvailable(),
  ]);

  if (ytdlpVersion) {
    logger.info(`✅ yt-dlp found: v${ytdlpVersion}`);
    // Auto-update yt-dlp in background to get latest YouTube bypass patches.
    // Non-blocking — server starts immediately, update happens in background.
    autoUpdateYtdlp().catch(() => {});
  } else {
    logger.warn('⚠️  yt-dlp NOT FOUND — install via: pip install yt-dlp');
    logger.warn('   Video extraction will fail until yt-dlp is installed.');
  }

  if (ffmpegVersion) {
    logger.info(`✅ FFmpeg found: ${ffmpegVersion}`);
  } else {
    logger.warn('⚠️  FFmpeg NOT FOUND — install from: https://ffmpeg.org/download.html');
    logger.warn('   Merged 4K downloads will fail until FFmpeg is installed.');
  }

  // Start server
  app.listen(PORT, () => {
    logger.info(`\n🚀 Video Downloader API running at http://localhost:${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   Open http://localhost:${PORT} in your browser\n`);
  });
}

startup().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});

module.exports = app;
