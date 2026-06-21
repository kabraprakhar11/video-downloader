const { spawn } = require('child_process');

function testYtDlp() {
  return new Promise((resolve) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=web_embedded',
      '--extractor-args', 'youtube:skip=hls,dash',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      'https://www.youtube.com/watch?v=jNQXAC9IVRw'
    ];
    
    const proc = spawn('yt-dlp', args);
    let err = '';
    
    proc.stderr.on('data', d => err += d.toString());
    
    proc.on('close', code => {
      console.log(`\n=== Exit: ${code} ===`);
      console.log(err);
      resolve();
    });
  });
}

testYtDlp();
