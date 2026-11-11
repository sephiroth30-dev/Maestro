/**
 * Funciones que se despliegan apagadas hasta que su backend exista.
 *
 * Son variables de COMPILACIÓN de Vite (`VITE_*`): se fijan al construir el
 * frontend, no en tiempo de ejecución. Sin la variable, la función queda
 * apagada y la pantalla es idéntica a la de siempre.
 */

/**
 * Proyección por agenda: lo atendido + lo agendado (citas pendientes de
 * Medifolios). El backend ya existe (`GET /api/reportes/agenda` y la
 * sincronización de citas), así que va ENCENDIDA por omisión: si la agenda no
 * está activada, no se ha sincronizado o está vieja, la propia pantalla lo avisa.
 * Se apaga al compilar con `VITE_PROYECCION_AGENDA=false`.
 */
export const PROYECCION_AGENDA: boolean = import.meta.env['VITE_PROYECCION_AGENDA'] !== 'false';
