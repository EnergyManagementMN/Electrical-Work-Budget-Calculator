// Inlines src/*.css and src/*.js into self-contained HTML files in dist/.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pages = [
  ['index.html', 'electrical-load-calculator.html'],
  ['energy.html', 'energy-consumption-calculator.html'],
];
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const [src, dest] of pages) {
  const html = read(src)
    .replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`)
    .replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}</script>`)
    .replace(/href="index\.html"/g, 'href="electrical-load-calculator.html"')
    .replace(/href="energy\.html"/g, 'href="energy-consumption-calculator.html"');
  const out = path.join(root, 'dist', dest);
  fs.writeFileSync(out, html);
  console.log('wrote ' + path.relative(root, out) + ' (' + Buffer.byteLength(html) + ' bytes)');
}
