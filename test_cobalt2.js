const fetch = require('node-fetch') || global.fetch;

async function testCobalt(url) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      })
    });
    console.log(url, 'Status:', res.status);
    const data = await res.json().catch(() => null);
    console.log(data);
  } catch (err) {
    console.error(url, 'Error:', err.message);
  }
}

testCobalt('https://cobalt.kwiatektv.me/');
testCobalt('https://api.cobalt.tools/');
testCobalt('https://cobalt.tools/api/json');
