const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const args = [
  '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  '-headers', 'Referer: https://www.reddit.com/\r\n',
  '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
  '-i', 'https://v.redd.it/dummy_video_url_just_to_test_args',
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-f', 'mp4',
  'pipe:1'
];

const proc = spawn(ffmpeg, args);
proc.stdout.on('data', d => console.log('stdout data', d.length));
let stderr = '';
proc.stderr.on('data', d => { stderr += d.toString(); });
proc.on('close', code => {
  console.log('exited with code', code);
  console.log('stderr:', stderr.slice(0, 500));
});
