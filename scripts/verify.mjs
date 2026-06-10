import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = ['index.html', 'home.html', 'map.html', 'status.html', 'workbench.html'];
const scriptFiles = ['assets/js/timetable.js', 'assets/js/status.js', 'assets/js/workbench-core.js', 'assets/js/workbench.js', 'sw.js'];
const webFiles = [...htmlFiles, ...scriptFiles];

const references = [];
const htmlRefPattern = /(?:src|href)=["']([^"'#]+)["']/g;
const assetRefPattern = /["'`](assets\/[^"'`]+\.(?:css|js|png|pdf))["'`]/g;

for (const file of webFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');

  if (file.endsWith('.html')) {
    for (const match of content.matchAll(htmlRefPattern)) references.push([file, match[1]]);
  }

  for (const match of content.matchAll(assetRefPattern)) references.push([file, match[1]]);
}

const missing = references
  .filter(([, reference]) => !/^(?:data:|https?:)/.test(reference))
  .filter(([, reference]) => !fs.existsSync(path.join(root, reference.split('?')[0])))
  .map(([file, reference]) => `${file} -> ${reference}`);

const rootAssets = fs.readdirSync(root)
  .filter((file) => /\.(?:png|pdf|css|js)$/i.test(file) && file !== 'sw.js');

const inlineAssets = htmlFiles.filter((file) => {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  return /<style>|<script>/.test(content);
});

const syntaxErrors = [];
for (const file of scriptFiles) {
  try {
    new Function(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    syntaxErrors.push(`${file}: ${error.message}`);
  }
}

if (missing.length || rootAssets.length || inlineAssets.length || syntaxErrors.length) {
  if (missing.length) console.error(`Missing references:\n${missing.join('\n')}`);
  if (rootAssets.length) console.error(`Unorganized root assets:\n${rootAssets.join('\n')}`);
  if (inlineAssets.length) console.error(`Inline CSS/JS remains:\n${inlineAssets.join('\n')}`);
  if (syntaxErrors.length) console.error(`JavaScript syntax errors:\n${syntaxErrors.join('\n')}`);
  process.exit(1);
}

console.log(`Verified ${references.length} local references; all resolve.`);
console.log('JavaScript syntax and repository organization checks passed.');
