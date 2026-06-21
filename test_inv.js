const https = require('https');

https.get('https://inv.thepixora.com/api/v1/videos/jNQXAC9IVRw', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.formatStreams || json.adaptiveFormats) {
        console.log('[SUCCESS] Fetched video metadata from Invidious API!');
        console.log('Title:', json.title);
        console.log('Formats found:', (json.formatStreams?.length || 0) + (json.adaptiveFormats?.length || 0));
      } else {
        console.log('[FAILED] Invalid response format:', Object.keys(json));
      }
    } catch (e) {
      console.error('[ERROR] Parsing JSON:', e.message);
    }
  });
}).on('error', e => console.error('[ERROR] Request:', e.message));
