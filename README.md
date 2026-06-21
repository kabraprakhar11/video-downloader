# StreamVault — Enterprise Video Downloader SaaS

A production-ready, full-stack video downloader SaaS built with Node.js/Express and a Vanilla JS SPA frontend.

## Quick Start

### 1. Install Prerequisites

| Tool | Install Command | Required For |
|------|----------------|--------------|
| **yt-dlp** | `pip install yt-dlp` or [download binary](https://github.com/yt-dlp/yt-dlp/releases) | Video extraction |
| **FFmpeg** | [Download](https://ffmpeg.org/download.html) + add to PATH | 4K audio merge |

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Stripe and Firebase keys
```

### 3. Start Server

```bash
npm start          # production
npm run dev        # development (auto-restart with nodemon)
```

Open **http://localhost:3000** in your browser.

---

## Architecture

```
server/
├── index.js                  Express entry point (Helmet, CORS, rate limiting)
├── routes/
│   ├── extract.js            POST /api/extract — yt-dlp JSON extraction
│   ├── proxy.js              GET  /api/proxy-download — CORS bypass stream proxy
│   ├── merge.js              GET  /api/merge — FFmpeg audio+video merge (Premium)
│   ├── stripe.js             POST /api/stripe/create-checkout + webhook
│   └── auth.js               POST /api/auth/verify — Firebase token verification
├── middleware/
│   ├── sanitize.js           URL allowlist validation, SSRF protection
│   ├── rateLimiter.js        Granular rate limits per endpoint
│   └── quota.js              Free tier: 3 downloads/day per IP
├── services/
│   ├── ytdlp.js              yt-dlp spawner (shell:false, no injection risk)
│   ├── ffmpeg.js             Piped FFmpeg merge → HTTP response stream
│   ├── firebase.js           Firebase Admin SDK (graceful degradation)
│   └── stripe.js             Stripe Checkout + webhook verification
public/
├── index.html                SPA shell (4 view states)
├── css/styles.css            Deep slate dark mode, glassmorphism, animations
└── js/
    ├── api.js                Fetch helpers + download trigger
    ├── auth.js               Firebase client auth
    ├── ui.js                 DOM manager + format card renderer
    └── app.js                State machine controller
```

## API Reference

### `POST /api/extract`
Extract video metadata and stream URLs.

**Body:** `{ "url": "https://youtube.com/watch?v=..." }`
**Headers:** `Authorization: Bearer <firebase-id-token>` (optional, for premium)

**Response:**
```json
{
  "success": true,
  "tier": "free",
  "quota": { "used": 1, "limit": 3, "remaining": 2 },
  "data": {
    "title": "...",
    "thumbnail": "...",
    "duration": 120,
    "formats": {
      "combined": [...],
      "videoOnly": [...],
      "audioOnly": [...]
    }
  }
}
```

### `GET /api/proxy-download`
CORS bypass proxy — streams remote file directly as an attachment download.

**Query:** `?url=<encoded-url>&filename=video.mp4`

### `GET /api/merge` ⭐ Premium
FFmpeg piped audio+video merge, streamed as MP4.

**Query:** `?videoUrl=<encoded>&audioUrl=<encoded>&filename=video&token=<firebase-token>`

### `POST /api/stripe/create-checkout`
Creates a Stripe Checkout session.

### `POST /api/webhooks/stripe`
Stripe webhook listener — upgrades user in Firestore on `checkout.session.completed`.

### `GET /api/health`
Server health check.

---

## Security Features

- **URL Allowlist** — only 15+ known video platforms accepted (SSRF protection)
- **Shell injection prevention** — `shell: false` on all child_process spawns
- **Helmet** — comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting** — tiered limits per endpoint (extraction: 12/min, merge: 6/min)
- **Input sanitization** — filename path traversal prevention
- **SSRF blocking** — private IP range rejection in proxy

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `YTDLP_PATH` | Path to yt-dlp binary |
| `FFMPEG_PATH` | Path to ffmpeg binary |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PREMIUM_PRICE_ID` | Stripe Price ID for premium plan |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin private key |
| `FIREBASE_API_KEY` | Firebase Web API key (public) |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain |

## Supported Platforms

YouTube, Twitter/X, Instagram, TikTok, Facebook, Vimeo, Dailymotion, Reddit, Twitch, SoundCloud, Bilibili, Niconico, Rumble, BitChute, Odysee, and 1000+ more via yt-dlp.
