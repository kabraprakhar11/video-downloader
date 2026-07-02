const { extractInfo } = require('./server/services/ytdlp');

const userUrls = {
  Instagram: "https://www.instagram.com/reel/DZxIQDORtO3/?igsh=MWZrMWNoY2Q2N3pzaQ==",
  Reddit: "https://www.reddit.com/r/MxRMods/comments/liwe27/i_found_tha_video_from_where_there_video_from_jan/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button",
  Snapchat: "https://snapchat.com/t/DkcbZfsX",
  Twitter: "https://x.com/narendramodi/status/2066717403707564188",
  Facebook: "https://www.facebook.com/narendramodi/videos/maoist-terror-is-breathing-its-last-in-india/1563221405529979/",
  VK: "https://vkvideo.ru/video-43618728_456357566",
  Vimeo: "https://vimeo.com/ondemand/marblehalls",
  TED: "https://www.ted.com/talks/dhruv_khullar_can_ozempic_end_addiction?utm_campaign=tedspread&utm_medium=referral&utm_source=tedcomshare",
  SoundCloud: "https://soundcloud.com/jadekoth/roll-like-thunder-prod-by-kushgrams?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  Bilibili: "https://www.bilibili.com/video/BV1fv4y1G7jB/?share_source=copy_web",
  Twitch: "https://www.twitch.tv/sahranisworld/clip/GracefulCheerfulPuppyAliens-6Al2hH2pzMpFeGkL",
  Rumble: "https://rumble.com/v7buvvu-getting-jumpscared.html",
  Dailymotion: "https://dai.ly/xaj8k6q",
  BBC: "https://www.bbc.com/news/videos/c5yz05y6vvqo",
  CNN: "https://www.cnn.com/2026/06/26/world/video/israel-hezbollah-drone-threat-diamond-digvid",
  Imgur: "https://imgur.com/gallery/relaxing-sound-9Vfiz2W",
  Pinterest: "https://www.pinterest.com/ideas/pinterest-video/928397394202/",
  FoxNews: "https://www.foxnews.com/video/6399495572112",
  Bloomberg: "https://www.bloomberg.com/news/videos/2026-06-26/auto-industry-fears-usmca-shakeup-video"
};

async function testUserUrls() {
  console.log('--- STARTING USER URLS EXTRACTION TEST ---');
  const results = [];
  
  for (const [platform, url] of Object.entries(userUrls)) {
    console.log(`\nTesting ${platform}...`);
    try {
      const data = await extractInfo(url);
      results.push({ Platform: platform, Status: 'SUCCESS', Note: data.title ? data.title.substring(0, 30) : 'Extracted successfully' });
      console.log(`  [SUCCESS] ${data.title}`);
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`);
      let note = err.message;
      if (note.length > 40) note = note.substring(0, 40) + '...';
      results.push({ Platform: platform, Status: 'FAILED', Note: note });
    }
  }
  
  console.log('\n--- FINAL USER TEST RESULTS ---');
  console.table(results);
}

testUserUrls();
