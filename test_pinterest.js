// no require

// Let's use node's native fetch.
async function getPin() {
    try {
        const res = await fetch('https://api.pinterest.com/v3/pidgets/boards/zuck/cars/pins/');
        const data = await res.json();
        const pinId = data.data.pins[0].id;
        console.log("Found Pin ID:", pinId);

        const htmlRes = await fetch(`https://www.pinterest.com/pin/${pinId}/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await htmlRes.text();
        if (html.includes('.mp4')) {
            console.log('MP4 Found in HTML!');
        } else if (html.includes('.m3u8')) {
            console.log('M3U8 Found in HTML!');
        } else {
            console.log('No video link found in HTML. Here is a snippet:', html.substring(0, 500));
        }
    } catch(e) {
        console.error(e);
    }
}
getPin();
