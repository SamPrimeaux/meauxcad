import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

const timestamp = Date.now();

// Replace ?v=xyz with ?v=newTimestamp
html = html.replace(/(src="\/index\.tsx)(\?v=[0-9]+)?(")/g, `$1?v=${timestamp}$3`);
html = html.replace(/(href="\/index\.css)(\?v=[0-9]+)?(")/g, `$1?v=${timestamp}$3`);

// Verify insertion for fresh strings
if (!html.includes(`index.tsx?v=${timestamp}`)) {
    html = html.replace('src="/index.tsx"', `src="/index.tsx?v=${timestamp}"`);
}
if (!html.includes(`index.css?v=${timestamp}`)) {
    html = html.replace('href="/index.css"', `href="/index.css?v=${timestamp}"`);
}

fs.writeFileSync(htmlPath, html);
console.log(`Busted cache with v=${timestamp}`);
