/**
 * URL & Input Sanitization Middleware
 * Protects against shell injection, path traversal, and SSRF attacks.
 *
 * NOTE: We do NOT maintain a platform allowlist here.
 * yt-dlp supports 1500+ websites and is the authoritative gatekeeper.
 * If a URL is unsupported, yt-dlp will return a clear "Unsupported URL" error.
 * We only block SSRF (private/internal network access) here.
 */

const logger = require('../utils/logger');
const dns = require('dns').promises;

// Explicitly blocked platforms
// DRM services blocked as they are technically impossible to support)
const BLOCKED_HOSTS = [
  'netflix.com', 'www.netflix.com',
  'hulu.com', 'www.hulu.com',
  'disneyplus.com', 'www.disneyplus.com',
  'primevideo.com', 'www.primevideo.com',
  'crunchyroll.com', 'www.crunchyroll.com',
  'onlyfans.com', 'www.onlyfans.com',
];

const BLOCKED_MESSAGES = {
  'netflix.com': 'Netflix uses DRM encryption and cannot be downloaded.',
  'hulu.com': 'Hulu uses DRM encryption and cannot be downloaded.',
  'disneyplus.com': 'Disney+ uses DRM encryption and cannot be downloaded.',
  'primevideo.com': 'Amazon Prime Video uses DRM encryption and cannot be downloaded.',
  'crunchyroll.com': 'Crunchyroll uses DRM encryption and cannot be downloaded.',
  'onlyfans.com': 'OnlyFans requires an active paid login session and cannot be downloaded.',
};

// Private/internal IP patterns — SSRF protection
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
  /^100\.64\./,  // CGNAT shared address space
  /^198\.51\.100\./,  // TEST-NET-2
  /^203\.0\.113\./,   // TEST-NET-3
];

/**
 * Check if an IP address is private/internal.
 */
function isPrivateIp(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return true;
  let normalized = ipStr.trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) normalized = normalized.slice(7);
  return PRIVATE_IP_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Resolve all IP addresses for a hostname and verify they are all public.
 */
async function checkDnsAndIp(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error(`Connection to private IP ${addr.address} is forbidden (SSRF protection).`);
      }
    }
  } catch (err) {
    if (err.message.includes('forbidden')) throw err;
    // DNS resolution failure — allow it through so yt-dlp can give a better error
    logger.warn(`[sanitize] DNS lookup failed for "${hostname}": ${err.message}`);
  }
}

/**
 * Validate a user-supplied video page URL.
 * - Checks http/https protocol
 * - Blocks explicitly unsupported platforms with helpful messages
 * - Performs SSRF protection via DNS check
 * - Does NOT maintain a platform allowlist — yt-dlp handles that
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

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  // Check blocked hosts
  const blockedKey = Object.keys(BLOCKED_MESSAGES).find(
    (h) => hostname === h.replace(/^www\./, '') || hostname.endsWith('.' + h.replace(/^www\./, ''))
  );
  if (blockedKey) {
    throw new Error(BLOCKED_MESSAGES[blockedKey]);
  }

  // SSRF protection
  await checkDnsAndIp(parsed.hostname);

  return parsed;
}

/**
 * Validate a CDN/stream URL for proxy and merge endpoints.
 * Only enforces SSRF protection (no platform restrictions needed here).
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

  await checkDnsAndIp(parsed.hostname);

  return parsed;
}

/**
 * Sanitize a filename to prevent path traversal and shell injection.
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
    req.validatedUrl = parsed.href;
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
