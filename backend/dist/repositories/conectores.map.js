"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapConector = mapConector;
function mapConector(row) {
    return {
        id: row.id,
        nombre: row.nombre,
        tipo: row.tipo,
        config: (typeof row.config === 'string' ? JSON.parse(row.config) : row.config),
        // `activo` y `esFuenteActiva` son cosas distintas: la primera dice si el
        // conector SE SINCRONIZA, la segunda si el dashboard LO MUESTRA.
        activo: Boolean(row.activo),
        // Si `m18` aún no se aplicó, la columna no viene en el SELECT y esto da
        // `false` — el mismo estado que "ninguna fuente marcada", que ya tiene su
        // aviso en pantalla. No hace falta guardia extra.
        esFuenteActiva: Boolean(row.es_fuente_activa),
        frecuenciaSync: row.frecuencia_sync,
        ultimaSync: row.ultima_sync,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
//# sourceMappingURL=conectores.map.js.map