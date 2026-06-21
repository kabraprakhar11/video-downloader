/**
 * POST /api/download
 * Fetches a remote media URL on the server's behalf and streams it to the client.
 * Bypasses CORS restrictions and forces native browser download.
 *
 * Body params:
 *   url   — remote media URL
 *   title — video title
 *   ext   — file extension
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

const { validateProxyRequest } = require('../middleware/sanitize');
const { proxyLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { tickets } = require('./tickets');

const PROXY_TIMEOUT_MS = 30000;
const MAX_REDIRECT_HOPS = 5;

function fetchWithRedirects(url, headers, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > MAX_REDIRECT_HOPS) {
      return reject(new Error('Too many redirects.'));
    }

    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        ...headers,
      },
      timeout: PROXY_TIMEOUT_MS,
    };

    const req = lib.request(reqOptions, (response) => {
      const { statusCode, headers: resHeaders } = response;

      // Follow 3xx redirects
      if (statusCode >= 300 && statusCode < 400 && resHeaders.location) {
        response.resume();
        const nextUrl = new URL(resHeaders.location, url).href;
        logger.debug(`[Proxy] Redirect ${statusCode} → ${nextUrl}`);
        return resolve(fetchWithRedirects(nextUrl, headers, hops + 1));
      }

      if (statusCode < 200 || statusCode >= 400) {
        response.resume();
        return reject(new Error(`Remote server returned status ${statusCode}`));
      }

      resolve({ response, statusCode, resHeaders });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection to remote server timed out.'));
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to connect to remote server: ${err.message}`));
    });

    req.end();
  });
}

router.post('/', proxyLimiter, validateProxyRequest, async (req, res) => {
  const remoteUrl = req.validatedUrl;
  const filename = req.sanitizedFilename || 'download';

  logger.info(`[Proxy] POST → ${remoteUrl.slice(0, 100)}... filename="${filename}"`);

  try {
    const { response, resHeaders } = await fetchWithRedirects(remoteUrl, {
      Referer: new URL(remoteUrl).origin,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    });

    // Forward relevant headers
    const acceptRanges = resHeaders['accept-ranges'];
    const contentLength = resHeaders['content-length'];

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');

    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    // Pipe remote response to client
    response.pipe(res);

    response.on('error', (err) => {
      logger.error(`[Proxy] Stream error: ${err.message}`);
      if (!res.headersSent) res.status(500).json({ error: 'Stream interrupted.' });
    });

    req.on('close', () => {
      response.destroy();
    });
  } catch (err) {
    logger.error(`[Proxy] Error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: `Proxy failed: ${err.message}` });
    }
  }
});

module.exports = router;
