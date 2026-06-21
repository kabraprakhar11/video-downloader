const play = require('play-dl');

async function test() {
  try {
    const info = await play.video_info('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('[SUCCESS] Play-dl extracted:', info.video_details.title);
  } catch (err) {
    console.error('[ERROR] Play-dl:', err.message);
  }
}

test();
