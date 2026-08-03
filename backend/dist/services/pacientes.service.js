"use strict";
/**
 * Compone la analítica de pacientes en una sola respuesta.
 *
 * Siete agregados en un solo viaje: en hosting compartido siete peticiones HTTP
 * costarían más que las consultas, y el cliente tiene 15 s de timeout.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPacientes = getPacientes;
exports.getDetalleAtenciones = getDetalleAtenciones;
const repo = __importStar(require("../repositories/pacientes.repo.js"));
const MESES = [
    '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
async function getPacientes(p) {
    // Ventana de retención: los 12 meses previos al fin del período.
    //
    // Se construye con Date.UTC y no con setMonth(): restar meses sobre un día 31
    // desborda al mes siguiente (31-ago menos 11 meses da 1-oct, no 1-sep) y la
    // ventana quedaba en 11 meses la mitad del año. Además la conexión usa
    // timezone '+00:00', así que las fechas deben construirse en UTC.
    const hoyRef = new Date();
    const fin = p.endDate
        ?? new Date(Date.UTC(p.anio ?? hoyRef.getUTCFullYear(), p.mesIdx ?? 12, 0, 23, 59, 59));
    const ini = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - 11, 1));
    const [cobertura, resumen, nuevos, frecuencia, porPagador, multiPagador, porServicio, retencion] = await Promise.all([
        repo.getCobertura(p),
        repo.getResumen(p),
        repo.getNuevosRecurrentes(p),
        repo.getFrecuencia(p),
        repo.getPorPagador(p),
        repo.getMultiPagador(p),
        repo.getPorServicio(p),
        repo.getRetencion(p, ini, fin),
    ]);
    const totalFrec = frecuencia.reduce((s, f) => s + f.pacientes, 0);
    const unicos = resumen.pacientes_unicos;
    // Un mes solo es puntuable cuando su mes SIGUIENTE ya terminó. Eso descarta
    // el mes en curso y también el anterior: puntuar octubre contra los tres días
    // que lleva noviembre daría un 3 % que se leería como un desplome. Los no
    // puntuables van como null y la gráfica los dibuja como hueco, no como cero.
    const hoy = new Date();
    const mesActualKey = hoy.getUTCFullYear() * 12 + (hoy.getUTCMonth() + 1);
    return {
        cobertura: {
            ...cobertura.global,
            cobertura_pct: pct(cobertura.global.filas_con_paciente, cobertura.global.filas),
            cobertura_documento_pct: pct(cobertura.global.filas_con_documento, cobertura.global.filas),
            por_conector: cobertura.porConector.map((c) => ({
                conector_id: c.conector_id,
                conector_nombre: c.conector_nombre ?? 'Sin fuente',
                filas: c.filas,
                filas_con_paciente: c.filas_con_paciente,
                cobertura_pct: pct(c.filas_con_paciente, c.filas),
            })),
        },
        resumen: {
            ...resumen,
            promedio_atenciones: unicos > 0 ? Math.round((resumen.atenciones_con_paciente / unicos) * 10) / 10 : 0,
            promedio_visitas: unicos > 0 ? Math.round((resumen.visitas_unicas / unicos) * 10) / 10 : 0,
            nuevos: nuevos.nuevos,
            recurrentes: nuevos.recurrentes,
            nuevos_pct: pct(nuevos.nuevos, nuevos.nuevos + nuevos.recurrentes),
            historia_desde: nuevos.historia_desde,
        },
        frecuencia: frecuencia.map((f) => ({ ...f, pct: pct(f.pacientes, totalFrec) })),
        por_pagador: porPagador,
        pacientes_multi_pagador: multiPagador,
        por_servicio: porServicio.map((s) => ({
            ...s,
            atenciones_por_paciente: s.pacientes > 0 ? Math.round((s.atenciones / s.pacientes) * 10) / 10 : 0,
        })),
        retencion: retencion.map((r) => {
            const mesSiguienteCerrado = r.anio * 12 + r.mes_idx < mesActualKey - 1;
            return {
                ...r,
                label: `${MESES[r.mes_idx]} ${String(r.anio).slice(2)}`,
                retencion_pct: mesSiguienteCerrado && r.pacientes > 0 ? pct(r.retenidos, r.pacientes) : null,
            };
        }),
    };
}
async function getDetalleAtenciones(p, limit) {
    return repo.getDetalleAtenciones(p, limit);
}
//# sourceMappingURL=pacientes.service.js.map