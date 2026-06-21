/**
 * auth.js — Firebase Client Auth
 * Handles Google Sign-In, sign-out, token management, and premium detection.
 * Gracefully degrades when Firebase is not configured.
 */

(function () {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey:            window.FIREBASE_API_KEY            || 'AIzaSyDw1KslV6aCj1rPQRZPyEMJC-cc7HtadqI',
    authDomain:        window.FIREBASE_AUTH_DOMAIN        || 'video-downloader-fd8ef.firebaseapp.com',
    projectId:         window.FIREBASE_PROJECT_ID         || 'video-downloader-fd8ef',
    storageBucket:     window.FIREBASE_STORAGE_BUCKET     || 'video-downloader-fd8ef.firebasestorage.app',
    messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || '820808226615',
    appId:             window.FIREBASE_APP_ID             || '1:820808226615:web:0128e41367b0b0fb152cb2',
    measurementId:     window.FIREBASE_MEASUREMENT_ID     || 'G-G6KBLVP4D8'
  };

  const isFirebaseConfigured =
    FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('YOUR_FIREBASE');

  let auth = null;
  let currentUser = null;
  let currentIdToken = null;
  let currentTier = 'free';
  let authListeners = [];
  let isDevMode = false;
  let signInInProgress = false;

  /**
   * Initialize Firebase Auth
   */
  async function init() {
    let config = { ...FIREBASE_CONFIG };
    try {
      const res = await fetch((window.API_BASE || '') + '/api/config');
      if (res.ok) {
        const serverConfig = await res.json();
        if (serverConfig) {
          if (serverConfig.env === 'development') {
            isDevMode = true;
          }
          if (serverConfig.razorpayKeyId) {
            window.RAZORPAY_KEY_ID = serverConfig.razorpayKeyId;
          }
          if (serverConfig.firebase) {
            // Merge non-null server values
            for (const key in serverConfig.firebase) {
              if (serverConfig.firebase[key]) {
                config[key] = serverConfig.firebase[key];
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Auth] Failed to fetch server config, using fallback defaults:', e);
    }

    const isConfigured = config.apiKey && !config.apiKey.includes('YOUR_FIREBASE');

    if (!isConfigured) {
      console.warn('[Auth] Firebase not configured — running in anonymous mode.');
      notifyListeners({ user: null, tier: 'free', idToken: null });
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      auth = firebase.auth();

      auth.onAuthStateChanged(async (user) => {
        console.log('[Auth] onAuthStateChanged fired. User:', user ? user.email : 'null');
        currentUser = user;
        if (user) {
          try {
            currentIdToken = await user.getIdToken();
            console.log('[Auth] ID Token retrieved. Verifying with server...');
            // Verify with server to get tier
            const info = await StreamAPI.apiVerifyAuth(currentIdToken);
            console.log('[Auth] Server verification successful. Tier:', info.tier);
            currentTier = info.tier;
          } catch (e) {
            console.error('[Auth] Server verification failed:', e);
            currentTier = 'free';
          }
        } else {
          currentIdToken = null;
          currentTier = 'free';
        }
        notifyListeners({ user, tier: currentTier, idToken: currentIdToken });
      });

      // Handle redirect result on load
      auth.getRedirectResult()
        .then((result) => {
          if (result && result.user) {
            console.log('[Auth] Redirect sign-in success:', result.user.email);
            setTimeout(() => {
              if (currentTier === 'free') {
                StreamUI.showUpgradeModal();
              }
            }, 1200);
          }
        })
        .catch((e) => {
          console.error('[Auth] Redirect result error:', e);
          if (e.code !== 'auth/redirect-cancelled-by-user') {
            alert(`Sign-in Redirect Error:\nCode: ${e.code}\nMessage: ${e.message}`);
            StreamUI.showToast(`Sign-in redirect failed: ${e.message}`, 'error');
          }
        });
    } catch (e) {
      console.error('[Auth] Firebase init error:', e);
      notifyListeners({ user: null, tier: 'free', idToken: null });
    }
  }

  /**
   * Sign in with Google popup (with redirect fallback).
   */
  async function signInWithGoogle() {
    if (signInInProgress) {
      console.log('[Auth] Sign-in already in progress, ignoring click.');
      return;
    }
    console.log('[Auth] signInWithGoogle clicked.');
    if (!auth) {
      StreamUI.showToast('Firebase is not configured. Sign-in unavailable.', 'warning');
      return;
    }
    
    signInInProgress = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      console.log('[Auth] Attempting signInWithRedirect...');
      await auth.signInWithRedirect(provider);
    } catch (e) {
      console.error('[Auth] Sign-in redirect error:', e);
      
      // If we are in development mode, offer a local test account fallback
      if (isDevMode) {
        console.log('[Auth] Dev mode active, offering local test account fallback...');
        const useTest = confirm(
          `Google Sign-In redirect failed (${e.code || e.message}).\n\nWould you like to sign in using a Developer Test Account for local testing?`
        );
        if (useTest) {
          const isPremium = confirm("Press OK to sign in as a PREMIUM test user, or CANCEL to sign in as a FREE test user.");
          await signInWithMock(isPremium ? 'premium' : 'free');
          return;
        }
      }

      alert(`Sign-in Error:\nCode: ${e.code}\nMessage: ${e.message}`);
      StreamUI.showToast(`Sign-in failed: ${e.message}`, 'error');
      signInInProgress = false;
    }
  }

  /**
   * Simulated/Mock sign-in for testing/sandbox environments.
   */
  async function signInWithMock(role) {
    console.log('[Auth] signInWithMock called with role:', role);
    currentUser = {
      uid: role === 'premium' ? 'mock-uid-premium-123' : 'mock-uid-free-123',
      email: role === 'premium' ? 'premium-test@example.com' : 'free-test@example.com',
      displayName: role === 'premium' ? 'Premium Test User' : 'Free Test User',
      photoURL: 'https://www.gstatic.com/images/branding/product/2x/avatar_128dp.png',
      getIdToken: async () => `mock-token-${role}`,
    };
    currentIdToken = `mock-token-${role}`;
    currentTier = role;
    
    // Also notify server to register the mock user if backend is running
    try {
      const info = await StreamAPI.apiVerifyAuth(currentIdToken);
      console.log('[Auth] Mock server verification successful:', info);
      currentTier = info.tier;
    } catch (e) {
      console.warn('[Auth] Mock server verification failed:', e);
    }

    notifyListeners({ user: currentUser, tier: currentTier, idToken: currentIdToken });
    StreamUI.showToast(`Signed in as ${role === 'premium' ? 'Premium' : 'Free'} Test User.`, 'success');

    if (currentTier === 'free') {
      setTimeout(() => {
        StreamUI.showUpgradeModal();
      }, 500);
    }
  }

  /**
   * Sign out current user.
   */
  async function signOut() {
    if (currentUser && currentUser.uid && currentUser.uid.startsWith('mock-')) {
      currentUser = null;
      currentIdToken = null;
      currentTier = 'free';
      notifyListeners({ user: null, tier: 'free', idToken: null });
      StreamUI.showToast('Signed out successfully.', 'info');
      return;
    }
    if (!auth) return;
    try {
      await auth.signOut();
      StreamUI.showToast('Signed out successfully.', 'info');
    } catch (e) {
      StreamUI.showToast(`Sign-out error: ${e.message}`, 'error');
    }
  }

  /**
   * Get a fresh ID token (refreshes if expired).
   */
  async function getIdToken() {
    if (!currentUser) return null;
    try {
      currentIdToken = await currentUser.getIdToken(/* forceRefresh = */ false);
      return currentIdToken;
    } catch {
      return null;
    }
  }

  /**
   * Register an auth state change listener.
   * Callback receives { user, tier, idToken }.
   */
  function onAuthChange(callback) {
    authListeners.push(callback);
  }

  function notifyListeners(state) {
    authListeners.forEach((cb) => cb(state));
  }

  /**
   * Sign in with Email and Password
   */
  async function signInWithEmail(email, password) {
    if (signInInProgress) return;
    signInInProgress = true;
    try {
      // Mock bypass for admin account
      if (email === 'arjitdaga@example.com' && password === '12345') {
        console.log('[Auth] Intercepting admin sign-in bypass...');
        currentUser = {
          uid: 'mock-uid-admin-arjit',
          email: 'arjitdaga@example.com',
          displayName: 'Arjit Daga (Admin)',
          photoURL: 'https://ui-avatars.com/api/?name=Arjit+Daga&background=6366f1&color=fff',
          getIdToken: async () => 'mock-token-admin-arjit',
        };
        currentIdToken = 'mock-token-admin-arjit';
        currentTier = 'premium';
        
        try {
          const info = await StreamAPI.apiVerifyAuth(currentIdToken);
          currentTier = info.tier;
        } catch (e) {
          console.warn('[Auth] Admin verify failed, using local override:', e);
        }

        notifyListeners({ user: currentUser, tier: currentTier, idToken: currentIdToken });
        StreamUI.showToast('Logged in as Admin (Premium)!', 'success');
        StreamUI.hideAuthModal();
        return;
      }

      if (!auth) throw new Error('Firebase is not initialized.');
      console.log('[Auth] Attempting email sign-in...');
      await auth.signInWithEmailAndPassword(email, password);
      console.log('[Auth] Email sign-in successful.');
      StreamUI.showToast('Signed in successfully!', 'success');
      StreamUI.hideAuthModal();
      
      setTimeout(() => {
        if (currentTier === 'free') {
          StreamUI.showUpgradeModal();
        }
      }, 800);
    } catch (e) {
      console.error('[Auth] Email sign-in error:', e);
      alert(`Sign-in Error:\n${e.message}`);
      StreamUI.showToast(`Sign-in failed: ${e.message}`, 'error');
    } finally {
      signInInProgress = false;
    }
  }

  /**
   * Sign up with Email and Password
   */
  async function signUpWithEmail(email, password, displayName) {
    if (signInInProgress) return;
    signInInProgress = true;
    try {
      if (!auth) throw new Error('Firebase is not initialized.');
      console.log('[Auth] Attempting email sign-up...');
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      
      // Update display name and avatar
      if (credential.user) {
        await credential.user.updateProfile({
          displayName: displayName || 'User',
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=6366f1&color=fff`
        });
        
        // Force refresh current user
        currentUser = auth.currentUser;
        currentIdToken = await currentUser.getIdToken();
        const info = await StreamAPI.apiVerifyAuth(currentIdToken);
        currentTier = info.tier;
        notifyListeners({ user: currentUser, tier: currentTier, idToken: currentIdToken });
      }
      
      console.log('[Auth] Email sign-up successful.');
      StreamUI.showToast('Account created successfully!', 'success');
      StreamUI.hideAuthModal();

      setTimeout(() => {
        if (currentTier === 'free') {
          StreamUI.showUpgradeModal();
        }
      }, 800);
    } catch (e) {
      console.error('[Auth] Email sign-up error:', e);
      alert(`Sign-up Error:\n${e.message}`);
      StreamUI.showToast(`Sign-up failed: ${e.message}`, 'error');
    } finally {
      signInInProgress = false;
    }
  }

  // Expose globally
  window.StreamAuth = {
    init,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithMock,
    signOut,
    getIdToken,
    onAuthChange,
    get currentUser()   { return currentUser; },
    get currentTier()   { return currentTier; },
    get currentIdToken(){ return currentIdToken; },
    get isPremium()     { return currentTier === 'premium'; },
    get isDevMode()     { return isDevMode; },
  };
})();
