const fs = require('fs');
const path = require('path');
const extractors = require('../utils/allowedExtractors');

const htmlStart = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Supported Sites - Click2Video</title>
  <meta name="description" content="Click2Video supports downloading videos from over 1,000 platforms including YouTube, Twitter, TikTok, and Reddit. See the full list here.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Exo+2:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #050510;
      color: #ffffff;
      font-family: 'Exo 2', sans-serif;
      margin: 0;
      padding: 40px 20px;
      line-height: 1.6;
    }
    h1 {
      font-family: 'Orbitron', sans-serif;
      text-align: center;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #00d4ff, #b300ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      text-align: center;
      color: #94a3b8;
      margin-bottom: 40px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .site-link {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px 16px;
      border-radius: 8px;
      color: #fff;
      text-decoration: none;
      font-size: 0.9rem;
      transition: all 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .site-link:hover {
      background: rgba(179, 0, 255, 0.1);
      border-color: #b300ff;
      transform: translateY(-2px);
    }
    .back-link {
      display: inline-block;
      margin-bottom: 30px;
      color: #00d4ff;
      text-decoration: none;
    }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div style="max-width: 1200px; margin: 0 auto;">
    <a href="/" class="back-link">&larr; Back to Click2Video</a>
    <h1>Supported Video Platforms</h1>
    <p class="subtitle">We support high-speed video extraction from over 1,000 websites. Click any platform below to start downloading.</p>
    
    <div class="grid">
`;

let htmlLinks = '';
for (const ext of extractors) {
  if (/^[a-z0-9]+$/.test(ext)) {
    const capitalized = ext.charAt(0).toUpperCase() + ext.slice(1);
    htmlLinks += `      <a href="/${ext}-video-downloader" class="site-link">${capitalized} Downloader</a>\n`;
  }
}

const htmlEnd = `    </div>
  </div>
</body>
</html>`;

const fullHtml = htmlStart + htmlLinks + htmlEnd;

const outputPath = path.join(__dirname, '../../public/supported-sites.html');
fs.writeFileSync(outputPath, fullHtml);
console.log('Successfully generated supported-sites.html with ' + Array.from(extractors).length + ' links.');
