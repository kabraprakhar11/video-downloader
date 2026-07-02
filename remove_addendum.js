const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, 'public', 'legal'),
  path.join(__dirname, 'public', 'articles')
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(f => {
    if (f.endsWith('.html')) {
      const p = path.join(d, f);
      let html = fs.readFileSync(p, 'utf8');
      
      // Remove the Detailed Addendum header and hr
      const regex = /<hr style="border-color: rgba\(255,255,255,0\.1\); margin: 20px 0;">\s*<h4>Detailed Addendum:<\/h4>/g;
      
      if (regex.test(html)) {
        html = html.replace(regex, '');
        fs.writeFileSync(p, html, 'utf8');
        console.log(`Updated ${f}`);
      }
    }
  });
});
