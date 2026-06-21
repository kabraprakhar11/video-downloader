const { spawn } = require('child_process');
const https = require('https');

https.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all&ssl=yes&anonymity=elite', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const proxies = data.split('\n').map(p => p.trim()).filter(Boolean);
    if (!proxies.length) return console.error('No proxies found');
    
    // Test the first 5 proxies
    for (let i = 0; i < Math.min(5, proxies.length); i++) {
      const proxy = `socks5://${proxies[i]}`;
      console.log('Testing proxy:', proxy);
      const yt = spawn('yt-dlp', ['--dump-json', '--no-playlist', '--proxy', proxy, '--socket-timeout', '10', 'https://www.youtube.com/watch?v=jNQXAC9IVRw']);
      
      let out = '';
      let err = '';
      yt.stdout.on('data', d => out += d);
      yt.stderr.on('data', d => err += d);
      
      yt.on('close', code => {
        if (code === 0) {
          console.log(`[SUCCESS] Proxy ${proxy} worked!`);
        } else {
          console.log(`[FAILED] Proxy ${proxy} failed:`, err.split('\n')[0]);
        }
      });
    }
  });
});
