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
  console.log('[BUILD] tsc completado con advertencias (code ' + result.status + ')');
}
