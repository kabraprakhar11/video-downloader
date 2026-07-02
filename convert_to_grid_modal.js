const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const legalDir = path.join(publicDir, 'legal');

const pagesToConvert = [
  path.join(legalDir, 'terms.html'),
  path.join(legalDir, 'privacy.html'),
  path.join(legalDir, 'copyright.html'),
  path.join(legalDir, 'contact.html'),
  path.join(publicDir, 'about.html')
];

const cssStyles = `
    /* Grid Layout */
    .blog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
      margin-top: 20px;
    }

    /* Blog Card styling matching the theme's glassmorphism */
    .blog-card {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 30px;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    }

    .blog-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 3px; height: 100%;
      background: linear-gradient(180deg, #00d4ff, #b300ff);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .blog-card:hover {
      border-color: rgba(0,212,255,0.2);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      transform: translateY(-4px);
    }
    .blog-card:hover::before { opacity: 1; }

    .card-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.25rem;
      color: #fff;
      margin-bottom: 15px;
      line-height: 1.4;
    }

    .card-excerpt {
      color: var(--text-sec);
      font-size: 0.9rem;
      flex-grow: 1;
      margin-bottom: 25px;
      line-height: 1.6;
    }

    .read-btn {
      align-self: flex-start;
      background: transparent;
      color: var(--cyan);
      border: 1px solid rgba(0, 212, 255, 0.4);
      border-radius: 8px;
      padding: 10px 20px;
      font-family: 'Orbitron', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .read-btn:hover {
      background: rgba(0, 212, 255, 0.1);
      border-color: var(--cyan);
      box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
    }

    /* Glassmorphic Modal Overlay */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(6, 7, 10, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-card {
      background: rgba(10, 11, 18, 0.9);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 40px;
      position: relative;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    .close-modal {
      position: absolute;
      top: 20px; right: 20px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 2rem;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s;
    }
    .close-modal:hover {
      color: var(--cyan);
    }

    .modal-body {
      margin-top: 15px;
    }
    
    .modal-body h2 {
      font-family: 'Orbitron', sans-serif;
      color: #fff;
      margin-bottom: 20px;
      font-size: 1.8rem;
      background: linear-gradient(135deg, #00d4ff, #b300ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .modal-body p {
      margin-bottom: 20px;
      color: var(--text-sec);
      font-size: 0.95rem;
      line-height: 1.8;
    }

    .modal-body ul {
      margin-bottom: 20px;
      padding-left: 20px;
      list-style: none;
    }
    
    .modal-body li {
      margin-bottom: 10px;
      font-size: 0.95rem;
      line-height: 1.7;
      color: var(--text-sec);
      position: relative;
      padding-left: 20px;
    }
    .modal-body li::before {
      content: '›';
      position: absolute;
      left: 0;
      color: var(--cyan);
      font-weight: 700;
    }

    @media (max-width: 640px) {
      .blog-card { padding: 20px; }
      .modal-card { padding: 24px; }
    }
`;

const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '');

pagesToConvert.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // 1. Extract all accordions
  const sections = [];
  let idx = 0;
  while (true) {
    const start = html.indexOf('<details class="legal-accordion">', idx);
    if (start === -1) break;
    const end = html.indexOf('</details>', start);
    if (end === -1) break;
    
    const block = html.substring(start, end + 10);
    
    const titleMatch = block.match(/<summary><h3>(.*?)<\/h3><\/summary>/);
    const title = titleMatch ? titleMatch[1] : 'Section';
    
    const contentStart = block.indexOf('<div class="accordion-content">');
    const contentEnd = block.lastIndexOf('</div>');
    const content = block.substring(contentStart + '<div class="accordion-content">'.length, contentEnd).trim();
    
    const excerpt = stripHtml(content).substring(0, 140).trim() + '...';
    
    sections.push({ title, excerpt, content });
    idx = end + 10;
  }
  
  if (sections.length === 0) {
    console.log('No accordions found in:', path.basename(filePath));
    return;
  }
  
  // 2. Re-write the HTML
  // Locate the legal-body container
  const bodyStartStr = '<div class="legal-body">';
  const bodyStart = html.indexOf(bodyStartStr);
  
  // Find where the legal-body ends (before </body>)
  const bodyEnd = html.indexOf('</body>');
  
  // Re-build style overrides by replacing accordion css rules or just appending
  // Let's replace the .legal-accordion CSS overrides in <style>
  // We can search for /* Accordion specific overrides */ and replace it
  const styleMarker = '.legal-accordion';
  const styleStart = html.indexOf(styleMarker);
  
  if (styleStart !== -1) {
    // Let's just find the closing </style> tag after styleStart
    const styleEnd = html.indexOf('</style>', styleStart);
    html = html.substring(0, html.lastIndexOf('<style>') + 7) + cssStyles + html.substring(styleEnd);
  }
  
  // Re-build body
  let newHtml = html.substring(0, bodyStart + bodyStartStr.length);
  newHtml += `
    <div class="blog-grid" id="sectionsGrid"></div>
  </div>`; // Closes legal-body and legal-wrapper
  
  // Add modal and script before </body>
  const finalStart = newHtml.indexOf('</body>'); // Wait, we closed it, let's find the actual </body> in the remaining html
  const remaining = html.substring(bodyEnd);
  
  newHtml += `
  
  <div class="modal-overlay" id="articleModal">
    <div class="modal-card">
      <button class="close-modal" id="closeModal">×</button>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <script>
    const sections = ${JSON.stringify(sections, null, 2)};

    const grid = document.getElementById('sectionsGrid');
    const modal = document.getElementById('articleModal');
    const modalBody = document.getElementById('modalBody');
    const closeBtn = document.getElementById('closeModal');

    // Render Cards
    sections.forEach((section, index) => {
      const card = document.createElement('article');
      card.className = 'blog-card';
      card.innerHTML = \`
        <h2 class="card-title">\${section.title}</h2>
        <p class="card-excerpt">\${section.excerpt}</p>
        <button class="read-btn" onclick="openSection(\${index})">Read More</button>
      \`;
      grid.appendChild(card);
    });

    // Modal Logic
    window.openSection = (index) => {
      modalBody.innerHTML = \`<h2>\${sections[index].title}</h2>\` + sections[index].content;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };

    closeBtn.onclick = () => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    };

    window.onclick = (event) => {
      if (event.target == modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    };
  </script>
` + remaining;
  
  fs.writeFileSync(filePath, newHtml, 'utf8');
  console.log('Converted to card grid + modal:', path.basename(filePath));
});
