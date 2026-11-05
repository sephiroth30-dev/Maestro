/**
 * Fuente activa del dashboard.
 *
 * Qué conector ve el dashboard, y por tanto qué filas de `atenciones` entran en
 * cada reporte. Existe porque dos fuentes pueden tener cargado el mismo mes —el
 * Sheet histórico y la API de Medifolios— y hasta ahora ninguna consulta
 * distinguía el origen: las habría sumado, duplicando la facturación sin avisar.
 *
 * Es **distinta** de `conectores.activo`, que decide si un conector se
 * sincroniza. Durante la transición hace falta sincronizar Medifolios en
 * segundo plano y compararlo en Diagnóstico antes de que el dashboard lo
 * muestre.
 *
 * El id se cachea en memoria del proceso para poder leerlo de forma **síncrona**
 * desde los constructores de SQL (`buildDateWhere` lo es). El valor es global:
 * no depende de la petición ni del usuario, así que no hay que pasarlo por
 * parámetro desde el frontend.
 */
/**
 * Garantiza que la fuente activa esté leída y sea reciente (máx. 5 s).
 *
 * Se llama en cada petición a `/api/` (ver `app.ts`). La frescura importa
 * porque el valor vive en la memoria de cada proceso y un cambio hecho en uno
 * tiene que llegar a los demás sin reiniciarlos.
 *
 * Lanza solo si nunca se ha podido leer: preferible a responder cifras
 * duplicadas.
 */
export declare function asegurarFuenteActiva(): Promise<void>;
/**
 * Relee la fuente activa ya. Al arrancar y tras cada cambio.
 *
 * No lanza: si falla, el hook de cada petición lo reintenta, y entre tanto se
 * conserva el valor anterior en vez de caer en «sin fuente».
 */
export declare function cargarFuenteActiva(): Promise<void>;
/** Id de la fuente activa, o `null` si no hay ninguna marcada (o aún no se leyó). */
export declare function fuenteActivaId(): string | null;
/**
 * Fragmento de SQL que restringe las atenciones a la fuente activa.
 *
 * Devuelve cadena vacía y sin parámetros cuando no hay fuente marcada, de modo
 * que concatenarlo siempre es seguro.
 *
 * @param alias Alias de la tabla `atenciones` en la consulta, si lo tiene.
 */
export declare function sqlFiltroFuente(alias?: string): [string, string[]];
/** Se expone para las pruebas: fija el valor sin tocar la base. */
export declare function _setFuenteActivaParaPruebas(id: string | null): void;
//# sourceMappingURL=fuente-activa.service.d.ts.map