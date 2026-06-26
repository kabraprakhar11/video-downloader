const fs = require('fs');
const { spawn } = require('child_process');
const ytDlp = require('./server/services/ytdlp');
const ffmpegStatic = require('ffmpeg-static');

async function test() {
  const url = 'https://www.reddit.com/r/Damnthatsinteresting/comments/1iino1e/the_way_this_guy_cleans_the_street/';
  console.log('Extracting', url);
  try {
    const raw = await ytDlp.extractInfo(url);
    const m3u8 = raw.formats.combined.find(f => f.url.includes('.m3u8'));
    if (!m3u8) {
      console.log('No m3u8 found');
      return;
    }
    console.log('Testing FFmpeg on:', m3u8.url);
    const args = [
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,data',
      '-i', m3u8.url,
      '-c', 'copy',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      '-t', '2',
      'test_reddit_out.mp4'
    ];
    const proc = spawn(ffmpegStatic, args);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      console.log('FFmpeg exit code:', code);
      console.log('Stderr tail:', stderr.slice(-1000));
      if (fs.existsSync('test_reddit_out.mp4')) {
        console.log('Size:', fs.statSync('test_reddit_out.mp4').size);
      }
    });
  } catch (err) {
    console.log('Err:', err);
  }
}
test();
