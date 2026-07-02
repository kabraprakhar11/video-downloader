async function testCobalt(videoUrl) {
  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        filenamePattern: 'nerdy',
      })
    });
    const text = await res.text();
    console.log(`[Cobalt] ${videoUrl}:`, text);
  } catch(e) {
    console.error(`[Cobalt Error] ${videoUrl}:`, e.message);
  }
}

testCobalt('https://snapchat.com/t/DkcbZfsX');
testCobalt('https://www.pinterest.com/ideas/pinterest-video/928397394202/');
