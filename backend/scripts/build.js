'use strict';
// Este script reemplaza tsc en producción.
// Garantiza que no haya rutas /health duplicadas sin importar qué archivos
// tenga Hostinger en disco (git pull puede no actualizar archivos untracked).
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const distDir = path.join(BACKEND, 'dist');
fs.mkdirSync(distDir, { recursive: true });

// ─── 1. Shim de entrada ───────────────────────────────────────────────────────
const shim = `'use strict';
// Auto-generado por scripts/build.js
process.chdir(require('path').join(__dirname, '..'));
const { register } = require('../node_modules/tsx/cjs/api');
register({ tsconfig: require('path').join(__dirname, '..', 'tsconfig.json') });
require('../src/index.ts');
`;
fs.writeFileSync(path.join(distDir, 'index.js'), shim, 'utf8');
console.log('[BUILD] dist/index.js shim escrito');

// ─── helper: elimina un bloque fastify.get(route) de un archivo ──────────────
// Usa búsqueda línea por línea para evitar problemas de regex con Unicode/CRLF.
function removeRoute(filePath, route) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const out = [];
  let i = 0;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Salta comentarios de sección que contengan "Health check"
    if (trimmed.startsWith('//') && trimmed.includes('Health check')) {
      i++;
      changed = true;
      continue;
    }

    // Detecta el inicio del bloque fastify.get(route)
    const startsRoute =
      trimmed.startsWith(`fastify.get('${route}',`) ||
      trimmed.startsWith(`fastify.get("${route}",`) ||
      trimmed.startsWith(`fastify.get('${route}')`) ||
      trimmed.startsWith(`fastify.get("${route}")`);

    if (startsRoute) {
      changed = true;
      // Avanza hasta encontrar el cierre '});' al mismo nivel de indentación
      const baseIndent = line.search(/\S/);
      i++;
      while (i < lines.length) {
        const l = lines[i];
        const lTrimmed = l.trim();
        const lIndent = l.search(/\S/);
        i++;
        if (lTrimmed === '});' && lIndent <= baseIndent) break;
      }
      continue;
    }

    out.push(line);
    i++;
  }

  if (changed) {
    fs.writeFileSync(filePath, out.join('\n'), 'utf8');
    const rel = path.relative(BACKEND, filePath);
    console.log(`[BUILD] ${rel} — eliminada ruta ${route}`);
  } else {
    const rel = path.relative(BACKEND, filePath);
    console.log(`[BUILD] ${rel} — ruta ${route} no encontrada (OK)`);
  }
}

// ─── 2. Eliminar /api/health de dist/app.js ──────────────────────────────────
removeRoute(path.join(distDir, 'app.js'), '/api/health');

// ─── 3. Eliminar /api/health de src/app.ts (por si git pull dejó versión vieja)
removeRoute(path.join(BACKEND, 'src', 'app.ts'), '/api/health');

// ─── 4. Eliminar /health de dist/controllers/auth.controller.js ──────────────
fs.mkdirSync(path.join(distDir, 'controllers'), { recursive: true });
removeRoute(path.join(distDir, 'controllers', 'auth.controller.js'), '/health');

// ─── 5. Eliminar /health de src/controllers/auth.controller.ts ───────────────
removeRoute(path.join(BACKEND, 'src', 'controllers', 'auth.controller.ts'), '/health');

console.log('[BUILD] Listo — sin rutas /health duplicadas posibles');
