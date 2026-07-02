const url = 'https://streamvault-backend-965260774860.us-central1.run.app/api/extract';
const urls = [
  'https://snapchat.com/t/DkcbZfsX',
  'https://www.bilibili.com/video/BV1fv4y1G7jB/?share_source=copy_web',
  'https://www.instagram.com/reel/DZxIQDORtO3/?igsh=MWZrMWNoY2Q2N3pzaQ==',
  'https://vimeo.com/ondemand/marblehalls'
];

async function testLive() {
  for (const u of urls) {
    console.log(`\nTesting: ${u}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u })
      });
      const text = await response.text();
      console.log(`HTTP Status: ${response.status}`);
      console.log(`Response: ${text.substring(0, 300)}...`);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }
}
testLive();
