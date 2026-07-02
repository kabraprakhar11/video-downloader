const fs = require('fs');
const src = 'D:\\Download\\cookies\\cookies.txt';
const dest = 'D:\\video downloader\\cookies.txt';

let content = fs.readFileSync(src, 'utf8');

// Fix the malformed netscape format where values wrapped to the next line
// Specifically targeting sessionid and rur which were wrapped
content = content.replace(/sessionid\s*\r?\n/g, 'sessionid\t');
content = content.replace(/rur\s*\r?\n/g, 'rur\t');

fs.writeFileSync(dest, content);
console.log('Fixed cookies file written to', dest);
