const { getProxyBatch } = require('./server/services/proxy-manager');
const { extractInfo } = require('./server/services/ytdlp');

async function test404() {
  const proxies = await getProxyBatch();
  const proxy = proxies[0]; // Just try the first one
  console.log(`Using proxy: ${proxy}`);
  
  const urls = [
    'https://snapchat.com/t/DkcbZfsX',
    'https://www.pinterest.com/ideas/pinterest-video/928397394202/'
  ];
  
  for (const url of urls) {
    console.log(`\nTesting ${url}`);
    const { spawn } = require('child_process');
    const proc = spawn('yt-dlp', ['--proxy', proxy, '--dump-json', '--no-warnings', url]);
    let stderr = '';
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      console.log(`Exit code: ${code}`);
      console.log(`Stderr: ${stderr}`);
    });
  }
}
test404();
