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
  
  // Legal & Info pages
  ['terms.html', 'privacy.html', 'copyright.html', '../about.html', '../supported-sites.html', '../articles/antigravity-physics-explained.html'].forEach(page => {
    // Note: page might be '../about.html', so we clean it up for the loc URL
    const urlPath = page.startsWith('../') ? page.replace('../', '') : `legal/${page}`;
    xml += `  <url>\n    <loc>${DOMAIN}/${urlPath}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
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
  const canonicalUrl = `${DOMAIN}/${platformRaw}-video-downloader`;
  
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
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Is downloading ${platform} videos completely free?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Yes, downloading videos from ${platform} up to 720p HD is 100% free with no daily limits. We also offer an optional Premium tier for 4K resolution.`
        }
      },
      {
        "@type": "Question",
        "name": `How do I download a video from ${platform}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `To download a video from ${platform}, simply copy the video URL from ${platform}, paste it into the Click2Video search box, and click Extract & Download.`
        }
      },
      {
        "@type": "Question",
        "name": `Is it safe to download from ${platform} using Click2Video?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Absolutely. We do not host any of the videos you download on our servers, nor do we inject watermarks or malware. The extraction is done ephemerally, ensuring complete user privacy.`
        }
      }
    ]
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `How to download ${platform} videos`,
    "description": `Learn how to quickly and safely download videos from ${platform} using Click2Video.`,
    "step": [
      {
        "@type": "HowToStep",
        "name": "Copy the Video URL",
        "text": `Find the video you want to download on ${platform} and copy its URL to your clipboard.`
      },
      {
        "@type": "HowToStep",
        "name": "Paste and Extract",
        "text": `Paste the link into the Click2Video search box and click 'Extract & Download'.`
      },
      {
        "@type": "HowToStep",
        "name": "Select Quality and Download",
        "text": `Choose your preferred format, such as 4K video or high-quality MP3 audio, and save it directly to your device.`
      }
    ]
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": title,
    "description": description,
    "author": {
      "@type": "Organization",
      "name": "Click2Video"
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [{
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": DOMAIN
    },{
      "@type": "ListItem",
      "position": 2,
      "name": `${platform} Video Downloader`,
      "item": canonicalUrl
    }]
  };

  const jsonLdScript = `
  <script type="application/ld+json">
    ${JSON.stringify(softwareSchema)}
  </script>
  <script type="application/ld+json">
    ${JSON.stringify(faqSchema)}
  </script>
  <script type="application/ld+json">
    ${JSON.stringify(howToSchema)}
  </script>
  <script type="application/ld+json">
    ${JSON.stringify(articleSchema)}
  </script>
  <script type="application/ld+json">
    ${JSON.stringify(breadcrumbSchema)}
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
    
    // Replace canonical URL
    html = html.replace(
      /<link\s+rel="canonical"\s+href=".*?"\s*\/>/i,
      `<link rel="canonical" href="${canonicalUrl}" />`
    );

    // Make H1 more relevant to the platform
    html = html.replace(
      /Download Any<br\/>/i,
      `Download ${platform}<br/>`
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

    // Replace Twitter Card title and description
    html = html.replace(
      /<meta\s+name="twitter:title"\s+content=".*?"\s*\/>/i,
      `<meta name="twitter:title" content="${title}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:description"\s+content=".*?"\s*\/>/i,
      `<meta name="twitter:description" content="${description}" />`
    );

    // Make AEO visible sections platform specific
    html = html.replace(
      /How to Download Videos/g,
      `How to Download ${platform} Videos`
    );
    html = html.replace(
      /How to download videos with Click2Video/g,
      `How to download ${platform} videos with Click2Video`
    );
    html = html.replace(
      /on any supported platform \(Twitter, Reddit, Vimeo, etc.\)/g,
      `on ${platform}`
    );

    // Inject JSON-LD right before </head>
    html = html.replace('</head>', `${jsonLdScript}\n</head>`);

    // Inject Visible SEO Content into the DOM
    const visibleSEOContent = `
    <style>
      .seo-article { max-width: 800px; margin: 40px auto; padding: 20px; color: #94a3b8; font-family: 'Exo 2', sans-serif; line-height: 1.6; }
      .seo-article h2 { color: #fff; font-family: 'Orbitron', sans-serif; margin-top: 32px; margin-bottom: 16px; font-size: 1.5rem; }
      .seo-article h3 { color: #fff; margin-top: 24px; margin-bottom: 12px; font-size: 1.2rem; }
      .seo-article p { margin-bottom: 16px; }
      .seo-article ol { padding-left: 20px; margin-bottom: 16px; }
      .seo-article li { margin-bottom: 8px; }
      .seo-faq-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 16px; border-radius: 8px; margin-bottom: 16px; }
      .seo-faq-item h3 { margin-top: 0; color: #b300ff; }
      .seo-faq-item p { margin-bottom: 0; }
    </style>
    <article class="seo-article">
      <h2>Why use our ${platform} Video Downloader?</h2>
      <p>Click2Video is the ultimate <strong>${platform} video downloader</strong> designed for speed, security, and maximum quality. Unlike other tools that compress files, our extraction engine pulls the direct source file from ${platform}, ensuring you get the absolute highest resolution available—including brilliant 4K UHD when supported.</p>
      <p>Best of all, our service is completely free for standard downloads, requires no software installation, and never adds annoying watermarks to your videos.</p>
      
      <h2>How to Download Videos from ${platform}</h2>
      <ol>
        <li><strong>Copy the link:</strong> Open ${platform}, find the video or media you wish to save, and copy the URL from your address bar or share menu.</li>
        <li><strong>Paste the URL:</strong> Return to Click2Video and paste the copied link into the glowing search box above.</li>
        <li><strong>Extract & Save:</strong> Click the "Extract & Download" button. Our servers will instantly bypass restrictions, process the video, and provide you with high-quality MP4 or MP3 download links!</li>
      </ol>

      <h2>Frequently Asked Questions</h2>
      <div class="seo-faq-item">
        <h3>Is downloading ${platform} videos completely free?</h3>
        <p>Yes, downloading videos from ${platform} up to 720p HD is 100% free with no daily limits. We also offer an optional Premium tier for 4K resolution and lossless audio.</p>
      </div>
      <div class="seo-faq-item">
        <h3>Is it safe to download from ${platform} using Click2Video?</h3>
        <p>Absolutely. We do not host any of the videos you download on our servers, nor do we inject watermarks or malware. The extraction is done ephemerally, ensuring complete user privacy.</p>
      </div>
    </article>
    `;
    
    html = html.replace('<div id="seo-content-injection"></div>', visibleSEOContent);

    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache SEO pages for 1 day at edge
    res.send(html);
  });
});

module.exports = router;
