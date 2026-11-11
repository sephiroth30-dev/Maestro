/**
 * Lógica pura del endpoint de agenda: qué fechas se consultan y cómo se arma la
 * respuesta. Sin base de datos, para poder probarla.
 *
 * El contrato de la respuesta (`AgendaResult`) vive también en
 * `frontend/src/api/reportes.ts`; deben coincidir.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Fechas de agenda de un periodo, recortadas a «de hoy en adelante».
 *
 * Una cita PENDIENTE no puede estar en el pasado: si el periodo ya terminó no
 * queda nada por atender, y si está en curso solo cuenta lo que falta. `null` =
 * no hay nada que consultar.
 */
export function periodoDeAgenda(
  p: { mesIdx: number; anio: number; startDate?: string; endDate?: string },
  hoy: string,
): { desde: string; hasta: string } | null {
  let inicio: string;
  let fin: string;
  if (p.startDate && p.endDate) {
    inicio = p.startDate;
    fin = p.endDate;
  } else {
    inicio = `${p.anio}-${pad(p.mesIdx)}-01`;
    const ultimo = new Date(Date.UTC(p.anio, p.mesIdx, 0)).getUTCDate();
    fin = `${p.anio}-${pad(p.mesIdx)}-${pad(ultimo)}`;
  }
  const desde = inicio > hoy ? inicio : hoy;
  return desde > fin ? null : { desde, hasta: fin };
}

/**
 * Los `n` meses CERRADOS anteriores a la fecha dada (el mes en curso no cuenta: a
 * medias distorsionaría el promedio), del más reciente al más antiguo.
 */
export function mesesCerradosPrevios(hoy: string, n = 3): Array<{ anio: number; mes: number }> {
  const [y, m] = hoy.split('-').map(Number) as [number, number];
  const out: Array<{ anio: number; mes: number }> = [];
  for (let i = 1; i <= n; i++) {
    const t = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push({ anio: t.getUTCFullYear(), mes: t.getUTCMonth() + 1 });
  }
  return out;
}

export interface FilaEntidadAgenda {
  entidadId: string | null;
  entidad: string;
  tipo: string;
  citas: number;
  valor: number;
  citasSinValor: number;
}

export interface AgendaResultado {
  actualizado_en: string | null;
  horizonte: string | null;
  total: { citas: number; valor: number; citas_sin_valor: number };
  por_entidad: Array<{
    entidad_id: string | null; entidad: string; tipo: string;
    citas: number; valor: number; citas_sin_valor: number; promedio_3m: number | null;
  }>;
  por_dia: Array<{ fecha: string; citas: number; valor: number }>;
}

/** `'YYYY-MM-DD HH:MM:SS'` (UTC, del pool) → ISO. `null` si no hay o no se entiende. */
export function aIso(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = Date.parse(`${s.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function armarAgenda(
  porEntidad: FilaEntidadAgenda[],
  porDia: Array<{ fecha: string; citas: number; valor: number }>,
  promedios: Map<string, number>,
  horizonte: string | null,
  ultimaOk: string | null,
): AgendaResultado {
  const filas = porEntidad.map((e) => ({
    entidad_id: e.entidadId,
    entidad: e.entidad,
    tipo: e.tipo,
    citas: e.citas,
    valor: Math.round(e.valor),
    citas_sin_valor: e.citasSinValor,
    // Sin historial, `null`: no se inventa una comparación.
    promedio_3m: e.entidadId && promedios.has(e.entidadId) ? Math.round(promedios.get(e.entidadId)!) : null,
  }));
  return {
    actualizado_en: aIso(ultimaOk),
    horizonte,
    // El total sale de las MISMAS filas que se devuelven: así la ficha y la tabla
    // por EPS no pueden discrepar.
    total: {
      citas: filas.reduce((s, f) => s + f.citas, 0),
      valor: filas.reduce((s, f) => s + f.valor, 0),
      citas_sin_valor: filas.reduce((s, f) => s + f.citas_sin_valor, 0),
    },
    por_entidad: filas,
    por_dia: porDia.map((d) => ({ fecha: d.fecha, citas: d.citas, valor: Math.round(d.valor) })),
  };
}

export function agendaVacia(horizonte: string | null, ultimaOk: string | null): AgendaResultado {
  return armarAgenda([], [], new Map(), horizonte, ultimaOk);
}
