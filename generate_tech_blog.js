const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const articlesDir = path.join(publicDir, 'articles');

const templates = {
  ffmpeg: [
    "Integrating {muxing_tool} into load-balanced serverless containers allows our backend to compile {media_type} segments without decreasing quality.",
    "During conversion cycles, the transcoder parses the {manifest_file} to align audio and video timestamps, avoiding {technical_error} drift.",
    "Our distributed execution nodes allocate dedicated memory stacks to handle intensive {muxing_tool} transcoding tasks on 4K resolutions.",
    "To achieve sub-second conversion latency, the pipeline buffers transient media tracks in ephemeral storage before running {muxing_tool}.",
    "We prevent output codec mismatch errors by forcing constant frame rate configurations and employing {muxing_tool} containers.",
    "The primary challenge in managing high-volume transcodes is resolving audio sample rate drifts caused by {technical_error} frames.",
    "By dynamically scaling our cloud workers, we isolate heavy {muxing_tool} operations, ensuring consistent uptime for all download queues."
  ],
  cdn: [
    "To bypass {cdn_limit}, our crawler nodes deploy virtual headprints that mimic browser footprints and cookie handshakes.",
    "Dynamic token renewal loops are executed periodically to extend stream validation times during massive {media_type} downloads.",
    "We route extraction requests through a secure proxy rotation network, effectively circumventing {cdn_limit} blocks.",
    "Obfuscated manifest queries frequently verify IP addresses, requiring our workers to implement geo-matched header injections.",
    "By parsing secret access hashes directly from incoming player payloads, we bypass {cdn_limit} threat checkers.",
    "To prevent geographic access restrictions, our nodes evaluate regional CDN latency profiles and select the optimal proxy route.",
    "Dynamic Cloudflare challenges are solved in secure sandbox containers, preventing {cdn_limit} triggers during high concurrency."
  ],
  signature: [
    "Decoding control flow flattening and web-pack obfuscations requires virtual sandboxing to extract active {technical_signature} keys.",
    "Our parser script reverse-engineers player JavaScript binaries, updating decryption routines automatically when the site deploys a new {technical_signature}.",
    "We intercept WebSocket handshakes to isolate key-exchange parameters, decrypting secure manifest hashes in real-time.",
    "Dynamic challenges are analyzed dynamically, injecting custom payloads to mimic original player states under headless conditions.",
    "To handle rolling changes to player signatures, our engine monitors code modifications on target platforms and runs decryptor audits.",
    "We emulate decryption routines using secure VM sandboxes in Node.js, protecting our environment from untrusted player scripts.",
    "Decoding signature obfuscations is an ongoing process, requiring frequent updates to our decryption library to preserve high success rates."
  ],
  arch: [
    "Our microservice architecture executes on Google Cloud Run, leveraging autoscaling containers to process heavy conversion loads.",
    "We deploy temporary caches to record converted media links, avoiding duplicate transcodes of popular target URLs.",
    "Task queuing is governed by RabbitMQ clusters, preventing job drops during extreme traffic peaks on our conversion pipelines.",
    "Network traffic is isolated using private security groups, shielding core transcoder nodes from public web threats.",
    "Firestore databases maintain real-time session tracking, coordinating tasks across load-balanced worker clusters.",
    "System resource allocation is optimized dynamically, spinning down idle containers to reduce overhead during off-peak hours.",
    "We implement Winston logging pipelines to log conversion statuses, tracing socket dropouts and stream terminations."
  ]
};

const dictionary = {
  media_type: ["high-definition MP4 videos", "lossless AAC audio files", "4K resolution video tracks", "segmented ts media chunks", "lossless FLAC streams"],
  manifest_file: [".m3u8 playlist configuration", "dynamic MPD manifest index", "HLS stream metadata source", "segmented video index track"],
  technical_error: ["sample rate mismatch", "fragmented audio codec frames", "dynamic manifest changes mid-stream", "packet dropouts on the client side", "CDN token expiration"],
  cdn_limit: ["dynamic platform rate-limiting", "geographic IP blocking", "obfuscated platform cookies", "temporary token authentication", "dynamic browser checks"],
  muxing_tool: ["cloud-based FFmpeg subroutines", "server-side binary muxing utilities", "our proprietary track merger script", "real-time container conversion tools"],
  technical_signature: ["manifest hashing mechanisms", "player signature keys", "JavaScript decryption challenges", "CDN tokenization algorithms", "stream manifest configurations"]
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

const articles = [
  {
    title: "Multiplexing Disparate Streams: The FFmpeg Pipeline",
    date: "2026.06.20",
    readTime: "7 MIN READ",
    excerpt: "Extracting multiplexed streams requires sophisticated manipulation of manifest files like .m3u8...",
    content: generateContent("ffmpeg", "Extracting multiplexed streams requires sophisticated manipulation of manifest files (like .m3u8). Our backend leverages advanced FFmpeg pipelines to seamlessly merge disjointed video and audio tracks in real-time.", 1200)
  },
  {
    title: "Bypassing Dynamic Tokenization in Modern CDNs",
    date: "2026.06.15",
    readTime: "12 MIN READ",
    excerpt: "The evolution of video streaming protocols has dramatically shifted how we consume media...",
    content: generateContent("cdn", "The evolution of video streaming protocols has dramatically shifted how we consume media. From the early days of progressive HTTP downloads to modern HLS and DASH, adaptive bitrate streaming now dominates the web.", 1200)
  },
  {
    title: "Algorithmic Reverse Engineering of Player Signatures",
    date: "2026.06.02",
    readTime: "9 MIN READ",
    excerpt: "As platforms employ dynamic JavaScript challenges, our extraction engines must adapt...",
    content: generateContent("signature", "As platforms employ dynamic JavaScript challenges, our extraction engines must utilise headless browser contexts and algorithmic reverse engineering.", 1200)
  },
  {
    title: "High-Availability Architecture for Video Extraction",
    date: "2026.05.28",
    readTime: "15 MIN READ",
    excerpt: "Ensuring full compliance with all relevant international standards and requirements...",
    content: generateContent("arch", "Ensuring full compliance with all relevant international standards and requirements while maintaining robust performance and security across all interacting systems.", 1200)
  }
];

const outputHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tech Blog — Click2Video</title>
  <meta name="description" content="Engineering and Tech Blog for Click2Video." />
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
      <div class="legal-badge">💻 Engineering</div>
      <h1 class="legal-title">Tech Blog</h1>
      <p class="legal-meta">Deep dives into video technology.</p>
    </header>

    <div class="blog-grid" id="blogGrid">
      <!-- Cards generated dynamically -->
    </div>
  </div>

  <div class="modal-overlay" id="articleModal">
    <div class="modal-card">
      <button class="close-modal" id="closeModal">×</button>
      <div class="modal-body" id="modalBody">
        <!-- Injected Content -->
      </div>
    </div>
  </div>

  <script>
    const articles = ${JSON.stringify(articles, null, 2)};

    const grid = document.getElementById('blogGrid');
    const modal = document.getElementById('articleModal');
    const modalBody = document.getElementById('modalBody');
    const closeBtn = document.getElementById('closeModal');

    // Render Cards
    articles.forEach((article, index) => {
      const card = document.createElement('article');
      card.className = 'blog-card';
      card.innerHTML = \`
        <div class="card-meta">
          <span>\${article.date}</span>
          <span>\${article.readTime}</span>
        </div>
        <h2 class="card-title">\${article.title}</h2>
        <p class="card-excerpt">\${article.excerpt}</p>
        <button class="read-btn" onclick="openArticle(\${index})">Read Article</button>
      \`;
      grid.appendChild(card);
    });

    // Modal Logic
    window.openArticle = (index) => {
      modalBody.innerHTML = articles[index].content;
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

fs.writeFileSync(path.join(articlesDir, 'tech-blog.html'), outputHtml, 'utf8');
console.log('Tech blog generated successfully with pre-compiled server-side unique text.');
