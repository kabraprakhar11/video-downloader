const fs = require('fs');
const readline = require('readline');

async function extract() {
  const fileStream = fs.createReadStream('C:\\Users\\kabra\\.gemini\\antigravity-ide\\brain\\e5a7bc90-828c-4b98-a512-6bf4dfed4d18\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.includes('"step_index":83') || line.includes('"step_index":84') || line.includes('"step_index":85')) {
      const parsed = JSON.parse(line);
      if (parsed.type === 'VIEW_FILE' && parsed.content.includes('ytdlp.js')) {
        console.log(parsed.content);
      }
    }
  }
}
extract();
