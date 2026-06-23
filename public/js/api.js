/**
 * api.js — Fetch helpers for the Click2Video API
 */

const API_BASE = window.API_BASE || '';

/**
 * Extract video info from a URL.
 * @param {string} url
 * @param {string|null} idToken - Firebase ID token for premium users
 * @returns {Promise<object>}
 */
async function apiExtract(url, idToken = null) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('spotify.com') || urlLower.includes('netflix.com') || urlLower.includes('hulu.com') || urlLower.includes('crunchyroll.com')) {
    throw new Error("DRM-protected streaming services are unsupported.");
  }
  if (urlLower.includes('patreon.com') || urlLower.includes('onlyfans.com')) {
    throw new Error("Platforms requiring paid subscriptions are unsupported.");
  }

  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(`${API_BASE}/api/extract`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

/**
 * Build a proxy-download URL for CORS-safe downloads.
 * @param {string} remoteUrl
 * @param {string} filename
 * @returns {string}
 */
function buildProxyUrl(remoteUrl, filename) {
  const params = new URLSearchParams({ url: remoteUrl, filename });
  return `${API_BASE}/api/proxy-download?${params}`;
}

/**
 * Build a merge URL for FFmpeg on-the-fly merge (premium).
 * @param {string} videoUrl
 * @param {string} audioUrl
 * @param {string} filename
 * @param {string} idToken
 * @returns {string}
 */
function buildMergeUrl(videoUrl, audioUrl, filename, idToken) {
  const params = new URLSearchParams({
    videoUrl,
    audioUrl,
    filename,
    token: idToken || '',
  });
  return `${API_BASE}/api/merge?${params}`;
}

/**
 * Create a Stripe Checkout session.
 * @param {string|null} idToken
 * @returns {Promise<{url: string, sessionId: string}>}
 */
async function apiCreateCheckout(idToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(`${API_BASE}/api/stripe/create-checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Checkout error (${res.status})`);
  return data;
}

/**
 * Verify Firebase token and get user tier.
 * @param {string} idToken
 * @returns {Promise<{uid, email, tier, isPremium}>}
 */
async function apiVerifyAuth(idToken) {
  const res = await fetch(`${API_BASE}/api/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Auth verification failed');
  return data;
}

async function triggerDownload(action, params, onProgress) {
  if (onProgress) onProgress(-1); // Indeterminate start "Preparing..."

  // Create a hidden form to submit the request natively.
  // This bypasses fetch() memory limits for huge files and relies on the browser's native download manager.
  // Using POST bypasses URL length limits for massive CDNs.
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  
  // Convert action like /api/merge to type string if needed by server, 
  // though server handles POST /api/merge and POST /api/download natively
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = params[key];
      form.appendChild(input);
    }
  });

  document.body.appendChild(form);
  form.submit();
  
  // Clean up the DOM after submission
  setTimeout(() => {
    if (document.body.contains(form)) {
      document.body.removeChild(form);
    }
    // Reset the button since the browser handles the download natively
    if (onProgress) onProgress(null);
  }, 1500);
}

// Expose globally
window.StreamAPI = {
  apiExtract,
  buildProxyUrl,
  buildMergeUrl,
  apiCreateCheckout,
  apiVerifyAuth,
  triggerDownload,
};
