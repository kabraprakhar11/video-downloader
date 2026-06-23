const { spawn } = require('child_process');

async function test() {
  const url = 'https://www.snapchat.com/@snapchat/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYd3NvamxhcXlvAZnzg2FHAZnzg0yfAAAAAQ';
  const proc = spawn('yt-dlp', ['-J', url]);
  let stdout = '';
  proc.stdout.on('data', d => stdout += d.toString());
  proc.on('close', () => {
    const raw = JSON.parse(stdout);
    for(const f of raw.formats) {
      console.log(`id:${f.format_id} vcodec:${f.vcodec} acodec:${f.acodec} ext:${f.ext}`);
    }
  });
}
test();
