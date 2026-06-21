const play = require('play-dl');
const { spawn } = require('child_process');
const FFMPEG_PATH = require('ffmpeg-static');

async function test() {
  const info = await play.video_info('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  
  const videoFormats = info.format.filter(f => f.hasVideo && !f.hasAudio).sort((a,b) => (b.width||0) - (a.width||0));
  const audioFormats = info.format.filter(f => !f.hasVideo && f.hasAudio).sort((a,b) => (b.bitrate||0) - (a.bitrate||0));
  
  const vUrl = videoFormats[0].url;
  const aUrl = audioFormats[0].url;
  
  console.log('Downloading with FFmpeg...');
  const ffmpeg = spawn(FFMPEG_PATH, [
    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    '-i', vUrl,
    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    '-i', aUrl,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-y', 'test_output.mp4'
  ]);
  
  ffmpeg.stderr.on('data', d => console.log(d.toString().trim()));
  ffmpeg.on('close', code => {
    console.log('FFmpeg exited with code', code);
  });
}

test().catch(console.error);
