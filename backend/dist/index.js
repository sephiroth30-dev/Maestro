'use strict';
const path = require('path');
const fs = require('fs');
const distDir = __dirname;
const backendDir = path.join(distDir, '..');
process.chdir(backendDir);

// Delete all stale dist/ JS files so tsx loads exclusively from src/
function cleanDist(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDist(full);
    } else if (entry.name.endsWith('.js') && full !== __filename) {
      try { fs.unlinkSync(full); } catch (_) {}
    }
  }
}
cleanDist(distDir);
console.log('[SHIM] dist/ limpiado — cargando desde src/');

const { register } = require(path.join(backendDir, 'node_modules', 'tsx', 'cjs', 'api'));
register({ tsconfig: path.join(backendDir, 'tsconfig.json') });
require(path.join(backendDir, 'src', 'index.ts'));
