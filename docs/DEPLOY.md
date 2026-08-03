# Despliegue y operación

**Producción:** https://dashboard.neurofic.com · Hostinger · MySQL

Stack: Node.js + Fastify + MySQL en el backend; React servido como estático desde el
propio backend.

---

## Cómo llega el código al servidor

**Lo despliega Hostinger**, con su integración de Git desde hPanel: el servidor sigue la
rama `main` y se actualiza por su cuenta.

GitHub Actions **no despliega**. El flujo `deploy.yml` quedó en ejecución manual
(`workflow_dispatch`) porque solo fallaba en el paso de SSH —faltan los secretos— y
generaba una notificación de error por cada commit. Se conserva como alternativa si
Hostinger dejara de servir; las instrucciones para reactivarlo están en el propio
archivo.

Lo que sí corre en cada push es `version.yml`, que no necesita secretos:

1. Sube la versión de parche en los tres `package.json`.
2. Valida que frontend y backend compilen.
3. Verifica que `backend/dist` corresponda al código fuente.

---

## `backend/dist` está versionado — y hay que recompilarlo

Hostinger ejecuta `node dist/index.js` **sin paso de compilación**. Por eso
`backend/dist` se commitea al repositorio, mientras que `frontend/dist` está en
`.gitignore`.

> **Todo cambio en `backend/src` exige regenerar y commitear `backend/dist`.**
>
> ```bash
> npm run build --prefix backend
> git add backend/dist && git commit
> ```
>
> Olvidarlo es peligroso porque **no falla nada a la vista**: el servidor sigue
> ejecutando la versión anterior, los endpoints nuevos devuelven 404 y las migraciones
> nuevas no corren. El chequeo de `version.yml` existe justamente para atrapar esto.

---

## Variables de entorno

Se configuran en hPanel y viven en el `.env` del directorio de la aplicación. **No están
en el repositorio.**

```
DATABASE_URL=mysql://USUARIO:CONTRASEÑA@localhost:3306/BASE
JWT_SECRET=<64 bytes aleatorios>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=*
COMMIT_SHA=<opcional; lo muestra /api/version>
```

Generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

> **Al mover el sitio de dominio o de carpeta, el `.env` no viaja.** Hay que copiarlo. Si
> cambia el `JWT_SECRET`, todas las sesiones activas se cierran — molesto pero inocuo.

Referencia completa en [ENV.md](ENV.md).

---

## Migraciones

**Se aplican solas al arrancar.** `runSchemaMigrations()` recorre la lista de
`schema-migrations.service.ts` en cada inicio; los fallos quedan como advertencia y no
impiden el arranque.

No hay comando manual que ejecutar: reiniciar la aplicación es lo que las aplica — y
recordar que llegan al servidor dentro de `backend/dist`.

Detalles y trampas en [MODELO-DATOS.md](MODELO-DATOS.md#migraciones).

---

## Reiniciar la aplicación

El proceso lo gestiona **Passenger**, no PM2:

```bash
touch ~/domains/dashboard.neurofic.com/nodejs/tmp/restart.txt
```

Passenger levanta la aplicación bajo demanda y la reinicia sola si se cae.

---

## Verificar que un despliegue llegó

```bash
curl https://dashboard.neurofic.com/api/version
```

Devuelve `{ version, commit, env }`. El `commit` es el `git rev-parse --short HEAD` del
servidor: si no coincide con `main`, el despliegue no llegó. La versión también aparece
al pie de la barra lateral.

---

## Diagnóstico

| Síntoma | Causa probable |
|---|---|
| La versión no cambia tras un push | Hostinger no ha hecho pull, o hay cambios locales en el servidor que bloquean el `git pull`. |
| Un endpoint nuevo devuelve 404 | `backend/dist` sin recompilar. |
| Página en blanco tras desplegar | Falló el build del frontend. `tsc` es estricto (`noUnusedLocals`): **un import sin usar rompe la compilación**, y como el comando es `tsc && vite build`, no se genera ningún paquete. |
| La aplicación no arranca | Falta el `.env` o tiene una variable mal. El log de arranque indica cuál. |
| Los datos no se actualizan | Es la sincronización, no el despliegue: Configuración → Fuentes. |

---

## Primera instalación

1. Crear la base de datos en hPanel y anotar las credenciales.
2. Clonar el repositorio en el directorio del dominio.
3. Crear el `.env`.
4. `npm install --prefix backend --omit=dev`
5. `npm install --prefix frontend && npm run build --prefix frontend`
6. Sembrar los datos iniciales: desde `backend/`, `npx tsx prisma/seed.ts`.
7. Configurar la aplicación Node en hPanel apuntando a `backend/dist/index.js`.
8. Entrar y cambiar la contraseña del administrador.
