/**
 * ui.js — DOM manipulation helpers & component renderers
 * Manages view transitions, format card rendering, toasts, and the upgrade modal.
 */

(function () {
  'use strict';

  // ── View State Management ─────────────────────────────────────────────────
  const views = {
    idle:       document.getElementById('view-idle'),
    processing: document.getElementById('view-processing'),
    results:    document.getElementById('view-results'),
    error:      document.getElementById('view-error'),
  };

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
      if (el) el.classList.toggle('hidden', key !== name);
    });

    const btnNavBack = document.getElementById('btn-nav-back');
    if (btnNavBack) {
      btnNavBack.classList.toggle('hidden', name === 'idle');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Processing Step Ticker ────────────────────────────────────────────────
  const STEPS = [
    { id: 'step-1', label: 'Validating URL' },
    { id: 'step-2', label: 'Connecting to platform' },
    { id: 'step-3', label: 'Parsing media streams' },
    { id: 'step-4', label: 'Mapping quality formats' },
    { id: 'step-5', label: 'Preparing download options' },
  ];

  let stepTimers = [];
  let currentStep = 0;

  function startProcessingAnimation(url) {
    const stepEl = document.getElementById('processing-step');
    const urlEl  = document.getElementById('processing-url');
    if (urlEl) urlEl.textContent = url;

    // Reset all steps
    STEPS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active', 'done'); }
    });

    currentStep = 0;
    advanceStep();
  }

  function advanceStep() {
    stepTimers.forEach(clearTimeout);
    stepTimers = [];

    if (currentStep >= STEPS.length) return;

    const { id, label } = STEPS[currentStep];
    const stepEl = document.getElementById('processing-step');
    const itemEl = document.getElementById(id);

    // Mark previous as done
    if (currentStep > 0) {
      const prevEl = document.getElementById(STEPS[currentStep - 1].id);
      if (prevEl) { prevEl.classList.remove('active'); prevEl.classList.add('done'); }
    }

    if (itemEl) itemEl.classList.add('active');
    if (stepEl) {
      stepEl.style.animation = 'none';
      stepEl.offsetHeight; // reflow
      stepEl.style.animation = '';
      stepEl.textContent = label + '...';
    }

    currentStep++;
    const delay = 700 + Math.random() * 400;
    const t = setTimeout(advanceStep, delay);
    stepTimers.push(t);
  }

  function finishProcessingSteps() {
    stepTimers.forEach(clearTimeout);
    STEPS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active'); el.classList.add('done'); }
    });
  }

  // ── Quota Badge ───────────────────────────────────────────────────────────
  // ── Quota Badge ───────────────────────────────────────────────────────────
  function updateQuotaBadge(quota) {
    const badge = document.getElementById('quota-badge');
    if (!badge) return;
    if (!quota) {
      badge.style.display = 'none';
      return;
    }

    badge.style.display = 'inline-flex';

    if (quota.tier === 'premium') {
      badge.textContent = '⭐ Premium — Unlimited';
      badge.style.borderColor = 'rgba(245,158,11,0.35)';
      badge.style.color = '#f59e0b';
      badge.style.background = 'rgba(245,158,11,0.12)';
    } else {
      const remaining = quota.remaining ?? (quota.limit - quota.used);
      badge.textContent = `${remaining}/${quota.limit} free today`;
      badge.style.borderColor = remaining === 0 ? 'rgba(239,68,68,0.3)' : '';
      badge.style.color = remaining === 0 ? 'var(--error)' : '';
      badge.style.background = '';
    }
  }

  function updateNavAuth({ user, tier, usage }) {
    const authArea    = document.getElementById('auth-area');
    const userProfile = document.getElementById('user-profile');
    const userName    = document.getElementById('user-name');
    const userAvatar  = document.getElementById('user-avatar');
    const tierDot     = document.getElementById('user-tier-dot');
    const upgradeBtn  = document.getElementById('btn-upgrade');

    if (user) {
      authArea?.classList.add('hidden');
      userProfile?.classList.remove('hidden');
      if (userName) userName.textContent = user.displayName || user.email || 'User';
      if (userAvatar) {
        userAvatar.src = user.photoURL || 'https://www.gstatic.com/images/branding/product/2x/avatar_128dp.png';
        userAvatar.alt = user.displayName || 'User avatar';
      }
      if (tierDot) {
        tierDot.classList.toggle('premium', tier === 'premium');
      }

      // Update header badge
      if (usage) {
        updateQuotaBadge({
          tier,
          used: usage.used,
          limit: usage.limit,
          remaining: usage.remaining
        });
      } else {
        updateQuotaBadge({ tier });
      }
    } else {
      authArea?.classList.remove('hidden');
      userProfile?.classList.add('hidden');
      updateQuotaBadge(null); // Hide header badge when logged out
    }

    // Show/hide upgrade button
    if (upgradeBtn) {
      upgradeBtn.classList.toggle('hidden', tier === 'premium');
    }
  }

  // ── Format Card Renderer ─────────────────────────────────────────────────
  function getTierClass(tier) {
    const map = { '4K': '4k', '2K': '2k', 'FHD': 'fhd', 'HD': 'hd', 'SD': 'sd', 'audio': 'audio' };
    return map[tier] || 'sd';
  }

  function formatNumber(n) {
    if (!n) return null;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  }

  function createFormatCard(fmt, options = {}) {
    const { isPremium = false, bestAudio = null, videoTitle = 'video', pageUrl = '' } = options;
    const tierClass = getTierClass(fmt.qualityTier);
    // Use server-side flag — FHD/2K/4K require premium
    const isPremiumOnly = fmt.isPremiumOnly && !isPremium;

    const card = document.createElement('div');
    card.className = `format-card${isPremiumOnly ? ' premium-locked' : ''}`;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `${fmt.qualityTier} ${fmt.ext} format, ${fmt.filesizeHuman}`);

    // Quality label display
    const qualityLabel = fmt.type === 'audio-only'
      ? (fmt.tbr ? `${Math.round(fmt.tbr)}kbps` : 'Audio')
      : fmt.qualityTier;

    // Resolution display
    const resDisplay = fmt.resolution || fmt.quality || 'Unknown';

    // Codecs display
    const codecStr = [fmt.vcodec, fmt.acodec]
      .filter(Boolean)
      .filter(c => c !== 'none')
      .map(c => c.split('.')[0]) // shorten e.g. avc1.640028 → avc1
      .join(' + ');

    // FPS display
    const fpsStr = fmt.fps ? `${fmt.fps}fps` : '';

    // Actions HTML
    let actionsHtml = '';

    if (isPremiumOnly) {
      // Premium-locked card
      actionsHtml = `
        <button class="btn-download btn-premium-lock" data-action="upgrade" aria-label="Upgrade for ${qualityLabel}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1l2.753 5.576 6.158.895-4.455 4.342 1.051 6.13L12 14.902l-5.507 2.89 1.051-6.13L3.089 7.47l6.158-.895z"/></svg>
          Upgrade for ${qualityLabel}
        </button>
      `;
    } else if (fmt.type === 'video-only' && bestAudio && isPremium) {
      // Premium video-only with merge option
      actionsHtml = `
        <button class="btn-download" data-action="download" data-page-url="${escHtml(options.pageUrl || '')}" data-format-id="${escHtml(fmt.formatId)}" data-title="${escHtml(videoTitle)}" data-ext="${escHtml(fmt.ext)}" aria-label="Download video only">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Video Only
        </button>
        <button class="btn-merge" data-action="merge" data-page-url="${escHtml(options.pageUrl || '')}" data-format-id="${escHtml(fmt.formatId)}" data-audio-format-id="${escHtml(bestAudio.formatId)}" data-title="${escHtml(videoTitle)}" data-ext="${escHtml(fmt.ext)}" aria-label="Merge with audio">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>
          +Audio
        </button>
      `;
    } else if (fmt.type === 'video-only') {
      // Video only (no audio available or not premium)
      actionsHtml = `
        <button class="btn-download" data-action="download" data-page-url="${escHtml(options.pageUrl || '')}" data-format-id="${escHtml(fmt.formatId)}" data-title="${escHtml(videoTitle)}_video" data-ext="${escHtml(fmt.ext)}" aria-label="Download video only">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Video Only
        </button>
      `;
    } else {
      // Combined (audio+video) or audio-only — standard download
      actionsHtml = `
        <button class="btn-download" data-action="download" data-page-url="${escHtml(options.pageUrl || '')}" data-format-id="${escHtml(fmt.formatId)}" data-title="${escHtml(videoTitle)}" data-ext="${escHtml(fmt.ext)}" aria-label="Download ${qualityLabel} ${fmt.ext}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
      `;
    }

    card.innerHTML = `
      <div class="format-card-accent accent-${tierClass}" aria-hidden="true"></div>
      <div class="format-header">
        <span class="format-quality-badge badge-${tierClass}">${escHtml(qualityLabel)}</span>
        <span class="format-ext">${escHtml(fmt.ext)}</span>
      </div>
      <div class="format-details">
        <div class="format-resolution">${escHtml(resDisplay)}</div>
        <div class="format-meta-row">
          ${fpsStr ? `<span class="format-meta-item">${escHtml(fpsStr)}</span>` : ''}
          ${fmt.filesizeHuman ? `<span class="format-filesize">${escHtml(fmt.filesizeHuman)}</span>` : ''}
        </div>
        ${codecStr ? `<div class="format-codecs">${escHtml(codecStr)}</div>` : ''}
      </div>
      <div class="format-actions">
        ${actionsHtml}
      </div>
    `;

    return card;
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Results Renderer ──────────────────────────────────────────────────────
  function renderResults(data, tier) {
    const { data: info, quota } = data;
    const isPremium = tier === 'premium';

    // Metadata
    const thumbnail = document.getElementById('result-thumbnail');
    const title     = document.getElementById('result-title');
    const duration  = document.getElementById('result-duration');
    const platform  = document.getElementById('result-platform');
    const uploaderEl= document.getElementById('result-uploader-name');
    const viewsEl   = document.getElementById('result-views-count');
    const descEl    = document.getElementById('result-description');
    const tierBadge = document.getElementById('result-tier-badge');

    if (thumbnail) {
      if (info.thumbnail) {
        // Proxy thumbnail through backend to bypass CORS/CSP issues with external CDNs
        thumbnail.src = (window.API_BASE || '') + '/api/thumbnail?url=' + encodeURIComponent(info.thumbnail);
      } else {
        thumbnail.src = '';
      }
      thumbnail.alt = info.title || 'Video thumbnail';
    }
    if (title)     title.textContent = info.title || 'Untitled';
    if (duration)  duration.textContent = info.durationFormatted || '';
    if (platform)  platform.textContent = info.extractor || '';
    if (uploaderEl) uploaderEl.textContent = info.uploader || '';
    if (viewsEl)   viewsEl.textContent = info.viewCount ? `${formatNumber(info.viewCount)} views` : '';
    if (descEl)    descEl.textContent = info.description || '';

    if (tierBadge) {
      tierBadge.textContent = isPremium ? '⭐ Premium' : 'Free';
      tierBadge.className = `meta-item tier-badge ${isPremium ? 'premium' : 'free'}`;
    }

    // Update quota badge
    updateQuotaBadge(quota);

    // Format grids
    const pageUrl = info.webpage_url || '';
    renderGrid('grid-combined', info.formats.combined, isPremium, info.bestAudio, info.title, pageUrl);
    renderGrid('grid-video',    info.formats.videoOnly, isPremium, info.bestAudio, info.title, pageUrl);
    renderGrid('grid-audio',    info.formats.audioOnly, isPremium, null, info.title, pageUrl);

    // Show/hide merge notice
    const mergeNotice = document.getElementById('merge-notice');
    if (mergeNotice) {
      mergeNotice.classList.toggle('hidden', isPremium || !info.hasHDFormats);
    }

    // Reset tabs to "combined"
    switchFormatTab('combined');
  }

  function renderGrid(gridId, formats, isPremium, bestAudio, videoTitle, pageUrl) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (!formats || formats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'format-empty';
      empty.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>No formats available in this category.</p>
      `;
      grid.appendChild(empty);
      return;
    }

    [...formats].reverse().forEach((fmt) => {
      const card = createFormatCard(fmt, { isPremium, bestAudio, videoTitle, pageUrl });
      grid.appendChild(card);
    });
  }

  // ── Format Tab Switching ──────────────────────────────────────────────────
  function switchFormatTab(tab) {
    ['combined', 'video', 'audio'].forEach((t) => {
      const tabEl   = document.getElementById(`tab-${t}`);
      const panelEl = document.getElementById(`panel-${t}`);
      const isActive = t === tab;
      if (tabEl)   { tabEl.classList.toggle('active', isActive); tabEl.setAttribute('aria-selected', isActive); }
      if (panelEl) panelEl.classList.toggle('active', isActive);
    });
  }

  // ── Toast Notifications ───────────────────────────────────────────────────
  const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] || 'ℹ️'}</span>
      <span class="toast-text">${escHtml(message)}</span>
    `;

    container.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 320);
    };

    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  // ── Upgrade Modal ─────────────────────────────────────────────────────────
  function showUpgradeModal() {
    const modal = document.getElementById('modal-upgrade');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideUpgradeModal() {
    const modal = document.getElementById('modal-upgrade');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Auth Modal ────────────────────────────────────────────────────────────
  function showAuthModal(state = 'signin') {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    switchAuthState(state);
  }

  function hideAuthModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function switchAuthState(state) {
    const signinView = document.getElementById('auth-state-signin');
    const signupView = document.getElementById('auth-state-signup');
    if (signinView && signupView) {
      signinView.classList.toggle('hidden', state !== 'signin');
      signupView.classList.toggle('hidden', state !== 'signup');
    }
  }

  // ── Download Button Progress Bar ──────────────────────────────────────────
  function setDownloadProgress(btn, percent) {
    if (!btn) return;

    // null = reset to original state
    if (percent === null) {
      btn.disabled = false;
      btn.style.background = '';
      btn.style.backgroundSize = '';
      btn.classList.remove('loading');
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
      return;
    }

    // Save original HTML once
    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('loading');
    }

    if (percent === 0) {
      btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Starting...
      </span>`;
      btn.style.background = `var(--color-primary, #6366f1)`;
      return;
    }

    if (percent === 100) {
      btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Saving...
      </span>`;
      btn.style.background = `#22c55e`;
      return;
    }

    // Live percentage — green fill grows left to right
    const pct = Math.max(0, Math.min(100, percent));
    btn.innerHTML = `<span style="display:flex;align-items:center;gap:6px;width:100%;justify-content:center">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
      ${pct}%
    </span>`;
    btn.style.background = `linear-gradient(90deg, #22c55e ${pct}%, rgba(34,197,94,0.15) ${pct}%)`;
    btn.style.transition = 'background 0.3s ease';
  }

  // Expose globally
  window.StreamUI = {
    showView,
    startProcessingAnimation,
    finishProcessingSteps,
    updateNavAuth,
    updateQuotaBadge,
    renderResults,
    switchFormatTab,
    showToast,
    showUpgradeModal,
    hideUpgradeModal,
    showAuthModal,
    hideAuthModal,
    switchAuthState,
    setDownloadProgress,
    formatNumber,
  };
})();
