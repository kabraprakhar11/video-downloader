const { spawn } = require('child_process');
const YTDLP_BIN = 'yt-dlp';

function isBotDetectionError(stderr) {
  return (
    stderr.includes('Sign in to confirm') ||
    stderr.includes('confirm you\'re not a bot') ||
    stderr.includes('This video is not available') ||
    stderr.includes('HTTP Error 429') ||
    stderr.includes('Too Many Requests')
  );
}

const logger = {
  info: console.log,
  error: console.error
};

async function extractInfo(url) {
  return new Promise((resolve, reject) => {
    logger.info(`[yt-dlp] Extracting info for ${url}`);
    
    // We add tv_embedded to work around YouTube issues
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--socket-timeout', '15',
      '--extractor-args', 'youtube:player_client=tv_embedded,default'
    ];
    
    const fs = require('fs');
    const path = require('path');
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    if (fs.existsSync(cookiesPath)) {
        args.push('--cookies', cookiesPath);
    }
    
    args.push(url);

    const proc = spawn(YTDLP_BIN, args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[yt-dlp] Error: ${stderr}`);
        
        let friendlyError = 'Failed to extract video information.';
        if (isBotDetectionError(stderr)) {
          friendlyError = 'YouTube bot detection blocked the request. Please try again later or configure cookies.';
        } else if (stderr.includes('Unsupported URL') || stderr.includes('Unsupported site')) {
          friendlyError = 'This website or URL is not supported.';
        } else if (stderr.includes('Video unavailable') || stderr.includes('Private video')) {
          friendlyError = 'This video is private or unavailable.';
        }
        
        return reject({
          message: friendlyError,
          status: 422,
          rawError: stderr,
        });
      }

      try {
        const raw = JSON.parse(stdout);
        
        const result = {
          title: raw.title || 'Unknown Title',
          thumbnail: raw.thumbnail || '',
          duration: raw.duration || 0,
          extractor: raw.extractor || 'unknown',
          formats: {
            combined: [],
            videoOnly: [],
            audioOnly: []
          }
        };

        if (raw.formats && Array.isArray(raw.formats)) {
          raw.formats.forEach((f) => {
            const vcodec = f.vcodec || 'none';
            const acodec = f.acodec || 'none';
            
            const isVideoOnly = vcodec !== 'none' && acodec === 'none';
            const isAudioOnly = vcodec === 'none' && acodec !== 'none';
            const isCombined = vcodec !== 'none' && acodec !== 'none';
            
            const formatObj = {
              format_id: f.format_id,
              ext: f.ext,
              resolution: f.resolution || (f.width ? `${f.width}x${f.height}` : 'unknown'),
              filesize: f.filesize || f.filesize_approx || null,
              vcodec: vcodec,
              acodec: acodec,
              url: f.url
            };

            if (raw.extractor && raw.extractor.toLowerCase() === 'instagram') {
              if (f.ext === 'mp4') {
                  result.formats.combined.push(formatObj);
              } else if (isCombined) {
                  result.formats.combined.push(formatObj);
              } else if (isVideoOnly) {
                  result.formats.videoOnly.push(formatObj);
              } else if (isAudioOnly) {
                  result.formats.audioOnly.push(formatObj);
              }
            } else {
              if (isCombined) {
                result.formats.combined.push(formatObj);
              } else if (isVideoOnly) {
                result.formats.videoOnly.push(formatObj);
              } else if (isAudioOnly) {
                result.formats.audioOnly.push(formatObj);
              }
            }
          });
          
          if (result.formats.combined.length === 0 && raw.extractor && raw.extractor.toLowerCase() === 'instagram') {
            if (result.formats.videoOnly.length > 0) {
              result.formats.combined.push(result.formats.videoOnly[0]);
              result.formats.videoOnly.shift();
            }
          }
        }

        logger.info(`[yt-dlp] Extraction successful! Found ${result.formats.combined.length} combined, ${result.formats.videoOnly.length} video, ${result.formats.audioOnly.length} audio formats.`);
        resolve(result);
      } catch (err) {
        logger.error(`[yt-dlp] JSON Parse Error: ${err.message}`);
        reject({
          message: 'Failed to parse extracted data.',
          status: 500,
          rawError: err.message,
        });
      }
    });
  });
}

async function run() {
  try {
    console.log('Testing Youtube...');
    const yt = await extractInfo('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Youtube success!', yt.title, 'Combined:', yt.formats.combined.length);
    
    console.log('Testing Instagram...');
    // A public instagram post
    const inst = await extractInfo('https://www.instagram.com/p/C_aJ5J2R5Qy/');
    console.log('Instagram success!', inst.title, 'Combined:', inst.formats.combined.length);
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

run();
