const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../utils/logger');

const YTDLP_BIN = 'yt-dlp';

// Find node binary path for the --js-runtimes flag
function findNodePath() {
  const candidates = [
    process.execPath,
    '/usr/local/bin/node',
    '/usr/bin/node',
    'node',
  ];
  for (const candidate of candidates) {
    try {
      if (candidate === 'node' || fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return 'node';
}

const NODE_PATH = findNodePath();
logger.info(`[yt-dlp] Using node runtime at: ${NODE_PATH}`);

// ─── VidsSave API Fallback ───────────────────────────────────────────────────

async function extractViaVidsSave(url) {
  return new Promise((resolve, reject) => {
    logger.info(`[vidssave-api] Routing request through api.vidssave.com for: ${url}`);
    
    // Exact payload used by vidssave.com
    const data = `auth=20250901majwlqo&domain=api-ak.vidssave.com&origin=source&link=${encodeURIComponent(url)}`;
    
    const req = https.request({
      hostname: 'api.vidssave.com',
      path: '/api/contentsite_api/media/parse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'Origin': 'https://vidssave.com',
        'Referer': 'https://vidssave.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
      },
      timeout: 20000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`VidsSave API returned HTTP ${res.statusCode}`));
        }
        try {
          const j = JSON.parse(body);
          if (!j.data || !j.data.resources) {
            return reject(new Error('VidsSave API returned invalid format or failed'));
          }
          
          const vData = j.data;
          
          const result = {
            title: vData.title || 'Unknown Title',
            thumbnail: vData.thumbnail || '',
            duration: vData.duration || 0,
            extractor: 'youtube', // Assuming youtube or generic
            webpage_url: url,
            formats: { combined: [], videoOnly: [], audioOnly: [] }
          };

          // Map VidsSave resources to our format
          vData.resources.forEach(res => {
            const isVideo = res.type === 'video';
            const isAudio = res.type === 'audio';
            const ext = res.format ? res.format.toLowerCase() : (isVideo ? 'mp4' : 'mp3');
            
            const formatObj = {
              formatId: String(res.resource_id || res.quality),
              format_id: String(res.resource_id || res.quality),
              ext: ext,
              resolution: isVideo ? res.quality : 'unknown',
              filesize: res.size || null,
              vcodec: isVideo ? 'avc1' : 'none',
              acodec: isVideo ? 'mp4a' : (isAudio ? 'mp3' : 'none'), // Assumes combined if it's video
              url: res.download_url || res.url || '', // Trusting their download_url
              vidssave_resource_id: res.resource_id 
            };
            
            if (formatObj.url) {
                if (isVideo) {
                    // VidsSave provides fully muxed MP4s with audio
                    result.formats.combined.push(formatObj);
                } else if (isAudio) {
                    result.formats.audioOnly.push(formatObj);
                }
            }
          });

          resolve(result);
        } catch(e) {
          reject(new Error('Failed to parse VidsSave response: ' + e.message));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('VidsSave API timeout')); });
    req.write(data);
    req.end();
  });
}

// ─── yt-dlp fallback (for non-YouTube URLs) ──────────────────────────────────
function isBotDetectionError(stderr) {
  return (
    stderr.includes('Sign in to confirm') ||
    stderr.includes('confirm you\'re not a bot') ||
    stderr.includes('HTTP Error 429') ||
    stderr.includes('Too Many Requests') ||
    stderr.includes('detected as a bot') ||
    stderr.includes('not a bot')
  );
}

const PLAYER_CLIENTS = ['android', 'ios', 'tv_embedded'];

function buildYtdlpArgs(url, playerClient) {
  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '20',
    '--extractor-args', `youtube:player_client=${playerClient}`,
    '--add-header', 'Accept-Language:en-US,en;q=0.9',
    '--js-runtimes', `node:${NODE_PATH}`,
  ];
  const cookiesPath = path.join(__dirname, '../../cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    args.push('--cookies', cookiesPath);
  }
  args.push(url);
  return args;
}

function parseFormats(raw, url) {
  const result = {
    title: raw.title || 'Unknown Title',
    thumbnail: raw.thumbnail || '',
    duration: raw.duration || 0,
    extractor: raw.extractor || 'unknown',
    webpage_url: raw.webpage_url || url,
    formats: { combined: [], videoOnly: [], audioOnly: [] }
  };

  (raw.formats || []).forEach(f => {
    const vcodec = f.vcodec || 'none';
    const acodec = f.acodec || 'none';
    const isVideoOnly = vcodec !== 'none' && acodec === 'none';
    const isAudioOnly = vcodec === 'none' && acodec !== 'none';
    const isCombined = vcodec !== 'none' && acodec !== 'none';
    const obj = {
      formatId: String(f.format_id || f.id || f.ext || 'default'),
      format_id: String(f.format_id || f.id || f.ext || 'default'),
      ext: f.ext || 'mp4',
      resolution: f.resolution || (f.width ? `${f.width}x${f.height}` : 'unknown'),
      filesize: f.filesize || f.filesize_approx || null,
      vcodec, acodec, url: f.url
    };

    const isInstagram = raw.extractor && raw.extractor.toLowerCase() === 'instagram';
    if (isInstagram) {
      if (f.ext === 'mp4' || isCombined) result.formats.combined.push(obj);
      else if (isVideoOnly) result.formats.videoOnly.push(obj);
      else if (isAudioOnly) result.formats.audioOnly.push(obj);
    } else {
      if (isCombined) result.formats.combined.push(obj);
      else if (isVideoOnly) result.formats.videoOnly.push(obj);
      else if (isAudioOnly) result.formats.audioOnly.push(obj);
    }
  });

  const isInstagram = raw.extractor && raw.extractor.toLowerCase() === 'instagram';
  if (isInstagram && result.formats.combined.length === 0 && result.formats.videoOnly.length > 0) {
    result.formats.combined.push(result.formats.videoOnly.shift());
  }
  return result;
}

function runYtdlp(url, playerClient) {
  return new Promise((resolve, reject) => {
    const args = buildYtdlpArgs(url, playerClient);
    logger.info(`[yt-dlp] Trying player_client=${playerClient} for ${url}`);
    const proc = spawn(YTDLP_BIN, args);
    let stdout = '', stderr = '';
    proc.stdout.on('data', c => { stdout += c; });
    proc.stderr.on('data', c => { stderr += c; });
    proc.on('close', code => {
      if (code !== 0) {
        logger.warn(`[yt-dlp] client=${playerClient} failed: ${stderr.slice(0, 200)}`);
        return reject({ code, stderr, isBot: isBotDetectionError(stderr) });
      }
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject({ code: -1, stderr: e.message, isBot: false }); }
    });
    proc.on('error', err => reject({ code: -1, stderr: err.message, isBot: false }));
  });
}

async function extractViaYtdlp(url) {
  let lastError = null;
  for (const client of PLAYER_CLIENTS) {
    try {
      const raw = await runYtdlp(url, client);
      const result = parseFormats(raw, url);
      logger.info(`[yt-dlp] Success client=${client}: ${result.formats.combined.length} combined`);
      return result;
    } catch (err) {
      lastError = err;
      if (!err.isBot) break;
      logger.warn(`[yt-dlp] Bot detected client=${client}, trying next...`);
    }
  }
  let msg = 'Failed to extract video information.';
  if (lastError?.isBot) msg = 'YouTube bot detection blocked the request. Please try again later or configure cookies.';
  else if (lastError?.stderr?.includes('Unsupported URL')) msg = 'This website or URL is not supported.';
  else if (lastError?.stderr?.includes('Video unavailable') || lastError?.stderr?.includes('Private video')) msg = 'This video is private or unavailable.';
  throw { message: msg, status: lastError?.isBot ? 422 : 500, rawError: lastError?.stderr };
}

// ─── Main entry point ────────────────────────────────────────────────────────
function isYouTubeUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com';
  } catch (_) { return false; }
}

async function extractInfo(url) {
  logger.info(`[extract] Starting extraction for: ${url}`);

  // Use VidsSave API for YouTube links exclusively to bypass IP ban
  if (isYouTubeUrl(url)) {
    try {
      const result = await extractViaVidsSave(url);
      if (result.formats.combined.length > 0 || result.formats.audioOnly.length > 0) {
        return result;
      }
    } catch (apiErr) {
      logger.warn(`[vidssave] API failed, falling back to yt-dlp: ${apiErr.message}`);
    }
  }

  // Fallback to local yt-dlp for everything else
  return extractViaYtdlp(url);
}

// ─── Utility functions (used by index.js) ────────────────────────────────────
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

function autoUpdateYtdlp() {
  return new Promise((resolve) => {
    logger.info('[yt-dlp] Checking for updates...');
    const proc = spawn(YTDLP_BIN, ['-U']);
    proc.on('close', code => { logger.info(`[yt-dlp] Update check done code=${code}`); resolve(); });
    proc.on('error', () => { logger.warn('[yt-dlp] Update check failed.'); resolve(); });
  });
}

module.exports = { checkYtdlpAvailable, autoUpdateYtdlp, extractInfo };
