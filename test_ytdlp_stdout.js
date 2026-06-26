const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
  const url = 'https://www.reddit.com/r/videos/comments/1exkj1/what_a_wonderful_world/'; // We know this might 404, let's use a standard test URL
  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // me at the zoo
  
  const args = [
    '-f', '22', // Try to get standard combined format if available, or just a stream
    '-o', '-',
    '--no-warnings',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  ];
  
  console.log('Spawning yt-dlp...');
  const proc = spawn('yt-dlp', args);
  
  const outStream = fs.createWriteStream('test_stdout.mp4');
  proc.stdout.pipe(outStream);
  
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d.toString(); });
  
  proc.on('close', code => {
    console.log('yt-dlp exited with code', code);
    console.log('stderr:', stderr);
    if (fs.existsSync('test_stdout.mp4')) {
      console.log('Downloaded size:', fs.statSync('test_stdout.mp4').size);
    }
  });
}
run();
