const fs = require('fs');

let content = fs.readFileSync('./server/services/ytdlp.js', 'utf8');

const helperCode = `
// ─── Custom Pinterest Extractor Bypass ──────────────────────────────────────────
async function getPinterestVideo(url) {
  let finalUrl = url;
  if (url.includes('pin.it')) {
      try {
          const fetch = (await import('node-fetch')).default;
          const res = await fetch(url, { redirect: 'follow' });
          finalUrl = res.url;
      } catch (e) {
          logger.error(\`[getPinterestVideo] Failed to resolve pin.it: \${e.message}\`);
      }
  }

  const pinMatch = finalUrl.match(/\\/pin\\/(\\d+)/);
  if (!pinMatch) throw new Error('Could not find Pin ID in URL.');
  const pinId = pinMatch[1];
  
  const fetchModule = (await import('node-fetch')).default;
  const res = await fetchModule(\`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=\${pinId}\`);
  const data = await res.json();
  
  if (!data || !data.data || data.data.length === 0) {
      throw new Error('Video not found or deleted.');
  }

  const pin = data.data[0];
  let videoUrl = null;

  if (pin.story_pin_data && pin.story_pin_data.pages) {
      for (const page of pin.story_pin_data.pages) {
          if (page.blocks) {
              for (const block of page.blocks) {
                  if (block.video && block.video.video_list) {
                      const vl = block.video.video_list;
                      videoUrl = (vl.V_720P || vl.V_HLSV4 || vl.V_EXP3 || Object.values(vl)[0]).url;
                      if (videoUrl) break;
                  }
              }
          }
          if (videoUrl) break;
      }
  }

  if (!videoUrl && pin.videos && pin.videos.video_list) {
      const vl = pin.videos.video_list;
      videoUrl = (vl.V_720P || vl.V_HLSV4 || vl.V_EXP3 || Object.values(vl)[0]).url;
  }
  
  if (!videoUrl) {
     const htmlRes = await fetchModule(finalUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
     const html = await htmlRes.text();
     const m = html.match(/https:\\/\\/v\\.pinimg\\.com\\/videos\\/mc\\/[^\\"]+\\.mp4/);
     if (m) videoUrl = m[0];
     else {
         const m2 = html.match(/https:\\/\\/[^\\"]+\\.m3u8/);
         if (m2) videoUrl = m2[0];
     }
  }

  if (!videoUrl) throw new Error('Pinterest Video not found. This might be an image pin.');

  return {
      title: (pin.description || 'Pinterest Video').slice(0, 100),
      thumbnail: pin.images && pin.images.orig ? pin.images.orig.url : '',
      duration: 0,
      durationFormatted: '0:00',
      extractor: 'pinterest',
      uploader: pin.pinner ? pin.pinner.full_name : 'Pinterest',
      viewCount: null,
      description: pin.description || '',
      webpage_url: finalUrl,
      formats: {
          combined: [{
              formatId: 'default',
              format_id: 'default',
              ext: videoUrl.includes('.m3u8') ? 'mp4' : 'mp4',
              resolution: '720p',
              filesize: null,
              filesizeHuman: '',
              vcodec: 'unknown',
              acodec: 'unknown',
              fps: 30,
              abr: null,
              tbr: null,
              height: 720,
              width: 1280,
              url: videoUrl,
              qualityTier: 'HD',
              qualityLabel: 'HD (720p)'
          }],
          videoOnly: [],
          audioOnly: []
      },
      bestAudio: null
  };
}
`;

content = content.replace('// ─── Entry Point for Extraction ───────────────────────────────────────────────', helperCode + '\n// ─── Entry Point for Extraction ───────────────────────────────────────────────');

const hookCode = `  const urlLower = url.toLowerCase();
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
      try {
          const pinData = await getPinterestVideo(url);
          return pinData;
      } catch (err) {
          logger.warn(\`[getPinterestVideo] Custom extractor failed: \${err.message}. Falling back to yt-dlp.\`);
      }
  }`;

content = content.replace('  const urlLower = url.toLowerCase();', hookCode);

const whitelistCode1 = `  const extractor = (raw.extractor_key || raw.extractor || '').toLowerCase();
  
  let isAllowed = ALLOWED_EXTRACTORS.has(extractor);
  if (!isAllowed && extractor === 'generic') {
    const uLower = url.toLowerCase();
    if (uLower.includes('pinterest.com') || uLower.includes('pin.it') || uLower.includes('snapchat.com')) {
      isAllowed = true;
      logger.info(\`[extract] Allowed generic extractor for known domain: \${url}\`);
    }
  }

  if (!isAllowed) {`;
content = content.replace(/  const extractor = raw\.extractor_key \|\| raw\.extractor;\s+if \(extractor && !ALLOWED_EXTRACTORS\.has\(extractor\.toLowerCase\(\)\)\) \{/, whitelistCode1);

const whitelistCode2 = `  const extractor = (raw.extractor_key || raw.extractor || '').toLowerCase();
  
  let isAllowed = ALLOWED_EXTRACTORS.has(extractor);
  if (!isAllowed && extractor === 'generic') {
    const uLower = pageUrl.toLowerCase();
    if (uLower.includes('pinterest.com') || uLower.includes('pin.it') || uLower.includes('snapchat.com')) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {`;
content = content.replace(/  const extractor = raw\.extractor_key \|\| raw\.extractor;\s+if \(extractor && !ALLOWED_EXTRACTORS\.has\(extractor\.toLowerCase\(\)\)\) \{/, whitelistCode2);

fs.writeFileSync('./server/services/ytdlp.js', content);
console.log('Patched ytdlp.js successfully.');
