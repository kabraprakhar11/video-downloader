const https = require('https');

https.get('https://pipedapi.kavin.rocks/streams/jNQXAC9IVRw', {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Title:', json.title);
      console.log('Video streams:', json.videoStreams?.length);
      console.log('Audio streams:', json.audioStreams?.length);
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('Fetch error:', e.message));
