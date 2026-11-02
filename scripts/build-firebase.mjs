// Rebuilds js/vendor/firebase.js from the pinned firebase package.
// Run: npm run build:firebase (only needed when upgrading Firebase).
import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/firebase-entry.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  legalComments: 'eof',
  outfile: 'js/vendor/firebase.js',
  banner: { js: '// Firebase JS SDK, bundled by scripts/build-firebase.mjs. Do not edit.' },
});
