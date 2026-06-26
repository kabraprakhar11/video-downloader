const { spawn } = require('child_process');
const fs = require('fs');
const ytDlp = require('./server/services/ytdlp');

async function run() {
  const url = 'https://www.reddit.com/r/Damnthatsinteresting/comments/1iino1e/the_way_this_guy_cleans_the_street/';
  console.log('Extracting info...');
  try {
    const raw = await ytDlp.extractInfo(url);
    const m3u8 = raw.formats.combined.find(f => f.url.includes('.m3u8'));
    if (!m3u8) return console.log('No m3u8 found');
    
    console.log('Testing yt-dlp -o - on format:', m3u8.format_id);
    const args = [
      '-f', m3u8.format_id,
      '-o', '-',
      '--no-warnings',
      url
    ];
    
    const proc = spawn('yt-dlp', args);
    const out = fs.createWriteStream('test_hls_stdout.mp4');
    proc.stdout.pipe(out);
    
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    
    proc.on('close', code => {
      console.log('Exit code:', code);
      console.log('Stderr:', stderr.slice(-1000));
      if (fs.existsSync('test_hls_stdout.mp4')) {
        console.log('Size:', fs.statSync('test_hls_stdout.mp4').size);
      }
    });
  } catch(e) {
    console.log(e.message);
  }
}
run();
