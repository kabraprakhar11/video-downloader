/**
 * FFmpeg Service
 * Pipes two remote streams (video-only + audio-only) through FFmpeg
 * and streams the merged MP4 output directly to the Express response.
 * No temporary files are written to disk.
 */

const { spawn } = require('child_process');
const logger = require('../utils/logger');

const FFMPEG_PATH = require('ffmpeg-static');

/**
 * Merge a video-only URL and audio-only URL, streaming the result to res.
 * @param {string} videoUrl - Direct URL to video-only stream
 * @param {string} audioUrl - Direct URL to audio-only stream
 * @param {object} res      - Express Response object
 * @param {string} filename - Output filename (without extension)
 */
function mergeStreams(videoUrl, audioUrl, res, filename = 'merged_video') {
  return new Promise((resolve, reject) => {
    logger.info(`[FFmpeg] Starting merge: ${filename}`);

    const safeFilename = filename.replace(/"/g, '') + '.mp4';

    // Set response headers before piping
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const args = [
      '-loglevel', 'warning',
      // Input 1: video stream (direct URL, no download needed)
      '-i', videoUrl,
      // Input 2: audio stream
      '-i', audioUrl,
      // Copy codecs — no re-encoding (fast, lossless quality)
      '-c:v', 'copy',
      '-c:a', 'aac',
      // Fragmented MP4 allows streaming without seeking (no moov atom at end)
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      // Output to stdout pipe
      'pipe:1',
    ];

    const proc = spawn(FFMPEG_PATH, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrLog = '';
    proc.stderr.on('data', (chunk) => {
      stderrLog += chunk.toString();
    });

    // Pipe FFmpeg stdout directly to Express response
    proc.stdout.pipe(res);

    proc.stdout.on('error', (err) => {
      logger.error('[FFmpeg] stdout pipe error:', err);
    });

    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        logger.error(`[FFmpeg] Exited with code ${code}:\n${stderrLog.slice(-1000)}`);
        // Don't reject if headers already sent — pipe already started
        if (!res.headersSent) {
          reject(new Error(`FFmpeg merge failed (code ${code}). The streams may be incompatible.`));
        }
      } else {
        logger.info(`[FFmpeg] Merge completed: ${safeFilename}`);
        resolve();
      }
    });

    proc.on('error', (err) => {
      logger.error('[FFmpeg] spawn error:', err);
      if (err.code === 'ENOENT') {
        if (!res.headersSent) {
          reject(new Error('FFmpeg is not installed or not in PATH. Please install FFmpeg: https://ffmpeg.org/download.html'));
        }
      } else {
        if (!res.headersSent) reject(err);
      }
    });

    // Handle client disconnect — kill ffmpeg process
    res.on('close', () => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
        logger.info('[FFmpeg] Process killed (client disconnected)');
      }
    });
  });
}

/**
 * Check if FFmpeg is available on the system.
 */
function checkFfmpegAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_PATH, ['-version'], { shell: false });
    let version = '';
    proc.stdout.on('data', (d) => { version += d.toString().split('\n')[0]; });
    proc.on('close', (code) => resolve(code === 0 ? version.trim() : null));
    proc.on('error', () => resolve(null));
  });
}

module.exports = { mergeStreams, checkFfmpegAvailable };
