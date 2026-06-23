const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ALLOWED_EXTRACTORS = require('../utils/allowedExtractors');

const YTDLP_BIN = 'yt-dlp';

// ─── Quality helpers ──────────────────────────────────────────────────────────
function getQualityTier(height) {
  if (!height) return 'SD';
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  if (height >= 1080) return 'FHD';
  if (height >= 720)  return 'HD';
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

// ─── yt-dlp args builder ──────────────────────────────────────────────────────
function buildYtdlpArgs(url) {
  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '30',
    '--retries', '3',
  ];

  // Only inject cookies if they exist
  const cookiesPath = path.join(__dirname, '../../cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    args.push('--cookies', cookiesPath);
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
      qualityTier: getQualityTier(raw.height),
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

    // Explicitly audio-only: codec says video is none, or no video dimensions at all
    const isExplicitAudioOnly = vcodec === 'none' && isAudioStream;
    // Explicitly video-only: codec says audio is none AND no audio bitrate
    const isExplicitVideoOnly = acodec === 'none' && !hasAbr && isVideoStream;

    const height = f.height || null;
    const qualityTier = isExplicitAudioOnly ? 'audio' : getQualityTier(height);
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

  return result;
}

// ─── Run yt-dlp ───────────────────────────────────────────────────────────────
function runYtdlp(url) {
  return new Promise((resolve, reject) => {
    const args = buildYtdlpArgs(url);
    logger.info(`[yt-dlp] Running extraction for: ${url}`);
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
async function extractInfo(url) {
  logger.info(`[extract] Starting for: ${url}`);

  const urlLower = url.toLowerCase();



  let raw;
  try {
    raw = await runYtdlp(url);
    extractionCache.set(urlLower, { data: raw, timestamp: Date.now() });
    
    // Cleanup old cache entries
    for (const [key, val] of extractionCache.entries()) {
      if (Date.now() - val.timestamp > CACHE_TTL_MS) extractionCache.delete(key);
    }
  } catch (err) {
    const stderr = err.stderr || '';
    if (stderr.includes('Unsupported URL')) {
      throw new Error('This website is not supported. Please try a different platform.');
    }
    if (stderr.includes('Video unavailable') || stderr.includes('Private video')) {
      throw new Error('This video is private or unavailable.');
    }
    if (stderr.includes('HTTP Error 403') || stderr.includes('HTTP Error 401')) {
      throw new Error('Access denied by the platform. The video may be private or age-restricted.');
    }
    if (stderr.includes('HTTP Error 404')) {
      throw new Error('Video not found. The link may be broken or the video may have been deleted.');
    }
    throw new Error(`Could not extract video information. ${stderr.slice(0, 150)}`);
  }

  const extractor = raw.extractor_key || raw.extractor;
  if (extractor && !ALLOWED_EXTRACTORS.has(extractor.toLowerCase())) {
    throw new Error('This website is not supported. Please try a different platform.');
  }

  return parseFormats(raw, url);
}

// ─── Re-extract a fresh direct URL for a specific format ─────────────────────
async function extractFormatUrl(pageUrl, formatId) {
  const urlLower = pageUrl.toLowerCase();
  let raw;
  
  const cached = extractionCache.get(urlLower);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    logger.info(`[extractFormatUrl] Using cached extraction for: ${pageUrl}`);
    raw = cached.data;
  } else {
    logger.info(`[extractFormatUrl] Cache miss/expired, re-extracting: ${pageUrl}`);
    try {
      raw = await runYtdlp(pageUrl);
      extractionCache.set(urlLower, { data: raw, timestamp: Date.now() });
    } catch (err) {
      throw new Error(`Re-extraction failed: ${(err.stderr || '').slice(0, 150)}`);
    }
  }

  const extractor = raw.extractor_key || raw.extractor;
  if (extractor && !ALLOWED_EXTRACTORS.has(extractor.toLowerCase())) {
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
