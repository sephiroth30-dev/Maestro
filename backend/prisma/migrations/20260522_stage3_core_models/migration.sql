-- Stage 3: Core Data Models
-- Creates: entidades, profesionales, servicios, atenciones, presupuestos_mensuales

-- ─── TipoEntidad enum ─────────────────────────────────────────────────────────
CREATE TYPE "TipoEntidad" AS ENUM ('EPS', 'CONVENIO', 'PARTICULAR', 'ARL', 'OTRO');

-- ─── entidades ────────────────────────────────────────────────────────────────
CREATE TABLE "entidades" (
    "id"            TEXT NOT NULL,
    "nombre"        TEXT NOT NULL,
    "nombres_raw"   TEXT[],
    "tipo"          "TipoEntidad" NOT NULL,
    "es_grupo_caja" BOOLEAN NOT NULL DEFAULT false,
    "activa"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entidades_tipo_idx"   ON "entidades"("tipo");
CREATE INDEX "entidades_nombre_idx" ON "entidades"("nombre");

-- ─── profesionales ────────────────────────────────────────────────────────────
CREATE TABLE "profesionales" (
    "id"          TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "nombres_raw" TEXT[],
    "es_nomina"   BOOLEAN NOT NULL DEFAULT false,
    "activo"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profesionales_pkey" PRIMARY KEY ("id")
);

-- ─── servicios ────────────────────────────────────────────────────────────────
CREATE TABLE "servicios" (
    "id"         TEXT NOT NULL,
    "nombre"     TEXT NOT NULL,
    "categoria"  TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicios_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "servicios_nombre_key"  UNIQUE ("nombre")
);

-- ─── atenciones ───────────────────────────────────────────────────────────────
CREATE TABLE "atenciones" (
    "id"                   TEXT NOT NULL,
    "descripcion_raw"      TEXT NOT NULL,
    "descripcion_norm"     TEXT NOT NULL,
    "fecha_dia"            DATE NOT NULL,
    "mes_idx"              INTEGER NOT NULL,
    "anio"                 INTEGER NOT NULL,
    "valor_bruto"          DECIMAL(12,2) NOT NULL,
    "numero_autorizacion"  TEXT,
    "es_telemetria"        BOOLEAN NOT NULL DEFAULT false,
    "hash_fila"            TEXT NOT NULL,
    "entidad_id"           TEXT,
    "profesional_id"       TEXT,
    "servicio_id"          TEXT,
    "conector_id"          TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atenciones_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "atenciones_hash_fila_key" UNIQUE ("hash_fila"),
    CONSTRAINT "atenciones_entidad_id_fkey"
        FOREIGN KEY ("entidad_id") REFERENCES "entidades"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atenciones_profesional_id_fkey"
        FOREIGN KEY ("profesional_id") REFERENCES "profesionales"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atenciones_servicio_id_fkey"
        FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "atenciones_fecha_dia_idx"         ON "atenciones"("fecha_dia");
CREATE INDEX "atenciones_mes_idx_anio_idx"      ON "atenciones"("mes_idx", "anio");
CREATE INDEX "atenciones_entidad_id_idx"        ON "atenciones"("entidad_id");
CREATE INDEX "atenciones_profesional_id_idx"    ON "atenciones"("profesional_id");
CREATE INDEX "atenciones_hash_fila_idx"         ON "atenciones"("hash_fila");
CREATE INDEX "atenciones_numero_autorizacion_idx" ON "atenciones"("numero_autorizacion");

-- ─── presupuestos_mensuales ───────────────────────────────────────────────────
CREATE TABLE "presupuestos_mensuales" (
    "id"         TEXT NOT NULL,
    "anio"       INTEGER NOT NULL,
    "mes"        INTEGER NOT NULL,
    "monto"      DECIMAL(14,2) NOT NULL,
    "notas"      TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presupuestos_mensuales_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "presupuestos_mensuales_anio_mes_key" UNIQUE ("anio", "mes")
);
