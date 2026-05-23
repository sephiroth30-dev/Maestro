'use strict';
const path = require('path');
const fs = require('fs');
const distDir = __dirname;
const backendDir = path.join(distDir, '..');
process.chdir(backendDir);

process.on('uncaughtException', function(err) {
  console.log('[SHIM] uncaughtException:', err && (err.stack || err.message || String(err)));
  process.exit(1);
});
process.on('unhandledRejection', function(reason) {
  console.log('[SHIM] unhandledRejection:', reason instanceof Error ? (reason.stack || reason.message) : String(reason));
  process.exit(1);
});

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
console.log('[SHIM] Node ' + process.version + ' | cwd: ' + process.cwd());

var tsxApi = path.join(backendDir, 'node_modules', 'tsx', 'cjs', 'api');
var srcIndex = path.join(backendDir, 'src', 'index.ts');
console.log('[SHIM] tsx api exists: ' + fs.existsSync(tsxApi + '.js'));
console.log('[SHIM] src/index.ts exists: ' + fs.existsSync(srcIndex));

try {
  var _tsx = require(tsxApi);
  console.log('[SHIM] tsx loaded, register type: ' + typeof _tsx.register);
  _tsx.register({ tsconfig: path.join(backendDir, 'tsconfig.json') });
  console.log('[SHIM] tsx registered — loading src/index.ts');
  require(srcIndex);
} catch (err) {
  console.log('[SHIM] FATAL: ' + (err && (err.stack || err.message || String(err))));
  process.exit(1);
}
