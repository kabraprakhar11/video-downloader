const { spawn } = require('child_process');

function testYtDlp(client) {
  return new Promise((resolve) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--extractor-args', `youtube:player_client=${client}`,
      'https://www.youtube.com/watch?v=jNQXAC9IVRw'
    ];
    
    const proc = spawn('yt-dlp', args);
    let out = '';
    let err = '';
    
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    
    proc.on('close', code => {
      console.log(`\n=== Client: ${client} (Exit: ${code}) ===`);
      console.log(err.split('\n').slice(-3).join('\n'));
      resolve();
    });
  });
}

async function run() {
  await testYtDlp('web_creator');
  await testYtDlp('tv_embedded');
  await testYtDlp('mweb');
  await testYtDlp('ios');
  await testYtDlp('web');
}

run();
