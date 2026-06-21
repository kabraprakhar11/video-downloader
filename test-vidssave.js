const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Intercept network requests
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.method() !== 'GET' && request.method() !== 'OPTIONS') {
        console.log('REQUEST:', request.method(), request.url(), request.postData());
    }
    request.continue();
  });
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') || url.includes('download') || url.includes('extract') || url.includes('parse') || url.includes('youtube')) {
        console.log('RESPONSE:', response.status(), url);
        try {
            const text = await response.text();
            console.log('BODY:', text.substring(0, 500));
        } catch(e) {}
    }
  });

  console.log('Navigating to vidssave.com...');
  await page.goto('https://vidssave.com', { waitUntil: 'networkidle2' });
  
  console.log('Typing URL...');
  await page.type('input', 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  
  console.log('Clicking download...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const downloadBtn = buttons.find(b => b.textContent && b.textContent.includes('Download'));
    if (downloadBtn) {
        downloadBtn.click();
    }
  });

  // Wait for a bit for requests to be made
  await new Promise(r => setTimeout(r, 10000));
  
  await browser.close();
})();
