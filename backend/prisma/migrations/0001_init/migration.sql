CREATE TABLE `usuarios` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES') NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuarios_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id` VARCHAR(36) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `usuario_id` VARCHAR(36) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `refresh_tokens_token_hash_key` (`token_hash`),
  KEY `refresh_tokens_usuario_id_fkey` (`usuario_id`),
  CONSTRAINT `refresh_tokens_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `conectores` (
  `id` VARCHAR(36) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `tipo` ENUM('GOOGLE_SHEETS','REST_API','POSTGRESQL','CSV') NOT NULL,
  `config` JSON NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `ultima_sync` DATETIME(3) NULL,
  `frecuencia_sync` VARCHAR(20) NOT NULL DEFAULT 'daily',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sincronizaciones` (
  `id` VARCHAR(36) NOT NULL,
  `conector_id` VARCHAR(36) NOT NULL,
  `estado` ENUM('EN_PROCESO','COMPLETADA','FALLIDA','PARCIAL') NOT NULL,
  `filas_leidas` INT NOT NULL DEFAULT 0,
  `filas_nuevas` INT NOT NULL DEFAULT 0,
  `errores` JSON NULL,
  `iniciada_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finalizada_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `sincronizaciones_conector_id_fkey` (`conector_id`),
  CONSTRAINT `sincronizaciones_conector_id_fkey` FOREIGN KEY (`conector_id`) REFERENCES `conectores` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dashboards` (
  `id` VARCHAR(36) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `descripcion` TEXT NULL,
  `usuario_id` VARCHAR(36) NULL,
  `rol_default` ENUM('ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES') NULL,
  `es_publico` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `dashboards_usuario_id_fkey` (`usuario_id`),
  CONSTRAINT `dashboards_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `widgets` (
  `id` VARCHAR(36) NOT NULL,
  `dashboard_id` VARCHAR(36) NOT NULL,
  `tipo` ENUM('KPI_CARD','TABLA_ENTIDADES','TABLA_SERVICIOS','CHART_CUMPLIMIENTO_SEMANAL','CHART_CUMPLIMIENTO_MENSUAL','CHART_DIAS_SEMANA','CHART_MIX_PAGADOR','CHART_TENDENCIA','CHART_PROYECCION','AUDITORIA_ALERTAS') NOT NULL,
  `titulo` VARCHAR(255) NULL,
  `config` JSON NOT NULL DEFAULT ('{}'),
  `pos_x` INT NOT NULL DEFAULT 0,
  `pos_y` INT NOT NULL DEFAULT 0,
  `ancho` INT NOT NULL DEFAULT 3,
  `alto` INT NOT NULL DEFAULT 2,
  `orden` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `widgets_dashboard_id_fkey` (`dashboard_id`),
  CONSTRAINT `widgets_dashboard_id_fkey` FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_log` (
  `id` VARCHAR(36) NOT NULL,
  `usuario_id` VARCHAR(36) NULL,
  `accion` VARCHAR(100) NOT NULL,
  `entidad_tipo` VARCHAR(100) NULL,
  `entidad_id` VARCHAR(36) NULL,
  `detalle` JSON NULL,
  `ip` VARCHAR(45) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_log_usuario_id_idx` (`usuario_id`),
  KEY `audit_log_accion_idx` (`accion`),
  KEY `audit_log_created_at_idx` (`created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `entidades` (
  `id` VARCHAR(36) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `nombres_raw` JSON NOT NULL,
  `tipo` ENUM('EPS','CONVENIO','PARTICULAR','ARL','OTRO') NOT NULL,
  `es_grupo_caja` BOOLEAN NOT NULL DEFAULT false,
  `activa` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `entidades_tipo_idx` (`tipo`),
  KEY `entidades_nombre_idx` (`nombre`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `profesionales` (
  `id` VARCHAR(36) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `nombres_raw` JSON NOT NULL,
  `es_nomina` BOOLEAN NOT NULL DEFAULT false,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `servicios` (
  `id` VARCHAR(36) NOT NULL,
  `nombre` VARCHAR(191) NOT NULL,
  `categoria` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `servicios_nombre_key` (`nombre`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `atenciones` (
  `id` VARCHAR(36) NOT NULL,
  `descripcion_raw` TEXT NOT NULL,
  `descripcion_norm` TEXT NOT NULL,
  `fecha_dia` DATETIME(3) NOT NULL,
  `mes_idx` INT NOT NULL,
  `anio` INT NOT NULL,
  `valor_bruto` DECIMAL(12,2) NOT NULL,
  `numero_autorizacion` VARCHAR(255) NULL,
  `es_telemetria` BOOLEAN NOT NULL DEFAULT false,
  `hash_fila` VARCHAR(64) NOT NULL,
  `entidad_id` VARCHAR(36) NULL,
  `profesional_id` VARCHAR(36) NULL,
  `servicio_id` VARCHAR(36) NULL,
  `conector_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `atenciones_hash_fila_key` (`hash_fila`),
  KEY `atenciones_fecha_dia_idx` (`fecha_dia`),
  KEY `atenciones_mes_anio_idx` (`mes_idx`, `anio`),
  KEY `atenciones_entidad_id_idx` (`entidad_id`),
  KEY `atenciones_profesional_id_idx` (`profesional_id`),
  KEY `atenciones_numero_autorizacion_idx` (`numero_autorizacion`),
  CONSTRAINT `atenciones_entidad_id_fkey` FOREIGN KEY (`entidad_id`) REFERENCES `entidades` (`id`),
  CONSTRAINT `atenciones_profesional_id_fkey` FOREIGN KEY (`profesional_id`) REFERENCES `profesionales` (`id`),
  CONSTRAINT `atenciones_servicio_id_fkey` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `presupuestos_mensuales` (
  `id` VARCHAR(36) NOT NULL,
  `anio` INT NOT NULL,
  `mes` INT NOT NULL,
  `monto` DECIMAL(14,2) NOT NULL,
  `notas` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `presupuestos_mensuales_anio_mes_key` (`anio`, `mes`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
