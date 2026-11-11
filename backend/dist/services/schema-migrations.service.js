"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSchemaMigrations = runSchemaMigrations;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
const MIGRATIONS = [
    {
        id: 'm01_entidad_nombre_raw',
        sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS entidad_nombre_raw VARCHAR(255) NULL',
    },
    {
        id: 'm02_servicios_palabras_clave',
        sql: "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS palabras_clave JSON NULL",
    },
    {
        id: 'm03_servicios_tipo_conteo',
        sql: "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS tipo_conteo ENUM('unidad','sesion') NOT NULL DEFAULT 'unidad'",
    },
    {
        id: 'm04_servicios_orden',
        sql: 'ALTER TABLE servicios ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 99',
    },
    {
        id: 'm05_atenciones_paciente_nombre',
        sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS paciente_nombre VARCHAR(255) NULL',
    },
    {
        id: 'm06_atenciones_paciente_documento',
        sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS paciente_documento VARCHAR(50) NULL',
    },
    {
        id: 'm07_atenciones_servicio_id_idx',
        sql: 'CREATE INDEX atenciones_servicio_id_idx ON atenciones (servicio_id)',
        index: { tabla: 'atenciones', columna: 'servicio_id' },
    },
    {
        id: 'm08_usuarios_rol_recursos_humanos',
        sql: "ALTER TABLE usuarios MODIFY COLUMN rol ENUM('ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES','RECURSOS_HUMANOS') NOT NULL",
    },
    {
        id: 'm09_reglas_honorarios',
        sql: `CREATE TABLE IF NOT EXISTS reglas_honorarios (
      id VARCHAR(36) NOT NULL,
      profesional_nombre VARCHAR(100) NOT NULL,
      categoria VARCHAR(30) NOT NULL,
      tipo ENUM('fijo','pct') NOT NULL,
      valor_entidad DECIMAL(15,4) NOT NULL,
      valor_particular DECIMAL(15,4) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      notas VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_prof_cat (profesional_nombre, categoria)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    {
        id: 'm10_reglas_especiales_honorarios',
        sql: `CREATE TABLE IF NOT EXISTS reglas_especiales_honorarios (
      id VARCHAR(36) NOT NULL,
      tipo_regla VARCHAR(50) NOT NULL,
      profesional_nombre VARCHAR(100) NOT NULL,
      condicion VARCHAR(200) NULL,
      valor DECIMAL(15,4) NOT NULL,
      descripcion VARCHAR(255) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    {
        id: 'm11_usuarios_modulos',
        sql: 'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos TEXT NULL',
    },
    {
        id: 'm12_atenciones_profesional_nombre_raw',
        sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS profesional_nombre_raw VARCHAR(200) NULL',
    },
    {
        id: 'm13_liquidaciones_es_simulado',
        sql: 'ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS es_simulado TINYINT(1) NOT NULL DEFAULT 0',
    },
    // Concede el módulo nuevo a quien ya tiene reportes. Sin esto,
    // `hasModuleAccess` falla cerrado y todo usuario con lista explícita de
    // módulos pierde la página hasta que un administrador se la marque a mano.
    //
    // El runner NO lleva registro de migraciones aplicadas: reejecuta la lista en
    // cada arranque. Por eso la condición `NOT LIKE '%"pacientes"%'` no es un
    // adorno — sin ella, cada reinicio añadiría otra copia de "pacientes" hasta
    // desbordar la columna TEXT.
    {
        id: 'm16_usuarios_modulo_pacientes',
        sql: `UPDATE usuarios
          SET modulos = REPLACE(modulos, '"reportes"', '"reportes","pacientes"')
          WHERE modulos LIKE '%"reportes"%' AND modulos NOT LIKE '%"pacientes"%'`,
    },
    // Base de conteo por grupo de capacidad. NULL = usar el valor por omisión del
    // catálogo en `config/capacidad-grupos.ts`.
    //
    // Existe porque un mismo mes admite dos cifras de demanda legítimas: visitas
    // únicas y estudios facturados. Potenciales Evocados se mide en estudios (una
    // visita cubre varias modalidades, cada una consume equipo y lectura), mientras
    // EMG / VCN se mide en visitas (EMG+VCN en la misma cita = un hueco de agenda).
    // Antes la elección estaba cableada en el SQL y era la misma para los doce grupos.
    {
        id: 'm17_capacidad_base_conteo',
        sql: "ALTER TABLE capacidad_instalada ADD COLUMN base_conteo ENUM('pacientes','estudios') NULL",
        columna: { tabla: 'capacidad_instalada', columna: 'base_conteo' },
    },
    // ─── Fuente activa del dashboard ──────────────────────────────────────────
    //
    // Hasta ahora ninguna consulta de reportes distinguía de qué conector venía
    // cada atención: todas sumaban la tabla entera. Con dos fuentes cargadas (el
    // Sheet histórico y la API de Medifolios), cada mes presente en ambas habría
    // aparecido con la facturación duplicada, sin ninguna alerta.
    //
    // Esta columna marca cuál es la fuente que ve el dashboard. Es distinta de
    // `activo`, que decide si el conector SE SINCRONIZA: durante la transición hay
    // que poder sincronizar Medifolios en segundo plano y compararlo en
    // Diagnóstico antes de que el dashboard lo muestre.
    {
        id: 'm18_conectores_fuente_activa',
        sql: 'ALTER TABLE conectores ADD COLUMN es_fuente_activa TINYINT(1) NOT NULL DEFAULT 0',
        columna: { tabla: 'conectores', columna: 'es_fuente_activa' },
    },
    // El filtro nuevo se aplica en cada consulta de reportes y esta columna no
    // tenía índice (sí lo tienen fecha, mes/año, entidad, profesional y autorización).
    {
        id: 'm19_atenciones_conector_id_idx',
        sql: 'CREATE INDEX atenciones_conector_id_idx ON atenciones (conector_id)',
        index: { tabla: 'atenciones', columna: 'conector_id' },
    },
    // Marca como fuente activa la que más atenciones tiene — hoy el Sheet, el
    // único con datos — para que el dashboard no cambie ni una cifra al desplegar.
    //
    // El guardia `NOT EXISTS` es obligatorio: el runner reejecuta la lista completa
    // en cada arranque, así que sin él esto pisaría la elección del administrador
    // en cada reinicio del servidor.
    {
        id: 'm20_marcar_fuente_activa_inicial',
        // El guardia usa una subconsulta CON AGREGADO a propósito. La versión
        // anterior envolvía la tabla en `(SELECT * FROM conectores) x`, que era el
        // truco clásico contra el error 1093 de MySQL ("no se puede usar la
        // tabla destino en un FROM"). Desde MySQL 5.7 el optimizador FUSIONA esas
        // subconsultas en vez de materializarlas, así que el truco dejó de servir y
        // la migración fallaba en cada arranque —registrada solo como aviso— sin
        // marcar ninguna fuente. Un agregado no se puede fusionar, así que obliga a
        // materializar y el 1093 no aparece.
        sql: `UPDATE conectores c
          JOIN (
            SELECT conector_id, COUNT(*) AS n
            FROM atenciones
            WHERE conector_id IS NOT NULL
            GROUP BY conector_id
            ORDER BY n DESC
            LIMIT 1
          ) top ON top.conector_id = c.id
          CROSS JOIN (
            SELECT COALESCE(SUM(es_fuente_activa), 0) AS activas FROM conectores
          ) chk
          SET c.es_fuente_activa = 1
          WHERE chk.activas = 0`,
    },
    // ─── Proyección por agenda (citas pendientes) ─────────────────────────────
    //
    // Copia local de las citas PENDIENTES de Medifolios: el dashboard nunca llama a
    // la API al abrirse, lee de aquí. Se reemplaza completa en cada sincronización.
    //
    // NO guarda datos de pacientes: para proyectar no hacen falta, y es una tabla
    // menos con información sensible.
    //
    // `valor_estimado` es NULL cuando no hay precio de referencia: se cuenta y se
    // AVISA, nunca se trata como 0.
    {
        id: 'm21_citas_agendadas',
        sql: `CREATE TABLE IF NOT EXISTS citas_agendadas (
      cod_asignacion BIGINT NOT NULL,
      conector_id VARCHAR(36) NOT NULL,
      fecha_cita DATETIME NOT NULL,
      fecha_dia DATE NOT NULL,
      convenio_cod INT NULL,
      convenio_nombre VARCHAR(200) NOT NULL DEFAULT '',
      entidad_id VARCHAR(36) NULL,
      referencia_nombre VARCHAR(255) NOT NULL DEFAULT '',
      cups VARCHAR(20) NULL,
      grupo VARCHAR(40) NULL,
      valor_estimado DECIMAL(15,2) NULL,
      origen_valor VARCHAR(20) NOT NULL DEFAULT 'sin_precio',
      PRIMARY KEY (cod_asignacion, conector_id),
      KEY idx_citas_fecha_dia (fecha_dia),
      KEY idx_citas_entidad (entidad_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    // Estado de la última sincronización de citas, una fila por conector. Alimenta
    // `actualizado_en` del endpoint (para avisar si la agenda está vieja) y la
    // pantalla de Diagnóstico: un 403 por falta de permiso debe VERSE, no vaciar la
    // tabla ni quedar como «no hay citas».
    {
        id: 'm22_agenda_sync',
        sql: `CREATE TABLE IF NOT EXISTS agenda_sync (
      conector_id VARCHAR(36) NOT NULL,
      ultimo_intento DATETIME NULL,
      ultima_ok DATETIME NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'nunca',
      error TEXT NULL,
      http_status INT NULL,
      citas_leidas INT NOT NULL DEFAULT 0,
      citas_guardadas INT NOT NULL DEFAULT 0,
      citas_sin_precio INT NOT NULL DEFAULT 0,
      horizonte DATE NULL,
      duracion_ms INT NULL,
      convenios_estado VARCHAR(20) NULL,
      convenios_error TEXT NULL,
      convenios_actualizado DATETIME NULL,
      PRIMARY KEY (conector_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    // Convenio (lista de precios) → EPS, del catálogo de Medifolios. Una cita trae
    // el convenio, no la EPS; el catálogo trae `eps.nomEps`, el mismo nombre que
    // usan los consumos. Si el usuario de la API no tiene permiso para el
    // catálogo, la tabla queda vacía y la EPS se vincula por nombre.
    {
        id: 'm24_agenda_backtest',
        sql: `CREATE TABLE IF NOT EXISTS agenda_backtest (
      conector_id VARCHAR(36) NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'nunca',
      iniciado DATETIME NULL,
      terminado DATETIME NULL,
      error TEXT NULL,
      resultado LONGTEXT NULL,
      PRIMARY KEY (conector_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    {
        id: 'm23_convenios_eps',
        sql: `CREATE TABLE IF NOT EXISTS convenios_eps (
      cod_convenio INT NOT NULL,
      conector_id VARCHAR(36) NOT NULL,
      nombre VARCHAR(200) NOT NULL DEFAULT '',
      eps_nombre VARCHAR(200) NULL,
      entidad_id VARCHAR(36) NULL,
      PRIMARY KEY (cod_convenio, conector_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
];
async function columnaExiste(tabla, columna) {
    const [rows] = await prisma_js_1.pool.query(`SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`, [tabla, columna]);
    return rows.length > 0;
}
async function indiceExiste(tabla, columna) {
    const [rows] = await prisma_js_1.pool.query(`SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND COLUMN_NAME = ? AND SEQ_IN_INDEX = 1
     LIMIT 1`, [tabla, columna]);
    return rows.length > 0;
}
async function runSchemaMigrations() {
    for (const m of MIGRATIONS) {
        try {
            if (m.index && (await indiceExiste(m.index.tabla, m.index.columna)))
                continue;
            if (m.columna && (await columnaExiste(m.columna.tabla, m.columna.columna)))
                continue;
            await prisma_js_1.pool.execute(m.sql);
        }
        catch (err) {
            logger_js_1.logger.warn(`Schema migration ${m.id} failed (non-fatal)`, {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    logger_js_1.logger.info('Schema migrations complete');
}
//# sourceMappingURL=schema-migrations.service.js.map