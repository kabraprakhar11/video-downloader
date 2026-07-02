const { extractInfo } = require('./server/services/ytdlp');

const testUrls = {
  Facebook: "https://www.facebook.com/facebook/videos/10153231379946729/",
  VK: "https://vk.com/video-22822305_456239018",
  Vimeo: "https://vimeo.com/76979871",
  TED: "https://www.ted.com/talks/bill_gates_the_next_outbreak_we_re_not_ready",
  SoundCloud: "https://soundcloud.com/postmalone/rockstar-feat-21-savage",
  TikTok: "https://www.tiktok.com/@zachking/video/6768504823336815877",
  Twitch: "https://www.twitch.tv/ninja" // using a live channel or known good link
};

async function runTests() {
  console.log('--- STARTING PLATFORM EXTRACTION TEST ---');
  
  const results = {};
  
  for (const [platform, url] of Object.entries(testUrls)) {
    console.log(`\nTesting ${platform}...`);
    try {
      const data = await extractInfo(url);
      console.log(`  [SUCCESS] Found title: ${data.title}`);
      results[platform] = 'SUCCESS';
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`);
      results[platform] = `FAILED`;
    }
  }
  
  console.log('\n--- FINAL RESULTS ---');
  console.table(results);
}

runTests();
