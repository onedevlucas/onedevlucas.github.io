import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep the public viewer artwork identical to the downloadable source PDFs.
for (const kind of ['regular-service', 'rush-hour', 'winter-emergency', 'route']) {
  const file = path.join(root, 'assets', 'maps', `borail-flatlands-${kind}-map`);
  const metadata = execFileSync('pdfinfo', [`${file}.pdf`], { encoding: 'utf8' });
  if (!/^Pages:\s+1\s*$/m.test(metadata)) throw new Error(`Expected one page: ${file}.pdf`);
  execFileSync('pdftoppm', ['-png', '-singlefile', '-scale-to', '5000', `${file}.pdf`, file], { stdio: 'inherit' });
  console.log(`Rendered ${kind} map at 5000 pixels.`);
}
