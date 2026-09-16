# Documento de Requerimientos

## Introducción

El sistema Gantt automático en Google Sheets permite a equipos creativos y de producción planificar actividades con fechas calculadas automáticamente respetando días hábiles, feriados y fines de semana.

La hoja de entrada principal ("Entrada Proceso Creativo") contiene columnas `Actividad | Días | Fecha Inicio | Fecha Fin`. Dentro de esa hoja existen **subgrupos** (etapas), identificados por filas especiales con fondo negro en la columna A:
- **PROCESO CREATIVO**
- **PRODUCTION PLANNING**

Hasta la versión 2.13, las únicas cascadas disponibles operaban sobre **toda la tabla** como una única unidad:
- **Cascada inversa global**: toma la Fecha Fin de la última actividad de toda la tabla y calcula hacia arriba.
- **Cascada normal global**: toma la Fecha Inicio de la primera actividad de toda la tabla y calcula hacia abajo.

Esta funcionalidad agrega dos nuevas cascadas que operan **por subgrupo (etapa)** de forma independiente, permitiendo que cada etapa tenga su propio ancla de fecha sin afectar las demás. También incluye la función auxiliar `obtenerLimitesSubgrupos`, correcciones en los wrappers del cliente y el menú.

---

## Glosario

- **GanttLib**: Biblioteca central de Apps Script (`Code_v2.14.gs`) que contiene toda la lógica del sistema Gantt.
- **Wrapper**: Archivo de Apps Script (`Wrapper_Gantt_v2.gs`) que delega cada llamada del menú a la librería `GanttLib`.
- **Hoja de entrada**: Hoja de Google Sheets llamada "Entrada Proceso Creativo" con columnas `Actividad | Días | Fecha Inicio | Fecha Fin`.
- **Subgrupo / Etapa**: Sección de la hoja de entrada delimitada por una fila header especial (fondo negro) cuyo valor en columna A es `PROCESO CREATIVO` o `PRODUCTION PLANNING`.
- **Fila header de subgrupo**: Fila cuya columna A contiene el nombre del subgrupo. No es una actividad; actúa como separador visual y semántico.
- **Actividad**: Fila de datos con nombre, cantidad de días y fechas calculadas. No incluye filas header de subgrupo.
- **Cascada inversa**: Algoritmo que, dada una Fecha Fin ancla, calcula las fechas de cada actividad hacia atrás (de abajo hacia arriba).
- **Cascada normal**: Algoritmo que, dada una Fecha Inicio ancla, calcula las fechas de cada actividad hacia adelante (de arriba hacia abajo).
- **Días hábiles**: Días de lunes a viernes que no coinciden con ningún feriado de la lista de feriados activos.
- **Feriado**: Fecha cargada en la hoja "Feriados" para el o los países seleccionados en la hoja "Instrucciones".
- **Ancla**: Fecha de referencia desde la cual parte el cálculo de una cascada.
- **cascadaInversaSubgrupos**: Función de `GanttLib` que ejecuta la cascada inversa independientemente sobre cada subgrupo detectado.
- **cascadaNormalSubgrupos**: Función de `GanttLib` que ejecuta la cascada normal independientemente sobre cada subgrupo detectado.
- **obtenerLimitesSubgrupos**: Función auxiliar de `GanttLib` que detecta y devuelve los rangos de filas de cada subgrupo, excluyendo las filas header.
- **Toast**: Notificación emergente no bloqueante que muestra `SpreadsheetApp.getActiveSpreadsheet().toast(...)`.

---

## Requerimientos

### Requerimiento 1: Detección de subgrupos en la hoja de entrada

**User Story:** Como sistema, necesito identificar los subgrupos presentes en "Entrada Proceso Creativo", para poder acotar el rango de filas sobre el que opera cada cascada por etapa.

#### Criterios de aceptación

1. THE `obtenerLimitesSubgrupos` SHALL recorrer todas las filas de la columna A de "Entrada Proceso Creativo" y detectar como fila header de subgrupo toda fila cuyo valor en A sea exactamente `PROCESO CREATIVO` o `PRODUCTION PLANNING` (comparación sin distinción de mayúsculas/minúsculas ni espacios extremos).
2. THE `obtenerLimitesSubgrupos` SHALL devolver un array de objetos con estructura `{ nombre, filaInicio, filaFin }`, donde `filaInicio` es la fila inmediatamente siguiente a la fila header del subgrupo (excluyendo el header) y `filaFin` es la fila anterior a la fila header del subgrupo siguiente o, para el último subgrupo, la última fila con datos.
3. IF ninguna fila de la hoja coincide con los nombres de subgrupo conocidos, THEN THE `obtenerLimitesSubgrupos` SHALL devolver un array vacío.
4. THE `obtenerLimitesSubgrupos` SHALL excluir la fila header de subgrupo del rango de actividades, de modo que las cascadas nunca intenten procesar esa fila como si fuera una actividad.
5. WHEN un subgrupo no tiene filas de actividad entre su fila header y el límite siguiente, THE `obtenerLimitesSubgrupos` SHALL omitir ese subgrupo del array resultante.

---

### Requerimiento 2: Cascada inversa por etapa

**User Story:** Como usuaria del sistema, quiero ejecutar la cascada inversa de forma independiente sobre cada etapa (subgrupo), para que cada etapa tome como ancla su propia Fecha Fin y no la de toda la tabla.

#### Criterios de aceptación

1. WHEN la usuaria selecciona "⬆️ Cascada inversa por etapa" en el menú, THE `cascadaInversaSubgrupos` SHALL obtener los subgrupos mediante `obtenerLimitesSubgrupos` y ejecutar la cascada inversa de forma independiente para cada uno.
2. WHEN se procesa un subgrupo con cascada inversa, THE `cascadaInversaSubgrupos` SHALL tomar como ancla la Fecha Fin de la última actividad con datos dentro de ese subgrupo (no de toda la tabla).
3. WHEN se procesa un subgrupo con cascada inversa, THE `cascadaInversaSubgrupos` SHALL calcular las fechas únicamente dentro del rango de filas de ese subgrupo (entre `filaInicio` y `filaFin`), sin modificar filas de otros subgrupos.
4. THE `cascadaInversaSubgrupos` SHALL calcular los días hábiles con la misma lógica que `cascadaInversa` (excluyendo fines de semana y feriados activos), usando `restarDiasHabiles` y `diaHabilAnterior`.
5. IF la hoja "Entrada Proceso Creativo" no existe, THEN THE `cascadaInversaSubgrupos` SHALL mostrar una alerta con el mensaje de error y no modificar ninguna hoja.
6. IF no se detectan subgrupos válidos, THEN THE `cascadaInversaSubgrupos` SHALL mostrar una alerta indicando que no se encontraron subgrupos y no modificar ninguna hoja.
7. IF un subgrupo no tiene Fecha Fin en su última actividad, THEN THE `cascadaInversaSubgrupos` SHALL omitir ese subgrupo, registrar una advertencia descriptiva con el nombre del subgrupo y el número de fila, y continuar procesando los demás subgrupos.
8. WHEN al menos un subgrupo fue procesado correctamente, THE `cascadaInversaSubgrupos` SHALL aplicar formato `dd/MM/yyyy` a todas las fechas de la hoja via `formatearFechasCreativo`, re-evaluar superposiciones via `marcarSuperposicionEntrada`, y mostrar un toast con la cantidad de subgrupos procesados y cualquier advertencia pendiente.

---

### Requerimiento 3: Cascada normal por etapa

**User Story:** Como usuaria del sistema, quiero ejecutar la cascada normal de forma independiente sobre cada etapa (subgrupo), para que cada etapa tome como ancla su propia Fecha Inicio y no la de toda la tabla.

#### Criterios de aceptación

1. WHEN la usuaria selecciona "⬇️ Cascada normal por etapa" en el menú, THE `cascadaNormalSubgrupos` SHALL obtener los subgrupos mediante `obtenerLimitesSubgrupos` y ejecutar la cascada normal de forma independiente para cada uno.
2. WHEN se procesa un subgrupo con cascada normal, THE `cascadaNormalSubgrupos` SHALL tomar como ancla la Fecha Inicio de la primera actividad con datos dentro de ese subgrupo (no de toda la tabla).
3. WHEN se procesa un subgrupo con cascada normal, THE `cascadaNormalSubgrupos` SHALL calcular las fechas únicamente dentro del rango de filas de ese subgrupo, sin modificar filas de otros subgrupos.
4. WHEN la Fecha Inicio ancla de un subgrupo cae en fin de semana o feriado, THE `cascadaNormalSubgrupos` SHALL ajustar esa fecha al siguiente día hábil antes de iniciar el cálculo, utilizando `siguienteDiaHabil`.
5. THE `cascadaNormalSubgrupos` SHALL calcular los días hábiles con la misma lógica que `cascadaNormal` (excluyendo fines de semana y feriados activos), usando `sumarDiasHabiles` y `siguienteDiaHabil`.
6. IF la hoja "Entrada Proceso Creativo" no existe, THEN THE `cascadaNormalSubgrupos` SHALL mostrar una alerta con el mensaje de error y no modificar ninguna hoja.
7. IF no se detectan subgrupos válidos, THEN THE `cascadaNormalSubgrupos` SHALL mostrar una alerta indicando que no se encontraron subgrupos y no modificar ninguna hoja.
8. IF un subgrupo no tiene Fecha Inicio en su primera actividad, THEN THE `cascadaNormalSubgrupos` SHALL omitir ese subgrupo, registrar una advertencia descriptiva con el nombre del subgrupo y el número de fila, y continuar procesando los demás subgrupos.
9. WHEN al menos un subgrupo fue procesado correctamente, THE `cascadaNormalSubgrupos` SHALL aplicar formato `dd/MM/yyyy`, re-evaluar superposiciones, y mostrar un toast con la cantidad de subgrupos procesados y cualquier advertencia pendiente.

---

### Requerimiento 4: Integración en el menú del Wrapper

**User Story:** Como usuaria del sistema, quiero que las nuevas cascadas por etapa aparezcan en el menú "🤖 Agente" del Wrapper, para poder ejecutarlas desde la interfaz de Google Sheets sin escribir código.

#### Criterios de aceptación

1. THE `Wrapper_Gantt_v2` SHALL exponer las funciones `cascadaInversaSubgrupos` y `cascadaNormalSubgrupos` como wrappers que deleguen directamente en `GanttLib.cascadaInversaSubgrupos()` y `GanttLib.cascadaNormalSubgrupos()` respectivamente.
2. THE `onOpen` del `Wrapper_Gantt_v2` SHALL incluir en el menú "🤖 Agente" las entradas "⬆️ Cascada inversa por etapa" y "⬇️ Cascada normal por etapa", ubicadas en una sección separada (con `addSeparator`) entre las cascadas globales y la opción "Generar Gantt".
3. THE `onOpen` del `Wrapper_Gantt_v2` SHALL construir el menú una única vez, sin entradas duplicadas.
4. WHEN la usuaria hace clic en "⬆️ Cascada inversa por etapa", THE `Wrapper_Gantt_v2` SHALL invocar `GanttLib.cascadaInversaSubgrupos()` con los permisos del trigger instalable.
5. WHEN la usuaria hace clic en "⬇️ Cascada normal por etapa", THE `Wrapper_Gantt_v2` SHALL invocar `GanttLib.cascadaNormalSubgrupos()` con los permisos del trigger instalable.

---

### Requerimiento 5: Independencia entre subgrupos

**User Story:** Como usuaria del sistema, quiero que la ejecución de una cascada por etapa sobre un subgrupo no altere las fechas de los demás subgrupos, para poder planificar cada etapa con sus propias fechas ancla sin interferir con las otras.

#### Criterios de aceptación

1. WHEN `cascadaInversaSubgrupos` procesa el subgrupo "PROCESO CREATIVO", THE `cascadaInversaSubgrupos` SHALL modificar únicamente las fechas de las filas pertenecientes a ese subgrupo, dejando intactas las fechas de "PRODUCTION PLANNING" y de cualquier otro subgrupo.
2. WHEN `cascadaNormalSubgrupos` procesa el subgrupo "PRODUCTION PLANNING", THE `cascadaNormalSubgrupos` SHALL modificar únicamente las fechas de las filas pertenecientes a ese subgrupo, dejando intactas las fechas de "PROCESO CREATIVO" y de cualquier otro subgrupo.
3. THE `cascadaInversaSubgrupos` SHALL NOT modificar la fila header de ningún subgrupo (filas con valor `PROCESO CREATIVO` o `PRODUCTION PLANNING` en columna A).
4. THE `cascadaNormalSubgrupos` SHALL NOT modificar la fila header de ningún subgrupo.

---

### Requerimiento 6: Consistencia con la lógica de días hábiles existente

**User Story:** Como usuaria del sistema, quiero que el cálculo de días hábiles en las cascadas por etapa sea idéntico al de las cascadas globales, para que los resultados sean predecibles y coherentes con el comportamiento conocido del sistema.

#### Criterios de aceptación

1. THE `cascadaInversaSubgrupos` SHALL utilizar las funciones `restarDiasHabiles`, `diaHabilAnterior` y `obtenerFeriados` de `GanttLib`, con la misma semántica que `cascadaInversa`.
2. THE `cascadaNormalSubgrupos` SHALL utilizar las funciones `sumarDiasHabiles`, `siguienteDiaHabil` y `obtenerFeriados` de `GanttLib`, con la misma semántica que `cascadaNormal`.
3. WHEN una actividad tiene 0 o un valor no numérico en la columna Días, THE sistema SHALL tratar ese valor como 1 día hábil, igual que lo hacen las cascadas globales.
4. WHEN una actividad tiene la columna A vacía, THE sistema SHALL saltear esa fila sin modificarla, igual que lo hacen las cascadas globales.
