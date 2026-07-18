import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// CI's auto-release computes the version from git tags and passes it in;
// local builds fall back to package.json.
const version = process.env.WIDGET_VERSION ?? pkg.version;

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/allquiet-status-widget.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  sourcemap: true,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(version) },
  banner: {
    js: `/*! allquiet-status-widget v${version} | MIT | https://github.com/pixelunioneu/allquiet-status-widget */`,
  },
});

console.log(`built dist/allquiet-status-widget.js (v${version})`);
