const ytDlp = require('./server/services/ytdlp');
const http = require('http');

async function test() {
  const pageUrl = 'https://twitter.com/SpaceX/status/1768270566367584501'; // example twitter video
  console.log('Extracting format info...');
  
  try {
    const streamInfo = await ytDlp.extractInfo(pageUrl);
    console.log('Extracted Info:', streamInfo);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
