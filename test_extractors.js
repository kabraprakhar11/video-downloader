const { extractInfo } = require('./server/services/ytdlp');

const urlsToTest = [
  { platform: 'Vimeo', url: 'https://vimeo.com/22439234', expectAllowed: true },
  { platform: 'Facebook', url: 'https://www.facebook.com/facebook/videos/10153231379946729/', expectAllowed: true },
  { platform: 'Reddit', url: 'https://www.reddit.com/r/videos/comments/16v8f1i/the_history_of_the_world_i_guess/', expectAllowed: true },
  { platform: 'YouTube', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', expectAllowed: false }
];

async function runTests() {
  console.log('--- Starting Extractor Tests ---');
  for (const { platform, url, expectAllowed } of urlsToTest) {
    console.log(`\nTesting ${platform}... (${url})`);
    try {
      const result = await extractInfo(url);
      if (expectAllowed) {
        console.log(`✅ [SUCCESS] Successfully extracted video: ${result.title} (Extractor: ${result.extractor})`);
      } else {
        console.error(`❌ [FAILED] Extracted successfully, but it should have been blocked! (Extractor: ${result.extractor})`);
      }
    } catch (err) {
      if (!expectAllowed && err.message.includes('not supported')) {
        console.log(`✅ [SUCCESS] Correctly blocked ${platform}: ${err.message}`);
      } else {
        console.error(`❌ [FAILED] Unexpected error for ${platform}: ${err.message}`);
      }
    }
  }
  console.log('\n--- Tests Completed ---');
}

runTests();
