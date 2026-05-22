ALTER TABLE "conectores" ADD COLUMN IF NOT EXISTS "frecuencia_sync" TEXT NOT NULL DEFAULT 'daily';
