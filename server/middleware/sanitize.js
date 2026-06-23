/**
 * URL & Input Sanitization Middleware
 * Protects against shell injection, path traversal, and SSRF attacks.
 */

const logger = require('../utils/logger');

// Strict allowlist of supported hostnames
// Covers all major yt-dlp supported platforms — keep SSRF protection via DNS check below
const ALLOWED_HOSTS = [
  // ── Social Media ──────────────────────────────────────────────────────────
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
  'instagram.com', 'www.instagram.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com',
  'facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com',
  'reddit.com', 'www.reddit.com', 'v.redd.it', 'old.reddit.com',
  'snapchat.com', 'www.snapchat.com',
  'pinterest.com', 'www.pinterest.com', 'pin.it',
  'tumblr.com', 'www.tumblr.com',
  'linkedin.com', 'www.linkedin.com',
  'bluesky.app', 'bsky.app',

  // ── Video Platforms ───────────────────────────────────────────────────────
  'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com',
  'vimeo.com', 'www.vimeo.com', 'player.vimeo.com',
  'dailymotion.com', 'www.dailymotion.com',
  'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv', 'vod-secure.twitch.tv',
  'rumble.com', 'www.rumble.com',
  'bitchute.com', 'www.bitchute.com',
  'odysee.com', 'www.odysee.com',
  'kick.com', 'www.kick.com',
  'streamable.com', 'www.streamable.com',
  'loom.com', 'www.loom.com',
  'brightcove.com', 'players.brightcove.net',

  // ── Music / Podcast ───────────────────────────────────────────────────────
  'soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com',
  'bandcamp.com', 'www.bandcamp.com',
  'audiomack.com', 'www.audiomack.com',
  'mixcloud.com', 'www.mixcloud.com',
  'deezer.com', 'www.deezer.com',
  'open.spotify.com',
  'podcasts.apple.com',
  'music.apple.com',

  // ── News / Media ──────────────────────────────────────────────────────────
  'bbc.com', 'www.bbc.com', 'bbc.co.uk', 'www.bbc.co.uk',
  'cnn.com', 'www.cnn.com', 'edition.cnn.com',
  'nbcnews.com', 'www.nbcnews.com',
  'abcnews.go.com',
  'cbsnews.com', 'www.cbsnews.com',
  'foxnews.com', 'www.foxnews.com',
  'aljazeera.com', 'www.aljazeera.com',
  'reuters.com', 'www.reuters.com',
  'bloomberg.com', 'www.bloomberg.com',
  'theguardian.com', 'www.theguardian.com',
  'huffpost.com', 'www.huffpost.com',
  'businessinsider.com', 'www.businessinsider.com',
  'washingtonpost.com', 'www.washingtonpost.com',
  'nytimes.com', 'www.nytimes.com',
  'npr.org', 'www.npr.org',
  'pbs.org', 'www.pbs.org',
  'rt.com', 'www.rt.com',
  'ruptly.tv', 'www.ruptly.tv',
  'democracynow.org', 'www.democracynow.org',

  // ── East Asia ─────────────────────────────────────────────────────────────
  'bilibili.com', 'www.bilibili.com', 'space.bilibili.com', 'live.bilibili.com',
  'nicovideo.jp', 'www.nicovideo.jp',
  'niconico.jp',
  'youku.com', 'www.youku.com',
  'iqiyi.com', 'www.iqiyi.com',
  'v.qq.com',
  'douyin.com', 'www.douyin.com',
  'kuaishou.com', 'www.kuaishou.com',
  'xiaohongshu.com', 'www.xiaohongshu.com',
  'xigua.com', 'www.xigua.com',
  'afreecatv.com', 'www.afreecatv.com',
  'tv.kakao.com',
  'naver.com', 'tv.naver.com',
  'abema.tv',
  'tver.jp',

  // ── Russia / Eastern Europe ───────────────────────────────────────────────
  'vk.com', 'www.vk.com', 'vkvideo.ru',
  'rutube.ru', 'www.rutube.ru',
  'dzen.ru', 'www.dzen.ru',
  'ok.ru', 'www.ok.ru',
  'coub.com', 'www.coub.com',

  // ── Indian Platforms ──────────────────────────────────────────────────────
  'hotstar.com', 'www.hotstar.com',
  'sonyliv.com', 'www.sonyliv.com',
  'zee5.com', 'www.zee5.com',
  'jiosaavn.com', 'www.jiosaavn.com',
  'hungama.com', 'www.hungama.com',

  // ── Misc / Alt Tech ───────────────────────────────────────────────────────
  '9gag.com', 'www.9gag.com',
  'imgur.com', 'www.imgur.com', 'i.imgur.com',
  'giphy.com', 'www.giphy.com',
  'gfycat.com', 'www.gfycat.com',
  'redgifs.com', 'www.redgifs.com',
  'worldstarhiphop.com', 'www.worldstarhiphop.com',
  'archive.org', 'www.archive.org',
  'ted.com', 'www.ted.com',
  'masterclass.com', 'www.masterclass.com',
  'udemy.com', 'www.udemy.com',
  'coursera.org', 'www.coursera.org',
  'khanacademy.org', 'www.khanacademy.org',
  'peertube.social',
  'peertube.tv',
  'veoh.com', 'www.veoh.com',
  'metacafe.com', 'www.metacafe.com',
  'break.com',
  'crackle.com',
  'tubi.tv', 'www.tubi.tv',
  'pluto.tv',
  'dropout.tv',
  'nebula.tv',
  'curiositystream.com',
  'mubi.com',
  'kanopy.com',
  'screen.yahoo.com',
  'news.yahoo.com',
  'sports.yahoo.com',
  'espn.com', 'www.espn.com',
  'nfl.com', 'www.nfl.com',
  'nba.com', 'www.nba.com',
  'nhl.com', 'www.nhl.com',
  'mlb.com', 'www.mlb.com',
  'formula1.com', 'www.formula1.com',
  'wwe.com', 'www.wwe.com',
  'globo.com', 'www.globo.com', 'globoplay.globo.com',
  'rtve.es', 'www.rtve.es',
  'zdf.de', 'www.zdf.de',
  'ard.de', 'www.ard.de',
  'rai.it', 'www.rai.it', 'raiplay.rai.it',
  'canal-plus.com', 'www.canal-plus.com',
  'france.tv', 'www.france.tv',
  'arte.tv', 'www.arte.tv',
  'streamja.com',
  'streamff.com',
  'streamwo.com',
  'clippituser.tv',
  'liveleak.com', 'www.liveleak.com',
  'metatube.com',
  'videa.hu',
  'veoh.com',
  'wimp.com',
  'funnyordie.com',
  'collegehumor.com',
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
