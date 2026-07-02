const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const legalDir = path.join(publicDir, 'legal');
const articlesDir = path.join(publicDir, 'articles');

const pagesToFix = [
  path.join(legalDir, 'terms.html'),
  path.join(legalDir, 'privacy.html'),
  path.join(legalDir, 'copyright.html'),
  path.join(legalDir, 'contact.html'),
  path.join(publicDir, 'about.html'),
  path.join(articlesDir, 'downloading-guides.html')
];

pagesToFix.forEach(page => {
  if (fs.existsSync(page)) {
    let html = fs.readFileSync(page, 'utf8');
    
    // Check if it's missing the closing divs (i.e. if it ends exactly with </details> \n\n </body>)
    // Or just look for </body>
    
    // Check how many </div> tags there are vs how many <div class="legal-wrapper"> and <div class="legal-body"> and <div class="accordion-content">
    // Actually, the simplest fix is to just append the missing tags before </body> if they are missing.
    
    // Let's just do a string replace:
    if (!html.includes('</div>\n</div>\n</body>') && !html.includes('</div>\n  </div>\n</body>')) {
      html = html.replace('</body>', '  </div>\n</div>\n</body>');
      fs.writeFileSync(page, html, 'utf8');
      console.log('Fixed', path.basename(page));
    } else {
      console.log('Already fixed or not broken:', path.basename(page));
    }
  }
});
