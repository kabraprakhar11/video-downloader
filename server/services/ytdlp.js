const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ALLOWED_EXTRACTORS = require('../utils/allowedExtractors');
const proxyManager = require('./proxy-manager');

const YTDLP_BIN = 'yt-dlp';

// ─── Quality helpers ──────────────────────────────────────────────────────────
function getQualityTier(width, height) {
  let minDim = height;
  if (width && height) minDim = Math.min(width, height);
  
  if (!minDim) return 'SD';
  if (minDim >= 2160) return '4K';
  if (minDim >= 1440) return '2K';
  if (minDim >= 1080) return 'FHD';
  if (minDim >= 720)  return 'HD';
  return 'SD';
}

function humanFilesize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Write Instagram cookies from env var to temp file ───────────────────────
let _instaCookiesPath = null;
function getInstagramCookiesPath() {
  // Support INSTAGRAM_COOKIES env var (Netscape cookie format string)
  if (process.env.INSTAGRAM_COOKIES && !_instaCookiesPath) {
    const tmpPath = path.join(__dirname, '../../.instagram_cookies.txt');
    fs.writeFileSync(tmpPath, process.env.INSTAGRAM_COOKIES, 'utf8');
    _instaCookiesPath = tmpPath;
    logger.info('[cookies] Instagram cookies loaded from INSTAGRAM_COOKIES env var');
  }
  // Fallback to cookies.txt if it exists
  const globalCookies = path.join(__dirname, '../../cookies.txt');
  if (fs.existsSync(globalCookies)) return globalCookies;
  return _instaCookiesPath;
}

// ─── yt-dlp args builder ──────────────────────────────────────────────────────
function buildYtdlpArgs(url, proxyUrl = null) {
  const isInstagram = /instagram\.com|instagr\.am/i.test(url);

  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--age-limit', '99',         // bypass age-gate checks
    '--socket-timeout', '30',
    '--retries', '3',
  ];

  if (isInstagram) {
    // Instagram-specific: try multiple API endpoints, no impersonation conflicts
    args.push(
      '--extractor-args', 'instagram:api=1',
      '--add-header', 'User-Agent:Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
    );
  } else {
    args.push(
      '--impersonate', 'chrome',
      '--extractor-args', 'youtube:player_client=android,web',
    );
  }

  // Inject cookies (global cookies.txt or Instagram-specific env cookies)
  const cookiesPath = getInstagramCookiesPath();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  // Proxy
  if (proxyUrl) {
    args.push('--proxy', proxyUrl);
  } else if (process.env.YTDLP_PROXY) {
    args.push('--proxy', process.env.YTDLP_PROXY);
  }

  args.push(url);
  return args;
}

// ─── Parse raw yt-dlp JSON into our format structure ──────────────────────────
function parseFormats(raw, url) {
  const result = {
    title: raw.title || 'Unknown Title',
    thumbnail: raw.thumbnail || (raw.thumbnails && raw.thumbnails.length > 0 ? raw.thumbnails[raw.thumbnails.length - 1].url : ''),
    duration: raw.duration || 0,
    durationFormatted: formatDuration(raw.duration),
    extractor: raw.extractor_key || raw.extractor || 'unknown',
    uploader: raw.uploader || raw.channel || raw.creator || '',
    viewCount: raw.view_count || null,
    description: (raw.description || '').slice(0, 300),
    webpage_url: raw.webpage_url || url,
    formats: { combined: [], videoOnly: [], audioOnly: [] },
    bestAudio: null,
  };

  const rawFormats = raw.formats || [];

  // If no formats array, treat the single URL as a combined format
  if (rawFormats.length === 0 && raw.url) {
    const obj = {
      formatId: 'default',
      format_id: 'default',
      ext: raw.ext || 'mp4',
      resolution: raw.resolution || (raw.height ? `${raw.height}p` : 'unknown'),
      filesize: raw.filesize || raw.filesize_approx || null,
      filesizeHuman: humanFilesize(raw.filesize || raw.filesize_approx),
      vcodec: 'unknown',
      acodec: 'unknown',
      fps: raw.fps || null,
      abr: null,
      tbr: raw.tbr || null,
      height: raw.height || null,
      width: raw.width || null,
      qualityTier: getQualityTier(raw.width, raw.height),
      isPremiumOnly: false,
      type: 'combined',
      url: raw.url,
    };
    result.formats.combined.push(obj);
    return result;
  }

  rawFormats.forEach(f => {
    if (!f.url) return; // Skip formats with no direct URL

    const vcodec = (f.vcodec || '').toLowerCase().trim();
    const acodec = (f.acodec || '').toLowerCase().trim();

    // Determine what streams this format contains
    const hasVideoCodec  = vcodec && vcodec !== 'none';
    const hasAudioCodec  = acodec && acodec !== 'none';
    const hasHeight      = f.height > 0;
    const hasWidth       = f.width > 0;
    const hasFps         = f.fps > 0;
    const hasAbr         = f.abr > 0;

    const isVideoStream = hasVideoCodec || hasHeight || hasWidth || hasFps;
    const isAudioStream = hasAudioCodec || hasAbr;

    // Explicitly audio-only: codec says video is none, or no video dimensions at all, or string match
    const isExplicitAudioOnly = (vcodec === 'none' && isAudioStream) || (f.resolution === 'audio only') || (f.format_note && f.format_note.toLowerCase().includes('audio'));
    // Explicitly video-only: codec says audio is none AND no audio bitrate
    const isExplicitVideoOnly = acodec === 'none' && !hasAbr && isVideoStream;

    const height = f.height || null;
    const width = f.width || null;
    const qualityTier = isExplicitAudioOnly ? 'audio' : getQualityTier(width, height);
    const isPremiumOnly = ['4K', '2K', 'FHD'].includes(qualityTier);
    const filesize = f.filesize || f.filesize_approx || null;

    const obj = {
      formatId: String(f.format_id || f.id || f.ext || 'default'),
      format_id: String(f.format_id || f.id || f.ext || 'default'),
      ext: f.ext || 'mp4',
      resolution: f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : (height ? `${height}p` : 'unknown')),
      filesize,
      filesizeHuman: humanFilesize(filesize),
      vcodec,
      acodec,
      fps: f.fps || null,
      abr: f.abr || null,
      tbr: f.tbr || null,
      height,
      width: f.width || null,
      qualityTier,
      isPremiumOnly,
      type: isExplicitAudioOnly ? 'audio-only' : (isExplicitVideoOnly ? 'video-only' : 'combined'),
      url: f.url,
    };

    if (isExplicitAudioOnly) {
      result.formats.audioOnly.push(obj);
    } else if (isExplicitVideoOnly) {
      result.formats.videoOnly.push(obj);
    } else if (isVideoStream) {
      // Everything with video goes to combined — most platforms mux audio+video
      result.formats.combined.push(obj);
    } else if (isAudioStream) {
      result.formats.audioOnly.push(obj);
    } else {
      // Fallback for formats with no codec metadata (like Snapchat)
      result.formats.combined.push(obj);
    }
  });

  // ── Pick bestAudio for merge operations ───────────────────────────────────
  if (result.formats.audioOnly.length > 0) {
    result.bestAudio = result.formats.audioOnly
      .slice()
      .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))[0];
  } else if (result.formats.combined.length > 0) {
    // Use a combined format as audio source if no dedicated audio
    result.bestAudio = result.formats.combined[0];
  }

  // ── Synthesize combined formats if none exist natively ────────────────────
  if (result.formats.combined.length === 0 && result.formats.videoOnly.length > 0) {
    if (result.bestAudio) {
      // Platform has separate video and audio, synthesize merged formats
      result.formats.videoOnly.forEach(v => {
        result.formats.combined.push({
          ...v,
          formatId: `${v.formatId}+${result.bestAudio.formatId}`,
          format_id: `${v.format_id}+${result.bestAudio.format_id}`,
          acodec: result.bestAudio.acodec || 'unknown',
          filesize: (v.filesize && result.bestAudio.filesize) ? (v.filesize + result.bestAudio.filesize) : null,
          filesizeHuman: humanFilesize((v.filesize || 0) + (result.bestAudio.filesize || 0)),
          type: 'combined'
        });
      });
      // We explicitly leave result.formats.videoOnly intact so the "Video Only" tab still works!
    } else {
      // Silent video (no audio exists on the platform)
      // Mirror video-only into combined so the default tab isn't empty, but label it clearly as video-only
      result.formats.videoOnly.forEach(v => {
        result.formats.combined.push({ ...v, type: 'video-only' });
      });
    }
  }

  // ── Deduplicate combined formats by resolution ─────────────────────────────
  const seen = new Set();
  result.formats.combined = result.formats.combined.filter(f => {
    const key = `${f.resolution}-${f.ext}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Flag if HD formats exist (for merge notice) ────────────────────────────
  result.hasHDFormats = result.formats.videoOnly.some(f => ['FHD', '2K', '4K'].includes(f.qualityTier));

  // ── Ensure at least one free format exists if possible ─────────────────────
  const totalCombined = result.formats.combined.length;
  const totalVideoOnly = result.formats.videoOnly.length;
  if (totalCombined === 1 && totalVideoOnly === 0) {
    result.formats.combined[0].isPremiumOnly = false;
  } else if (totalCombined === 0 && totalVideoOnly === 1) {
    result.formats.videoOnly[0].isPremiumOnly = false;
  }

  return result;
}

// ─── Run yt-dlp ───────────────────────────────────────────────────────────────
function runYtdlp(url, proxyUrl = null) {
  return new Promise((resolve, reject) => {
    const args = buildYtdlpArgs(url, proxyUrl);
    logger.info(`[yt-dlp] Running extraction for: ${url} ${proxyUrl ? '(using proxy)' : ''}`);
    const proc = spawn(YTDLP_BIN, args);
    let stdout = '', stderr = '';
    proc.stdout.on('data', c => { stdout += c; });
    proc.stderr.on('data', c => { stderr += c; });
    proc.on('close', code => {
      if (code !== 0) {
        logger.warn(`[yt-dlp] Failed (code=${code}): ${stderr.slice(0, 300)}`);
        return reject({ code, stderr });
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject({ code: -1, stderr: `JSON parse error: ${e.message}` });
      }
    });
    proc.on('error', err => reject({ code: -1, stderr: err.message }));
  });
}

// ─── Cache to prevent HTTP 429 on rapid re-extractions ───────────────────────
const extractionCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Main extraction function ─────────────────────────────────────────────────
async function getBilibiliVideo(url) {
  let bvid = '';
  const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
  if (match) {
    bvid = match[1];
  } else if (url.includes('b23.tv')) {
    const res = await fetch(url, { redirect: 'manual' });
    const location = res.headers.get('location');
    if (location) {
      const m = location.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
      if (m) bvid = m[1];
    }
  }

  if (!bvid) throw new Error('Could not find Bilibili BVID from URL.');

  const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  const viewData = await viewRes.json();
  if (viewData.code !== 0) throw new Error(`Bilibili API error: ${viewData.message}`);
  
  const cid = viewData.data.cid;
  const title = viewData.data.title;
  const thumbnail = viewData.data.pic;
  const duration = viewData.data.duration;
  const uploader = viewData.data.owner ? viewData.data.owner.name : 'Bilibili';

  const playRes = await fetch(`https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80&otype=json`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.bilibili.com/'
    }
  });
  const playData = await playRes.json();
  if (playData.code !== 0) throw new Error(`Bilibili PlayURL error: ${playData.message}`);
  
  const videoUrl = playData.data.durl[0].url;
  const quality = playData.data.quality === 80 ? '1080p' : (playData.data.quality === 64 ? '720p' : (playData.data.quality === 32 ? '480p' : '360p'));
  const filesize = playData.data.durl[0].size;

  return {
    title: title,
    thumbnail: thumbnail,
    duration: duration,
    durationFormatted: formatDuration(duration),
    extractor: 'bilibili',
    uploader: uploader,
    viewCount: viewData.data.stat ? viewData.data.stat.view : null,
    description: (viewData.data.desc || '').slice(0, 300),
    webpage_url: url,
    formats: {
      combined: [{
        formatId: 'default',
        format_id: 'default',
        ext: 'mp4',
        resolution: quality,
        filesize: filesize,
        filesizeHuman: humanFilesize(filesize),
        vcodec: 'h264',
        acodec: 'aac',
        fps: null,
        abr: null,
        tbr: null,
        height: parseInt(quality.replace('p', '')) || 480,
        width: null,
        qualityTier: getQualityTier(null, parseInt(quality.replace('p', '')) || 480),
        isPremiumOnly: false,
        type: 'combined',
        url: videoUrl,
        headers: { 'Referer': 'https://www.bilibili.com/' }
      }],
      videoOnly: [],
      audioOnly: []
    },
    bestAudio: null,
    hasHDFormats: false
  };
}

async function extractInfo(url) {
  logger.info(`[extract] Starting for: ${url}`);

  const urlLower = url.toLowerCase();

  if (urlLower.includes('bilibili.com') || urlLower.includes('b23.tv')) {
    try {
      return await getBilibiliVideo(url);
    } catch (err) {
      logger.warn(`[getBilibiliVideo] Custom extractor failed: ${err.message}. Falling back to yt-dlp.`);
    }
  }
  let raw;
  try {
    raw = await runYtdlp(url);
  } catch (err) {
    const stderr = err.stderr || '';
    const isInstagram = /instagram\.com|instagr\.am/i.test(url);
    
    // ── Instagram-specific handling ──────────────────────────────────────────
    if (isInstagram) {
      const needsAuth = stderr.includes('empty media response') ||
                        stderr.includes('certain audiences') ||
                        stderr.includes('login') ||
                        stderr.includes('Login required') ||
                        stderr.includes('age') ||
                        stderr.includes('checkpoint');

      if (needsAuth) {
        // Try with proxy first (helps with geo-restrictions)
        logger.warn(`[extract] Instagram auth/age issue. Trying proxy fallover...`);
        const proxies = await proxyManager.getProxyBatch();
        let proxySuccess = false;
        for (let i = 0; i < proxies.length; i++) {
          try {
            raw = await runYtdlp(url, proxies[i]);
            proxySuccess = true;
            break;
          } catch (proxyErr) {
            logger.warn(`[extract] Instagram proxy ${i + 1} failed: ${(proxyErr.stderr || '').slice(0, 80)}`);
          }
        }
        if (!proxySuccess) {
          if (stderr.includes('certain audiences') || stderr.includes('age')) {
            throw new Error('This Instagram post is age-restricted (18+). To download it, add your Instagram account cookies to the server via the INSTAGRAM_COOKIES environment variable.');
          }
          throw new Error('Instagram requires a logged-in session to access this content. The post may be from a private account, age-restricted, or recently made login-only by Instagram.');
        }
      } else {
        // Non-auth Instagram error
        throw new Error(`Could not extract Instagram video. ${stderr.slice(0, 150)}`);
      }
    }
    // ── Standard proxy failover for other platforms ─────────────────────────
    else {
      const needsProxy = stderr.includes('HTTP Error 429') || 
                         stderr.includes('Bot detection') || 
                         stderr.includes('Sign in') || 
                         stderr.includes('HTTP Error 403') ||
                         stderr.includes('HTTP Error 401');
      
      if (needsProxy) {
        logger.warn(`[extract] Rate limit / block detected for ${url}. Attempting proxy failover...`);
        const proxies = await proxyManager.getProxyBatch();
        
        let proxySuccess = false;
        for (let i = 0; i < proxies.length; i++) {
          try {
            logger.info(`[extract] Trying proxy ${i + 1}/${proxies.length}...`);
            raw = await runYtdlp(url, proxies[i]);
            proxySuccess = true;
            break;
          } catch (proxyErr) {
            logger.warn(`[extract] Proxy ${i + 1} failed: ${(proxyErr.stderr || '').slice(0, 80)}`);
          }
        }
        
        if (!proxySuccess) {
          throw new Error('Access denied by the platform, and all proxy fallback attempts failed. The video may be private, age-restricted, or actively blocking datacenter IPs.');
        }
      } else {
        // Standard Errors (not fixable by proxy)
        if (stderr.includes('Unsupported URL')) {
          throw new Error('This website is not supported. Please try a different platform.');
        }
        if (stderr.includes('Video unavailable') || stderr.includes('Private video')) {
          throw new Error('This video is private or unavailable.');
        }
        if (stderr.includes('HTTP Error 404')) {
          throw new Error('Video not found. The link may be broken or the video may have been deleted.');
        }
        throw new Error(`Could not extract video information. ${stderr.slice(0, 150)}`);
      }
    }
  }

  // Cache successful extraction
  extractionCache.set(urlLower, { data: raw, timestamp: Date.now() });
  
  // Cleanup old cache entries
  for (const [key, val] of extractionCache.entries()) {
    if (Date.now() - val.timestamp > CACHE_TTL_MS) extractionCache.delete(key);
  }

  const extractor = (raw.extractor_key || raw.extractor || '').toLowerCase();
  
  let isAllowed = ALLOWED_EXTRACTORS.has(extractor);
  if (!isAllowed && extractor === 'generic') {
    const uLower = url.toLowerCase();
    if (uLower.includes('pinterest.com') || uLower.includes('pin.it') || uLower.includes('snapchat.com')) {
      isAllowed = true;
      logger.info(`[extract] Allowed generic extractor for known domain: ${url}`);
    }
  }

  if (!isAllowed) {
    throw new Error('This website is not supported. Please try a different platform.');
  }

  return parseFormats(raw, url);
}

// ─── Re-extract a fresh direct URL for a specific format ─────────────────────
async function extractFormatUrl(pageUrl, formatId) {
  const urlLower = pageUrl.toLowerCase();
  
  if (urlLower.includes('bilibili.com') || urlLower.includes('b23.tv')) {
    const biliData = await getBilibiliVideo(pageUrl);
    return {
      videoUrl: biliData.formats.combined[0].url,
      audioUrl: null,
      isMerge: false,
      headers: biliData.formats.combined[0].headers || null
    };
  }

  let raw;
  
  const cached = extractionCache.get(urlLower);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    logger.info(`[extractFormatUrl] Using cached extraction for: ${pageUrl}`);
    raw = cached.data;
  } else {
    logger.info(`[extractFormatUrl] Cache miss/expired, re-extracting: ${pageUrl}`);
    try {
      raw = await runYtdlp(pageUrl);
    } catch (err) {
      const stderr = err.stderr || '';
      const needsProxy = stderr.includes('HTTP Error 429') || stderr.includes('Bot detection') || stderr.includes('Sign in') || stderr.includes('HTTP Error 403') || stderr.includes('HTTP Error 401');
      
      if (needsProxy) {
        logger.warn(`[extractFormatUrl] Block detected for ${pageUrl}. Attempting proxy failover...`);
        const proxies = await proxyManager.getProxyBatch();
        let proxySuccess = false;
        for (let i = 0; i < proxies.length; i++) {
          try {
            raw = await runYtdlp(pageUrl, proxies[i]);
            proxySuccess = true;
            break;
          } catch (proxyErr) {}
        }
        if (!proxySuccess) throw new Error('Re-extraction failed: IP blocked and all proxies exhausted.');
      } else {
        throw new Error(`Re-extraction failed: ${stderr.slice(0, 150)}`);
      }
    }
    extractionCache.set(urlLower, { data: raw, timestamp: Date.now() });
  }

  const extractor = (raw.extractor_key || raw.extractor || '').toLowerCase();
  
  let isAllowed = ALLOWED_EXTRACTORS.has(extractor);
  if (!isAllowed && extractor === 'generic') {
    const uLower = pageUrl.toLowerCase();
    if (uLower.includes('pinterest.com') || uLower.includes('pin.it') || uLower.includes('snapchat.com')) {
      isAllowed = true;
      logger.info(`[extractFormatUrl] Allowed generic extractor for known domain: ${pageUrl}`);
    }
  }

  if (!isAllowed) {
    throw new Error('This website is not supported. Please try a different platform.');
  }

  const allFormats = [
    ...(raw.formats || []),
  ];

  // Handle merged format IDs like "137+140"
  if (formatId.includes('+')) {
    const [videoId, audioId] = formatId.split('+');
    const videoFmt = allFormats.find(f => String(f.format_id) === videoId);
    const audioFmt = allFormats.find(f => String(f.format_id) === audioId);
    return {
      videoUrl: videoFmt?.url || null,
      audioUrl: audioFmt?.url || null,
      isMerge: true,
      videoHeaders: videoFmt?.http_headers || null,
      audioHeaders: audioFmt?.http_headers || null,
    };
  }

  // Single format
  const fmt = allFormats.find(f => String(f.format_id) === String(formatId));
  if (!fmt) {
    // Fallback: if only one format exists (e.g. direct URL platforms), use it
    if (allFormats.length === 1) {
      return { videoUrl: allFormats[0].url, audioUrl: null, isMerge: false };
    }
    // Final fallback: raw.url (single-format response)
    if (raw.url) {
      return { videoUrl: raw.url, audioUrl: null, isMerge: false };
    }
    throw new Error('Requested format not found. Please try extracting the video again.');
  }

  const vcodec = (fmt.vcodec || '').toLowerCase();
  const acodec = (fmt.acodec || '').toLowerCase();
  const isAudioOnly = vcodec === 'none' && acodec !== 'none';

  return {
    videoUrl: isAudioOnly ? null : fmt.url,
    audioUrl: isAudioOnly ? fmt.url : null,
    isMerge: false,
    headers: fmt.http_headers || null,
  };
}

// ─── Check yt-dlp is installed ────────────────────────────────────────────────
function checkYtdlpAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(YTDLP_BIN, ['--version']);
    proc.on('error', () => { logger.error('[yt-dlp] Binary not found.'); resolve(false); });
    proc.on('close', code => {
      if (code === 0) { logger.info('[yt-dlp] Binary found and ready.'); resolve(true); }
      else { logger.error(`[yt-dlp] Binary check failed code=${code}`); resolve(false); }
    });
  });
}

// ─── Auto-update yt-dlp ───────────────────────────────────────────────────────
async function autoUpdateYtdlp() {
  return new Promise((resolve) => {
    logger.info('[yt-dlp] Running auto-update...');
    const proc = spawn(YTDLP_BIN, ['-U']);
    proc.on('close', code => {
      if (code === 0) logger.info('[yt-dlp] Update check complete.');
      else logger.warn(`[yt-dlp] Update exited with code ${code}`);
      resolve();
    });
    proc.on('error', () => resolve());
  });
}

module.exports = { extractInfo, extractFormatUrl, checkYtdlpAvailable, autoUpdateYtdlp };
