import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_GZIP_BYTES = 6144;

const file = new URL('../dist/allquiet-status-widget.js', import.meta.url);
const raw = readFileSync(file);
const gzipped = gzipSync(raw).length;

console.log(`dist/allquiet-status-widget.js: ${raw.length} bytes raw, ${gzipped} bytes gzipped (budget ${BUDGET_GZIP_BYTES})`);

if (gzipped > BUDGET_GZIP_BYTES) {
  console.error('size budget exceeded');
  process.exit(1);
}
