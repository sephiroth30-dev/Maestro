---
id: auditoria
titulo: Auditoría
modulo: auditoria
orden: 80
claves: log, registro, quien hizo, historial, trazabilidad, eventos
---

## Para qué sirve

Registro de todo lo que se hace en el sistema: inicios de sesión, creación y cambios de
usuarios, generación de liquidaciones, aprobaciones, ajustes y cambios de configuración.

Responde a «quién hizo esto y cuándo».

## Filtrar

- **Tipo de acción** — login, liquidación, usuario, conector, etc.
- **Desde / Hasta** — el rango de fechas.

Tras cambiar un filtro hay que pulsar **Buscar**: la consulta va al servidor, no se filtra
en pantalla.

## Qué muestra cada línea

Fecha y hora, quién lo hizo, qué acción fue, sobre qué y desde qué dirección IP.

> El registro es de **solo lectura**. No se puede editar ni borrar, ni siquiera por un
> administrador. Ese es justamente el punto.

<details>
<summary>Descargar el registro</summary>

El botón **Exportar** descarga **todos los eventos del filtro activo**, no solo la página
que estás viendo, hasta un máximo de 2.000 registros. Si hay más, el archivo lo indica y
conviene acotar el rango de fechas.

Para volúmenes grandes, el formato CSV es más manejable que el PDF.

</details>
