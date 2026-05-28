"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIPOS_VALIDOS = void 0;
exports.getAgregadoMes = getAgregadoMes;
exports.getFacturacionDia = getFacturacionDia;
exports.getDiasTranscurridos = getDiasTranscurridos;
exports.getFechasDelMes = getFechasDelMes;
exports.getEntidadesAgg = getEntidadesAgg;
exports.getDiariosDelMes = getDiariosDelMes;
exports.getDiasSemanaAgg = getDiasSemanaAgg;
exports.getTendenciaMeses = getTendenciaMeses;
exports.getPresupuesto = getPresupuesto;
exports.listPresupuestos = listPresupuestos;
exports.listEntidades = listEntidades;
exports.updateEntidadGrupoCaja = updateEntidadGrupoCaja;
exports.patchEntidad = patchEntidad;
exports.getDiagnosticoConectores = getDiagnosticoConectores;
exports.listProfesionales = listProfesionales;
exports.patchProfesional = patchProfesional;
exports.getSinEntidadDiagnostico = getSinEntidadDiagnostico;
exports.getSinServicioDiagnostico = getSinServicioDiagnostico;
exports.getServiciosDiagnostico = getServiciosDiagnostico;
exports.getServiciosAgg = getServiciosAgg;
exports.listServiciosCatalog = listServiciosCatalog;
exports.patchServicio = patchServicio;
exports.getServicioAgrupaciones = getServicioAgrupaciones;
exports.upsertPresupuesto = upsertPresupuesto;
exports.reclasificarServicios = reclasificarServicios;
const prisma_js_1 = require("../config/prisma.js");
const node_crypto_1 = require("node:crypto");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Returns a [whereClause, params] tuple for filtering atenciones by date range
 * or by mes_idx/anio.
 */
function buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana) {
    let clause;
    let params;
    if (startDate && endDate) {
        clause = 'fecha_dia >= ? AND fecha_dia <= ?';
        params = [startDate, endDate];
    }
    else {
        clause = 'mes_idx = ? AND anio = ?';
        params = [mesIdx ?? 0, anio ?? 0];
    }
    if (diaSemana !== undefined) {
        clause += ' AND DAYOFWEEK(fecha_dia) = ?';
        params.push(diaSemana);
    }
    return [clause, params];
}
// ─── Repository ───────────────────────────────────────────────────────────────
async function getAgregadoMes(mesIdx, anio, entidadId, startDate, endDate, diaSemana) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana);
    // Sum ALL records — es_grupo_caja (PARTICULARES etc.) is real income and must count.
    // That flag is only used for visual grouping in charts, not for filtering totals.
    let sql = `SELECT SUM(valor_bruto) AS total, COUNT(id) AS cnt FROM atenciones WHERE ${whereClause}`;
    const allParams = [...params];
    if (entidadId) {
        sql += ' AND entidad_id = ?';
        allParams.push(entidadId);
    }
    const [rows] = await prisma_js_1.pool.query(sql, allParams);
    return {
        total: Number(rows[0]?.total ?? 0),
        atenciones: Number(rows[0]?.cnt ?? 0),
    };
}
async function getFacturacionDia(fecha) {
    const startOfDay = new Date(fecha);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const [rows] = await prisma_js_1.pool.query('SELECT SUM(valor_bruto) AS total FROM atenciones WHERE fecha_dia >= ? AND fecha_dia <= ?', [startOfDay, endOfDay]);
    return Number(rows[0]?.total ?? 0);
}
async function getDiasTranscurridos(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT COUNT(DISTINCT DATE(fecha_dia)) AS cnt FROM atenciones WHERE ${whereClause}`, params);
    return Number(rows[0]?.cnt ?? 0);
}
async function getFechasDelMes(mesIdx, anio) {
    const [rows] = await prisma_js_1.pool.query('SELECT DISTINCT fecha_dia FROM atenciones WHERE mes_idx = ? AND anio = ? ORDER BY fecha_dia ASC', [mesIdx, anio]);
    return rows.map((r) => r.fecha_dia);
}
async function getEntidadesAgg(mesIdx, anio, startDate, endDate, diaSemana) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      a.entidad_id,
      e.nombre,
      e.tipo,
      e.es_grupo_caja,
      COUNT(a.id) AS cantidad,
      SUM(a.valor_bruto) AS valor_bruto
    FROM atenciones a
    LEFT JOIN entidades e ON e.id = a.entidad_id
    WHERE ${whereClause}
    GROUP BY a.entidad_id, e.nombre, e.tipo, e.es_grupo_caja
    ORDER BY valor_bruto DESC`, params);
    return rows.map((r) => ({
        entidad_id: r.entidad_id,
        nombre: r.nombre,
        tipo: r.tipo,
        es_grupo_caja: r.es_grupo_caja,
        cantidad: Number(r.cantidad),
        valor_bruto: Number(r.valor_bruto),
    }));
}
async function getDiariosDelMes(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      DATE(fecha_dia) AS fecha_dia,
      SUM(valor_bruto) AS total,
      COUNT(id) AS atenciones
    FROM atenciones
    WHERE ${whereClause}
    GROUP BY DATE(fecha_dia)
    ORDER BY DATE(fecha_dia) ASC`, params);
    return rows.map((r) => ({
        fecha_dia: new Date(r.fecha_dia + 'T00:00:00.000Z'),
        total: Number(r.total),
        atenciones: Number(r.atenciones),
    }));
}
async function getDiasSemanaAgg(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      (DAYOFWEEK(fecha_dia) - 1) AS dia_num,
      AVG(valor_bruto)           AS promedio,
      SUM(valor_bruto)           AS total,
      COUNT(id)                  AS atenciones
    FROM atenciones
    WHERE ${whereClause}
      AND DAYOFWEEK(fecha_dia) BETWEEN 2 AND 6
    GROUP BY dia_num
    ORDER BY dia_num ASC`, params);
    return rows.map((r) => ({
        dia_num: Number(r.dia_num),
        promedio: Number(r.promedio),
        total: Number(r.total),
        atenciones: Number(r.atenciones),
    }));
}
async function getTendenciaMeses(meses) {
    // Subquery: pick the N most-recent months, then re-sort ascending for display.
    const [rows] = await prisma_js_1.pool.query(`SELECT anio, mes_idx, total FROM (
       SELECT anio, mes_idx, SUM(valor_bruto) AS total
       FROM atenciones
       GROUP BY anio, mes_idx
       ORDER BY anio DESC, mes_idx DESC
       LIMIT ?
     ) sub
     ORDER BY anio ASC, mes_idx ASC`, [meses]);
    return rows.map((r) => ({
        anio: Number(r.anio),
        mes_idx: Number(r.mes_idx),
        total: Number(r.total),
    }));
}
async function getPresupuesto(anio, mes) {
    const [rows] = await prisma_js_1.pool.query('SELECT monto FROM presupuestos_mensuales WHERE anio = ? AND mes = ? LIMIT 1', [anio, mes]);
    return Number(rows[0]?.monto ?? 0);
}
async function listPresupuestos() {
    const [rows] = await prisma_js_1.pool.query('SELECT id, anio, mes, monto, notas, created_at FROM presupuestos_mensuales ORDER BY anio ASC, mes ASC');
    return rows.map((r) => ({
        id: r.id,
        anio: Number(r.anio),
        mes: Number(r.mes),
        monto: Number(r.monto),
        notas: r.notas,
        createdAt: r.created_at,
    }));
}
async function listEntidades() {
    const [rows] = await prisma_js_1.pool.query('SELECT id, nombre, tipo, es_grupo_caja, activa, nombres_raw FROM entidades ORDER BY tipo ASC, nombre ASC');
    return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        es_grupo_caja: Boolean(r.es_grupo_caja),
        activa: Boolean(r.activa),
        nombres_raw: (() => {
            try {
                return JSON.parse(r.nombres_raw);
            }
            catch {
                return [];
            }
        })(),
    }));
}
async function updateEntidadGrupoCaja(id, esGrupoCaja) {
    await prisma_js_1.pool.execute('UPDATE entidades SET es_grupo_caja = ? WHERE id = ?', [esGrupoCaja ? 1 : 0, id]);
}
exports.TIPOS_VALIDOS = ['EPS', 'ARL', 'CONVENIO', 'PARTICULAR', 'OTRO'];
async function patchEntidad(id, fields) {
    const sets = [];
    const params = [];
    if (fields.es_grupo_caja !== undefined) {
        sets.push('es_grupo_caja = ?');
        params.push(fields.es_grupo_caja ? 1 : 0);
    }
    if (fields.tipo !== undefined) {
        sets.push('tipo = ?');
        params.push(fields.tipo);
    }
    if (fields.nombres_raw !== undefined) {
        sets.push('nombres_raw = ?');
        params.push(JSON.stringify(fields.nombres_raw));
    }
    if (sets.length === 0)
        return;
    params.push(id);
    await prisma_js_1.pool.execute(`UPDATE entidades SET ${sets.join(', ')} WHERE id = ?`, params);
}
async function getDiagnosticoConectores() {
    const [rows] = await prisma_js_1.pool.query(`SELECT
      a.conector_id,
      COALESCE(c.nombre, a.conector_id) AS conector_nombre,
      a.anio,
      a.mes_idx,
      COUNT(a.id)                              AS atenciones,
      SUM(a.valor_bruto)                       AS valor_bruto,
      SUM(CASE WHEN a.entidad_id IS NULL THEN 1 ELSE 0 END) AS sin_entidad,
      SUM(CASE WHEN a.valor_bruto = 0   THEN 1 ELSE 0 END) AS sin_valor
    FROM atenciones a
    LEFT JOIN conectores c ON c.id = a.conector_id
    GROUP BY a.conector_id, c.nombre, a.anio, a.mes_idx
    ORDER BY a.anio DESC, a.mes_idx DESC, conector_nombre ASC`);
    return rows.map((r) => ({
        conector_id: r.conector_id,
        conector_nombre: r.conector_nombre,
        anio: Number(r.anio),
        mes_idx: Number(r.mes_idx),
        atenciones: Number(r.atenciones),
        valor_bruto: Number(r.valor_bruto),
        sin_entidad: Number(r.sin_entidad),
        sin_valor: Number(r.sin_valor),
    }));
}
async function listProfesionales() {
    const [rows] = await prisma_js_1.pool.query(`SELECT p.id, p.nombre, p.nombre_completo, p.nombres_raw, p.es_nomina, p.especialidad,
            COUNT(a.id) AS total_atenciones
     FROM profesionales p
     LEFT JOIN atenciones a ON a.profesional_id = p.id
     WHERE p.activo = 1
     GROUP BY p.id
     ORDER BY total_atenciones DESC, p.nombre ASC`);
    return rows.map((r) => ({
        id: r['id'],
        nombre: r['nombre'],
        nombre_completo: r['nombre_completo'] ?? null,
        nombres_raw: (typeof r['nombres_raw'] === 'string'
            ? JSON.parse(r['nombres_raw'])
            : r['nombres_raw']),
        es_nomina: Boolean(r['es_nomina']),
        especialidad: r['especialidad'] ?? null,
        total_atenciones: Number(r['total_atenciones']),
    }));
}
async function patchProfesional(id, fields) {
    const parts = [];
    const vals = [];
    if ('especialidad' in fields) {
        parts.push('especialidad = ?');
        vals.push(fields.especialidad);
    }
    if ('nombre_completo' in fields) {
        parts.push('nombre_completo = ?');
        vals.push(fields.nombre_completo ?? null);
    }
    if (parts.length === 0)
        return;
    vals.push(id);
    await prisma_js_1.pool.execute(`UPDATE profesionales SET ${parts.join(', ')} WHERE id = ?`, vals);
}
async function getSinEntidadDiagnostico(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      COALESCE(entidad_nombre_raw, '(vacío)') AS nombre_raw,
      COUNT(*) AS cnt,
      SUM(valor_bruto) AS total
    FROM atenciones
    WHERE entidad_id IS NULL AND ${whereClause}
    GROUP BY entidad_nombre_raw
    ORDER BY total DESC`, params);
    return rows.map((r) => ({
        nombre_raw: r.nombre_raw,
        cnt: Number(r.cnt),
        total: Number(r.total),
    }));
}
async function getSinServicioDiagnostico(limit = 60) {
    const [rows] = await prisma_js_1.pool.query(`SELECT
      descripcion_raw,
      COUNT(*) AS cnt,
      SUM(valor_bruto) AS total
    FROM atenciones
    WHERE servicio_id IS NULL
    GROUP BY descripcion_raw
    ORDER BY cnt DESC
    LIMIT ?`, [limit]);
    return rows.map((r) => ({
        descripcion_raw: r.descripcion_raw,
        cnt: Number(r.cnt),
        total: Number(r.total),
    }));
}
// ─── Servicios seed diagnostic ────────────────────────────────────────────────
async function getServiciosDiagnostico() {
    let servicios_en_catalogo = 0;
    let servicios_con_keywords = 0;
    try {
        const [catRows] = await prisma_js_1.pool.query('SELECT COUNT(*) AS total, SUM(CASE WHEN palabras_clave IS NOT NULL THEN 1 ELSE 0 END) AS con_kw FROM servicios');
        const cat = catRows[0] ?? {};
        servicios_en_catalogo = Number(cat['total'] ?? 0);
        servicios_con_keywords = Number(cat['con_kw'] ?? 0);
    }
    catch {
        try {
            const [catRows] = await prisma_js_1.pool.query('SELECT COUNT(*) AS total FROM servicios');
            servicios_en_catalogo = Number((catRows[0] ?? {})['total'] ?? 0);
        }
        catch {
            // servicios table or palabras_clave column not yet migrated
        }
    }
    const [covRows] = await prisma_js_1.pool.query('SELECT SUM(CASE WHEN servicio_id IS NOT NULL THEN 1 ELSE 0 END) AS clasificadas, SUM(CASE WHEN servicio_id IS NULL THEN 1 ELSE 0 END) AS sin_clasificar FROM atenciones');
    const cov = covRows[0] ?? {};
    const total = Number(cov['clasificadas'] ?? 0) + Number(cov['sin_clasificar'] ?? 0);
    const clasificadas = Number(cov['clasificadas'] ?? 0);
    return {
        servicios_en_catalogo,
        servicios_con_keywords,
        atenciones_clasificadas: clasificadas,
        atenciones_sin_clasificar: Number(cov['sin_clasificar'] ?? 0),
        cobertura_pct: total > 0 ? Math.round((clasificadas / total) * 100) : 0,
    };
}
async function getServiciosAgg(mesIdx, anio, startDate, endDate, entidadId, diaSemana) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana);
    const entidadExtra = entidadId ? ' AND a.entidad_id = ?' : '';
    const entidadParams = entidadId ? [entidadId] : [];
    // Step 1: Core aggregation — only columns that always exist
    const [coreRows] = await prisma_js_1.pool.query(`SELECT a.servicio_id, COUNT(a.id) AS total_filas, SUM(a.valor_bruto) AS valor_bruto
     FROM atenciones a
     WHERE ${whereClause}${entidadExtra}
     GROUP BY a.servicio_id`, [...params, ...entidadParams]);
    if (coreRows.length === 0)
        return [];
    // Step 2: Session counting — requires paciente_nombre & paciente_documento (new columns)
    const sesionesMap = new Map();
    try {
        const [sesRows] = await prisma_js_1.pool.query(`SELECT a.servicio_id,
         COUNT(DISTINCT CONCAT(DATE(a.fecha_dia), '|',
           COALESCE(a.paciente_nombre, ''), '|',
           COALESCE(a.paciente_documento, ''))) AS sesiones
       FROM atenciones a
       WHERE ${whereClause}${entidadExtra}
       GROUP BY a.servicio_id`, [...params, ...entidadParams]);
        for (const r of sesRows)
            sesionesMap.set(r.servicio_id, Number(r.sesiones));
    }
    catch {
        // paciente columns not yet migrated — sesiones will fall back to total_filas per row
    }
    const svcMap = new Map();
    // Try queries in order from most to least capable, gracefully handling missing columns
    const svcQueries = [
        'SELECT id, COALESCE(nombre_display, nombre) AS nombre, tipo_conteo, orden, categoria FROM servicios',
        'SELECT id, nombre, tipo_conteo, orden, categoria FROM servicios',
        'SELECT id, nombre FROM servicios',
    ];
    for (const q of svcQueries) {
        if (svcMap.size > 0)
            break;
        try {
            const [svcRows] = await prisma_js_1.pool.query(q);
            for (const r of svcRows) {
                svcMap.set(r.id, {
                    id: r.id,
                    nombre: r.nombre,
                    tipo_conteo: r.tipo_conteo === 'sesion' ? 'sesion' : 'unidad',
                    orden: Number(r.orden ?? 99),
                    categoria: r.categoria ?? null,
                });
            }
        }
        catch { /* try next fallback */ }
    }
    // Step 4: Join in JavaScript
    const result = coreRows.map((r) => {
        const svc = r.servicio_id ? svcMap.get(r.servicio_id) : undefined;
        const totalFilas = Number(r.total_filas);
        const sesiones = sesionesMap.size > 0 ? (sesionesMap.get(r.servicio_id) ?? totalFilas) : totalFilas;
        return {
            servicio_id: r.servicio_id,
            nombre: svc?.nombre ?? null,
            tipo_conteo: svc?.tipo_conteo ?? 'unidad',
            orden: svc?.orden ?? 99,
            categoria: svc?.categoria ?? null,
            total_filas: totalFilas,
            sesiones,
            valor_bruto: Number(r.valor_bruto),
        };
    });
    return result.sort((a, b) => a.orden - b.orden || (a.nombre ?? '').localeCompare(b.nombre ?? ''));
}
async function listServiciosCatalog() {
    // Try with nombre_display first; fall back gracefully if column not yet migrated
    const queries = [
        `SELECT s.id, s.nombre, s.nombre_display, s.palabras_clave, s.tipo_conteo, s.orden,
       (SELECT COUNT(*) FROM atenciones WHERE servicio_id = s.id) AS total_atenciones
     FROM servicios s ORDER BY s.orden ASC, s.nombre ASC`,
        `SELECT s.id, s.nombre, NULL AS nombre_display, s.palabras_clave, s.tipo_conteo, s.orden,
       (SELECT COUNT(*) FROM atenciones WHERE servicio_id = s.id) AS total_atenciones
     FROM servicios s ORDER BY s.orden ASC, s.nombre ASC`,
    ];
    let rows = [];
    for (const q of queries) {
        try {
            [rows] = await prisma_js_1.pool.query(q);
            break;
        }
        catch { /* try next */ }
    }
    return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        nombre_display: r.nombre_display ?? null,
        palabras_clave: (() => { try {
            return JSON.parse(r.palabras_clave ?? '[]');
        }
        catch {
            return [];
        } })(),
        tipo_conteo: r.tipo_conteo === 'sesion' ? 'sesion' : 'unidad',
        orden: Number(r.orden),
        total_atenciones: Number(r.total_atenciones),
    }));
}
async function patchServicio(id, fields) {
    const sets = [];
    const params = [];
    if (fields.tipo_conteo !== undefined) {
        sets.push('tipo_conteo = ?');
        params.push(fields.tipo_conteo);
    }
    if ('nombre_display' in fields) {
        sets.push('nombre_display = ?');
        params.push(fields.nombre_display ?? null);
    }
    if (sets.length === 0)
        return;
    params.push(id);
    await prisma_js_1.pool.execute(`UPDATE servicios SET ${sets.join(', ')} WHERE id = ?`, params);
}
async function getServicioAgrupaciones() {
    const [rows] = await prisma_js_1.pool.query(`SELECT s.id AS servicio_id,
            COALESCE(s.nombre_display, s.nombre) AS nombre,
            a.descripcion_raw,
            COUNT(*) AS cnt,
            SUM(a.valor_bruto) AS valor
     FROM servicios s
     JOIN atenciones a ON a.servicio_id = s.id
     GROUP BY s.id, nombre, a.descripcion_raw
     ORDER BY s.orden ASC, s.nombre ASC, cnt DESC`);
    const map = new Map();
    for (const r of rows) {
        const sid = r['servicio_id'];
        if (!map.has(sid)) {
            map.set(sid, { servicio_id: sid, nombre: r['nombre'], total_cnt: 0, items: [] });
        }
        const entry = map.get(sid);
        const cnt = Number(r['cnt']);
        entry.total_cnt += cnt;
        entry.items.push({ descripcion_raw: r['descripcion_raw'], cnt, valor: Number(r['valor']) });
    }
    return [...map.values()];
}
async function upsertPresupuesto(anio, mes, monto, notas) {
    // Check if row already exists to get its id
    const [existing] = await prisma_js_1.pool.query('SELECT id FROM presupuestos_mensuales WHERE anio = ? AND mes = ? LIMIT 1', [anio, mes]);
    const notasVal = notas ?? null;
    if (existing[0]) {
        const existingId = existing[0].id;
        await prisma_js_1.pool.execute('UPDATE presupuestos_mensuales SET monto = ?, notas = ? WHERE id = ?', [monto, notasVal, existingId]);
        return { id: existingId, anio, mes, monto, notas: notasVal };
    }
    const newId = (0, node_crypto_1.randomUUID)();
    await prisma_js_1.pool.execute('INSERT INTO presupuestos_mensuales (id, anio, mes, monto, notas) VALUES (?, ?, ?, ?, ?)', [newId, anio, mes, monto, notasVal]);
    return { id: newId, anio, mes, monto, notas: notasVal };
}
// ─── Reclassify all atenciones with current service catalog ──────────────────
async function reclasificarServicios() {
    // Load current service catalog ordered by precedence
    const [catRows] = await prisma_js_1.pool.query('SELECT id, nombre, palabras_clave FROM servicios WHERE palabras_clave IS NOT NULL ORDER BY orden ASC');
    const catalog = catRows.map((r) => ({
        id: r['id'],
        nombre: r['nombre'],
        keywords: (typeof r['palabras_clave'] === 'string'
            ? JSON.parse(r['palabras_clave'])
            : r['palabras_clave']).map((kw) => kw.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')),
    }));
    // Build specialty upgrade map: generic service id → { NEUROLOGIA: id, FISIATRIA: id }
    const upgradeMap = new Map();
    const UPGRADES = [
        ['CONSULTA PRIMERA VEZ', 'CONSULTA PRIMERA VEZ NEUROLOGIA', 'CONSULTA PRIMERA VEZ FISIATRA'],
        ['CONSULTA DE CONTROL', 'CONSULTA DE CONTROL NEUROLOGIA', 'CONSULTA DE CONTROL FISIATRIA'],
    ];
    for (const [generic, neuro, fisio] of UPGRADES) {
        const genericId = catalog.find((s) => s.nombre === generic)?.id ?? null;
        const neuroId = catalog.find((s) => s.nombre === neuro)?.id ?? null;
        const fisioId = catalog.find((s) => s.nombre === fisio)?.id ?? null;
        if (genericId)
            upgradeMap.set(genericId, { NEUROLOGIA: neuroId, FISIATRIA: fisioId });
    }
    // Load profesionales specialty
    const [profRows] = await prisma_js_1.pool.query('SELECT id, especialidad FROM profesionales WHERE activo = 1');
    const profEspecialidad = new Map();
    for (const p of profRows) {
        if (p['especialidad']) {
            profEspecialidad.set(p['id'], p['especialidad']);
        }
    }
    // Load all atenciones
    const [rows] = await prisma_js_1.pool.query('SELECT id, descripcion_norm, servicio_id, profesional_id FROM atenciones');
    let updated = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const updates = [];
        for (const row of batch) {
            const norm = (row['descripcion_norm'] ?? '').toUpperCase();
            let matched = null;
            for (const svc of catalog) {
                if (svc.keywords.some((kw) => norm.includes(kw))) {
                    matched = svc.id;
                    break;
                }
            }
            // Specialty upgrade: if matched a generic consultation, use professional's specialty
            if (matched && upgradeMap.has(matched)) {
                const profId = row['profesional_id'];
                const esp = profId ? (profEspecialidad.get(profId) ?? null) : null;
                if (esp === 'NEUROLOGIA' || esp === 'FISIATRIA') {
                    matched = upgradeMap.get(matched)[esp] ?? matched;
                }
            }
            const current = row['servicio_id'] ?? null;
            if (matched !== current) {
                updates.push([matched, row['id']]);
            }
        }
        for (const [newId, id] of updates) {
            await prisma_js_1.pool.execute('UPDATE atenciones SET servicio_id = ? WHERE id = ?', [newId, id]);
            updated++;
        }
    }
    const sinClasificar = rows.filter((r) => {
        const norm = (r['descripcion_norm'] ?? '').toUpperCase();
        return !catalog.some((svc) => svc.keywords.some((kw) => norm.includes(kw)));
    }).length;
    return { total: rows.length, updated, sin_clasificar: sinClasificar };
}
//# sourceMappingURL=reportes.repo.js.map