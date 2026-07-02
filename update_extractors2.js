const fs = require('fs');
let code = fs.readFileSync('server/utils/allowedExtractors.js', 'utf8');
const toAdd = ['vimeoondemand', 'twitchclips', 'twitchstream', 'twitchvod', 'twitchclip'];

for (const ext of toAdd) {
  if (!code.includes(`"${ext}"`)) {
    code = code.replace('"vimeo"', `"vimeo","${ext}"`);
  }
}
fs.writeFileSync('server/utils/allowedExtractors.js', code);
console.log('Updated allowedExtractors.js');
