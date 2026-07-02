const { extractInfo } = require('./server/services/ytdlp');

const testUrls = {
  Facebook: "https://www.facebook.com/facebook/videos/10153231379946729/",
  VK: "https://vk.com/video-22822305_456239018",
  Vimeo: "https://vimeo.com/76979871",
  TED: "https://www.ted.com/talks/bill_gates_the_next_outbreak_we_re_not_ready",
  SoundCloud: "https://soundcloud.com/postmalone/rockstar-feat-21-savage",
  TikTok: "https://www.tiktok.com/@zachking/video/6768504823336815877",
  Twitter: "https://x.com/SpaceX/status/1768270570533036490",
  Instagram: "https://www.instagram.com/p/C_aJ5J2R5Qy/",
  Dailymotion: "https://www.dailymotion.com/video/x2m8jpp",
  Bilibili: "https://www.bilibili.com/video/BV1xx411c7mD",
  Twitch: "https://www.twitch.tv/ninja",
  Rumble: "https://rumble.com/v2n9l86-tucker-on-twitter-episode-1.html",
  BBC: "https://www.bbc.co.uk/news/av/technology-68499878",
  CNN: "https://edition.cnn.com/videos/world/2024/03/01/video-test.cnn",
  Imgur: "https://imgur.com/gallery/q3Kx7",
  Patreon: "https://www.patreon.com/posts/test-video-123456",
  ApplePodcasts: "https://podcasts.apple.com/us/podcast/the-daily/id1200361736",
  Pinterest: "https://www.pinterest.com/pin/106679313626284260/",
  Snapchat: "https://story.snapchat.com/p/e9c1db16-86c3-4d4d-bc93-7848692994c6/1684307525330944",
  Reddit: "https://www.reddit.com/r/aww/comments/16l5q6j/my_dog_learning_to_howl/",
  FoxNews: "https://www.foxnews.com/video/6347000000001",
  Bloomberg: "https://www.bloomberg.com/news/videos/2024-01-01/test-video",
  Kickstarter: "https://www.kickstarter.com/projects/peak-design/travel-tripod",
  LinkedIn: "https://www.linkedin.com/posts/linkedin_linkedin-tips-and-tricks-activity-7128038872935272448-ABC",
  AmazonMiniTV: "https://www.amazon.in/minitv/tp/8a011cd6-6701-4475-ae9e-10b240cc8c51"
};

async function runTests() {
  console.log('--- STARTING PLATFORM EXTRACTION TEST (25 PLATFORMS) ---');
  const results = [];
  
  // We process them sequentially to avoid rate limits
  for (const [platform, url] of Object.entries(testUrls)) {
    try {
      const data = await extractInfo(url);
      results.push({ Platform: platform, Status: 'SUCCESS', Note: `Extracted ${data.title.substring(0, 20)}...` });
    } catch (err) {
      let reason = 'Error';
      if (err.message.includes('not found') || err.message.includes('unavailable') || err.message.includes('404')) {
        reason = '404 Video Not Found (Dead Test URL)';
      } else if (err.message.includes('login') || err.message.includes('cookie') || err.message.includes('empty media')) {
        reason = 'Requires Active Cookies';
      } else if (err.message.includes('not supported')) {
        reason = 'Unsupported URL';
      } else {
        reason = err.message.substring(0, 30);
      }
      results.push({ Platform: platform, Status: 'FAILED', Note: reason });
    }
  }
  
  console.log('\n--- FINAL RESULTS ---');
  console.table(results);
}

runTests();
