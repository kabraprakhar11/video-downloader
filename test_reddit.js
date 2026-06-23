const { spawn } = require('child_process');
const ytdlp = require('./server/services/ytdlp');

async function test() {
  try {
    const raw = await ytdlp.extractInfo('https://twitter.com/SpaceX/status/1768270566367584501');
    console.log("Found formats:", raw.formats.combined.length, raw.formats.videoOnly.length);
    
    // Pick the first combined one (which we synthesized)
    const fmt = raw.formats.combined[0];
    if (!fmt) return console.log("No combined formats found");
    
    console.log("Testing download for formatId:", fmt.formatId);
    
    const urls = await ytdlp.extractFormatUrl('https://twitter.com/SpaceX/status/1768270566367584501', fmt.formatId);
    console.log("Got URLs:");
    console.log("Video:", urls.videoUrl ? urls.videoUrl.slice(0, 100) + '...' : null);
    console.log("Audio:", urls.audioUrl ? urls.audioUrl.slice(0, 100) + '...' : null);
    
    // Run ffmpeg
    const FFMPEG_PATH = require('ffmpeg-static');
    const args = [
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-i', urls.videoUrl,
      '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-i', urls.audioUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      'pipe:1'
    ];
    
    console.log("Running ffmpeg...");
    const proc = spawn(FFMPEG_PATH, args);
    let bytes = 0;
    proc.stdout.on('data', d => bytes += d.length);
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      console.log(`FFmpeg exited with ${code}. Output size: ${bytes} bytes`);
      if (code !== 0) console.log("STDERR:", stderr);
    });
    
  } catch(e) {
    console.error(e);
  }
}
test();
