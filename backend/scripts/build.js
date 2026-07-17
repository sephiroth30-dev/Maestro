'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const BACKEND = path.join(__dirname, '..');

console.log('[BUILD] Compilando TypeScript...');
const result = spawnSync(
  path.join(BACKEND, 'node_modules', '.bin', 'tsc'),
  ['--project', path.join(BACKEND, 'tsconfig.json')],
  { cwd: BACKEND, stdio: 'inherit' }
);
if (result.status === 0) {
  console.log('[BUILD] TypeScript compilado sin errores');
} else {
  console.error('[BUILD] Error de TypeScript (code ' + (result.status ?? 1) + '). Abortando build.');
  process.exit(result.status ?? 1);
}
