import React from 'react';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { useProfesionales, useUpdateProfesionalEspecialidad } from '../../api/profesionales.js';
import type { ProfesionalRow, Especialidad } from '../../api/profesionales.js';

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

const ESP_LABELS: Record<string, string> = {
  NEUROLOGIA: 'Neurología',
  FISIATRIA:  'Fisiatría',
  OTRO:       'Otra',
};

const ESP_COLORS: Record<string, string> = {
  NEUROLOGIA: '#3b82f6',
  FISIATRIA:  '#8b5cf6',
  OTRO:       '#64748b',
};

function ProfRow({ p }: { p: ProfesionalRow }): React.ReactElement {
  const update = useUpdateProfesionalEspecialidad();

  function setEsp(val: string): void {
    const esp: Especialidad = val === '' ? null : (val as Especialidad);
    void update.mutateAsync({ id: p.id, especialidad: esp });
  }

  const current = p.especialidad ?? '';
  const color = current ? ESP_COLORS[current] : '#9ca3af';

  return (
    <tr className="tabla-entidades-tr">
      <td className="tabla-entidades-td" style={{ fontWeight: 500 }}>
        {p.nombre}
      </td>
      <td className="tabla-entidades-td">
        <div className="svc-kws-list">
          {p.nombres_raw.map((n) => (
            <span key={n} className="svc-kw-tag">{n}</span>
          ))}
        </div>
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
        <select
          className="prof-esp-select"
          value={current}
          onChange={(e) => setEsp(e.target.value)}
          disabled={update.isPending}
          style={{ borderColor: color, color }}
        >
          <option value="">— sin asignar —</option>
          <option value="NEUROLOGIA">Neurología</option>
          <option value="FISIATRIA">Fisiatría</option>
          <option value="OTRO">Otra especialidad</option>
        </select>
        {update.isPending && <Loader2 size={11} className="spin" style={{ marginLeft: 4 }} />}
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
        {fmtNum(p.total_atenciones)}
      </td>
    </tr>
  );
}

export default function TabProfesionales(): React.ReactElement {
  const { data, isLoading, isError } = useProfesionales();

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando profesionales…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el catálogo de profesionales.
      </div>
    );
  }

  const tagged = data.filter((p) => p.especialidad).length;
  const byEsp = Object.entries(ESP_LABELS).map(([k, label]) => ({
    key: k, label, count: data.filter((p) => p.especialidad === k).length,
  }));

  return (
    <div>
      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Asigna la especialidad de cada profesional. Las consultas genéricas ("CONSULTA PRIMERA VEZ",
          "CONSULTA DE CONTROL") se reclasifican automáticamente como Neurología o Fisiatría según
          quién las realizó. Tras etiquetar, usa{' '}
          <strong>Reclasificar registros</strong> en la pestaña Procedimientos.
        </span>
      </div>

      <p className="entidades-stats" style={{ marginTop: '8px' }}>
        {data.length} profesionales
        {' · '}
        <strong style={{ color: '#16a34a' }}>{tagged}</strong> etiquetados
        {' · '}
        {byEsp.map(({ key, label, count }) => count > 0 && (
          <span key={key} style={{ marginRight: 8 }}>
            <strong style={{ color: ESP_COLORS[key] }}>{count}</strong> {label}
          </span>
        ))}
      </p>

      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <th className="tabla-entidades-th">Profesional</th>
              <th className="tabla-entidades-th">Nombres en el Sheet</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '180px' }}>Especialidad</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'right', width: '90px' }}>Registros</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => <ProfRow key={p.id} p={p} />)}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        La especialidad solo afecta la clasificación de consultas genéricas. Los demás procedimientos
        se clasifican siempre por descripción.
      </p>
    </div>
  );
}
