# Documento de Diseño Técnico — `cascadas-por-etapa`

## Overview

El feature agrega al sistema Gantt automático la capacidad de ejecutar cascadas
(inversa y normal) de forma **independiente por subgrupo (etapa)** dentro de la
hoja "Entrada Proceso Creativo".

Hasta la versión 2.13 las dos cascadas globales (`cascadaInversa` /
`cascadaNormal`) operaban sobre toda la tabla como una unidad: el ancla era
siempre la primera o la última actividad de la tabla completa. Esto impedía que
cada etapa —PROCESO CREATIVO y PRODUCTION PLANNING— tuviera su propio ancla de
fecha sin perturbar la otra.

La solución añade tres elementos al proyecto:

1. **`obtenerLimitesSubgrupos(hoja)`** — función auxiliar que detecta los rangos
   de filas de cada subgrupo, excluyendo las filas header.
2. **`cascadaInversaSubgrupos()`** — ejecuta la lógica de `cascadaInversa` de
   forma acotada e independiente sobre cada subgrupo.
3. **`cascadaNormalSubgrupos()`** — ejecuta la lógica de `cascadaNormal` de
   forma acotada e independiente sobre cada subgrupo.

Ambas nuevas funciones de cascada se exponen en el menú "🤖 Agente" mediante
dos nuevas entradas en el `Wrapper_Gantt_v2.gs`.

---

## Architecture

El sistema mantiene una separación estricta en dos capas:

```
┌─────────────────────────────────────────────────────────┐
│  Spreadsheet cliente (Google Sheets)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Wrapper_Gantt_v2.gs                              │  │
│  │  - onOpen()  → construye menú localmente          │  │
│  │  - cascadaInversaSubgrupos()  → GanttLib.…()      │  │
│  │  - cascadaNormalSubgrupos()   → GanttLib.…()      │  │
│  └─────────────────┬─────────────────────────────────┘  │
└────────────────────│────────────────────────────────────┘
                     │  calls GanttLib.<fn>()
                     ▼
┌─────────────────────────────────────────────────────────┐
│  GanttLib (Code_v2.14.gs — proyecto central)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │  obtenerLimitesSubgrupos(hoja)                    │  │
│  │  cascadaInversaSubgrupos()                        │  │
│  │  cascadaNormalSubgrupos()                         │  │
│  │  ── reusan ──                                     │  │
│  │  restarDiasHabiles / sumarDiasHabiles             │  │
│  │  diaHabilAnterior  / siguienteDiaHabil            │  │
│  │  obtenerFeriados                                  │  │
│  │  formatearFechasCreativo                          │  │
│  │  marcarSuperposicionEntrada                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Decisiones arquitectónicas clave:**

- Toda la lógica de negocio vive en GanttLib. El wrapper es solo delegación.
- El menú en `Wrapper_Gantt_v2.gs` se construye localmente en `onOpen` (sin
  llamar a la librería) para evitar errores de autorización en triggers simples.
- Las nuevas funciones reutilizan completamente las primitivas de días hábiles
  existentes; no duplican lógica de calendario.
- El estado de la hoja (formato, marcas de superposición) se actualiza
  idénticamente a las cascadas globales al finalizar cada ejecución exitosa.

---

## Components and Interfaces

### `obtenerLimitesSubgrupos(hoja: Sheet): SubgrupoLimite[]`

**Archivo:** `Code_v2.14.gs` (GanttLib)

**Propósito:** detectar los subgrupos presentes en la hoja y devolver sus
límites de fila para que las cascadas puedan operar de forma acotada.

**Firma:**
```javascript
/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @returns {Array<{nombre: string, filaInicio: number, filaFin: number}>}
 */
function obtenerLimitesSubgrupos(hoja)
```

**Algoritmo:**
1. Leer columna A completa de la hoja (filas 1..ultimaFila).
2. Por cada celda: normalizar a uppercase+trim; si coincide con
   `'PROCESO CREATIVO'` o `'PRODUCTION PLANNING'`, registrar como header de
   subgrupo con su número de fila.
3. Para cada header detectado:
   - `filaInicio = filaHeader + 1`
   - `filaFin = filaHeader_siguiente - 1` (o `ultimaFila` para el último)
4. Si `filaInicio > filaFin`, omitir ese subgrupo (sin actividades).
5. Devolver el array resultante (vacío si no se detectaron headers).

**Tipo de retorno:**
```javascript
// SubgrupoLimite
{
  nombre: string,      // valor original de la celda ("PROCESO CREATIVO")
  filaInicio: number,  // primera fila de actividades (1-indexed, ≥ 2)
  filaFin: number      // última fila de actividades (1-indexed)
}
```

---

### `cascadaInversaSubgrupos(): void`

**Archivo:** `Code_v2.14.gs` (GanttLib)

**Propósito:** ejecutar la cascada inversa de forma independiente sobre cada
subgrupo detectado por `obtenerLimitesSubgrupos`.

**Firma:**
```javascript
function cascadaInversaSubgrupos()
```

**Flujo de datos:**

```
cascadaInversaSubgrupos()
  │
  ├─ ss = SpreadsheetApp.getActiveSpreadsheet()
  ├─ hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO)
  ├─ feriados = obtenerFeriados()
  │
  ├─ [guard] hoja no existe → alert + return
  │
  ├─ subgrupos = obtenerLimitesSubgrupos(hoja)
  ├─ [guard] subgrupos.length === 0 → alert + return
  │
  ├─ verificarHeadersCreativo(hoja)
  │
  └─ para cada subgrupo sg:
       ├─ buscar ultimaFilaConActividad (de sg.filaFin hacia sg.filaInicio)
       ├─ [si no hay actividad] → continue
       ├─ fechaFinUltima = hoja.getRange(ultimaFilaConActividad, 4).getValue()
       ├─ [si no es Date válida] → push advertencia + continue
       │
       └─ para fila = ultimaFilaConActividad downTo sg.filaInicio:
            ├─ [si col A vacía] → continue
            ├─ dias = parseInt(B) || 1
            ├─ fechaFin = fechaFinActual
            ├─ fechaInicio = restarDiasHabiles(fechaFin, dias-1, feriados)
            ├─ hoja.setRange(fila, 3) = fechaInicio
            ├─ hoja.setRange(fila, 4) = fechaFin
            └─ fechaFinActual = diaHabilAnterior(fechaInicio, feriados)

  formatearFechasCreativo()
  marcarSuperposicionEntrada(hoja)
  toast(msg con contador de subgrupos procesados + advertencias)
```

**Postcondición:** para cada subgrupo procesado, la Fecha Fin de la última
actividad es idéntica al ancla original; todas las fechas están en días hábiles;
las filas de otros subgrupos no han sido modificadas.

---

### `cascadaNormalSubgrupos(): void`

**Archivo:** `Code_v2.14.gs` (GanttLib)

**Propósito:** ejecutar la cascada normal de forma independiente sobre cada
subgrupo detectado por `obtenerLimitesSubgrupos`.

**Firma:**
```javascript
function cascadaNormalSubgrupos()
```

**Flujo de datos:**

```
cascadaNormalSubgrupos()
  │
  ├─ ss, hoja, feriados  (igual que cascadaInversaSubgrupos)
  ├─ [guards idénticos]
  │
  └─ para cada subgrupo sg:
       ├─ buscar primeraFilaConActividad (de sg.filaInicio hacia sg.filaFin)
       ├─ [si no hay actividad] → continue
       ├─ fechaInicioPrimera = hoja.getRange(primeraFilaConActividad, 3).getValue()
       ├─ [si no es Date válida] → push advertencia + continue
       │
       ├─ si !esDiaHabil(fechaInicioPrimera) → ajustar a siguienteDiaHabil
       │    (y actualizar la celda C de la primera actividad)
       │
       └─ para fila = primeraFilaConActividad to sg.filaFin:
            ├─ [si col A vacía] → continue
            ├─ dias = parseInt(B) || 1
            ├─ fechaInicio = fechaInicioActual
            ├─ fechaFin = sumarDiasHabiles(fechaInicio, dias-1, feriados)
            ├─ hoja.setRange(fila, 3) = fechaInicio
            ├─ hoja.setRange(fila, 4) = fechaFin
            └─ fechaInicioActual = siguienteDiaHabil(fechaFin, feriados)

  formatearFechasCreativo()
  marcarSuperposicionEntrada(hoja)
  toast(msg con contador de subgrupos procesados + advertencias)
```

**Postcondición:** para cada subgrupo procesado, la Fecha Inicio de la primera
actividad es el ancla original (o el siguiente día hábil si el ancla era no
hábil); todas las fechas están en días hábiles; las filas de otros subgrupos no
han sido modificadas.

---

### Wrappers en `Wrapper_Gantt_v2.gs`

```javascript
// Delegación directa a GanttLib
function cascadaInversaSubgrupos() { GanttLib.cascadaInversaSubgrupos(); }
function cascadaNormalSubgrupos()  { GanttLib.cascadaNormalSubgrupos();  }
```

### `onOpen()` en `Wrapper_Gantt_v2.gs`

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤖 Agente')
    .addItem('⬆️ Cascada inversa (desde fecha fin última)',    'cascadaInversa')
    .addItem('⬇️ Cascada normal (desde fecha inicio primera)', 'cascadaNormal')
    .addItem('✏️ Ajustar desde fecha editada',                 'ajustarDesdeFechaEditada')
    .addSeparator()
    .addItem('⬆️ Cascada inversa por etapa', 'cascadaInversaSubgrupos')  // NUEVO
    .addItem('⬇️ Cascada normal por etapa',  'cascadaNormalSubgrupos')   // NUEVO
    .addSeparator()
    .addItem('📊 Generar Gantt en este documento', 'generarGantt')
    .addItem('📤 Copiar Gantt a Cliente',          'copiarGanttACliente')
    .addSeparator()
    .addItem('⚙️ Instalar trigger automático', 'instalarTriggerAutomatico')
    .addToUi();
}
```

Las dos entradas nuevas están en una sección propia, separadas de las cascadas
globales y del bloque de Gantt por `addSeparator()`.

---

## Data Models

### Estructura interna: `SubgrupoLimite`

```javascript
{
  nombre:     string,  // e.g. "PROCESO CREATIVO" o "PRODUCTION PLANNING"
  filaInicio: number,  // fila 1-indexed de la primera actividad del subgrupo
  filaFin:    number   // fila 1-indexed de la última actividad del subgrupo
}
```

Esta estructura es efímera: se construye en memoria dentro de
`obtenerLimitesSubgrupos` y se consume en el mismo ciclo de ejecución de
`cascadaInversaSubgrupos` / `cascadaNormalSubgrupos`. No se persiste en la hoja.

### Hoja de entrada: `Entrada Proceso Creativo`

| Col | Nombre       | Tipo                  | Notas                                  |
|-----|--------------|-----------------------|----------------------------------------|
| A   | Actividad    | `string`              | Vacío → fila ignorada por las cascadas |
| B   | Días         | `number`              | ≤ 0 o no numérico → tratado como 1    |
| C   | Fecha Inicio | `Date` (dd/MM/yyyy)   | Escritura por las cascadas             |
| D   | Fecha Fin    | `Date` (dd/MM/yyyy)   | Escritura por las cascadas             |

**Filas header de subgrupo:** fila cuya columna A es `PROCESO CREATIVO` o
`PRODUCTION PLANNING` (case-insensitive + trim). Nunca se modifican por las
cascadas.

### Estructura de la tabla en la hoja (ejemplo ilustrativo)

```
Fila 1  | [headers: Actividad | Días | Fecha Inicio | Fecha Fin]
Fila 2  | PROCESO CREATIVO   |     |              |             ← header subgrupo 1
Fila 3  | Actividad A        | 3   | …            | …
Fila 4  | Actividad B        | 5   | …            | …           ← última de SG1
Fila 5  | PRODUCTION PLANNING|     |              |             ← header subgrupo 2
Fila 6  | Actividad C        | 2   | …            | …
Fila 7  | Actividad D        | 4   | …            | …           ← última de SG2

obtenerLimitesSubgrupos → [
  { nombre: "PROCESO CREATIVO",   filaInicio: 3, filaFin: 4 },
  { nombre: "PRODUCTION PLANNING", filaInicio: 6, filaFin: 7 }
]
```

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe ser verdadero en
todas las ejecuciones válidas del sistema — esencialmente, un enunciado formal
sobre lo que el software debe hacer. Las propiedades sirven de puente entre
especificaciones legibles por humanos y garantías de corrección verificables por
máquinas.*

---

### Property 1: Detección de headers es case/whitespace-insensitive

*Para cualquier* array de valores de columna A, toda fila cuyo valor sea
`PROCESO CREATIVO` o `PRODUCTION PLANNING` —independientemente de mayúsculas,
minúsculas y espacios extremos— debe ser detectada como header de subgrupo por
`obtenerLimitesSubgrupos`; ninguna fila con otro valor debe ser detectada como
header.

**Validates: Requirements 1.1**

---

### Property 2: Invariante de límites de subgrupo

*Para cualquier* tabla con uno o más headers de subgrupo, cada objeto
`SubgrupoLimite` devuelto por `obtenerLimitesSubgrupos` debe cumplir:

- `filaInicio = filaHeader + 1` (el header queda excluido del rango)
- `filaFin = filaHeader_siguiente - 1` para subgrupos intermedios, o
  `filaFin = ultimaFila` para el último subgrupo
- Si `filaInicio > filaFin` (subgrupo vacío), el subgrupo no aparece en el
  resultado

**Validates: Requirements 1.2, 1.4, 1.5**

---

### Property 3: cascadaInversaSubgrupos preserva el ancla por subgrupo

*Para cualquier* subgrupo con una Fecha Fin válida en su última actividad, tras
ejecutar `cascadaInversaSubgrupos`, la Fecha Fin de esa última actividad debe
ser igual al valor original del ancla.

**Validates: Requirements 2.2**

---

### Property 4: Aislamiento de subgrupos

*Para cualquier* tabla con dos o más subgrupos, ejecutar
`cascadaInversaSubgrupos` o `cascadaNormalSubgrupos` sobre esa tabla debe dejar
intactas —sin ninguna modificación— las fechas de todos los subgrupos que no
sean el objetivo de esa cascada en esa iteración. Igualmente, las filas header
de subgrupo (columna A = nombre del subgrupo) nunca deben ser modificadas por
ninguna de las dos cascadas.

**Validates: Requirements 2.3, 5.1, 5.2, 5.3, 5.4**

---

### Property 5: Equivalencia de cascadas por subgrupo con cascadas globales

*Para cualquier* tabla cuyo único subgrupo abarque todas las actividades (tabla
sin múltiples etapas):

- `cascadaInversaSubgrupos` debe producir resultados idénticos a
  `cascadaInversa` en una copia idéntica de la tabla.
- `cascadaNormalSubgrupos` debe producir resultados idénticos a `cascadaNormal`
  en una copia idéntica de la tabla.

**Validates: Requirements 2.4, 3.5, 6.1, 6.2**

---

### Property 6: Resiliencia ante anclas ausentes

*Para cualquier* tabla con una mezcla de subgrupos —algunos con ancla válida y
otros sin ella—, `cascadaInversaSubgrupos` y `cascadaNormalSubgrupos` deben
procesar correctamente todos los subgrupos con ancla válida, omitir los
subgrupos sin ancla (sin modificarlos), y registrar una advertencia por cada
subgrupo omitido.

**Validates: Requirements 2.7, 3.8**

---

### Property 7: cascadaNormalSubgrupos preserva el ancla por subgrupo

*Para cualquier* subgrupo con una Fecha Inicio válida en su primera actividad
(que sea un día hábil), tras ejecutar `cascadaNormalSubgrupos`, la Fecha Inicio
de esa primera actividad debe ser igual al valor original del ancla.

**Validates: Requirements 3.2**

---

### Property 8: Ajuste de ancla a día hábil en cascada normal

*Para cualquier* ancla de Fecha Inicio que caiga en fin de semana o en un día
feriado, `cascadaNormalSubgrupos` debe ajustar esa fecha al siguiente día hábil
antes de iniciar el cálculo, de modo que la Fecha Inicio resultante de la
primera actividad sea siempre un día hábil.

**Validates: Requirements 3.4**

---

### Property 9: Días inválidos tratados como 1

*Para cualquier* actividad cuya columna Días contenga el valor 0, un número
negativo, o un valor no numérico, ambas cascadas por subgrupo deben calcular las
fechas de esa actividad como si tuviera exactamente 1 día hábil (Fecha Fin =
Fecha Inicio para la cascada normal; Fecha Inicio = Fecha Fin para la inversa).

**Validates: Requirements 6.3**

---

### Property 10: Filas con columna A vacía no son modificadas

*Para cualquier* fila dentro del rango de un subgrupo cuya columna A esté vacía
(o contenga solo espacios), ambas cascadas deben dejar las columnas C y D de
esa fila exactamente iguales a como estaban antes de la ejecución.

**Validates: Requirements 6.4**

---

## Error Handling

| Condición de error | Función afectada | Respuesta |
|---|---|---|
| Hoja `CONFIG.HOJA_CREATIVO` no existe | `cascadaInversaSubgrupos`, `cascadaNormalSubgrupos` | `SpreadsheetApp.getUi().alert(msg)` + `return` sin modificar nada |
| No se detectan subgrupos válidos (`obtenerLimitesSubgrupos` devuelve `[]`) | Ambas | `alert(msg)` + `return` |
| Subgrupo sin Fecha Fin válida (cascada inversa) | `cascadaInversaSubgrupos` | El subgrupo se omite; se acumula advertencia en array `advertencias[]`; se continúa con el siguiente subgrupo |
| Subgrupo sin Fecha Inicio válida (cascada normal) | `cascadaNormalSubgrupos` | Idem |
| Todos los subgrupos fueron omitidos (0 procesados) | Ambas | El toast reporta "0 subgrupo(s) procesado(s)" y lista las advertencias; no se llama a `formatearFechasCreativo` ni `marcarSuperposicionEntrada` (no hubo escrituras) |
| Días = 0, negativo, o no numérico | Ambas | Tratado silenciosamente como `1`; no genera advertencia |
| Fila con columna A vacía dentro del subgrupo | Ambas | `continue` sin modificar la fila; no genera advertencia |

Las advertencias de subgrupos omitidos se muestran al final del toast de éxito,
concatenadas en el mensaje (no interrumpen el flujo con un `alert` bloqueante).

---

## Testing Strategy

### Herramienta de property-based testing

Para Apps Script (JavaScript), se recomienda usar **[fast-check](https://fast-check.dev/)** como librería de PBT, ejecutada en un entorno Node.js local (jest + clasp para CI, o directamente en Node para pruebas unitarias de la lógica pura extraída a módulos JS).

Cada test de propiedad debe ejecutarse con **mínimo 100 iteraciones**.

El tag de referencia en cada test sigue el formato:
`// Feature: cascadas-por-etapa, Property <N>: <texto>`

---

### Tests de propiedades (property-based)

Las propiedades 1–10 del documento se implementan como tests de PBT. Los
generadores necesarios son:

- **`genFilasHoja`**: genera un array de objetos `{ colA, dias, fechaInicio,
  fechaFin }` con valores aleatorios (incluyendo strings con casing mixto,
  espacios, valores nulos, números inválidos para días, fechas en fin de semana
  o feriado como anclas).
- **`genSubgrupoConActividades`**: genera una tabla con 1–3 headers de subgrupo
  en posiciones aleatorias, rodeados de 0–N filas de actividades.
- **`genFechaNoHabil`**: genera dates aleatorias que caen en sábado, domingo, o
  en la lista de feriados de prueba.
- **`genDiasInvalidos`**: genera valores como `0`, `-1`, `NaN`, `""`, `"abc"`.

```javascript
// Property 1 - Feature: cascadas-por-etapa, Property 1: detección case-insensitive
fc.assert(fc.property(
  genFilasConHeaders,
  (filas) => {
    const subgrupos = obtenerLimitesSubgruposLogica(filas);
    // Todos los headers detectados
    const headersEsperados = filas.filter(f => esHeaderSubgrupo(f.colA));
    return subgrupos.length === headersEsperados.filter(h => tieneActividades(h, filas)).length;
  }
), { numRuns: 100 });

// Property 2 - Feature: cascadas-por-etapa, Property 2: invariante de límites
fc.assert(fc.property(
  genSubgrupoConActividades,
  (tabla) => {
    const subgrupos = obtenerLimitesSubgruposLogica(tabla);
    return subgrupos.every((sg, i) => {
      const headerFila = tabla.headerFilas[i];
      const nextHeader = tabla.headerFilas[i + 1];
      return sg.filaInicio === headerFila + 1
          && sg.filaFin === (nextHeader ? nextHeader - 1 : tabla.length);
    });
  }
), { numRuns: 100 });
```

(Patterns similares para Properties 3–10.)

---

### Tests de ejemplos (example-based / unit tests)

- **Error: hoja ausente** — llamar `cascadaInversaSubgrupos` con hoja nula;
  verificar que se muestra alert y no se escribe nada.
- **Error: sin subgrupos** — tabla sin ningún header de subgrupo; verificar
  alert y estado inalterado.
- **Post-procesamiento** — tras una ejecución exitosa, verificar que:
  - las columnas C:D tienen formato `dd/MM/yyyy`
  - se llamó a `marcarSuperposicionEntrada`
  - el toast fue disparado
- **Menú** — verificar que `onOpen` construye el menú con exactamente las
  entradas esperadas, sin duplicados, con el separador en el lugar correcto.
- **Wrapper delegation** — verificar que `cascadaInversaSubgrupos()` del wrapper
  invoca `GanttLib.cascadaInversaSubgrupos()`.

---

### Balance entre unit tests y property tests

Los tests de unidad se enfocan en:
- Casos de error específicos (hoja ausente, sin subgrupos, ancla inválida)
- Verificación del menú y los wrappers
- Comportamiento de post-procesamiento (formato + toast)

Los tests de propiedad se enfocan en:
- Invariantes del algoritmo de detección de subgrupos
- Corrección del cálculo de fechas para cualquier combinación de días y anclas
- Aislamiento entre subgrupos con cualquier configuración de tabla
- Equivalencia con las cascadas globales existentes

Evitar duplicar en unit tests lo que ya está cubierto por los generadores de PBT.
