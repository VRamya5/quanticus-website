const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Find all href="#..." in index.html
const hrefRegex = /href="#([^"]+)"/g;
let match;
const anchors = new Set();
while ((match = hrefRegex.exec(html)) !== null) {
  anchors.add(match[1]);
}

console.log('Found internal anchor links in index.html:', Array.from(anchors));

// Find all id="..." in index.html
const idRegex = /id="([^"]+)"/g;
const ids = new Set();
while ((match = idRegex.exec(html)) !== null) {
  ids.add(match[1]);
}

let broken = 0;
for (const anchor of anchors) {
  if (!ids.has(anchor)) {
    console.error(`[BROKEN LINK] Anchor #${anchor} has no matching id on page!`);
    broken++;
  } else {
    console.log(`[OK LINK] #${anchor} -> found id="${anchor}"`);
  }
}

if (broken === 0) {
  console.log('\nAll navigation and internal anchor links are 100% valid!');
} else {
  console.error(`\nFound ${broken} broken links!`);
  process.exit(1);
}
