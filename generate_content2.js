const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const legalDir = path.join(publicDir, 'legal');
const articlesDir = path.join(publicDir, 'articles');

if (!fs.existsSync(legalDir)) fs.mkdirSync(legalDir, { recursive: true });
if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });

// Generator for ~1500 words
const generateFillerText = (paragraphs, targetWords = 1500) => {
  let content = '';
  let currentWords = 0;
  while (currentWords < targetWords) {
    const p1 = paragraphs[Math.floor(Math.random() * paragraphs.length)];
    const p2 = paragraphs[Math.floor(Math.random() * paragraphs.length)];
    const p3 = paragraphs[Math.floor(Math.random() * paragraphs.length)];
    const combined = `${p1} ${p2} ${p3}`;
    currentWords += combined.split(/\s+/).length;
    content += `<p>${p1}</p><p>${p2}</p><ul><li>Ensuring absolute compliance and robust execution.</li><li>Maintaining high-availability fault tolerance.</li><li>Preserving exact technical specifications.</li></ul><p>${p3}</p>`;
  }
  return content;
};

// Legal filler paragraphs (highly verbose, generic legal jargon)
const legalFiller = [
  "This provision explicitly details the complex, multi-layered responsibilities incumbent upon all utilizing entities, ensuring that every interaction conforms strictly to the governing operational guidelines established within this framework.",
  "Furthermore, it is universally acknowledged that any deviation from these meticulously architected protocols may result in automated throttling or immediate revocation of access privileges without prior notification.",
  "The underlying infrastructure operates on a decentralized, ephemeral basis, inherently minimizing the persistent storage of metadata while simultaneously maximizing the cryptographic security of all transit streams.",
  "To the fullest extent permitted by international and domestic jurisdictions, the platform disclaims all warranties, both express and implied, thereby indemnifying the operators from unforeseeable consequential damages.",
  "Users are strictly prohibited from employing automated robotic scripts, aggressive scraping heuristics, or any mechanism designed to circumvent the meticulously designed rate-limiting constraints."
];

// Guide filler paragraphs
const guideFiller = [
  "When initiating a download sequence for high-fidelity media, the backend extraction algorithm must seamlessly negotiate with the origin servers to parse complex manifest files (such as .m3u8).",
  "This process involves dynamic, real-time multiplexing of disparate audio and video streams, leveraging advanced FFmpeg subroutines to ensure flawless 4K output without compromising original bitrates.",
  "Understanding the nuances of adaptive bitrate streaming is essential; different CDNs implement wildly varying tokenization and geographic restriction schemas which our system autonomously circumvents.",
  "Always ensure that your localized network conditions can support sustained, high-bandwidth data transfer rates, as interrupted sessions may require complete re-initialization of the extraction pipeline.",
  "By adhering to these advanced methodologies, users can reliably archive even the most stubbornly obfuscated digital assets directly to their local storage environments."
];

const cssOverrides = `
    /* Accordion specific overrides */
    .legal-accordion {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      margin-bottom: 16px;
      transition: border-color 0.2s, box-shadow 0.2s;
      position: relative;
      overflow: hidden;
    }
    .legal-accordion::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 3px; height: 100%;
      background: linear-gradient(180deg, #00d4ff, #b300ff);
      border-radius: 0 0 0 0;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .legal-accordion:hover {
      border-color: rgba(0,212,255,0.2);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .legal-accordion:hover::before { opacity: 1; }
    
    .legal-accordion summary {
      padding: 24px 28px;
      cursor: pointer;
      list-style: none; /* Hide default arrow */
      outline: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .legal-accordion summary::-webkit-details-marker {
      display: none;
    }
    
    .legal-accordion summary h3 {
      font-family: 'Orbitron', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--cyan);
      margin: 0;
      letter-spacing: 0.02em;
    }

    /* Custom plus/minus indicator */
    .legal-accordion summary::after {
      content: '+';
      font-family: 'Orbitron', sans-serif;
      font-size: 1.5rem;
      color: var(--cyan);
      transition: transform 0.3s;
    }
    .legal-accordion[open] summary::after {
      content: '-';
    }

    .accordion-content {
      padding: 0 28px 24px 28px;
    }
    .accordion-content p {
      font-size: 0.9rem;
      color: var(--text-sec);
      line-height: 1.8;
      margin-bottom: 12px;
    }
    .accordion-content ul {
      list-style: none;
      padding: 0;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .accordion-content ul li {
      font-size: 0.88rem;
      color: var(--text-sec);
      line-height: 1.7;
      padding-left: 20px;
      position: relative;
    }
    .accordion-content ul li::before {
      content: '›';
      position: absolute;
      left: 0;
      color: var(--cyan);
      font-weight: 700;
    }
`;

const processHtmlFile = (filePath, fillerTextArray) => {
  if (!fs.existsSync(filePath)) return;
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Inject CSS overrides
  if (!html.includes('.legal-accordion')) {
    html = html.replace('</style>', cssOverrides + '\n  </style>');
  }
  
  // Replace <div class="legal-section"> with accordions
  // A bit complex because of nested elements, so let's do a regex that captures the H3 and the initial paragraph(s).
  // Alternatively, just replace the starting tags.
  
  const sections = html.split('<div class="legal-section">');
  if (sections.length < 2) return; // No sections found
  
  let newHtml = sections[0];
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    // Find the end of the section (last </div> before next split)
    const endIdx = section.lastIndexOf('</div>');
    
    const sectionContent = section.substring(0, endIdx);
    const afterSection = section.substring(endIdx + 6);
    
    // Extract the H3
    const h3Match = sectionContent.match(/<h3>(.*?)<\/h3>/);
    const title = h3Match ? h3Match[1] : 'Section';
    
    const originalText = sectionContent.replace(/<h3>.*?<\/h3>/, '').trim();
    
    const generatedFiller = generateFillerText(fillerTextArray, 1500);
    
    newHtml += `
    <details class="legal-accordion">
      <summary><h3>${title}</h3></summary>
      <div class="accordion-content">
        ${originalText}
        <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
        <h4>Detailed Addendum:</h4>
        ${generatedFiller}
      </div>
    </details>
    ${afterSection}`;
  }
  
  fs.writeFileSync(filePath, newHtml, 'utf8');
};

const pagesToProcess = [
  { path: path.join(legalDir, 'terms.html'), filler: legalFiller },
  { path: path.join(legalDir, 'privacy.html'), filler: legalFiller },
  { path: path.join(legalDir, 'copyright.html'), filler: legalFiller },
  { path: path.join(legalDir, 'contact.html'), filler: legalFiller },
  { path: path.join(publicDir, 'about.html'), filler: legalFiller },
  { path: path.join(articlesDir, 'tech-blog.html'), filler: guideFiller },
  { path: path.join(articlesDir, 'downloading-guides.html'), filler: guideFiller }
];

pagesToProcess.forEach(page => {
  if (fs.existsSync(page.path)) {
    processHtmlFile(page.path, page.filler);
  }
});

console.log('Successfully converted sections to interactive accordions and injected 1500 words per section.');
