import React, { useEffect, useRef, useState } from 'react';
import { valorEntreLecturas, suavizar } from '../../lib/tv.js';

/**
 * Contador animado. Muestra el valor REAL de la última lectura más —si se permite— lo que
 * daría el ritmo del día desde la hora de esa lectura, con tope. Se acomoda con una
 * transición, también hacia abajo cuando llega un dato real menor.
 */
export default function Contador({
  valor, anclaMs, porHora, enHorario, topeMin, interpolar, formato, entero = false, className,
}: {
  valor: number;
  anclaMs: number | null;
  porHora: number | null;
  enHorario: boolean;
  topeMin: number;
  interpolar: boolean;
  formato: (n: number) => string;
  entero?: boolean;
  className?: string;
}): React.ReactElement {
  const mostrado = useRef(valor);
  const [texto, setTexto] = useState(() => formato(valor));
  const ultimoTexto = useRef(texto);

  // Los parámetros viajan en una ref: el temporizador no se reinicia con cada lectura.
  const params = useRef({ valor, anclaMs, porHora, enHorario, topeMin, interpolar, formato, entero });
  params.current = { valor, anclaMs, porHora, enHorario, topeMin, interpolar, formato, entero };

  useEffect(() => {
    let previo = Date.now();
    const id = setInterval(() => {
      const ahoraMs = Date.now();
      const p = params.current;
      const objetivo = p.interpolar && p.anclaMs !== null
        ? valorEntreLecturas({ ancla: p.valor, anclaMs: p.anclaMs, ahoraMs, porHora: p.porHora, enHorario: p.enHorario, topeMin: p.topeMin })
        : p.valor;
      mostrado.current = suavizar(mostrado.current, objetivo, ahoraMs - previo);
      previo = ahoraMs;
      const t = p.formato(p.entero ? Math.floor(mostrado.current + 1e-6) : mostrado.current);
      if (t !== ultimoTexto.current) { ultimoTexto.current = t; setTexto(t); }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return <span className={className}>{texto}</span>;
}
