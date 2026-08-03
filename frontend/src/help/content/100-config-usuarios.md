---
id: config-usuarios
titulo: Usuarios y accesos
modulo: configuracion
orden: 100
claves: usuario, crear usuario, contraseña, restablecer, desactivar, modulos, dar acceso
---

## Dónde está

**Configuración → Usuarios**. Solo con el módulo `configuracion`.

## Crear un usuario

Pulsa **Nuevo usuario** y completa nombre, correo (con el que iniciará sesión), los
módulos que necesita y una contraseña inicial de al menos 8 caracteres.

> Asigna **solo los módulos que la persona necesita para su trabajo**. Es más fácil añadir
> uno después que descubrir que alguien llevaba meses viendo información que no le tocaba.

## Los módulos

| Módulo | Da acceso a |
|---|---|
| `dashboard` | La pantalla de inicio |
| `reportes` | Reportes de facturación |
| `pacientes` | Analítica de pacientes |
| `honorarios` | Liquidaciones |
| `capacidad` | Capacidad instalada |
| `auditoria` | Registro de actividad |
| `aprobar` | **Aprobar y pagar** liquidaciones, y autorizar ajustes |
| `configuracion` | Todo, incluida esta pantalla |

Dos que conviene mirar dos veces: **`aprobar`** es el que autoriza dinero, y
**`configuracion`** da acceso completo al sistema.

## Otras acciones

- **Editar** — cambiar nombre, módulos o estado.
- **Restablecer contraseña** — genera una temporal y cierra la sesión activa de esa persona.
- **Eliminar** — en realidad **desactiva**: la cuenta no puede entrar, pero su historial se
  conserva en Auditoría y en las liquidaciones donde participó.

No puedes cambiar tu propio rol ni desactivar tu propia cuenta.

<details>
<summary>Rol y módulos: cuál manda</summary>

Cada usuario tiene un rol y una lista de módulos. **Cuando la lista de módulos está
poblada, es la que decide**; el rol queda como etiqueta descriptiva.

El rol se deduce automáticamente de los módulos marcados, así que no hay que mantenerlo a
mano: marca los módulos y el sistema pone la etiqueta que corresponde.

</details>
