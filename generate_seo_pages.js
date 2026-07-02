const fs = require('fs');
const path = require('path');
const allowedExtractors = require('./server/utils/allowedExtractors');

const DOMAIN = 'https://click2video.com';
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(publicDir, 'index.html');

const baseHtml = fs.readFileSync(indexPath, 'utf8');

// Function to capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

console.log(`Generating SEO pages for ${allowedExtractors.size} platforms...`);

let count = 0;
for (const platformRaw of allowedExtractors) {
  // e.g. "twitter" -> "Twitter"
  const platformName = capitalize(platformRaw);
  
  // Create title & canonical
  const dynamicTitle = `Download ${platformName} Videos - Best ${platformName} Video Downloader`;
  const canonicalUrl = `${DOMAIN}/${platformRaw}-video-downloader`;
  
  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": `${platformName} Video Downloader`,
    "operatingSystem": "Any",
    "applicationCategory": "MultimediaApplication",
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD"
    },
    "description": `Download videos directly from ${platformName} for free. Fast, secure, and no installation required.`,
    "url": canonicalUrl
  };
  const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  
  // Replace title, canonical, and inject json-ld
  let modifiedHtml = baseHtml;
  modifiedHtml = modifiedHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${dynamicTitle}</title>`
  );
  modifiedHtml = modifiedHtml.replace(
    /<link\s+rel="canonical"\s+href=".*?"\s*\/>/i,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );
  modifiedHtml = modifiedHtml.replace(
    '<!-- Programmatic SEO Injection Point -->',
    jsonLdScript
  );
  
  // Save to public folder
  const fileName = `${platformRaw}-video-downloader.html`;
  const filePath = path.join(publicDir, fileName);
  fs.writeFileSync(filePath, modifiedHtml, 'utf8');
  count++;
}

console.log(`Successfully generated ${count} SEO pages in the public/ folder.`);
