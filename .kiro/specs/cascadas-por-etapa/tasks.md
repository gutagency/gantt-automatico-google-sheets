# Plan de implementación: `cascadas-por-etapa`

## Overview

Implementación de cascadas independientes por subgrupo (etapa) en el sistema Gantt automático de Google Apps Script. La lógica central ya fue implementada en `Code_v2.14.gs` y `Wrapper_Gantt_v2.gs`. Las tareas pendientes son los tests (property-based y de ejemplos) y la actualización del header de versión.

Los tests se implementan como **funciones GAS nativas** en `Tests_Gantt.gs`, sin dependencias externas ni npm. Cada test se ejecuta directamente desde el editor de Apps Script. Los property-based tests usan generadores aleatorios simples en JS vanilla (sin fast-check).

---

## Tasks

- [x] 1. Implementar función auxiliar `obtenerLimitesSubgrupos`
  - Detecta headers de subgrupo en columna A (case-insensitive, sin espacios extremos)
  - Calcula `filaInicio` y `filaFin` de cada subgrupo
  - Omite subgrupos vacíos (`filaInicio > filaFin`)
  - Devuelve array vacío si no hay headers
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implementar `cascadaInversaSubgrupos` en GanttLib
  - [x] 2.1 Lógica principal de cascada inversa por subgrupo
    - Obtiene subgrupos via `obtenerLimitesSubgrupos`
    - Guards: hoja ausente → alert + return; sin subgrupos → alert + return
    - Por cada subgrupo: busca última fila con actividad, toma ancla Fecha Fin, calcula hacia arriba
    - Omite subgrupos sin ancla válida, acumula advertencias, continúa con el siguiente
    - Llama a `formatearFechasCreativo`, `marcarSuperposicionEntrada` y toast al finalizar
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 5.1, 5.3, 6.1, 6.3, 6.4_

- [x] 3. Implementar `cascadaNormalSubgrupos` en GanttLib
  - [x] 3.1 Lógica principal de cascada normal por subgrupo
    - Obtiene subgrupos via `obtenerLimitesSubgrupos`
    - Guards: hoja ausente → alert + return; sin subgrupos → alert + return
    - Por cada subgrupo: busca primera fila con actividad, toma ancla Fecha Inicio, ajusta a día hábil si necesario, calcula hacia abajo
    - Omite subgrupos sin ancla válida, acumula advertencias, continúa con el siguiente
    - Llama a `formatearFechasCreativo`, `marcarSuperposicionEntrada` y toast al finalizar
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 5.2, 5.4, 6.2, 6.3, 6.4_

- [x] 4. Actualizar menú y wrappers en `Wrapper_Gantt_v2.gs`
  - [x] 4.1 Agregar entradas al menú en `onOpen`
    - Nuevas entradas "⬆️ Cascada inversa por etapa" y "⬇️ Cascada normal por etapa"
    - Separadas de cascadas globales y del bloque Gantt con `addSeparator()`
    - _Requirements: 4.2, 4.3_
  - [x] 4.2 Agregar funciones wrapper de delegación
    - `cascadaInversaSubgrupos()` → `GanttLib.cascadaInversaSubgrupos()`
    - `cascadaNormalSubgrupos()` → `GanttLib.cascadaNormalSubgrupos()`
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 5. Crear `Tests_Gantt.gs` — framework y generadores
  - Framework minimalista: `assert(condicion, msg)`, `assertEqual(a, b, msg)`, función `runTests()` que ejecuta todos los tests e imprime resultados via `Logger.log`
  - Generadores aleatorios en JS vanilla (usados por los property tests):
    - `genCasingAleatorio(str)`: devuelve el string con mayúsculas/minúsculas mezcladas aleatoriamente
    - `genEspaciosAleatorios(str)`: agrega espacios al inicio/fin aleatoriamente
    - `genFilasConHeaders(n)`: array de n filas donde algunas son headers de subgrupo con casing/espacios aleatorios
    - `genSubgrupoConActividades()`: tabla con 1–2 headers y 1–5 actividades cada uno, días y fechas aleatorias
    - `genFechaNoHabil()`: Date que cae en sábado o domingo
    - `genDiasInvalidos()`: un valor de la lista `[0, -1, -5, NaN, '', 'abc']`
  - _Requirements: 1.1–1.5, 2.1–2.8, 3.1–3.9, 6.1–6.4_

- [ ] 6. Implementar property-based tests en `Tests_Gantt.gs`
  - [ ] 6.1 Property 1 — Detección case/whitespace-insensitive de headers
    - Para 100 variantes de `'PROCESO CREATIVO'` y `'PRODUCTION PLANNING'` con casing y espacios aleatorios: verificar que son detectadas como headers
    - Para 100 strings que NO son headers: verificar que no se detectan
    - Tag: `// Feature: cascadas-por-etapa, Property 1`
    - _Requirements: 1.1_

  - [ ] 6.2 Property 2 — Invariante de límites de subgrupo
    - Para 100 tablas generadas: verificar que `filaInicio = filaHeader + 1`, `filaFin = filaHeaderSiguiente - 1` (o `ultimaFila`), y subgrupos vacíos omitidos
    - Tag: `// Feature: cascadas-por-etapa, Property 2`
    - _Requirements: 1.2, 1.4, 1.5_

  - [ ] 6.3 Property 3 — Cascada inversa preserva el ancla
    - Para 100 tablas generadas: tras `cascadaInversaLogica`, verificar que la Fecha Fin de la última actividad de cada subgrupo es igual al ancla original
    - Tag: `// Feature: cascadas-por-etapa, Property 3`
    - _Requirements: 2.2_

  - [ ] 6.4 Property 4 — Aislamiento de subgrupos
    - Para 100 tablas con 2 subgrupos: tras aplicar la cascada sobre el primer subgrupo, verificar que las fechas del segundo subgrupo no cambiaron
    - Tag: `// Feature: cascadas-por-etapa, Property 4`
    - _Requirements: 2.3, 5.1, 5.2, 5.3, 5.4_

  - [ ] 6.5 Property 5 — Equivalencia con cascadas globales
    - Para 100 tablas con un único subgrupo abarcando todo: verificar que `cascadaInversaLogica` produce resultados idénticos a `cascadaInversaGlobalLogica`, y lo mismo para normal
    - Tag: `// Feature: cascadas-por-etapa, Property 5`
    - _Requirements: 2.4, 3.5, 6.1, 6.2_

  - [ ] 6.6 Property 6 — Resiliencia ante anclas ausentes
    - Para 100 tablas con mezcla de subgrupos con/sin ancla válida: verificar que los válidos se procesan, los inválidos se omiten, y hay una advertencia por cada omitido
    - Tag: `// Feature: cascadas-por-etapa, Property 6`
    - _Requirements: 2.7, 3.8_

  - [ ] 6.7 Property 7 — Cascada normal preserva el ancla
    - Para 100 tablas donde la ancla ya es día hábil: tras `cascadaNormalLogica`, verificar que la Fecha Inicio de la primera actividad es igual al ancla original
    - Tag: `// Feature: cascadas-por-etapa, Property 7`
    - _Requirements: 3.2_

  - [ ] 6.8 Property 8 — Ajuste de ancla a día hábil
    - Para 100 anclas generadas con `genFechaNoHabil`: tras `cascadaNormalLogica`, verificar que la Fecha Inicio resultante es el siguiente día hábil
    - Tag: `// Feature: cascadas-por-etapa, Property 8`
    - _Requirements: 3.4_

  - [ ] 6.9 Property 9 — Días inválidos tratados como 1
    - Para 100 actividades con días generados con `genDiasInvalidos`: verificar que Fecha Fin = Fecha Inicio en cascada normal, y Fecha Inicio = Fecha Fin en cascada inversa
    - Tag: `// Feature: cascadas-por-etapa, Property 9`
    - _Requirements: 6.3_

  - [ ] 6.10 Property 10 — Filas con columna A vacía no son modificadas
    - Para 100 tablas con filas de columna A vacía intercaladas: verificar que las columnas C y D de esas filas quedan intactas tras cualquier cascada
    - Tag: `// Feature: cascadas-por-etapa, Property 10`
    - _Requirements: 6.4_

- [ ] 7. Checkpoint — Todos los property tests pasan
  - Ejecutar `runPropertyTests()` desde el editor de Apps Script y verificar que los 10 tests pasan en el log
  - Preguntar al usuario si hay dudas antes de continuar

- [ ] 8. Implementar unit tests / example-based tests en `Tests_Gantt.gs`
  - [ ] 8.1 Error: hoja ausente en cascada inversa
    - Pasar `null` como hoja a `cascadaInversaLogica`; verificar que se registra el error y no se modifica ninguna fila
    - _Requirements: 2.5_

  - [ ] 8.2 Error: hoja ausente en cascada normal
    - Pasar `null` como hoja a `cascadaNormalLogica`; verificar que se registra el error y no se modifica ninguna fila
    - _Requirements: 3.6_

  - [ ] 8.3 Error: sin subgrupos en cascada inversa
    - Tabla sin headers de subgrupo → verificar que se registra la condición y el estado de la tabla no cambia
    - _Requirements: 2.6_

  - [ ] 8.4 Error: sin subgrupos en cascada normal
    - Tabla sin headers de subgrupo → verificar que se registra la condición y el estado de la tabla no cambia
    - _Requirements: 3.7_

  - [ ] 8.5 Cálculo correcto — cascada inversa (ejemplo fijo)
    - 1 subgrupo, 3 actividades de 3/2/1 días, ancla Fecha Fin = lunes 2025-06-09
    - Verificar fechas calculadas exactas para cada actividad
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 8.6 Cálculo correcto — cascada normal (ejemplo fijo)
    - 1 subgrupo, 3 actividades de 3/2/1 días, ancla Fecha Inicio = lunes 2025-06-02
    - Verificar fechas calculadas exactas para cada actividad
    - _Requirements: 3.1, 3.2, 3.5_

  - [ ] 8.7 Post-procesamiento — contador de subgrupos en mensaje
    - Tabla con 2 subgrupos válidos: verificar que el mensaje de resultado dice "2 subgrupo(s) procesado(s)"
    - _Requirements: 2.8, 3.9_

  - [ ] 8.8 Wrappers de delegación (smoke test)
    - Verificar que las funciones `cascadaInversaSubgrupos` y `cascadaNormalSubgrupos` existen y son de tipo función
    - _Requirements: 4.1, 4.4, 4.5_

- [ ] 9. Checkpoint — Todos los unit tests pasan
  - Ejecutar `runUnitTests()` desde el editor de Apps Script y verificar que todos pasan en el log
  - Preguntar al usuario si hay dudas antes de continuar

- [x] 10. Actualizar header de versión en `Code_v2.14.gs`
  - Cambiar el número de versión de `v2.14` a `v2.15` en el comentario de cabecera del archivo
  - Documentar en la sección `CAMBIO vs 2.14` los tres elementos añadidos:
    - `obtenerLimitesSubgrupos(hoja)`: detecta rangos de filas de cada subgrupo
    - `cascadaInversaSubgrupos()`: cascada inversa independiente por subgrupo
    - `cascadaNormalSubgrupos()`: cascada normal independiente por subgrupo
  - _Requirements: (documentación de la versión entregada)_

- [ ] 11. Checkpoint final — Verificación integral
  - Ejecutar `runAllTests()` (property + unit) y confirmar que todos pasan tras el cambio de versión
  - Preguntar al usuario si hay observaciones finales antes de cerrar la tarea

---

## Notes

- Las tareas 1–4 están marcadas como completadas (`[x]`) porque la implementación ya fue realizada en `Code_v2.14.gs` y `Wrapper_Gantt_v2.gs`.
- Los property tests y unit tests operan sobre lógica pura (`cascadaInversaLogica`, `cascadaNormalLogica`, `obtenerLimitesSubgruposLogica`) definida dentro de `Tests_Gantt.gs`, que replica la lógica de `Code_v2.14.gs` sin depender de la Sheets API.
- Para ejecutar los tests: en el editor de Apps Script, seleccionar `runAllTests` (o `runPropertyTests` / `runUnitTests`) y hacer clic en "Ejecutar". Los resultados aparecen en el log de ejecución.
- Los checkpoints (tareas 7, 9 y 11) son puntos de sincronización; se puede pausar ahí para revisar resultados antes de seguir.
