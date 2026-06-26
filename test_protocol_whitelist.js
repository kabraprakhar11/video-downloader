const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

// Dummy proxy and valid URL
const args = [
  '-http_proxy', 'http://user:pass@127.0.0.1:8080',
  '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
  '-i', 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  '-t', '1',
  '-f', 'null',
  '-'
];

const proc = spawn(ffmpegStatic, args);
let stderr = '';
proc.stderr.on('data', d => { stderr += d.toString(); });
proc.on('close', code => {
  console.log('Code:', code);
  console.log('Stderr:', stderr.slice(-500));
});
