/**
 * app.js — Main SPA Controller
 * Orchestrates state transitions: IDLE → PROCESSING → SUCCESS / ERROR
 * Handles URL extraction, format downloads, auth events, and Stripe checkout.
 */

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  const State = { IDLE: 'idle', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' };
  let currentState = State.IDLE;
  let lastExtractedData = null;
  let lastUrl = '';

  // ── DOM References ────────────────────────────────────────────────────────
  const urlInput    = document.getElementById('url-input');
  const btnExtract  = document.getElementById('btn-extract');
  const btnPaste    = document.getElementById('btn-paste');
  const btnReset    = document.getElementById('btn-reset');
  const btnRetry    = document.getElementById('btn-retry');
  const btnErrorReset = document.getElementById('btn-error-reset');
  const btnSignin   = document.getElementById('btn-signin');
  const btnSignout  = document.getElementById('btn-signout');
  const btnUpgrade  = document.getElementById('btn-upgrade');
  const btnMergeUpgrade = document.getElementById('btn-merge-upgrade');
  const btnCheckout = document.getElementById('btn-checkout');
  const btnModalClose = document.getElementById('modal-close');
  const btnNavBack   = document.getElementById('btn-nav-back');

  const tabCombined = document.getElementById('tab-combined');
  const tabVideo    = document.getElementById('tab-video');
  const tabAudio    = document.getElementById('tab-audio');

  const modalOverlay = document.getElementById('modal-upgrade');

  // ── Transition State Machine ──────────────────────────────────────────────
  function setState(newState) {
    currentState = newState;
    StreamUI.showView(newState === State.SUCCESS ? 'results' : newState);
  }

  // ── Core: Extract Video Info ──────────────────────────────────────────────
  async function handleExtract(url) {
    url = (url || urlInput?.value || '').trim();
    if (!url) {
      StreamUI.showToast('Please paste a video URL first.', 'warning');
      urlInput?.focus();
      return;
    }

    lastUrl = url;
    setState(State.PROCESSING);
    StreamUI.startProcessingAnimation(url);

    try {
      const idToken = await StreamAuth.getIdToken();
      const data = await StreamAPI.apiExtract(url, idToken);

      StreamUI.finishProcessingSteps();

      // Small delay for visual completion feedback
      await delay(300);

      lastExtractedData = data;
      StreamUI.renderResults(data, data.tier || 'free');
      setState(State.SUCCESS);

      const count = [
        ...(data.data?.formats?.combined || []),
        ...(data.data?.formats?.videoOnly || []),
        ...(data.data?.formats?.audioOnly || []),
      ].length;

      StreamUI.showToast(`Found ${count} download formats.`, 'success');

      // If quota exhausted after this extraction
      if (data.quota?.remaining === 0 && data.tier === 'free') {
        setTimeout(() => {
          StreamUI.showToast("You've reached today's free limit. Upgrade for unlimited downloads.", 'warning', 6000);
        }, 1500);
      }
    } catch (err) {
      setState(State.ERROR);
      const errorEl = document.getElementById('error-message');
      if (errorEl) errorEl.textContent = err.message;

      // Special handling for quota exceeded
      if (err.message?.includes('Daily free limit') || err.message?.includes('upgradeRequired')) {
        setTimeout(() => StreamUI.showUpgradeModal(), 500);
      }
    }
  }

  // ── Shared download engine — triggers direct browser download ──────────────
  async function runDownloadJob(btn, pageUrl, formatId, title, ext) {
    StreamUI.setDownloadProgress(btn, 0); // show spinner briefly

    const headers = { 'Content-Type': 'application/json' };
    try {
      const idToken = await StreamAuth.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (err) {
      console.warn('[Download] Could not retrieve ID token:', err);
    }

    // Step 1: Request a short-lived download session from the backend
    let downloadUrl;
    const startRes = await fetch((window.API_BASE || '') + '/api/download', {
      method: 'POST',
      headers,
      body: JSON.stringify({ pageUrl, formatId, title, ext }),
    });
    
    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      throw new Error(err.error || `Server error (${startRes.status})`);
    }
    
    ({ downloadUrl } = await startRes.json());

    // Step 2: Navigate the browser to the stream URL to trigger native download
    StreamUI.setDownloadProgress(btn, 100);
    
    const a = document.createElement('a');
    a.href = (window.API_BASE || '') + downloadUrl;
    // We can't always rely on a.download for cross-origin or programmatic redirects,
    // but the backend sets Content-Disposition attachment anyway.
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 500);
  }

  // ── Ad Trigger Helpers ────────────────────────────────────────────────────
  function triggerPopunderAd() {
    console.log('[Ads] Triggering Popunder click-popup ad...');
    // In production, your ad network (e.g. Adsterra) Popunder script will automatically bind to click events,
    // or you can manually trigger their SmartLink / Direct Link opening in a new tab:
    // window.open('https://your-adsterra-direct-link.com', '_blank');
    if (typeof window.adsterra_popunder === 'function') {
      window.adsterra_popunder();
    } else {
      console.log('%c[AD DISPLAYED] Popunder ad window popped up.', 'color: #f59e0b; font-weight: bold;');
    }
  }

  function triggerInterstitialAd() {
    console.log('[Ads] Triggering Vignette / Interstitial full-screen ad...');
    if (typeof window.adsterra_interstitial === 'function') {
      window.adsterra_interstitial();
    } else {
      console.log('%c[AD DISPLAYED] Vignette/Interstitial full-screen ad shown.', 'color: #f59e0b; font-weight: bold;');
      StreamUI.showToast('ℹ️ [AD PLACEHOLDER] Vignette full-screen ad triggered.', 'info', 3000);
    }
  }

  // ── Download Handler ──────────────────────────────────────────────────────
  async function handleDownload(btn) {
    triggerPopunderAd();
    const pageUrl  = btn.dataset.pageUrl;
    const formatId = btn.dataset.formatId;
    const title    = btn.dataset.title || 'download';
    const ext      = btn.dataset.ext   || 'mp4';

    if (!pageUrl || !formatId) {
      StreamUI.showToast('Download info missing. Please extract the video again.', 'error');
      return;
    }

    try {
      await runDownloadJob(btn, pageUrl, formatId, title, ext);
      StreamUI.showToast(`Starting stream: ${title}.${ext}...`, 'info');
    } catch (err) {
      StreamUI.showToast(`Download failed: ${err.message}`, 'error');
    } finally {
      StreamUI.setDownloadProgress(btn, null);
    }
  }

  // ── Merge Handler ─────────────────────────────────────────────────────────
  async function handleMerge(btn) {
    triggerPopunderAd();
    const pageUrl       = btn.dataset.pageUrl;
    const formatId      = btn.dataset.formatId;
    const audioFormatId = btn.dataset.audioFormatId;
    const title         = btn.dataset.title || 'merged_video';
    const ext           = btn.dataset.ext   || 'mp4';

    if (!pageUrl || !formatId || !audioFormatId) {
      StreamUI.showToast('Merge info missing. Please extract the video again.', 'error');
      return;
    }

    try {
      await runDownloadJob(btn, pageUrl, `${formatId}+${audioFormatId}`, title, ext);
      StreamUI.showToast(`Merging and streaming on the fly: ${title}.${ext}`, 'info');
    } catch (err) {
      StreamUI.showToast(`Merge failed: ${err.message}`, 'error');
    } finally {
      StreamUI.setDownloadProgress(btn, null);
    }
  }



  // ── Razorpay Checkout ─────────────────────────────────────────────────────
  async function handleCheckout() {
    const idToken = await StreamAuth.getIdToken();
    if (!idToken) {
      StreamUI.showToast('Please sign in first.', 'warning');
      return;
    }

    btnCheckout.disabled = true;
    btnCheckout.textContent = 'Initializing Payment...';

    try {
      // 1. Create Order on Backend
      const res = await fetch((window.API_BASE || '') + '/api/checkout/create-order', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const order = data.order;

      // 2. Initialize Razorpay SDK
      const options = {
        key: window.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY', // Provided by server/env
        amount: order.amount,
        currency: order.currency,
        name: 'Click2Video Premium',
        description: 'Unlimited 4K & Merged Downloads',
        order_id: order.id,
        handler: async function (response) {
          // 3. Verify Payment Signature
          try {
            btnCheckout.textContent = 'Verifying...';
            const verifyRes = await fetch((window.API_BASE || '') + '/api/checkout/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) throw new Error(verifyData.error);

            StreamUI.showToast('Payment successful! Welcome to Premium.', 'success');
            StreamUI.hideUpgradeModal();
            // Force token refresh to get new custom claims / tier
            await StreamAuth.getIdToken();
            window.location.reload(); // Refresh to apply UI changes
          } catch (err) {
            StreamUI.showToast(`Verification failed: ${err.message}`, 'error');
            btnCheckout.disabled = false;
            btnCheckout.textContent = 'Get Premium — Only $49/mo';
          }
        },
        prefill: {
          email: StreamAuth.currentUser?.email || '',
        },
        theme: {
          color: '#F59E0B',
        },
        modal: {
          ondismiss: function () {
            btnCheckout.disabled = false;
            btnCheckout.textContent = 'Get Premium — Only $49/mo';
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      StreamUI.showToast(`Checkout failed: ${err.message}`, 'error');
      btnCheckout.disabled = false;
      btnCheckout.textContent = 'Get Premium — Only $49/mo';
    }
  }

  // ── URL Validation Feedback ───────────────────────────────────────────────
  function validateUrlInput(url) {
    const inputWrap = document.getElementById('input-wrap');
    if (!inputWrap) return;
    if (!url) {
      inputWrap.style.borderColor = '';
      return;
    }
    try {
      const u = new URL(url);
      const valid = u.protocol === 'http:' || u.protocol === 'https:';
      inputWrap.style.borderColor = valid ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)';
    } catch {
      inputWrap.style.borderColor = url.length > 5 ? 'rgba(239,68,68,0.6)' : '';
    }
  }

  // ── Event Listeners ───────────────────────────────────────────────────────
  function bindEvents() {
    // Extract
    btnExtract?.addEventListener('click', () => handleExtract());
    urlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleExtract();
    });
    urlInput?.addEventListener('input', (e) => validateUrlInput(e.target.value));

    // Paste from clipboard
    btnPaste?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (urlInput) {
          urlInput.value = text;
          urlInput.dispatchEvent(new Event('input'));
          urlInput.focus();
        }
      } catch {
        StreamUI.showToast('Could not read clipboard. Paste manually (Ctrl+V).', 'warning');
      }
    });

    // Reset / Retry
    const handleReset = () => {
      triggerInterstitialAd();
      setState(State.IDLE);
      if (urlInput) { urlInput.value = ''; urlInput.focus(); }
      lastExtractedData = null;
    };

    btnReset?.addEventListener('click', handleReset);
    btnNavBack?.addEventListener('click', handleReset);

    btnRetry?.addEventListener('click', () => handleExtract(lastUrl));

    btnErrorReset?.addEventListener('click', handleReset);

    // Auth Modal Triggers
    btnSignin?.addEventListener('click', () => StreamUI.showAuthModal('signin'));
    btnSignout?.addEventListener('click', () => StreamAuth.signOut());

    const modalAuth = document.getElementById('modal-auth');
    const btnAuthClose = document.getElementById('auth-modal-close');
    const linkGotoSignup = document.getElementById('link-goto-signup');
    const linkGotoSignin = document.getElementById('link-goto-signin');

    btnAuthClose?.addEventListener('click', () => StreamUI.hideAuthModal());
    modalAuth?.addEventListener('click', (e) => {
      if (e.target === modalAuth) StreamUI.hideAuthModal();
    });

    linkGotoSignup?.addEventListener('click', (e) => {
      e.preventDefault();
      StreamUI.switchAuthState('signup');
    });

    linkGotoSignin?.addEventListener('click', (e) => {
      e.preventDefault();
      StreamUI.switchAuthState('signin');
    });


    // Form Submissions
    const formSignin = document.getElementById('form-signin');
    const formSignup = document.getElementById('form-signup');
    const btnGoogleSignin = document.getElementById('btn-google-signin');
    const btnGoogleSignup = document.getElementById('btn-google-signup');

    btnGoogleSignin?.addEventListener('click', () => StreamAuth.signInWithGoogle());
    btnGoogleSignup?.addEventListener('click', () => StreamAuth.signInWithGoogle());

    formSignin?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email')?.value || '';
      const password = document.getElementById('signin-password')?.value || '';
      StreamAuth.signInWithEmail(email, password);
    });

    formSignup?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name')?.value || '';
      const email = document.getElementById('signup-email')?.value || '';
      const password = document.getElementById('signup-password')?.value || '';
      StreamAuth.signUpWithEmail(email, password, name);
    });

    // Upgrade modal triggers
    btnUpgrade?.addEventListener('click', () => StreamUI.showUpgradeModal());
    btnMergeUpgrade?.addEventListener('click', () => StreamUI.showUpgradeModal());
    btnModalClose?.addEventListener('click', () => StreamUI.hideUpgradeModal());
    modalOverlay?.addEventListener('click', (e) => {
      if (e.target === modalOverlay) StreamUI.hideUpgradeModal();
    });

    const linkModalSignin = document.getElementById('link-modal-signin');
    linkModalSignin?.addEventListener('click', (e) => {
      e.preventDefault();
      StreamUI.hideUpgradeModal();
      StreamUI.showAuthModal('signin');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        StreamUI.hideUpgradeModal();
        StreamUI.hideAuthModal();
      }
    });

    // Stripe checkout
    btnCheckout?.addEventListener('click', handleCheckout);

    // ── Deal countdown timer ──────────────────────────────────────────────────
    (function startDealCountdown() {
      const COUNTDOWN_KEY = 'sv_deal_end';
      const DURATION_MS   = 24 * 60 * 60 * 1000; // 24 hours
      let endTime = parseInt(localStorage.getItem(COUNTDOWN_KEY) || '0', 10);
      if (!endTime || endTime < Date.now()) {
        endTime = Date.now() + DURATION_MS;
        localStorage.setItem(COUNTDOWN_KEY, String(endTime));
      }

      const el = document.getElementById('deal-countdown');
      if (!el) return;

      function tick() {
        const diff = Math.max(0, endTime - Date.now());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent =
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (diff === 0) {
          // Reset timer when it hits zero (keeps urgency alive)
          localStorage.removeItem(COUNTDOWN_KEY);
          endTime = Date.now() + DURATION_MS;
          localStorage.setItem(COUNTDOWN_KEY, String(endTime));
        }
      }

      tick();
      setInterval(tick, 1000);
    })();

    // Format tabs
    tabCombined?.addEventListener('click', () => StreamUI.switchFormatTab('combined'));
    tabVideo?.addEventListener('click',    () => StreamUI.switchFormatTab('video'));
    tabAudio?.addEventListener('click',    () => StreamUI.switchFormatTab('audio'));

    // Download / Merge buttons (event delegation on results container)
    const resultsSection = document.getElementById('view-results');
    console.log('[DEBUG] resultsSection found:', !!resultsSection);
    resultsSection?.addEventListener('click', (e) => {
      console.log('[DEBUG] click on resultsSection, target:', e.target.tagName, e.target.className);
      const btn = e.target.closest('[data-action]');
      console.log('[DEBUG] closest [data-action] btn:', btn ? btn.dataset.action : 'NOT FOUND');
      if (!btn) return;
      
      e.preventDefault();

      const action = btn.dataset.action;
      console.log('[DEBUG] action:', action, 'pageUrl:', btn.dataset.pageUrl ? btn.dataset.pageUrl.slice(0,50) : 'MISSING', 'formatId:', btn.dataset.formatId);
      if (action === 'download')  handleDownload(btn);
      else if (action === 'merge') handleMerge(btn);
      else if (action === 'upgrade') StreamUI.showUpgradeModal();
    });

    // Handle URL params on load (e.g., ?upgraded=true after Stripe redirect)
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      StreamUI.showToast('🎉 Welcome to Premium! Enjoy unlimited 4K downloads.', 'success', 6000);
      // Clean URL
      window.history.replaceState({}, '', '/');
    }

    // Handle dropped URLs
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
      if (text && text.startsWith('http') && urlInput) {
        urlInput.value = text;
        urlInput.dispatchEvent(new Event('input'));
        handleExtract(text);
      }
    });
  }

  // ── Auth State Listener ───────────────────────────────────────────────────
  function bindAuthState() {
    StreamAuth.onAuthChange(({ user, tier, usage }) => {
      StreamUI.updateNavAuth({ user, tier, usage });

      // Re-render results if tier changed and we have data
      if (lastExtractedData && currentState === State.SUCCESS) {
        StreamUI.renderResults(lastExtractedData, tier);
      }
    });
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    bindAuthState();
    StreamAuth.init();
    bindEvents();

    // Focus input on load
    urlInput?.focus();

    console.log('%c⬡ Click2Video%c loaded', 'color:#818cf8;font-weight:900;font-size:16px', 'color:#94a3b8');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
