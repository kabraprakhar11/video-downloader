/**
 * Free-tier quota enforcement.
 * Tracks download counts per IP using an in-memory store (resets on server restart).
 * When Firebase is configured, quota is persisted per authenticated user.
 *
 * Free tier: 3 extractions/day, max 720p quality.
 * Premium tier: unlimited, up to 4K + FFmpeg merge.
 */

const logger = require('../utils/logger');
const { getUserDailyUsage } = require('../services/firebase');

const FREE_DAILY_LIMIT = 3;

// In-memory store: { ip: { date: 'YYYY-MM-DD', count: N } }
const ipQuotaStore = new Map();

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get quota record for an IP address.
 */
function getIpQuota(ip) {
  const today = getTodayString();
  const record = ipQuotaStore.get(ip);
  if (!record || record.date !== today) {
    return { date: today, count: 0 };
  }
  return record;
}

/**
 * Increment download count for an IP.
 */
function incrementIpQuota(ip) {
  const today = getTodayString();
  const record = getIpQuota(ip);
  ipQuotaStore.set(ip, { date: today, count: record.count + 1 });
}

/**
 * Express middleware: enforce free-tier limits on extraction requests.
 * Sets req.userTier = 'free' | 'premium'.
 * Sets req.quotaInfo = { used, limit, remaining }.
 */
async function enforceQuota(req, res, next) {
  // Check if user has a verified premium token (set by auth middleware)
  if (req.userTier === 'premium') {
    req.quotaInfo = { tier: 'premium', used: 0, limit: Infinity, remaining: Infinity };
    return next();
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const quota = getIpQuota(ip);
  const count = quota.count;

  req.userTier = 'free';
  req.quotaInfo = {
    tier: 'free',
    used: count,
    limit: FREE_DAILY_LIMIT,
    remaining: Math.max(0, FREE_DAILY_LIMIT - count),
  };

  if (count >= FREE_DAILY_LIMIT) {
    const targetId = `IP ${req.ip || 'unknown'}`;
    logger.info(`Quota exceeded for ${targetId}: ${count}/${FREE_DAILY_LIMIT}`);
    return res.status(429).json({
      error: `Daily free limit reached (${FREE_DAILY_LIMIT} extractions/day). Upgrade to Premium for unlimited downloads.`,
      quota: req.quotaInfo,
      upgradeRequired: true,
    });
  }

  next();
}

/**
 * Call after a successful extraction to record usage.
 */
function recordUsage(ip) {
  incrementIpQuota(ip);
  logger.debug(`Quota recorded for ${ip}: ${getIpQuota(ip).count}/${FREE_DAILY_LIMIT}`);
}

module.exports = { enforceQuota, recordUsage, getIpQuota };
