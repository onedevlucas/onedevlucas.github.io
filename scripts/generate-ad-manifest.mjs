import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carouselDirectory = path.join(root, 'assets', 'images', 'ads', 'carousel');
const linksPath = path.join(carouselDirectory, 'links.json');
const manifestPath = path.join(carouselDirectory, 'manifest.json');

const links = fs.existsSync(linksPath)
  ? JSON.parse(fs.readFileSync(linksPath, 'utf8'))
  : {};

const files = fs.readdirSync(carouselDirectory)
  .filter(file => file.toLowerCase().endsWith('.png'))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

function defaultAlt(file) {
  return file
    .replace(/\.png$/i, '')
    .replace(/^\d+[._ -]*/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase()) || 'Advertisement';
}

const manifest = files.map(file => {
  const configured = links[file] || {};
  const entry = {
    file,
    alt: String(configured.alt || defaultAlt(file))
  };

  if (configured.href) {
    const href = new URL(String(configured.href));
    if (!['http:', 'https:'].includes(href.protocol)) {
      throw new Error(`Unsupported advertisement link protocol for ${file}`);
    }
    entry.href = href.href;
  }

  return entry;
});

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated advertisement manifest with ${manifest.length} PNG file(s).`);
