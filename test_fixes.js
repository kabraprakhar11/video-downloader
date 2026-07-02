const { extractInfo } = require('./server/services/ytdlp');

const testUrls = {
  Snapchat: "https://snapchat.com/t/DkcbZfsX",
  Vimeo: "https://vimeo.com/ondemand/marblehalls",
  Bilibili: "https://www.bilibili.com/video/BV1fv4y1G7jB/?share_source=copy_web",
  Twitch: "https://www.twitch.tv/sahranisworld/clip/GracefulCheerfulPuppyAliens-6Al2hH2pzMpFeGkL",
  Pinterest: "https://www.pinterest.com/ideas/pinterest-video/928397394202/",
  Bloomberg: "https://www.bloomberg.com/news/videos/2026-06-26/auto-industry-fears-usmca-shakeup-video"
};

async function testUserUrls() {
  console.log('--- STARTING FIXES EXTRACTION TEST ---');
  for (const [platform, url] of Object.entries(testUrls)) {
    try {
      const data = await extractInfo(url);
      console.log(`[SUCCESS] ${platform}: ${data.title}`);
    } catch (err) {
      console.error(`[FAILED] ${platform}: ${err.message}`);
    }
  }
}

testUserUrls();
