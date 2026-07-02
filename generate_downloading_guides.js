const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const articlesDir = path.join(publicDir, 'articles');

const templates = {
  hls: [
    "To download video streams from HLS playlists, our backend first parses the {manifest_file} to retrieve all segment keys.",
    "By parsing the {manifest_file} dynamically, we reconstruct video tracks without triggering {cdn_limit} errors.",
    "Segmented streams are retrieved in parallel and stitched into a single output container to avoid frame dropouts.",
    "If the index track points to AES-128 encryption keys, the transcoders fetch the keys to decrypt the ts blocks in real-time.",
    "We automatically resolve buffer limitations on high-resolution streams by pre-allocating segment caches dynamically.",
    "Our HLS parser checks query parameters for validation keys, ensuring compatibility with geo-locked content servers."
  ],
  mobile: [
    "For mobile devices, direct saving to the local storage is limited by browser sandboxing. Use the {mobile_method} workaround.",
    "iOS clients should run Safari and tap the standard download indicator, saving raw files to the iCloud Files utility.",
    "On Android devices, downloads are routed to the target storage folder directly using the standard file manager app.",
    "To transfer video outputs to the local Photos app, save to Files first and then execute the 'Save Video' system menu.",
    "We recommend utilizing compatible third-party browser environments to bypass sandbox constraints on older mobile versions.",
    "If the mobile browser blocks direct downloads, generate the direct download URL and copy it to a secure downloader app."
  ],
  sync: [
    "If you observe sync issues, it is often due to {technical_error} mismatch between the audio and video streams.",
    "Stitching adaptive bitrate tracks requires analyzing audio track frame rates and aligning dynamic timestamp tags.",
    "We resolve variable frame rate problems by applying audio delays and constant conversion filters.",
    "Aligning separate tracks requires computing temporal offsets, mitigating drift on long-form transcodes.",
    "If sample rates drift on the client browser, force clean codec conversions using standard player presets.",
    "Our transcoders cross-check chunk lengths periodically to keep the combined file in absolute audio-video alignment."
  ],
  stitch: [
    "Premium extraction leverages multi-threaded download connections, bypassing {cdn_limit} to deliver maximum throughput.",
    "To merge 4K video streams with high-bitrate audio, we allocate dedicated processing threads on our cloud transcoders.",
    "Lossless container formats (like MKV, FLAC, and AAC) are utilized to preserve original upload quality parameters.",
    "Always verify that your network supports {bandwidth_need} speed, otherwise the manifest connection may timeout.",
    "Stitching high-fidelity tracks is an intense process, executing in ephemeral clusters to avoid resource blocks.",
    "Premium accounts bypass free-tier rate limits, obtaining high-priority queues on server-side compilation pipelines."
  ]
};

const dictionary = {
  media_type: ["high-definition MP4 videos", "lossless AAC audio files", "4K resolution video tracks", "segmented ts media chunks", "lossless FLAC streams"],
  manifest_file: [".m3u8 playlist configuration", "dynamic MPD manifest index", "HLS stream metadata source", "segmented video index track"],
  technical_error: ["sample rate mismatch", "fragmented audio codec frames", "dynamic manifest changes mid-stream", "packet dropouts on the client side", "CDN token expiration"],
  cdn_limit: ["dynamic platform rate-limiting", "geographic IP blocking", "obfuscated platform cookies", "temporary token authentication", "dynamic browser checks"],
  mobile_method: ["Safari 'Save to Files' utility", "Android download directory transfer", "cloud storage intermediary link", "local file explorer drag-and-drop"],
  bandwidth_need: ["at least 100Mbps", "a stable, high-throughput network", "low-latency broadband", "unmetered broadband connection"]
};

function generateParagraph(theme) {
  const list = templates[theme];
  let paragraph = "";
  for (let i = 0; i < 6; i++) {
    let sentence = list[Math.floor(Math.random() * list.length)];
    const matches = sentence.match(/\{([a-z_]+)\}/g) || [];
    matches.forEach(match => {
      const key = match.slice(1, -1);
      if (dictionary[key]) {
        const choice = dictionary[key][Math.floor(Math.random() * dictionary[key].length)];
        sentence = sentence.replace(match, choice);
      }
    });
    paragraph += sentence + " ";
  }
  return paragraph;
}

function generateContent(theme, initialText, targetWords = 1000) {
  let content = `<p>${initialText}</p>`;
  let currentWords = initialText.split(/\s+/).length;
  
  while (currentWords < targetWords) {
    const p1 = generateParagraph(theme);
    const p2 = generateParagraph(theme);
    const p3 = generateParagraph(theme);
    const combined = `${p1} ${p2} ${p3}`;
    currentWords += combined.split(/\s+/).length;
    content += `<p>${p1}</p><p>${p2}</p><ul><li>Ensuring absolute compliance and robust execution.</li><li>Maintaining high-availability fault tolerance.</li><li>Preserving exact technical specifications.</li></ul><p>${p3}</p>`;
  }
  return content;
}

const guides = [
  {
    title: "Downloading HLS (.m3u8) Streams in High Definition",
    date: "2026.06.25",
    readTime: "8 MIN READ",
    excerpt: "HLS streams require parsing individual fragment chunks and merging them dynamically...",
    content: generateContent("hls", "When initiating a download sequence for high-fidelity media, the backend extraction algorithm must seamlessly negotiate with the origin servers to parse complex manifest files (such as .m3u8).", 1200)
  },
  {
    title: "How to Save Videos Directly to iOS & Android Camera Roll",
    date: "2026.06.18",
    readTime: "5 MIN READ",
    excerpt: "Mobile browsers implement strict sandboxing rules. Learn the native methods to bypass this...",
    content: generateContent("mobile", "For mobile users on iOS, downloading directly to the camera roll requires specific browser behaviors. We highly recommend using Safari and utilizing the 'Save to Files' feature before moving it to your Photos app.", 1200)
  },
  {
    title: "Troubleshooting Audio-Video Multiplexing and Sync Issues",
    date: "2026.06.10",
    readTime: "10 MIN READ",
    excerpt: "When high-definition videos serve audio and video tracks separately, multiplexing offsets can occur...",
    content: generateContent("sync", "To download in 4K resolution, you must often merge separate high-fidelity video streams with high-bitrate audio streams. Our Premium tier automates this complex multiplexing process entirely on the server.", 1200)
  },
  {
    title: "Unlocking 4K Resolution and Lossless Audio Merges",
    date: "2026.05.30",
    readTime: "11 MIN READ",
    excerpt: "Maximize the potential of video extraction with server-side stitching at maximum bitrates...",
    content: generateContent("stitch", "When encountering geo-restricted content, downloading can become tricky. While our servers operate globally, some deeply restricted streams may require you to provide localized access tokens or utilize specific routing.", 1200)
  }
];

const outputHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Downloading Guides — Click2Video</title>
  <meta name="description" content="Tutorials and guides for downloading media on Click2Video." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Exo+2:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/styles.css?t=20260626_1946" />
  <style>
    .legal-wrapper {
      max-width: 1000px;
      margin: 0 auto;
      padding: 48px 24px 100px;
      position: relative;
      z-index: 1;
    }

    .legal-back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 40px;
      transition: color 0.2s;
      font-family: 'Exo 2', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      text-decoration: none;
    }
    .legal-back:hover { color: var(--cyan); }
    .legal-back svg { transition: transform 0.2s; }
    .legal-back:hover svg { transform: translateX(-4px); }

    .legal-header {
      margin-bottom: 48px;
      text-align: center;
    }

    .legal-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0,212,255,0.08);
      border: 1px solid rgba(0,212,255,0.2);
      border-radius: 100px;
      padding: 5px 16px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--cyan);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 20px;
      font-family: 'Exo 2', sans-serif;
    }

    .legal-title {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(1.8rem, 5vw, 2.8rem);
      font-weight: 800;
      background: linear-gradient(135deg, #00d4ff, #b300ff, #ff006e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
    }

    .legal-meta {
      font-size: 0.82rem;
      color: var(--text-muted);
      font-family: 'Exo 2', sans-serif;
    }

    /* Grid Layout */
    .blog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    /* Card styling */
    .blog-card {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 30px;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    }

    .blog-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 3px; height: 100%;
      background: linear-gradient(180deg, #00d4ff, #b300ff);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .blog-card:hover {
      border-color: rgba(0,212,255,0.2);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      transform: translateY(-4px);
    }
    .blog-card:hover::before { opacity: 1; }

    .card-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--cyan);
      margin-bottom: 15px;
      text-transform: uppercase;
      font-family: 'Exo 2', sans-serif;
      font-weight: 600;
    }

    .card-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.25rem;
      color: #fff;
      margin-bottom: 15px;
      line-height: 1.4;
    }

    .card-excerpt {
      color: var(--text-sec);
      font-size: 0.9rem;
      flex-grow: 1;
      margin-bottom: 25px;
      line-height: 1.6;
    }

    .read-btn {
      align-self: flex-start;
      background: transparent;
      color: var(--cyan);
      border: 1px solid rgba(0, 212, 255, 0.4);
      border-radius: 8px;
      padding: 10px 20px;
      font-family: 'Orbitron', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .read-btn:hover {
      background: rgba(0, 212, 255, 0.1);
      border-color: var(--cyan);
      box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
    }

    /* Modal Overlay */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(6, 7, 10, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-card {
      background: rgba(10, 11, 18, 0.9);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 40px;
      position: relative;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    .close-modal {
      position: absolute;
      top: 20px; right: 20px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 2rem;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s;
    }
    .close-modal:hover {
      color: var(--cyan);
    }

    .modal-body {
      margin-top: 15px;
    }
    
    .modal-body h2 {
      font-family: 'Orbitron', sans-serif;
      color: #fff;
      margin-bottom: 20px;
      font-size: 1.8rem;
      background: linear-gradient(135deg, #00d4ff, #b300ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .modal-body p {
      margin-bottom: 20px;
      color: var(--text-sec);
      font-size: 0.95rem;
      line-height: 1.8;
    }

    .modal-body ul {
      margin-bottom: 20px;
      padding-left: 20px;
      list-style: none;
    }
    
    .modal-body li {
      margin-bottom: 10px;
      font-size: 0.95rem;
      line-height: 1.7;
      color: var(--text-sec);
      position: relative;
      padding-left: 20px;
    }
    .modal-body li::before {
      content: '›';
      position: absolute;
      left: 0;
      color: var(--cyan);
      font-weight: 700;
    }

    @media (max-width: 640px) {
      .legal-wrapper { padding: 32px 16px 80px; }
      .blog-card { padding: 20px; }
      .modal-card { padding: 24px; }
    }
  </style>
</head>
<body>

  <!-- Aurora Background -->
  <div class="aurora" aria-hidden="true">
    <div class="aurora-orb aurora-orb--1"></div>
    <div class="aurora-orb aurora-orb--2"></div>
    <div class="aurora-orb aurora-orb--3"></div>
    <div class="grid-overlay"></div>
  </div>

  <div class="legal-wrapper">
    <a href="/" class="legal-back">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      Back to Home
    </a>
    
    <header class="legal-header">
      <div class="legal-badge">📚 Tutorials</div>
      <h1 class="legal-title">Downloading Guides</h1>
      <p class="legal-meta">Master the art of media extraction.</p>
    </header>

    <div class="blog-grid" id="guidesGrid">
      <!-- Cards generated dynamically -->
    </div>
  </div>

  <div class="modal-overlay" id="guideModal">
    <div class="modal-card">
      <button class="close-modal" id="closeModal">×</button>
      <div class="modal-body" id="modalBody">
        <!-- Injected Content -->
      </div>
    </div>
  </div>

  <script>
    const guides = ${JSON.stringify(guides, null, 2)};

    const grid = document.getElementById('guidesGrid');
    const modal = document.getElementById('guideModal');
    const modalBody = document.getElementById('modalBody');
    const closeBtn = document.getElementById('closeModal');

    // Render Cards
    guides.forEach((guide, index) => {
      const card = document.createElement('article');
      card.className = 'blog-card';
      card.innerHTML = \`
        <div class="card-meta">
          <span>\${guide.date}</span>
          <span>\${guide.readTime}</span>
        </div>
        <h2 class="card-title">\${guide.title}</h2>
        <p class="card-excerpt">\${guide.excerpt}</p>
        <button class="read-btn" onclick="openGuide(\${index})">Read Guide</button>
      \`;
      grid.appendChild(card);
    });

    // Modal Logic
    window.openGuide = (index) => {
      modalBody.innerHTML = guides[index].content;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };

    closeBtn.onclick = () => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    };

    window.onclick = (event) => {
      if (event.target == modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    };
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(articlesDir, 'downloading-guides.html'), outputHtml, 'utf8');
console.log('Downloading Guides generated successfully with pre-compiled unique text.');
