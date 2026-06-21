const rateLimit = require('express-rate-limit');

// ── Global limiter ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please wait 15 minutes and try again.',
  },
});

// ── Extract endpoint (yt-dlp spawn) — tighter limit ───────────────────────────
const extractLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Extraction rate limit exceeded. Please slow down (max 12 requests/min).',
  },
});

// ── Merge endpoint (FFmpeg — CPU intensive) ────────────────────────────────────
const mergeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Merge rate limit exceeded. Please wait before requesting another merge.',
  },
});

// ── Proxy endpoint ─────────────────────────────────────────────────────────────
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Download rate limit exceeded. Please wait a moment.',
  },
});

// ── Stripe webhook ─────────────────────────────────────────────────────────────
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, extractLimiter, mergeLimiter, proxyLimiter, webhookLimiter };
