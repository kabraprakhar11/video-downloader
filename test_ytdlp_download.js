const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const targetPath = path.join(os.tmpdir(), `test_download.mp4`);
console.log('Downloading to', targetPath);

const args = [
  '-f', '18', // standard format
  '--no-playlist',
  '--no-warnings',
  '--merge-output-format', 'mp4',
  '-o', targetPath,
  'https://www.youtube.com/watch?v=jNQXAC9IVRw'
];

const proc = spawn('yt-dlp', args);
proc.stdout.pipe(process.stdout);
let stderr = '';
proc.stderr.on('data', d => { stderr += d.toString(); });

proc.on('close', code => {
  console.log('Exit code:', code);
  console.log('Stderr:', stderr);
  if (fs.existsSync(targetPath)) {
    console.log('File size:', fs.statSync(targetPath).size);
    fs.unlinkSync(targetPath);
  }
});
