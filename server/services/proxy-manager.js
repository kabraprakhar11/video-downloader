const https = require('https');
const logger = require('../utils/logger');

let cachedProxies = [];
let lastFetchTime = 0;
let currentProxyIndex = 0;

// Fetch free SOCKS5 proxies from ProxyScrape
function fetchProxies() {
  return new Promise((resolve) => {
    // Only fetch once every 10 minutes to avoid rate limits
    if (Date.now() - lastFetchTime < 10 * 60 * 1000 && cachedProxies.length > 0) {
      return resolve(cachedProxies);
    }

    logger.info('[ProxyManager] Fetching fresh free proxy list...');
    https.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all&ssl=yes&anonymity=elite', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const proxies = data.split('\n').map(p => p.trim()).filter(Boolean);
        if (proxies.length > 0) {
          cachedProxies = proxies.map(p => `socks5://${p}`);
          lastFetchTime = Date.now();
          currentProxyIndex = 0;
          logger.info(`[ProxyManager] Successfully loaded ${cachedProxies.length} proxies.`);
        } else {
          logger.warn('[ProxyManager] Failed to load new proxies. Using cache.');
        }
        resolve(cachedProxies);
      });
    }).on('error', (err) => {
      logger.error(`[ProxyManager] Error fetching proxies: ${err.message}`);
      resolve(cachedProxies);
    });
  });
}

/**
 * Gets a batch of 5 proxies to try sequentially.
 */
async function getProxyBatch() {
  const proxies = await fetchProxies();
  if (proxies.length === 0) return [];

  const batch = [];
  for (let i = 0; i < 5; i++) {
    batch.push(proxies[currentProxyIndex]);
    currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  }
  return batch;
}

module.exports = {
  getProxyBatch
};
