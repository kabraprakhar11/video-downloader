const url = 'https://www.instagram.com/p/DXLn8NrEz-6/';
async function run() {
  try {
    const res = await fetch('https://instances.cobalt.tools/instances.json');
    const data = await res.json();
    const instances = data.filter(i => i.cors === 1 && i.api_online && i.version.startsWith('10.'));
    
    for (let i = 0; i < Math.min(5, instances.length); i++) {
      const api = instances[i].api;
      console.log(`Trying ${api}...`);
      try {
        const pRes = await fetch(`${api}/json`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url })
        });
        const pData = await pRes.json();
        console.log(`Success with ${api}:`, JSON.stringify(pData).substring(0, 200));
        return; // success
      } catch (e) {
        console.log(`Failed ${api}: ${e.message}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
