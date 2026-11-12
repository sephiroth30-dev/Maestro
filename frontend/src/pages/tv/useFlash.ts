import { useEffect, useRef, useState } from 'react';

/**
 * Devuelve `'sube'` o `'baja'` durante un momento cuando el valor CAMBIA, como en una pantalla de
 * bolsa. Solo debe alimentarse con datos REALES: parpadear con una estimación sería mentir.
 * El primer valor (al montar) no parpadea.
 */
export function useFlash(valor: number | null | undefined, ms = 1800): 'sube' | 'baja' | '' {
  const previo = useRef<number | null | undefined>(valor);
  const [estado, setEstado] = useState<'sube' | 'baja' | ''>('');

  useEffect(() => {
    const antes = previo.current;
    previo.current = valor;
    if (antes === undefined || antes === null || valor === undefined || valor === null) return;
    if (!Number.isFinite(antes) || !Number.isFinite(valor) || antes === valor) return;
    setEstado(valor > antes ? 'sube' : 'baja');
    const t = setTimeout(() => setEstado(''), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);

  return estado;
}
