const { spawn } = require('child_process');
const ytDlp = require('./server/services/ytdlp');
const ffmpegStatic = require('ffmpeg-static');

async function run() {
  // Use a known valid reddit video URL that I just found online
  const url = 'https://www.reddit.com/r/videos/comments/1iio32r/dude_plays_super_mario_theme_while_the_fire_alarm/';
  const info = await ytDlp.extractInfo(url);
  
  // Find an HLS format
  const format = info.formats.find(f => f.url.includes('.m3u8'));
  if (!format) return console.log('No HLS format found.');
  
  console.log('Found HLS URL:', format.url);
  
  const args = [
    '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
    '-i', format.url,
    '-c', 'copy',
    '-movflags', 'frag_keyframe+empty_moov',
    '-f', 'mp4',
    '-t', '2', // just 2 seconds to test
    'test_out.mp4'
  ];
  
  const proc = spawn(ffmpegStatic, args);
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d.toString(); });
  proc.on('close', code => {
    console.log('FFmpeg exited with code', code);
    console.log('Stderr tail:', stderr.slice(-1000));
    
    // Check file size
    const fs = require('fs');
    if (fs.existsSync('test_out.mp4')) {
        console.log('Output file size:', fs.statSync('test_out.mp4').size);
    }
  });
}
run();
