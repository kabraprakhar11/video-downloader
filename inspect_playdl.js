const play = require('play-dl');

async function test() {
  const info = await play.video_info('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  console.log(Object.keys(info.format[0]));
  console.log(info.format[0]);
}

test().catch(console.error);
