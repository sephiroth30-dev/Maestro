"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enriquecerCita = enriquecerCita;
const capacidad_grupos_js_1 = require("../config/capacidad-grupos.js");
function enriquecerCita(f, r, epsPorConvenio) {
    // EPS: primero la del catálogo de convenios (el mismo nombre que usan los
    // consumos); si no hay, el nombre del convenio contra los alias de Entidades.
    const epsNombre = f.convenioCod !== null ? epsPorConvenio.get(f.convenioCod) ?? null : null;
    const entidadId = (epsNombre ? r.entidad(epsNombre) : null) ?? r.entidad(f.convenioNombre);
    // Grupo, con la MISMA cadena que las atenciones: palabras clave del catálogo
    // (con el ascenso de «consulta genérica» a la de la especialidad del
    // profesional) y luego el grupo por nombre. Si las palabras clave no resuelven,
    // se intenta el nombre de la referencia tal cual.
    const especialidad = r.especialidadDe(f.profesionalNombre);
    const grupo = (0, capacidad_grupos_js_1.grupoDeNombre)(r.servicioNombre(f.referenciaNombre, especialidad)) ?? (0, capacidad_grupos_js_1.grupoDeNombre)(f.referenciaNombre);
    return { entidadId, grupo };
}
//# sourceMappingURL=agenda-enriquecer.js.map