'use strict';
// Este script reemplaza tsc en producción.
// 1. Escribe dist/index.js como un shim que carga tsx → src/index.ts
// 2. Parchea dist/app.js para eliminar cualquier ruta /api/health registrada directamente
// 3. Parchea dist/controllers/auth.controller.js para garantizar que tenga /health
//    (bajo el prefijo /api → /api/health) — así no importa si el archivo es viejo o nuevo
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
fs.mkdirSync(distDir, { recursive: true });

// 1. Shim de entrada — Hostinger arranca con node dist/index.js
const shim = `'use strict';
// Auto-generado por scripts/build.js — no editar manualmente
process.chdir(require('path').join(__dirname, '..'));
const { register } = require('../node_modules/tsx/cjs/api');
register({ tsconfig: require('path').join(__dirname, '..', 'tsconfig.json') });
require('../src/index.ts');
`;
fs.writeFileSync(path.join(distDir, 'index.js'), shim, 'utf8');
console.log('[BUILD] dist/index.js shim escrito — usará tsx en runtime');

// 2. Parchear dist/app.js — eliminar fastify.get('/api/health') si existe
const appJsPath = path.join(distDir, 'app.js');
if (fs.existsSync(appJsPath)) {
  let content = fs.readFileSync(appJsPath, 'utf8');
  const before = content;
  // Elimina el bloque incluyendo la línea de cierre     });
  content = content.replace(
    /[ \t]*\/\/ ─+[^\n]*Health check[^\n]*\n[ \t]*fastify\.get\(['"]\/api\/health['"][\s\S]*?\n[ \t]*\}\);\n?/,
    ''
  );
  // Fallback sin comentario de sección
  if (content === before) {
    content = content.replace(
      /[ \t]*fastify\.get\(['"]\/api\/health['"][\s\S]*?\n[ \t]*\}\);\n?/,
      ''
    );
  }
  if (content !== before) {
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log('[BUILD] dist/app.js — eliminada ruta /api/health duplicada');
  } else {
    console.log('[BUILD] dist/app.js — sin cambios necesarios');
  }
}

// 3. Parchear dist/controllers/auth.controller.js — garantizar que tiene /health
const authCtrlDir = path.join(distDir, 'controllers');
const authCtrlPath = path.join(authCtrlDir, 'auth.controller.js');
fs.mkdirSync(authCtrlDir, { recursive: true });
if (fs.existsSync(authCtrlPath)) {
  let content = fs.readFileSync(authCtrlPath, 'utf8');
  if (!content.includes("fastify.get('/health'")) {
    // Insertar ruta /health justo después de crear authService
    content = content.replace(
      /(const authService = new [^;]+;)/,
      "$1\n    fastify.get('/health', async (_request, reply) => {\n        await reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' });\n    });"
    );
    fs.writeFileSync(authCtrlPath, content, 'utf8');
    console.log('[BUILD] dist/controllers/auth.controller.js — ruta /health añadida');
  } else {
    console.log('[BUILD] dist/controllers/auth.controller.js — ruta /health ya presente');
  }
}
