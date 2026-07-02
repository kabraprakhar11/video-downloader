const https = require('https');

function testCobalt(videoUrl) {
  const data = JSON.stringify({ url: videoUrl });
  const options = {
    hostname: 'api.cobalt.tools',
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => console.log('Response:', body));
  });

  req.on('error', (e) => console.error(e));
  req.write(data);
  req.end();
}

testCobalt('https://www.youtube.com/watch?v=IaigtoNPAZw');
