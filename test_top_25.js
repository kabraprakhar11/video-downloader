const { extractInfo } = require('./server/services/ytdlp');

const testUrls = {
  Facebook: "https://www.facebook.com/facebook/videos/10153231379946729/",
  Instagram: "https://www.instagram.com/p/C_aJ5J2R5Qy/",
  Twitter: "https://x.com/SpaceX/status/1768270570533036490",
  TikTok: "https://www.tiktok.com/@tiktok/video/7106594312292453675",
  Reddit: "https://www.reddit.com/r/aww/comments/16l5q6j/my_dog_learning_to_howl/",
  Snapchat: "https://story.snapchat.com/p/e9c1db16-86c3-4d4d-bc93-7848692994c6/1684307525330944",
  Pinterest: "https://www.pinterest.com/pin/106679313626284260/",
  LinkedIn: "https://www.linkedin.com/posts/linkedin_linkedin-tips-and-tricks-activity-7128038872935272448-ABC",
  VK: "https://vk.com/video-22822305_456239018",
  Twitch: "https://clips.twitch.tv/KathishRichCiderTheRinger-Q2x4yH2X7O9a_Y31",
  Vimeo: "https://vimeo.com/76979871",
  Dailymotion: "https://www.dailymotion.com/video/x7tg3l1",
  Bilibili: "https://www.bilibili.com/video/BV1xx411c7mD",
  Rumble: "https://rumble.com/v1b0fbb-cats-are-funny.html",
  BBC: "https://www.bbc.co.uk/news/av/technology-68499878",
  CNN: "https://edition.cnn.com/videos/world/2024/03/01/video-test.cnn",
  FoxNews: "https://www.foxnews.com/video/6347000000001",
  Bloomberg: "https://www.bloomberg.com/news/videos/2024-01-01/test-video",
  Patreon: "https://www.patreon.com/posts/test-video-123456",
  Kickstarter: "https://www.kickstarter.com/projects/peak-design/travel-tripod",
  TED: "https://www.ted.com/talks/bill_gates_the_next_outbreak_we_re_not_ready",
  SoundCloud: "https://soundcloud.com/postmalone/rockstar-feat-21-savage",
  Imgur: "https://imgur.com/gallery/q3Kx7",
  ApplePodcasts: "https://podcasts.apple.com/us/podcast/the-daily/id1200361736",
  AmazonMiniTV: "https://www.amazon.in/minitv/tp/8a011cd6-6701-4475-ae9e-10b240cc8c51"
};

async function runTests() {
  console.log('--- STARTING 25 PLATFORM EXTRACTION TEST ---');
  
  const results = {};
  
  for (const [platform, url] of Object.entries(testUrls)) {
    console.log(`\nTesting ${platform}...`);
    try {
      const data = await extractInfo(url);
      console.log(`  [SUCCESS] Found title: ${data.title}`);
      console.log(`  Formats -> Combined: ${data.formats.combined.length}, VideoOnly: ${data.formats.videoOnly.length}, AudioOnly: ${data.formats.audioOnly.length}`);
      results[platform] = 'SUCCESS';
    } catch (err) {
      console.error(`  [FAILED] ${err.message}`);
      
      let reason = 'Unknown Error';
      if (err.message.includes('Bot detection') || err.message.includes('Sign in') || err.message.includes('HTTP Error 429') || err.message.includes('403') || err.message.includes('cookie')) {
          reason = 'Bot Detection / Login Required';
      } else if (err.message.includes('404') || err.message.includes('unavailable') || err.message.includes('not found')) {
          reason = 'Video Not Found / Private';
      } else if (err.message.includes('not supported')) {
          reason = 'Unsupported by Extractor';
      } else {
          reason = err.message.slice(0, 50);
      }
      
      results[platform] = `FAILED (${reason})`;
    }
    
    // Wait a bit to avoid rapid fire rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n--- FINAL RESULTS ---');
  console.table(results);
}

runTests();
