const fs = require('fs');
const allowedExtractors = require('./server/utils/allowedExtractors');
const DOMAIN = 'https://click2video.com';

let urls = DOMAIN + '/\n';
urls += ['terms.html', 'privacy.html', 'copyright.html'].map(page => `${DOMAIN}/legal/${page}\n`).join('');
urls += `${DOMAIN}/about.html\n`;
urls += `${DOMAIN}/articles/antigravity-physics-explained.html\n`;

for (const extractor of allowedExtractors) {
  if (/^[a-z0-9]+$/.test(extractor)) {
    urls += `${DOMAIN}/${extractor}-video-downloader\n`;
  }
}

fs.writeFileSync('seo_urls.txt', urls);
console.log('Wrote ' + urls.split('\n').length + ' URLs to seo_urls.txt');
