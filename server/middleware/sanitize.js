/**
 * URL & Input Sanitization Middleware
 * Protects against shell injection, path traversal, and SSRF attacks.
 */

const logger = require('../utils/logger');

// Strict allowlist of supported hostnames
const ALLOWED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'm.youtube.com',
  'music.youtube.com',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'instagram.com',
  'www.instagram.com',
  'tiktok.com',
  'www.tiktok.com',
  'vm.tiktok.com',
  'facebook.com',
  'www.facebook.com',
  'fb.watch',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
  'dailymotion.com',
  'www.dailymotion.com',
  'reddit.com',
  'www.reddit.com',
  'v.redd.it',
  'twitch.tv',
  'www.twitch.tv',
  'clips.twitch.tv',
  'soundcloud.com',
  'www.soundcloud.com',
  'bilibili.com',
  'www.bilibili.com',
  'nicovideo.jp',
  'www.nicovideo.jp',
  'rumble.com',
  'bitchute.com',
  'www.bitchute.com',
  'odysee.com',
  'www.odysee.com',
  'snapchat.com',
  'sc-cdn.net',
  'sc-cdn.com',
];

// Private/internal IP patterns — used for SSRF protection in both validators
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
];

const dns = require('dns').promises;

/**
 * Helper to check if an IP address string belongs to a private, loopback, or link-local range.
 */
function isPrivateIp(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return true;
  
  let normalized = ipStr.trim().toLowerCase();
  
  // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }
  
  return PRIVATE_IP_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Helper to resolve all IP addresses of a hostname and verify they are public.
 */
async function checkDnsAndIp(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error(`Connection to private IP ${addr.address} is forbidden.`);
      }
    }
  } catch (err) {
    if (err.message.includes('forbidden')) {
      throw err;
    }
    throw new Error(`Could not resolve hostname "${hostname}".`);
  }
}

/**
 * Validate and parse a user-supplied VIDEO PAGE URL (extract endpoint).
 * Enforces strict platform allowlist + SSRF protection.
 */
async function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL is required and must be a string.');
  }

  const trimmed = rawUrl.trim();

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('URL must use http or https protocol.');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Malformed URL — could not parse.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Enforce platform allowlist
  const isAllowed = ALLOWED_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith('.' + allowed)
  );
  if (!isAllowed) {
    throw new Error(
      'Unsupported platform. Supported: YouTube, Twitter/X, Instagram, TikTok, Facebook, Vimeo, Snapchat, Dailymotion, Reddit, Twitch, SoundCloud, Bilibili, and more.'
    );
  }

  // Resolve and verify IP address safety
  await checkDnsAndIp(hostname);

  return parsed;
}

/**
 * Validate a CDN/stream URL for the proxy and merge endpoints.
 * Enforces SSRF protection here (no allowlist).
 */
async function validateCdnUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Stream URL is required.');
  }

  const trimmed = rawUrl.trim();

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Stream URL must use http or https protocol.');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Malformed stream URL.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Resolve and verify IP address safety
  await checkDnsAndIp(hostname);

  return parsed;
}

/**
 * Sanitize a filename to prevent path traversal and injection.
 */
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'download';
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Windows-illegal chars
    .replace(/\.\./g, '_')                    // path traversal
    .replace(/^\.+/, '_')                     // leading dots
    .slice(0, 200);                           // length cap
}

/**
 * Express middleware — validates req.body.url for extraction endpoints.
 */
async function validateExtractRequest(req, res, next) {
  try {
    const parsed = await validateUrl(req.body?.url);
    req.validatedUrl = parsed.href; // normalized URL
    next();
  } catch (err) {
    logger.warn(`URL validation failed: ${err.message} | Input: ${req.body?.url}`);
    return res.status(400).json({ error: err.message });
  }
}

/**
 * Express middleware — validates POST body for proxy endpoints.
 */
async function validateProxyRequest(req, res, next) {
  try {
    const raw = req.body?.url || '';
    const parsed = await validateCdnUrl(raw);
    req.validatedUrl = parsed.href;
    
    const title = req.body?.title || 'download';
    const ext = req.body?.ext ? `.${req.body.ext}` : '';
    req.sanitizedFilename = sanitizeFilename(`${title}${ext}`);
    
    next();
  } catch (err) {
    logger.warn(`Proxy URL validation failed: ${err.message}`);
    return res.status(400).json({ error: err.message });
  }
}

module.exports = { validateUrl, validateCdnUrl, sanitizeFilename, validateExtractRequest, validateProxyRequest };
