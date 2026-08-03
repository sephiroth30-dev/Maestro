/**
 * Regla única de acceso a módulos.
 *
 * Estaba implementada dos veces con formas distintas — `hasModuleAccess` en
 * App.tsx y `hasAccess` en Sidebar.tsx — y la ayuda contextual necesitaba una
 * tercera. Vive aquí para que la regla exista en un solo sitio.
 *
 * El sistema tiene dos capas de permisos que conviven:
 *
 *  - `user.modulos`: lista explícita por usuario. Cuando está poblada, manda.
 *  - `user.rol`: el esquema anterior, que sigue sirviendo de respaldo para las
 *    cuentas a las que nadie les ha asignado módulos todavía.
 *
 * `configuracion` funciona como súper-módulo: quien lo tiene, entra a todo.
 */

export interface UsuarioConAcceso {
  rol: string;
  modulos?: string[];
}

/**
 * ¿Puede este usuario ver algo que exige `modulo` (o, en su defecto, alguno de
 * `rolesFallback`)?
 *
 * - Sin `modulo` y sin `rolesFallback`: visible para cualquier autenticado. Es
 *   el caso de la ayuda transversal y de las entradas de menú sin restricción.
 * - Con `modulo`: si el usuario tiene lista explícita, decide ella; si no, se
 *   cae a los roles.
 */
export function tieneAcceso(
  user: UsuarioConAcceso | null | undefined,
  modulo?: string,
  rolesFallback?: readonly string[],
): boolean {
  if (!user) return false;

  const mods = user.modulos;
  if (modulo && mods && mods.length > 0) {
    return mods.includes(modulo) || mods.includes('configuracion');
  }

  // Sin roles declarados no hay restricción que aplicar.
  if (!rolesFallback || rolesFallback.length === 0) return true;

  return rolesFallback.includes(user.rol);
}
