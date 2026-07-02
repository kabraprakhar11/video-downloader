const url = 'https://streamvault-backend-965260774860.us-central1.run.app/api/extract';
const videoUrl = 'https://vkvideo.ru/video-43618728_456357566'; // A known working URL

async function testLive() {
  console.log(`Sending POST request to ${url}...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    
    const text = await response.text();
    console.log(`HTTP Status: ${response.status}`);
    console.log(`Response: ${text}`);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testLive();
