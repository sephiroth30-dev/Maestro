"use strict";
/**
 * Normalización de las citas que devuelve Medifolios, sin base de datos ni red.
 *
 * El conector REST ya aplana cada cita con `fieldMap` (rutas con punto):
 *
 *   codAsignacion ← codAsignacion          estado    ← estadoCita.codEstado
 *   fechaInicioCita ← fechaInicioCita      origen    ← origenCita
 *   codConvenio ← convenio.codConvenio     convenio  ← convenio.nomConvenio
 *   referencia ← referencia.nomReferencia  cups      ← referencia.codigoCupsCums
 *   profesional ← profesional.nomProfesional
 *
 * Aquí se filtra y se limpia. Se guarda lo mínimo: **no hay datos de pacientes**,
 * porque para proyectar no hacen falta.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.texto = exports.FIELD_MAP_CITAS = void 0;
exports.parseFechaCita = parseFechaCita;
exports.normalizarCitas = normalizarCitas;
exports.FIELD_MAP_CITAS = {
    codAsignacion: 'codAsignacion',
    fechaInicioCita: 'fechaInicioCita',
    estado: 'estadoCita.codEstado',
    origen: 'origenCita',
    codConvenio: 'convenio.codConvenio',
    convenio: 'convenio.nomConvenio',
    referencia: 'referencia.nomReferencia',
    cups: 'referencia.codigoCupsCums',
    profesional: 'profesional.nomProfesional',
};
const pad = (n) => String(n).padStart(2, '0');
function fechaValida(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31)
        return false;
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
/**
 * Acepta `YYYY-MM-DD HH:MM[:SS]`, `YYYY-MM-DDTHH:MM[:SS][.sss][Z]`, `DD/MM/YYYY
 * [HH:MM[:SS]]` y solo la fecha. La especificación no dice el formato de
 * `fechaInicioCita` (sí el de `fechaSolicitud`), así que se toleran los
 * habituales en vez de apostar por uno y perder todas las citas si falla.
 *
 * NO se convierte de zona horaria: la hora es la de la clínica. Pasarla por
 * `Date` la desplazaría y una cita de las 8 p. m. caería en el día siguiente.
 */
function parseFechaCita(raw) {
    if (typeof raw !== 'string')
        return null;
    const s = raw.trim();
    if (!s)
        return null;
    // Con zona explícita (`Z` o ±hh:mm) el instante es absoluto: se pasa a la hora de la
    // clínica (UTC-5, sin horario de verano). Sin ella, la hora YA es la de la clínica.
    const conZona = /^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    if (conZona) {
        const t = Date.parse(s.replace(' ', 'T'));
        if (!Number.isFinite(t))
            return null;
        const l = new Date(t - 5 * 3_600_000);
        const dia = `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
        return { fechaDia: dia, fechaCita: `${dia} ${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:${pad(l.getUTCSeconds())}` };
    }
    let y, mo, d;
    let resto = '';
    let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](.*))?$/.exec(s);
    if (m) {
        y = Number(m[1]);
        mo = Number(m[2]);
        d = Number(m[3]);
        resto = m[4] ?? '';
    }
    else {
        m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.*))?$/.exec(s);
        if (!m)
            return null;
        d = Number(m[1]);
        mo = Number(m[2]);
        y = Number(m[3]);
        resto = m[4] ?? '';
    }
    if (!fechaValida(y, mo, d))
        return null;
    let hh = 0, mm = 0, ss = 0;
    const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(resto.trim());
    if (t) {
        hh = Number(t[1]);
        mm = Number(t[2]);
        ss = Number(t[3] ?? 0);
        // Una hora imposible hace dudar de toda la fecha: se descarta la cita (queda
        // contada en «sin fecha») en vez de moverla en silencio a las 00:00.
        if (hh > 23 || mm > 59 || ss > 59)
            return null;
    }
    const fechaDia = `${y}-${pad(mo)}-${pad(d)}`;
    return { fechaDia, fechaCita: `${fechaDia} ${pad(hh)}:${pad(mm)}:${pad(ss)}` };
}
/**
 * Un nombre que empieza por «{» o «[» es un objeto o arreglo entero que llegó
 * donde se esperaba un texto (el campo anidado no existe con ese nombre en la
 * respuesta). No es un nombre: se trata como vacío para que se note, en vez de
 * guardar un JSON como si fuera el convenio.
 */
const texto = (v) => {
    if (v === null || v === undefined)
        return '';
    const s = String(v).trim();
    return s.startsWith('{') || s.startsWith('[') ? '' : s;
};
exports.texto = texto;
/**
 * Se queda con las citas de AGENDA en los estados pedidos (por omisión solo las
 * PENDIENTES), limpias y sin repetir.
 *
 * El filtro por estado y origen ya viaja en la petición (`estadoCita=P`), pero se
 * repite aquí a propósito: es barato y es la defensa si la API ignorara un
 * parámetro. Una cita cumplida contada como agendada se contaría dos veces (ya
 * está facturada), y una cancelada o de imagenología no consume la agenda.
 */
function normalizarCitas(rows, estadosPermitidos = ['P']) {
    const descartadas = { noPendiente: 0, noAgenda: 0, sinFecha: 0, sinCodigo: 0, duplicadas: 0 };
    const porCodigo = new Map();
    for (const r of rows) {
        const estado = (0, exports.texto)(r['estado']).toUpperCase();
        if (!estadosPermitidos.includes(estado)) {
            descartadas.noPendiente++;
            continue;
        }
        // Si la API no informa el origen, se asume agenda: es el valor por omisión.
        const origen = (0, exports.texto)(r['origen']).toLowerCase();
        if (origen && origen !== 'agenda') {
            descartadas.noAgenda++;
            continue;
        }
        const cod = Number(r['codAsignacion']);
        if (!Number.isFinite(cod) || cod <= 0) {
            descartadas.sinCodigo++;
            continue;
        }
        const f = parseFechaCita(r['fechaInicioCita']);
        if (!f) {
            descartadas.sinFecha++;
            continue;
        }
        if (porCodigo.has(cod))
            descartadas.duplicadas++;
        const codConvenio = Number(r['codConvenio']);
        porCodigo.set(cod, {
            codAsignacion: cod,
            estado,
            fechaDia: f.fechaDia,
            fechaCita: f.fechaCita,
            convenioCod: Number.isFinite(codConvenio) && codConvenio > 0 ? codConvenio : null,
            convenioNombre: (0, exports.texto)(r['convenio']),
            referenciaNombre: (0, exports.texto)(r['referencia']),
            cups: (0, exports.texto)(r['cups']) || null,
            profesionalNombre: (0, exports.texto)(r['profesional']) || null,
        });
    }
    return { filas: [...porCodigo.values()], descartadas };
}
//# sourceMappingURL=agenda-mapeo.js.map