import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist/assets');
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

if (files.length === 0) {
  console.error('No JS bundle found in dist/assets');
  process.exit(1);
}

const bundlePath = path.join(distDir, files[0]);
const content = fs.readFileSync(bundlePath, 'utf8');

const hasRender = content.includes('https://robopulse-backend.onrender.com/api');
const hasLocalhost5000 = content.includes('localhost:5000');

console.log('Bundle File:', files[0]);
console.log('Contains Render Backend URL (https://robopulse-backend.onrender.com/api):', hasRender);
console.log('Contains localhost:5000:', hasLocalhost5000);

if (hasRender && !hasLocalhost5000) {
  console.log('SUCCESS: Production build uses the Render backend URL!');
} else {
  console.error('FAILURE: Unexpected bundle configuration.');
  process.exit(1);
}
