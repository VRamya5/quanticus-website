const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#60a5fa"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bgGrad)"/>
  <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.4"/>
  <circle cx="31" cy="30" r="14" fill="none" stroke="url(#qGrad)" stroke-width="5.5"/>
  <path d="M39 38 L48 47" stroke="url(#qGrad)" stroke-width="5.5" stroke-linecap="round"/>
</svg>`;

const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), svg);

sharp(Buffer.from(svg))
  .resize(64, 64)
  .png()
  .toFile(path.join(assetsDir, 'favicon.png'))
  .then(() => {
    // Also copy / write favicon.ico
    fs.copyFileSync(path.join(assetsDir, 'favicon.png'), path.join(__dirname, '../favicon.ico'));
    console.log('Favicon generated successfully!');
  })
  .catch((err) => {
    console.error('Error generating favicon:', err);
  });
