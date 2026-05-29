CREATE TABLE `capacidad_instalada` (
  `id`         VARCHAR(36)      NOT NULL,
  `grupo`      VARCHAR(50)      NOT NULL,
  `nombre`     VARCHAR(150)     NOT NULL,
  `anio`       SMALLINT         NOT NULL,
  `mes_idx`    TINYINT          NOT NULL COMMENT '1-12',
  `capacidad`  SMALLINT UNSIGNED NOT NULL,
  `recursos`   TEXT             NULL,
  `created_at` DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grupo_mes` (`grupo`, `anio`, `mes_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
