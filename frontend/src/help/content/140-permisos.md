---
id: permisos
titulo: Permisos por rol
orden: 140
claves: permisos, roles, acceso, quien puede, modulos, admisiones, gerencia
---

## Cómo funciona el acceso

El sistema tiene siete roles, pero lo que realmente decide qué ve cada quien son los
**módulos** asignados a su usuario. Un administrador los configura en
Configuración → Usuarios.

Los módulos son: `dashboard`, `reportes`, `pacientes`, `honorarios`, `capacidad`,
`auditoria`, `configuracion` y `aprobar`.

## Quién puede hacer qué

| Función | Admin | Gerencia | Dirección | Facturación | Coordinadora | Admisiones | RR. HH. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reportes | ✓ | ✓ | ✓ | ✓ | ✓ | solo mes actual | — |
| Pacientes | ✓ | ✓ | ✓ | ✓ | ✓ | solo mes actual | — |
| Honorarios (ver / generar) | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Honorarios (aprobar / pagar) | ✓ | ✓ | ✓ | — | — | — | — |
| Ajustes (crear) | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| Ajustes (autorizar) | ✓ | ✓ | ✓ | — | — | — | — |
| Capacidad | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Auditoría | ✓ | — | — | ✓ | — | — | — |
| Configuración | ✓ | — | — | — | — | — | — |

## Dos restricciones que conviene conocer

**Admisiones solo ve el mes en curso** en Reportes y Pacientes, y **nunca recibe valores
monetarios en las exportaciones**. Ambas se aplican en el servidor, no solo en la pantalla.

**Un ajuste lo debe autorizar alguien distinto de quien lo creó.** Ni siquiera un
administrador puede autorizar el suyo propio.

<details>
<summary>Por qué mi rol dice una cosa y veo otra</summary>

Cuando un usuario tiene módulos asignados explícitamente, **mandan los módulos y el rol
pasa a segundo plano**. La tabla de arriba describe el reparto habitual, pero un
administrador puede conceder o quitar módulos caso por caso.

Tu nombre en la barra lateral muestra los módulos que tienes activos. Eso es lo que
realmente determina lo que ves.

Quien tiene el módulo `configuracion` entra a todo: es el equivalente a ser administrador.

</details>
