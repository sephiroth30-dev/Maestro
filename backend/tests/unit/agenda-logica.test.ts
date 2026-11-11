import { ventanaCitas, hoyEnBogota, enHorarioLaboral } from '../../src/services/agenda-ventana';
import {
  mediana, construirTablaPrecios, valorarCita, MIN_CASOS, type VisitaHistorica,
} from '../../src/services/agenda-valoracion';
import { normalizarCitas, parseFechaCita, type FilaCruda } from '../../src/services/agenda-mapeo';
import {
  grupoDeNombre, sqlClasificacionGrupo, GRUPOS_ORDENADOS, GRUPOS_CAPACIDAD,
} from '../../src/config/capacidad-grupos';

describe('ventana de citas (hora de Colombia)', () => {
  it('va de hoy al último día del mes siguiente', () => {
    expect(ventanaCitas(new Date('2026-11-10T15:00:00Z'))).toEqual({ desde: '2026-11-10', hasta: '2026-12-31' });
  });

  it('cruza el año en diciembre', () => {
    expect(ventanaCitas(new Date('2026-12-15T15:00:00Z'))).toEqual({ desde: '2026-12-15', hasta: '2027-01-31' });
  });

  it('el mes siguiente a enero tiene 28 días (2027) o 29 (2028)', () => {
    expect(ventanaCitas(new Date('2027-01-10T15:00:00Z')).hasta).toBe('2027-02-28');
    expect(ventanaCitas(new Date('2028-01-10T15:00:00Z')).hasta).toBe('2028-02-29');
  });

  it('usa la hora de Colombia, no la del servidor', () => {
    // 2026-11-01 02:00 UTC = 31 de octubre, 9 p. m. en Bogotá: todavía es octubre.
    expect(hoyEnBogota(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10-31');
    expect(ventanaCitas(new Date('2026-11-01T02:00:00Z'))).toEqual({ desde: '2026-10-31', hasta: '2026-11-30' });
  });

  it('mesesAdelante = 0 es solo hasta fin del mes en curso', () => {
    expect(ventanaCitas(new Date('2026-11-10T15:00:00Z'), 0).hasta).toBe('2026-11-30');
  });

  it('horario laboral: lunes a sábado, de 6:00 a 19:59 en Bogotá', () => {
    // 2026-11-10 es martes. 15:00 UTC = 10:00 Bogotá.
    expect(enHorarioLaboral(new Date('2026-11-10T15:00:00Z'))).toBe(true);
    expect(enHorarioLaboral(new Date('2026-11-10T10:59:00Z'))).toBe(false);  // 5:59
    expect(enHorarioLaboral(new Date('2026-11-10T11:00:00Z'))).toBe(true);   // 6:00
    expect(enHorarioLaboral(new Date('2026-11-11T00:59:00Z'))).toBe(true);   // 19:59
    expect(enHorarioLaboral(new Date('2026-11-11T01:00:00Z'))).toBe(false);  // 20:00
    expect(enHorarioLaboral(new Date('2026-11-14T15:00:00Z'))).toBe(true);   // sábado
    expect(enHorarioLaboral(new Date('2026-11-15T15:00:00Z'))).toBe(false);  // domingo
  });
});

describe('valoración de citas', () => {
  const v = (entidad_id: string | null, grupo: string, valor: number): VisitaHistorica => ({ entidad_id, grupo, valor });
  const muchas = (entidad: string | null, grupo: string, valores: number[]): VisitaHistorica[] =>
    valores.map((x) => v(entidad, grupo, x));

  it('la mediana, no el promedio: un atípico no la mueve', () => {
    expect(mediana([100, 110, 120, 130, 9_000_000])).toBe(120);
    expect(mediana([100, 200])).toBe(150);
    expect(mediana([])).toBe(0);
  });

  it('usa la mediana de la EPS y del grupo cuando hay casos suficientes', () => {
    const t = construirTablaPrecios(muchas('e1', 'emg', [100, 110, 120]));
    expect(valorarCita(t, 'e1', 'emg')).toEqual({ valor: 110, origen: 'entidad_grupo' });
  });

  it('con pocos casos de la EPS cae al grupo en todas las EPS', () => {
    const t = construirTablaPrecios([
      ...muchas('e1', 'emg', [500, 510]),                  // solo 2: no alcanza
      ...muchas('e2', 'emg', [100, 110, 120]),
    ]);
    // e1 tiene 2 casos (<3): se usa la mediana del grupo (5 casos: 100,110,120,500,510 → 120)
    expect(valorarCita(t, 'e1', 'emg')).toEqual({ valor: 120, origen: 'grupo' });
  });

  it('sin historial suficiente NO devuelve 0: devuelve sin precio', () => {
    const t = construirTablaPrecios(muchas('e1', 'emg', [100, 110]));   // 2 casos en total
    expect(valorarCita(t, 'e1', 'emg')).toEqual({ valor: null, origen: 'sin_precio' });
    expect(valorarCita(t, 'e1', 'eeg')).toEqual({ valor: null, origen: 'sin_precio' });
  });

  it('una cita sin grupo no tiene precio', () => {
    const t = construirTablaPrecios(muchas('e1', 'emg', [100, 110, 120]));
    expect(valorarCita(t, 'e1', null)).toEqual({ valor: null, origen: 'sin_precio' });
  });

  it('una EPS sin vincular usa el grupo', () => {
    const t = construirTablaPrecios(muchas('e1', 'emg', [100, 110, 120]));
    expect(valorarCita(t, null, 'emg')).toEqual({ valor: 110, origen: 'grupo' });
  });

  it('las visitas en $0 no cuentan: no dicen cuánto vale el servicio', () => {
    const t = construirTablaPrecios(muchas('e1', 'emg', [0, 0, 0, 100, 110, 120]));
    expect(valorarCita(t, 'e1', 'emg').valor).toBe(110);
  });

  it('el mínimo de casos es 3', () => {
    expect(MIN_CASOS).toBe(3);
  });
});

describe('fechas de las citas', () => {
  it.each([
    ['2026-11-10 08:30:00', '2026-11-10', '2026-11-10 08:30:00'],
    ['2026-11-10 08:30', '2026-11-10', '2026-11-10 08:30:00'],
    ['2026-11-10T20:15:00', '2026-11-10', '2026-11-10 20:15:00'],
    // Con zona explícita el instante es absoluto: se pasa a la hora de la clínica (UTC-5).
    ['2026-11-10T20:15:00.000Z', '2026-11-10', '2026-11-10 15:15:00'],
    ['2026-11-11T01:00:00Z', '2026-11-10', '2026-11-10 20:00:00'],
    ['2026-11-10T20:00:00-05:00', '2026-11-10', '2026-11-10 20:00:00'],
    ['10/11/2026 07:00', '2026-11-10', '2026-11-10 07:00:00'],
    ['2026-11-10', '2026-11-10', '2026-11-10 00:00:00'],
  ])('«%s»', (raw, dia, completa) => {
    expect(parseFechaCita(raw)).toEqual({ fechaDia: dia, fechaCita: completa });
  });

  it('NO convierte de zona: una cita de las 8 p. m. sigue siendo de ese día', () => {
    expect(parseFechaCita('2026-11-10 20:00:00')?.fechaDia).toBe('2026-11-10');
  });

  it('una hora imposible descarta la fecha en vez de moverla a las 00:00', () => {
    expect(parseFechaCita('2026-11-10 25:00:00')).toBeNull();
    expect(parseFechaCita('2026-11-10 08:75')).toBeNull();
  });

  it.each([null, undefined, '', 'mañana', '2026-13-40', '31/02/2026', 12345])('rechaza %p', (raw) => {
    expect(parseFechaCita(raw)).toBeNull();
  });
});

describe('normalización de citas', () => {
  const base: FilaCruda = {
    codAsignacion: 101, fechaInicioCita: '2026-11-12 09:00:00', estado: 'P', origen: 'agenda',
    codConvenio: 5, convenio: 'SANITAS CONTRIBUTIVO', referencia: 'CONSULTA DE CONTROL NEUROLOGIA',
    cups: '890274', profesional: 'CRUZ',
  };

  it('conserva una cita pendiente de agenda', () => {
    const r = normalizarCitas([base]);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({ codAsignacion: 101, fechaDia: '2026-11-12', convenioCod: 5, cups: '890274' });
  });

  it('descarta las cumplidas: ya están facturadas y contarlas duplicaría', () => {
    const r = normalizarCitas([{ ...base, estado: 'C' }, { ...base, codAsignacion: 102, estado: 'I' }, { ...base, codAsignacion: 103, estado: 'L' }]);
    expect(r.filas).toHaveLength(0);
    expect(r.descartadas.noPendiente).toBe(3);
  });

  it('descarta imagenología y canceladas', () => {
    const r = normalizarCitas([{ ...base, origen: 'imagenologia' }, { ...base, codAsignacion: 102, origen: 'cancelacion' }]);
    expect(r.filas).toHaveLength(0);
    expect(r.descartadas.noAgenda).toBe(2);
  });

  it('sin origen informado se asume agenda', () => {
    expect(normalizarCitas([{ ...base, origen: undefined }]).filas).toHaveLength(1);
  });

  it('descarta sin código o sin fecha válida, y lo cuenta', () => {
    const r = normalizarCitas([{ ...base, codAsignacion: null }, { ...base, codAsignacion: 7, fechaInicioCita: 'xx' }]);
    expect(r.filas).toHaveLength(0);
    expect(r.descartadas).toMatchObject({ sinCodigo: 1, sinFecha: 1 });
  });

  it('una misma cita repetida entre páginas cuenta UNA vez', () => {
    // Pasa con una API paginada sobre datos que cambian entre página y página.
    const r = normalizarCitas([base, { ...base }, { ...base }]);
    expect(r.filas).toHaveLength(1);
    expect(r.descartadas.duplicadas).toBe(2);
  });

  it('no guarda datos de pacientes aunque la API los mande', () => {
    const r = normalizarCitas([{ ...base, paciente: 'JUAN PEREZ', documento: '123' } as FilaCruda]);
    expect(JSON.stringify(r.filas[0])).not.toMatch(/JUAN|123/);
  });
});

describe('clasificación de servicios en memoria', () => {
  it.each([
    ['ELECTROMIOGRAFIA DE MIEMBROS', 'emg_vcn'],
    ['ELECTROMIOGRAFÍA DE MIEMBROS', 'emg_vcn'],          // tilde: el LIKE de MySQL la ignora
    ['electromiografia de miembros', 'emg_vcn'],          // minúsculas
    ['POTENCIALES EVOCADOS VISUALES', 'pe'],
    ['CONSULTA DE CONTROL NEUROLOGIA', 'consulta_neurologia'],
    ['CONSULTA PRIMERA VEZ NEUROLOGIA', 'consulta_neurologia'],
    ['ECOGRAFIA', 'ecografia'],
    ['ECOGRAFIA COMO GUIA PARA PROCEDIMIENTO', 'ecografia'],
    ['MONITORIZACION VIDEO EEG', 'tlm'],
  ])('«%s» → %s', (nombre, grupo) => {
    expect(grupoDeNombre(nombre)).toBe(grupo);
  });

  it('la neurología PEDIÁTRICA gana a la general (prioridad 10 frente a 60)', () => {
    expect(grupoDeNombre('CONSULTA DE CONTROL NEUROLOGIA PEDIATRICA')).toBe('consulta_neurologia_pediatrica');
    expect(grupoDeNombre('CONSULTA PRIMERA VEZ NEUROLOGIA PEDIATRICA')).toBe('consulta_neurologia_pediatrica');
  });

  it('un patrón EXACTO no absorbe lo que no debe: ecografía diagnóstica no es ecografía guía', () => {
    expect(grupoDeNombre('ECOGRAFIA ABDOMINAL')).toBeNull();
  });

  it.each([null, undefined, '', 'CONSULTA GENERAL', 'LABORATORIO'])('%p no encaja en ningún grupo', (n) => {
    expect(grupoDeNombre(n)).toBeNull();
  });

  it('PARIDAD con el CASE de SQL: mismos grupos y en el mismo orden de evaluación', () => {
    // El CASE de SQL y grupoDeNombre salen de la MISMA lista ordenada. Si alguien
    // volviera a calcular el orden por separado, esto se rompería.
    const sql = sqlClasificacionGrupo('sv.nombre');
    const enSql = [...sql.matchAll(/THEN '([a-z_]+)'/g)].map((m) => m[1]);
    expect(enSql).toEqual(GRUPOS_ORDENADOS.map((g) => g.grupo));
    expect(new Set(enSql)).toEqual(new Set(GRUPOS_CAPACIDAD.map((g) => g.grupo)));
  });

  it('PARIDAD de patrones: cada patrón del catálogo aparece en el SQL con el mismo texto', () => {
    const sql = sqlClasificacionGrupo('sv.nombre');
    for (const g of GRUPOS_CAPACIDAD) for (const p of g.patrones) expect(sql).toContain(`LIKE '${p}'`);
  });
});

describe('un campo anidado mal mapeado no se guarda como nombre', () => {
  const base: FilaCruda = {
    codAsignacion: 1, fechaInicioCita: '2026-11-12 09:00:00', estado: 'P', origen: 'agenda',
    codConvenio: 5, referencia: 'CONSULTA', cups: '890274', profesional: 'CRUZ',
  };

  it('un objeto entero donde se esperaba el nombre queda vacío', () => {
    const r = normalizarCitas([{ ...base, convenio: '{"codConvenio":5,"nombreConvenio":"SANITAS"}' }]);
    expect(r.filas[0]!.convenioNombre).toBe('');
  });

  it('un arreglo tampoco es un nombre', () => {
    expect(normalizarCitas([{ ...base, convenio: '[1,2]' }]).filas[0]!.convenioNombre).toBe('');
  });

  it('un nombre normal se conserva', () => {
    expect(normalizarCitas([{ ...base, convenio: 'SANITAS CONTRIBUTIVO' }]).filas[0]!.convenioNombre).toBe('SANITAS CONTRIBUTIVO');
  });
});
