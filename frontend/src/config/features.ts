/**
 * Funciones que se despliegan apagadas hasta que su backend exista.
 *
 * Son variables de COMPILACIÓN de Vite (`VITE_*`): se fijan al construir el
 * frontend, no en tiempo de ejecución. Sin la variable, la función queda
 * apagada y la pantalla es idéntica a la de siempre.
 */

/**
 * Proyección por agenda: lo atendido + lo agendado (citas pendientes de
 * Medifolios). La parte visual está lista, pero el endpoint
 * `GET /api/reportes/agenda` y la sincronización de citas todavía no existen en
 * el servidor. Encenderla antes haría que cada carga de Reportes y del Inicio
 * pidiera un endpoint inexistente. Se enciende con `VITE_PROYECCION_AGENDA=true`.
 */
export const PROYECCION_AGENDA: boolean = import.meta.env['VITE_PROYECCION_AGENDA'] === 'true';
