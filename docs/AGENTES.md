# Agentes de Claude Code del proyecto

> **Para qué sirve.** Repartir el trabajo de Claude Code entre modelos: uno planea y decide, otro lee, otro escribe. Es una convención de **desarrollo**; no afecta a la aplicación ni a su despliegue.

## Reparto de modelos

Regla en `CLAUDE.md`:

> Opus planea y decide. Toda lectura/búsqueda amplia de archivos se delega al agente `explore` (Haiku). Todo cambio de código según un plan se delega al agente `coder` (Sonnet). Opus revisa el diff antes de commit/deploy.

| Agente | Modelo | Herramientas | Hace |
|---|---|---|---|
| **Opus** (hilo principal) | el de la sesión | todas | Planea, decide, revisa el diff, hace commit y push. |
| **`explore`** | `claude-haiku-5-5` | Read, Grep, Glob, Bash | **Solo lectura:** busca, lee y resume código, logs y docs. |
| **`coder`** | `claude-sonnet-5-5` | Read, Grep, Glob, Edit, Write, Bash | Ejecuta **un plan ya definido**, con pruebas. |

Las definiciones están en `.claude/agents/explore.md` y `.claude/agents/coder.md` (versionadas con el proyecto). Los agentes **cargan al iniciar Claude Code**: tras añadirlos o editarlos hay que reiniciarlo.

## `explore` (Haiku, solo lectura)

- Devuelve **la respuesta directa primero**, rutas como `archivo:línea` y fragmentos de **máximo 20 líneas**.
- Si no vio algo, lo dice; **nunca inventa** rutas, líneas ni comportamientos.
- `Bash` solo para comandos que no escriben (`ls`, `git log`, `git diff`, `git status`, `git show`, `git blame`, `wc`, `file`, `head`, `tail`). Tiene prohibido escribir, instalar, ejecutar la app, las pruebas o un build, y usar la red.
- Ignora `node_modules/`, `backend/dist/` (la fuente es `backend/src/`) y `frontend/dist/`. No copia secretos.

## `coder` (Sonnet, implementa)

- Ejecuta el plan **sin rediseñarlo**; lo dudoso lo reporta, no lo decide.
- Escribe con el estilo del código vecino, agrega o ajusta pruebas (una que falle sin el arreglo, si es un defecto) y corre la **suite real**.
- Comandos reales del proyecto:

  | Para | Comando |
  |---|---|
  | Pruebas del backend | `cd backend && npx jest` |
  | Tipos | `cd backend && npx tsc --noEmit` · `cd frontend && npx tsc --noEmit` |
  | Compilar | `cd frontend && npm run build` · `cd backend && npm run build` |

- `backend/dist/` está **versionado** (Hostinger no compila): si cambió `backend/src/`, recompila para que `dist/` quede coherente en el diff.
- **No hace** `git commit`, `push`, `pull`, `checkout`, `reset` ni `stash`; no despliega; no toca los `version` de los `package.json`, `.github/workflows/` ni `docs/DEPLOY.md`; no llama a Medifolios real, no usa credenciales ni lee `.env`; no ejecuta migraciones.
- Responde: **archivos cambiados**, **resultado real de las pruebas** (resumen literal de jest, y `tsc`/`build` si aplican) y **dudas** (incluido «SQL sin ejecutar»: en el entorno de desarrollo no hay MySQL).

## Flujo recomendado

1. **Opus** define el plan (qué, dónde, criterios de aceptación).
2. **`explore`** localiza el código afectado y resume cómo funciona.
3. **`coder`** implementa y corre la suite.
4. **Opus revisa el diff** (y, si el cambio es delicado, pide una revisión independiente de solo lectura) antes de hacer commit y push a `main`.

## Límites

- Los agentes **no sustituyen la revisión**: `coder` informa lo que corrió, pero quien decide si el cambio sirve es quien revisa el diff.
- Ni `explore` ni `coder` pueden comprobar datos reales: no hay MySQL ni acceso a producción en el entorno de desarrollo.
- El despliegue sigue igual: lo hace Hostinger al recibir el push a `main`, y un flujo de CI sube la versión después (ver `docs/DEPLOY.md`).
