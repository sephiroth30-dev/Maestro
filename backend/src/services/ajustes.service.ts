import {
  getAjustesByLiquidacion,
  getAjusteById,
  crearAjuste,
  autorizarAjuste,
  rechazarAjuste,
  eliminarAjuste,
  type AjusteDB,
} from '../repositories/ajustes.repo.js';
import { getLiquidacionById } from '../repositories/liquidaciones.repo.js';

export { getAjustesByLiquidacion };

export async function crearAjusteLiquidacion(
  liquidacionId: string,
  usuarioId: string,
  data: {
    categoria: string;
    descripcion: string;
    cantidad: number;
    valor_unitario: number;
    justificacion: string;
    referencia_doc?: string;
  },
): Promise<AjusteDB> {
  const liq = await getLiquidacionById(liquidacionId);
  if (!liq) throw Object.assign(new Error('Liquidación no encontrada'), { statusCode: 404 });
  if (liq.estado === 'PAGADO') throw Object.assign(new Error('No se pueden agregar ajustes a una liquidación ya pagada'), { statusCode: 400 });

  return crearAjuste({ ...data, liquidacion_id: liquidacionId, creado_por: usuarioId });
}

export async function autorizarAjusteLiquidacion(id: string, usuarioId: string): Promise<AjusteDB> {
  const ajuste = await getAjusteById(id);
  if (!ajuste) throw Object.assign(new Error('Ajuste no encontrado'), { statusCode: 404 });
  if (ajuste.estado !== 'PENDIENTE') throw Object.assign(new Error('El ajuste ya fue procesado'), { statusCode: 400 });
  if (ajuste.creado_por === usuarioId) throw Object.assign(new Error('No puedes autorizar un ajuste que tú mismo registraste'), { statusCode: 403 });

  await autorizarAjuste(id, usuarioId);
  return (await getAjusteById(id))!;
}

export async function rechazarAjusteLiquidacion(id: string, usuarioId: string, motivo: string): Promise<AjusteDB> {
  const ajuste = await getAjusteById(id);
  if (!ajuste) throw Object.assign(new Error('Ajuste no encontrado'), { statusCode: 404 });
  if (ajuste.estado !== 'PENDIENTE') throw Object.assign(new Error('El ajuste ya fue procesado'), { statusCode: 400 });
  if (ajuste.creado_por === usuarioId) throw Object.assign(new Error('No puedes rechazar un ajuste que tú mismo registraste'), { statusCode: 403 });

  await rechazarAjuste(id, usuarioId, motivo);
  return (await getAjusteById(id))!;
}

export async function eliminarAjusteLiquidacion(id: string, usuarioId: string): Promise<void> {
  const ajuste = await getAjusteById(id);
  if (!ajuste) throw Object.assign(new Error('Ajuste no encontrado'), { statusCode: 404 });
  if (ajuste.creado_por !== usuarioId) throw Object.assign(new Error('Solo quien lo registró puede eliminarlo'), { statusCode: 403 });
  if (ajuste.estado !== 'PENDIENTE') throw Object.assign(new Error('Solo se pueden eliminar ajustes pendientes'), { statusCode: 400 });

  await eliminarAjuste(id, usuarioId);
}
