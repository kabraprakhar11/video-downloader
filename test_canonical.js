const https = require('https');
https.get('https://click2video.com/twitter-video-downloader', res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const match = data.match(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i);
    console.log('Live canonical:', match ? match[0] : 'No canonical found');
    
    // also check title
    const titleMatch = data.match(/<title>.*?<\/title>/i);
    console.log('Live title:', titleMatch ? titleMatch[0] : 'No title');
  });
});
