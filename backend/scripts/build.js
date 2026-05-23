'use strict';
// Este script reemplaza tsc en producción.
// Escribe dist/index.js como un shim que carga tsx → src/index.ts
// Así Hostinger siempre arranca con el código fuente actualizado,
// sin importar si tenía un dist/ viejo o incorrecto.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
fs.mkdirSync(distDir, { recursive: true });

const shim = `'use strict';
// Auto-generado por scripts/build.js — no editar manualmente
process.chdir(require('path').join(__dirname, '..'));
const { register } = require('../node_modules/tsx/cjs/api');
register({ tsconfig: require('path').join(__dirname, '..', 'tsconfig.json') });
require('../src/index.ts');
`;

fs.writeFileSync(path.join(distDir, 'index.js'), shim, 'utf8');
console.log('[BUILD] dist/index.js shim escrito — usará tsx en runtime');
