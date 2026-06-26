const express = require('express');
const path = require('path');
const fs = require('fs');
const allowedExtractors = require('../utils/allowedExtractors'); // This is a Set

const router = express.Router();
const DOMAIN = 'https://click2video.com';

// ── 1. robots.txt ─────────────────────────────────────────────────────────────
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`);
});

// ── 2. sitemap.xml ────────────────────────────────────────────────────────────
router.get('/sitemap.xml', (req, res) => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Home page
  xml += `  <url>\n    <loc>${DOMAIN}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
  
  // Legal pages
  ['terms.html', 'privacy.html', 'copyright.html'].forEach(page => {
    xml += `  <url>\n    <loc>${DOMAIN}/legal/${page}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.3</priority>\n  </url>\n`;
  });

  // Dynamic Platform Pages
  for (const extractor of allowedExtractors) {
    // Only include sensible alphanumeric names to avoid weird URLs
    if (/^[a-z0-9]+$/.test(extractor)) {
      xml += `  <url>\n    <loc>${DOMAIN}/${extractor}-video-downloader</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }
  }
  
  xml += `</urlset>`;
  
  res.type('application/xml');
  res.send(xml);
});

// ── 3. Dynamic SEO Meta Injection ─────────────────────────────────────────────
// Intercepts URLs like /instagram-video-downloader
router.get('/:platform-video-downloader', (req, res, next) => {
  const platformRaw = req.params.platform;
  
  // Basic sanity check to ensure it's a valid string
  if (!platformRaw || typeof platformRaw !== 'string' || !/^[a-z0-9]+$/.test(platformRaw)) {
    return next(); // Fallback to normal SPA handling
  }
  
  const platform = platformRaw.charAt(0).toUpperCase() + platformRaw.slice(1);
  const title = `Download ${platform} Videos - Best ${platform} Video Downloader`;
  const description = `Free, fast, and secure ${platform} video downloader. Download high-quality HD and 4K videos from ${platform} instantly with Click2Video. No watermarks.`;
  const keywords = `${platform} video downloader, download ${platform} videos, save ${platform} video, ${platform} downloader 4k`;
  
  // GEO & AEO Structured Data (JSON-LD)
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": `${platform} Video Downloader`,
    "operatingSystem": "All",
    "applicationCategory": "MultimediaApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": `How do I download a video from ${platform}?`,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": `To download a video from ${platform}, simply copy the video URL from ${platform}, paste it into the Click2Video search box, and click Download. You can choose to download in HD or 4K quality.`
      }
    }]
  };

  const jsonLdScript = `
  <script type="application/ld+json">
    ${JSON.stringify(softwareSchema)}
  </script>
  <script type="application/ld+json">
    ${JSON.stringify(faqSchema)}
  </script>
  `;

  const indexPath = path.join(__dirname, '../../public/index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      console.error('Error reading index.html for SEO rendering:', err);
      return next();
    }

    // Replace <title>
    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    
    // Replace <meta name="description">
    html = html.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/>/i,
      `<meta name="description" content="${description}" />`
    );
    
    // Replace <meta name="keywords">
    html = html.replace(
      /<meta\s+name="keywords"\s+content=".*?"\s*\/>/i,
      `<meta name="keywords" content="${keywords}" />`
    );

    // Replace Open Graph title and description
    html = html.replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/>/i,
      `<meta property="og:title" content="${title}" />`
    );
    html = html.replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/>/i,
      `<meta property="og:description" content="${description}" />`
    );

    // Inject JSON-LD right before </head>
    html = html.replace('</head>', `${jsonLdScript}\n</head>`);

    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache SEO pages for 1 day at edge
    res.send(html);
  });
});

module.exports = router;
