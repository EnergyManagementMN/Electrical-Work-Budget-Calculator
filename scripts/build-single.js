// Inlines src/*.css and src/*.js into one self-contained HTML file: dist/electrical-load-calculator.html
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html')
  .replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`)
  .replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'electrical-load-calculator.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Buffer.byteLength(html) + ' bytes)');
