"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAjustesByLiquidacion = void 0;
exports.crearAjusteLiquidacion = crearAjusteLiquidacion;
exports.autorizarAjusteLiquidacion = autorizarAjusteLiquidacion;
exports.rechazarAjusteLiquidacion = rechazarAjusteLiquidacion;
exports.eliminarAjusteLiquidacion = eliminarAjusteLiquidacion;
const ajustes_repo_js_1 = require("../repositories/ajustes.repo.js");
Object.defineProperty(exports, "getAjustesByLiquidacion", { enumerable: true, get: function () { return ajustes_repo_js_1.getAjustesByLiquidacion; } });
const liquidaciones_repo_js_1 = require("../repositories/liquidaciones.repo.js");
async function crearAjusteLiquidacion(liquidacionId, usuarioId, data) {
    const liq = await (0, liquidaciones_repo_js_1.getLiquidacionById)(liquidacionId);
    if (!liq)
        throw Object.assign(new Error('Liquidación no encontrada'), { statusCode: 404 });
    if (liq.estado === 'PAGADO')
        throw Object.assign(new Error('No se pueden agregar ajustes a una liquidación ya pagada'), { statusCode: 400 });
    return (0, ajustes_repo_js_1.crearAjuste)({ ...data, liquidacion_id: liquidacionId, creado_por: usuarioId });
}
async function autorizarAjusteLiquidacion(id, usuarioId) {
    const ajuste = await (0, ajustes_repo_js_1.getAjusteById)(id);
    if (!ajuste)
        throw Object.assign(new Error('Ajuste no encontrado'), { statusCode: 404 });
    if (ajuste.estado !== 'PENDIENTE')
        throw Object.assign(new Error('El ajuste ya fue procesado'), { statusCode: 400 });
    if (ajuste.creado_por === usuarioId)
        throw Object.assign(new Error('No puedes autorizar un ajuste que tú mismo registraste'), { statusCode: 403 });
    await (0, ajustes_repo_js_1.autorizarAjuste)(id, usuarioId);
    return (await (0, ajustes_repo_js_1.getAjusteById)(id));
}
async function rechazarAjusteLiquidacion(id, usuarioId, motivo) {
    const ajuste = await (0, ajustes_repo_js_1.getAjusteById)(id);
    if (!ajuste)
        throw Object.assign(new Error('Ajuste no encontrado'), { statusCode: 404 });
    if (ajuste.estado !== 'PENDIENTE')
        throw Object.assign(new Error('El ajuste ya fue procesado'), { statusCode: 400 });
    if (ajuste.creado_por === usuarioId)
        throw Object.assign(new Error('No puedes rechazar un ajuste que tú mismo registraste'), { statusCode: 403 });
    await (0, ajustes_repo_js_1.rechazarAjuste)(id, usuarioId, motivo);
    return (await (0, ajustes_repo_js_1.getAjusteById)(id));
}
async function eliminarAjusteLiquidacion(id, usuarioId) {
    const ajuste = await (0, ajustes_repo_js_1.getAjusteById)(id);
    if (!ajuste)
        throw Object.assign(new Error('Ajuste no encontrado'), { statusCode: 404 });
    if (ajuste.creado_por !== usuarioId)
        throw Object.assign(new Error('Solo quien lo registró puede eliminarlo'), { statusCode: 403 });
    if (ajuste.estado !== 'PENDIENTE')
        throw Object.assign(new Error('Solo se pueden eliminar ajustes pendientes'), { statusCode: 400 });
    await (0, ajustes_repo_js_1.eliminarAjuste)(id, usuarioId);
}
//# sourceMappingURL=ajustes.service.js.map