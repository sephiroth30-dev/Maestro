-- Migration 0006: nombres_completos para profesionales + nombre_display para servicios
-- Solo actualiza filas donde el campo todavía está en NULL
-- (preserva cualquier valor que el usuario haya editado manualmente desde la UI)

-- ─── Profesionales — nombre_completo ─────────────────────────────────────────
-- Fuente: Informe de Honorarios Médicos 2026 (INFORME_HONORARIOS_MEDICOS_2026_1.xlsx)

UPDATE profesionales SET nombre_completo = 'Gustavo Adolfo Perlaza'
  WHERE nombre = 'PERLAZA' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'David Leonardo Laverde'
  WHERE nombre = 'LAVERDE' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Juan Fernando Escobar'
  WHERE nombre = 'ESCOBAR' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Claudia Liseth Therán Rosero'
  WHERE nombre = 'TERAN' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Juan Manuel Montaño'
  WHERE nombre = 'MONTAÑO' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Diana María Parada Palacios'
  WHERE nombre = 'PARADA' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Yolima Álvarez'
  WHERE nombre = 'YOLIMA' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Sergio Santiago Cruz'
  WHERE nombre = 'CRUZ' AND nombre_completo IS NULL;

UPDATE profesionales SET nombre_completo = 'Marcela Concha'
  WHERE nombre = 'CONCHA' AND nombre_completo IS NULL;

-- ─── Corrección de nombres_raw (DRA LAVERDE → DR LAVERDE) ────────────────────
UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('LAVERDE', 'DR LAVERDE', 'DAVID LAVERDE', 'DAVID LEONARDO LAVERDE')
  WHERE nombre = 'LAVERDE';

-- Ampliar nombres_raw de cada profesional para mejorar el matching desde el Sheet
UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('PERLAZA', 'DR PERLAZA', 'GUSTAVO PERLAZA', 'GUSTAVO ADOLFO PERLAZA')
  WHERE nombre = 'PERLAZA';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('ESCOBAR', 'DR ESCOBAR', 'JUAN ESCOBAR', 'JUAN FERNANDO ESCOBAR')
  WHERE nombre = 'ESCOBAR';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('TERAN', 'DRA TERAN', 'CLAUDIA TERAN', 'CLAUDIA THERAN', 'CLAUDIA LISETH THERAN', 'CLAUDIA LISETH THERAN ROSERO', 'THERAN ROSERO')
  WHERE nombre = 'TERAN';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('MONTAÑO', 'DR MONTAÑO', 'JUAN MONTAÑO', 'JUAN MANUEL MONTAÑO')
  WHERE nombre = 'MONTAÑO';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('PARADA', 'DRA PARADA', 'DIANA PARADA', 'DIANA MARIA PARADA', 'DIANA MARIA PARADA PALACIOS')
  WHERE nombre = 'PARADA';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('YOLIMA', 'DRA YOLIMA', 'YOLIMA ALVAREZ', 'YOLIMA ÁLVAREZ')
  WHERE nombre = 'YOLIMA';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('CRUZ', 'DR CRUZ', 'SERGIO CRUZ', 'SERGIO SANTIAGO CRUZ')
  WHERE nombre = 'CRUZ';

UPDATE profesionales
  SET nombres_raw = JSON_ARRAY('CONCHA', 'DRA CONCHA', 'MARCELA CONCHA')
  WHERE nombre = 'CONCHA';

-- ─── Servicios — nombre_display ───────────────────────────────────────────────
-- Solo establece donde está en NULL (no sobreescribe ediciones manuales)

-- Procedimientos neurofisiológicos
UPDATE servicios SET nombre_display = 'Electromiografía (EMG)'
  WHERE nombre = 'ELECTROMIOGRAFIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Neuroconducción / Velocidad de Conducción Nerviosa'
  WHERE nombre = 'NEUROCONDUCCION' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Reflejo H / Onda F / Reflejo F'
  WHERE nombre = 'REFLEJO H' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Estimulación Repetitiva (Electromiografía Neuromuscular)'
  WHERE nombre = 'PRUEBA ESTIMULO REPETITIVO' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Aguja Monopolar (EMG de Aguja)'
  WHERE nombre = 'AGUJA MONOPOLAR' AND nombre_display IS NULL;

-- EEG / Sueño / Monitorización
UPDATE servicios SET nombre_display = 'Electroencefalograma (EEG)'
  WHERE nombre = 'ELECTROENCEFALOGRAMA COMPUTARIZADO' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Electroencefalograma Portátil (UCI / Domicilio)'
  WHERE nombre = 'ELECTROENCEFALOGRAMA PORTATIL' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Monitorización EEG / Video-EEG (Telemetría)'
  WHERE nombre = 'MONITORIZACION EEG VIDEO-RADIO' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Polisomnografía (Estudio de Sueño Nocturno)'
  WHERE nombre = 'POLISOMNOGRAFIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Prueba de Latencia Múltiple de Sueño (MSLT)'
  WHERE nombre = 'PRUEBA DE LATENCIA MULTIPLE' AND nombre_display IS NULL;

-- Potenciales evocados
UPDATE servicios SET nombre_display = 'Potenciales Evocados (PEA / PEV / PESS / Motor)'
  WHERE nombre = 'POTENCIALES EVOCADOS' AND nombre_display IS NULL;

-- Procedimientos intervencionistas
UPDATE servicios SET nombre_display = 'Inyección de Toxina Botulínica'
  WHERE nombre = 'INYECCION TOXINA BOTULINICA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Infiltración Articular / Periarticular'
  WHERE nombre = 'INFILTRACION' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Ecografía como Guía para Procedimiento'
  WHERE nombre = 'ECOGRAFIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Terapia con Ondas de Choque (Extracorpórea)'
  WHERE nombre = 'TERAPIA ONDAS DE CHOQUE' AND nombre_display IS NULL;

-- Consultas
UPDATE servicios SET nombre_display = 'Consulta Primera Vez — Fisiatría'
  WHERE nombre = 'CONSULTA PRIMERA VEZ FISIATRA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Consulta Primera Vez — Neurología'
  WHERE nombre = 'CONSULTA PRIMERA VEZ NEUROLOGIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Consulta de Control — Neurología'
  WHERE nombre = 'CONSULTA DE CONTROL NEUROLOGIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Consulta de Control — Fisiatría'
  WHERE nombre = 'CONSULTA DE CONTROL FISIATRIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Consulta de Control (General)'
  WHERE nombre = 'CONSULTA DE CONTROL' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Consulta Primera Vez (General)'
  WHERE nombre = 'CONSULTA PRIMERA VEZ' AND nombre_display IS NULL;

-- Otros
UPDATE servicios SET nombre_display = 'Junta Médica Interdisciplinaria'
  WHERE nombre = 'JUNTA MEDICA INTERDISCIPLINARIA' AND nombre_display IS NULL;

UPDATE servicios SET nombre_display = 'Derechos de Sala'
  WHERE nombre = 'DERECHOS DE SALA' AND nombre_display IS NULL;
