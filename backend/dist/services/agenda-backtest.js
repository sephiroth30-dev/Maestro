"use strict";
/**
 * Evaluación de la valoración contra lo realmente facturado, sin base de datos.
 *
 * ## Qué mide, y qué NO
 *
 * Toma las citas CUMPLIDAS de un mes ya cerrado, las valora con el historial
 * ANTERIOR a ese mes (para no contaminar la prueba con lo que se quiere
 * predecir) y compara, por EPS, la suma estimada contra lo que ese mes facturó.
 *
 * Mide si la VALORACIÓN es razonable. **No mide cuántas citas se llegan a
 * agendar** (eso es lo que no se puede reconstruir con la API: el estado de la
 * agenda hace diez días ya no existe).
 *
 * ## Cómo leer la «cobertura»
 *
 * `cobertura = estimado ÷ real`. Es normal que sea algo menor a 1: lo facturado
 * incluye líneas que no nacen de una cita (atención sin agendar, ajustes). Lo que
 * importa es que sea ESTABLE y cercana entre EPS: una EPS en 0,4 mientras las
 * demás están en 0,9 es la que está mal valorada.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluarBacktest = evaluarBacktest;
const razon = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : null);
function evaluarBacktest(mes, citas, real) {
    const por = new Map();
    const fila = (key, entidad) => {
        let f = por.get(key);
        if (!f) {
            f = { entidadKey: key, entidad, cumplidas: 0, incumplidas: 0, sinPrecio: 0, estimado: 0, real: 0, cobertura: null, inasistencia: null };
            por.set(key, f);
        }
        return f;
    };
    for (const c of citas) {
        const f = fila(c.entidadKey, c.entidad);
        if (c.estado === 'I') {
            f.incumplidas++;
            continue;
        }
        f.cumplidas++;
        if (c.valor === null)
            f.sinPrecio++;
        else
            f.estimado += c.valor;
    }
    // Lo facturado de EPS que no tuvieron ninguna cita cumplida también cuenta: es
    // facturación que la agenda no explica.
    for (const [key, r] of real)
        fila(key, r.entidad).real = r.valor;
    const filas = [...por.values()].map((f) => ({
        ...f,
        estimado: Math.round(f.estimado),
        real: Math.round(f.real),
        cobertura: razon(f.estimado, f.real),
        inasistencia: razon(f.incumplidas, f.cumplidas + f.incumplidas),
    })).sort((a, b) => b.real - a.real);
    const sum = (k) => filas.reduce((s, f) => s + f[k], 0);
    const estimado = sum('estimado');
    const real_ = sum('real');
    return {
        mes,
        filas,
        total: {
            cumplidas: sum('cumplidas'), incumplidas: sum('incumplidas'), sinPrecio: sum('sinPrecio'),
            estimado, real: real_, cobertura: razon(estimado, real_),
            inasistencia: razon(sum('incumplidas'), sum('cumplidas') + sum('incumplidas')),
        },
    };
}
//# sourceMappingURL=agenda-backtest.js.map