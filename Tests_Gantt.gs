/**
 * Tests_Gantt.gs — Tests para cascadas-por-etapa
 *
 * Framework minimalista + generadores aleatorios + property tests + unit tests.
 * Ejecutar desde el editor de Apps Script: seleccionar runAllTests() y "Ejecutar".
 * Resultados en Logger (Ver → Registros).
 *
 * Las funciones de lógica pura (obtenerLimitesSubgruposLogica, cascadaInversaLogica,
 * cascadaNormalLogica, cascadaInversaGlobalLogica, cascadaNormalGlobalLogica) están
 * definidas aquí sin dependencia de la Sheets API.
 */

// ============================================
// FRAMEWORK DE TESTS
// ============================================

var _testResults = [];
var _testsPassed = 0;
var _testsFailed = 0;

function _assert(condicion, msg) {
  if (!condicion) {
    throw new Error('ASSERT FAILED: ' + (msg || '(sin mensaje)'));
  }
}

function _assertEqual(a, b, msg) {
  if (a !== b) {
    throw new Error('ASSERT EQUAL FAILED: ' + (msg || '') +
      ' — esperado: ' + JSON.stringify(b) + ', recibido: ' + JSON.stringify(a));
  }
}

function _assertDatesEqual(a, b, msg) {
  var aTime = a ? a.getTime() : null;
  var bTime = b ? b.getTime() : null;
  if (aTime !== bTime) {
    throw new Error('ASSERT DATES EQUAL FAILED: ' + (msg || '') +
      ' — esperado: ' + (b ? b.toISOString() : 'null') +
      ', recibido: ' + (a ? a.toISOString() : 'null'));
  }
}

function _runTest(nombre, fn) {
  try {
    fn();
    _testsPassed++;
    _testResults.push('✅ ' + nombre);
  } catch (e) {
    _testsFailed++;
    _testResults.push('❌ ' + nombre + ' — ' + e.message);
  }
}

function _printResults(seccion) {
  Logger.log('\n═══════════════════════════════════════');
  Logger.log(seccion);
  Logger.log('═══════════════════════════════════════');
  for (var i = 0; i < _testResults.length; i++) {
    Logger.log(_testResults[i]);
  }
  Logger.log('\nTotal: ' + (_testsPassed + _testsFailed) +
    ' | Passed: ' + _testsPassed + ' | Failed: ' + _testsFailed);
  Logger.log('═══════════════════════════════════════\n');
}

function _resetResults() {
  _testResults = [];
  _testsPassed = 0;
  _testsFailed = 0;
}


// ============================================
// GENERADORES ALEATORIOS
// ============================================

function genCasingAleatorio(str) {
  var result = '';
  for (var i = 0; i < str.length; i++) {
    result += Math.random() > 0.5 ? str[i].toUpperCase() : str[i].toLowerCase();
  }
  return result;
}

function genEspaciosAleatorios(str) {
  var pre = '';
  var post = '';
  var n = Math.floor(Math.random() * 4);
  for (var i = 0; i < n; i++) pre += ' ';
  n = Math.floor(Math.random() * 4);
  for (var j = 0; j < n; j++) post += ' ';
  return pre + str + post;
}

function genFilasConHeaders(n) {
  var HEADERS = ['PROCESO CREATIVO', 'PRODUCTION PLANNING'];
  var filas = [];
  // Colocar 1-2 headers en posiciones aleatorias
  var numHeaders = 1 + Math.floor(Math.random() * 2); // 1 o 2
  var headerPositions = [];
  for (var h = 0; h < numHeaders; h++) {
    var pos = Math.floor(Math.random() * n);
    headerPositions.push(pos);
  }
  for (var i = 0; i < n; i++) {
    var esHeader = headerPositions.indexOf(i) !== -1;
    if (esHeader) {
      var headerBase = HEADERS[headerPositions.indexOf(i) % HEADERS.length];
      filas.push({ colA: genEspaciosAleatorios(genCasingAleatorio(headerBase)), dias: '', fechaInicio: null, fechaFin: null });
    } else {
      filas.push({ colA: 'Actividad ' + i, dias: 1 + Math.floor(Math.random() * 5), fechaInicio: null, fechaFin: null });
    }
  }
  return filas;
}

function genSubgrupoConActividades() {
  var HEADERS = ['PROCESO CREATIVO', 'PRODUCTION PLANNING'];
  var filas = [];
  var numHeaders = 1 + Math.floor(Math.random() * 2); // 1 o 2

  for (var h = 0; h < numHeaders; h++) {
    // Header row
    filas.push({ colA: genEspaciosAleatorios(genCasingAleatorio(HEADERS[h % HEADERS.length])), dias: '', fechaInicio: null, fechaFin: null });
    // 1-5 actividades
    var numAct = 1 + Math.floor(Math.random() * 5);
    for (var a = 0; a < numAct; a++) {
      var dias = 1 + Math.floor(Math.random() * 5);
      var baseDate = new Date(2025, 5, 2); // lunes 2 junio 2025
      filas.push({
        colA: 'Act_' + h + '_' + a,
        dias: dias,
        fechaInicio: new Date(baseDate.getTime() + a * 86400000 * 2),
        fechaFin: new Date(baseDate.getTime() + a * 86400000 * 2 + (dias - 1) * 86400000)
      });
    }
  }
  return filas;
}

function genFechaNoHabil() {
  // Genera una fecha que cae en sábado o domingo
  var base = new Date(2025, 0, 4); // sábado 4 enero 2025
  var semanas = Math.floor(Math.random() * 50);
  var esDomingo = Math.random() > 0.5;
  var fecha = new Date(base.getTime());
  fecha.setDate(fecha.getDate() + semanas * 7 + (esDomingo ? 1 : 0));
  return fecha;
}

function genDiasInvalidos() {
  var opciones = [0, -1, -5, NaN, '', 'abc'];
  return opciones[Math.floor(Math.random() * opciones.length)];
}

// ============================================
// LÓGICA PURA — FUNCIONES DE FECHA (copia de Code_v2.14.gs)
// ============================================

function _normalizarFecha(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

function _esFinDeSemana(fecha) {
  var dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

function _esFeriado(fecha, feriados) {
  var fechaNorm = _normalizarFecha(fecha);
  for (var i = 0; i < feriados.length; i++) {
    if (feriados[i] === fechaNorm) return true;
  }
  return false;
}

function _esDiaHabil(fecha, feriados) {
  return !_esFinDeSemana(fecha) && !_esFeriado(fecha, feriados);
}

function _siguienteDiaHabil(fecha, feriados) {
  var siguiente = new Date(fecha.getTime());
  siguiente.setDate(siguiente.getDate() + 1);
  while (!_esDiaHabil(siguiente, feriados)) {
    siguiente.setDate(siguiente.getDate() + 1);
  }
  return siguiente;
}

function _diaHabilAnterior(fecha, feriados) {
  var anterior = new Date(fecha.getTime());
  anterior.setDate(anterior.getDate() - 1);
  while (!_esDiaHabil(anterior, feriados)) {
    anterior.setDate(anterior.getDate() - 1);
  }
  return anterior;
}

function _sumarDiasHabiles(fechaInicio, diasHabiles, feriados) {
  var fecha = new Date(fechaInicio.getTime());
  var diasAgregados = 0;
  if (diasHabiles === 0) return fecha;
  while (diasAgregados < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1);
    if (_esDiaHabil(fecha, feriados)) {
      diasAgregados++;
    }
  }
  return fecha;
}

function _restarDiasHabiles(fechaFin, diasHabiles, feriados) {
  var fecha = new Date(fechaFin.getTime());
  var diasRestados = 0;
  if (diasHabiles === 0) return fecha;
  while (diasRestados < diasHabiles) {
    fecha.setDate(fecha.getDate() - 1);
    if (_esDiaHabil(fecha, feriados)) {
      diasRestados++;
    }
  }
  return fecha;
}


// ============================================
// LÓGICA PURA — DETECCIÓN DE SUBGRUPOS
// ============================================

var _HEADERS_SUBGRUPO = ['PROCESO CREATIVO', 'PRODUCTION PLANNING'];

function _esHeaderSubgrupo(valor) {
  if (!valor) return false;
  var norm = valor.toString().toUpperCase().trim();
  return _HEADERS_SUBGRUPO.indexOf(norm) !== -1;
}

/**
 * Versión pura de obtenerLimitesSubgrupos.
 * @param {Array<{colA: string}>} filas - 0-indexed (index 0 = fila 1 de la hoja)
 * @returns {Array<{nombre: string, filaInicio: number, filaFin: number}>} - 1-indexed
 */
function obtenerLimitesSubgruposLogica(filas) {
  var headerFilas = [];
  for (var i = 0; i < filas.length; i++) {
    var val = filas[i].colA ? filas[i].colA.toString().toUpperCase().trim() : '';
    if (_HEADERS_SUBGRUPO.indexOf(val) !== -1) {
      headerFilas.push({ nombre: filas[i].colA.toString().trim(), fila: i + 1 });
    }
  }
  if (headerFilas.length === 0) return [];

  var ultimaFila = filas.length;
  var subgrupos = [];
  for (var j = 0; j < headerFilas.length; j++) {
    var filaInicio = headerFilas[j].fila + 1;
    var filaFin = (j + 1 < headerFilas.length) ? headerFilas[j + 1].fila - 1 : ultimaFila;
    if (filaInicio <= filaFin) {
      subgrupos.push({ nombre: headerFilas[j].nombre, filaInicio: filaInicio, filaFin: filaFin });
    }
  }
  return subgrupos;
}

// ============================================
// LÓGICA PURA — CASCADA INVERSA POR SUBGRUPOS
// ============================================

/**
 * @param {Array} subgrupos - de obtenerLimitesSubgruposLogica
 * @param {Array<{colA: string, dias: any, fechaInicio: Date|null, fechaFin: Date|null}>} filas - 0-indexed
 * @param {number[]} feriados
 * @returns {{procesados: number, advertencias: string[], filas: Array}}
 */
function cascadaInversaLogica(subgrupos, filas, feriados) {
  var filasOut = [];
  for (var k = 0; k < filas.length; k++) {
    filasOut.push({
      colA: filas[k].colA,
      dias: filas[k].dias,
      fechaInicio: filas[k].fechaInicio ? new Date(filas[k].fechaInicio.getTime()) : null,
      fechaFin: filas[k].fechaFin ? new Date(filas[k].fechaFin.getTime()) : null
    });
  }

  var subgruposProcesados = 0;
  var advertencias = [];

  for (var s = 0; s < subgrupos.length; s++) {
    var sg = subgrupos[s];
    var ultimaFilaConActividad = -1;
    for (var f = sg.filaFin; f >= sg.filaInicio; f--) {
      var act = filasOut[f - 1].colA;
      if (act && act.toString().trim() !== '') {
        ultimaFilaConActividad = f;
        break;
      }
    }
    if (ultimaFilaConActividad === -1) continue;

    var fechaFinUltima = filasOut[ultimaFilaConActividad - 1].fechaFin;
    if (!fechaFinUltima || !(fechaFinUltima instanceof Date)) {
      advertencias.push('Subgrupo "' + sg.nombre + '": no tiene Fecha Fin en la última actividad (fila ' + ultimaFilaConActividad + '). Se omitió.');
      continue;
    }

    var fechaFinActual = new Date(fechaFinUltima.getTime());
    for (var fila = ultimaFilaConActividad; fila >= sg.filaInicio; fila--) {
      var actividad = filasOut[fila - 1].colA;
      var dias = filasOut[fila - 1].dias;
      if (!actividad || actividad.toString().trim() === '') continue;

      dias = parseInt(dias);
      if (isNaN(dias) || dias < 1) dias = 1;

      var fechaFin = new Date(fechaFinActual.getTime());
      var fechaInicio = _restarDiasHabiles(fechaFin, dias - 1, feriados);

      filasOut[fila - 1].fechaInicio = fechaInicio;
      filasOut[fila - 1].fechaFin = fechaFin;

      fechaFinActual = _diaHabilAnterior(fechaInicio, feriados);
    }
    subgruposProcesados++;
  }

  return { procesados: subgruposProcesados, advertencias: advertencias, filas: filasOut };
}

// ============================================
// LÓGICA PURA — CASCADA NORMAL POR SUBGRUPOS
// ============================================

/**
 * @param {Array} subgrupos
 * @param {Array<{colA: string, dias: any, fechaInicio: Date|null, fechaFin: Date|null}>} filas - 0-indexed
 * @param {number[]} feriados
 * @returns {{procesados: number, advertencias: string[], filas: Array}}
 */
function cascadaNormalLogica(subgrupos, filas, feriados) {
  var filasOut = [];
  for (var k = 0; k < filas.length; k++) {
    filasOut.push({
      colA: filas[k].colA,
      dias: filas[k].dias,
      fechaInicio: filas[k].fechaInicio ? new Date(filas[k].fechaInicio.getTime()) : null,
      fechaFin: filas[k].fechaFin ? new Date(filas[k].fechaFin.getTime()) : null
    });
  }

  var subgruposProcesados = 0;
  var advertencias = [];

  for (var s = 0; s < subgrupos.length; s++) {
    var sg = subgrupos[s];
    var primeraFilaConActividad = -1;
    for (var f = sg.filaInicio; f <= sg.filaFin; f++) {
      var act = filasOut[f - 1].colA;
      if (act && act.toString().trim() !== '') {
        primeraFilaConActividad = f;
        break;
      }
    }
    if (primeraFilaConActividad === -1) continue;

    var fechaInicioPrimera = filasOut[primeraFilaConActividad - 1].fechaInicio;
    if (!fechaInicioPrimera || !(fechaInicioPrimera instanceof Date)) {
      advertencias.push('Subgrupo "' + sg.nombre + '": no tiene Fecha Inicio en la primera actividad (fila ' + primeraFilaConActividad + '). Se omitió.');
      continue;
    }

    var fechaInicioActual = new Date(fechaInicioPrimera.getTime());
    if (!_esDiaHabil(fechaInicioActual, feriados)) {
      fechaInicioActual = _siguienteDiaHabil(fechaInicioActual, feriados);
      filasOut[primeraFilaConActividad - 1].fechaInicio = new Date(fechaInicioActual.getTime());
    }

    for (var fila = primeraFilaConActividad; fila <= sg.filaFin; fila++) {
      var actividad = filasOut[fila - 1].colA;
      var dias = filasOut[fila - 1].dias;
      if (!actividad || actividad.toString().trim() === '') continue;

      dias = parseInt(dias);
      if (isNaN(dias) || dias < 1) dias = 1;

      var fechaInicio = new Date(fechaInicioActual.getTime());
      var fechaFin = _sumarDiasHabiles(fechaInicio, dias - 1, feriados);

      filasOut[fila - 1].fechaInicio = fechaInicio;
      filasOut[fila - 1].fechaFin = fechaFin;

      fechaInicioActual = _siguienteDiaHabil(fechaFin, feriados);
    }
    subgruposProcesados++;
  }

  return { procesados: subgruposProcesados, advertencias: advertencias, filas: filasOut };
}

// ============================================
// LÓGICA PURA — CASCADAS GLOBALES (para Property 5)
// ============================================

function cascadaInversaGlobalLogica(filas, feriados) {
  var filasOut = [];
  for (var k = 0; k < filas.length; k++) {
    filasOut.push({
      colA: filas[k].colA,
      dias: filas[k].dias,
      fechaInicio: filas[k].fechaInicio ? new Date(filas[k].fechaInicio.getTime()) : null,
      fechaFin: filas[k].fechaFin ? new Date(filas[k].fechaFin.getTime()) : null
    });
  }

  // Buscar última fila con actividad
  var ultimaFila = -1;
  for (var i = filasOut.length - 1; i >= 0; i--) {
    if (filasOut[i].colA && filasOut[i].colA.toString().trim() !== '' && !_esHeaderSubgrupo(filasOut[i].colA)) {
      ultimaFila = i;
      break;
    }
  }
  if (ultimaFila === -1) return { filas: filasOut };

  var fechaFinUltima = filasOut[ultimaFila].fechaFin;
  if (!fechaFinUltima || !(fechaFinUltima instanceof Date)) return { filas: filasOut };

  var fechaFinActual = new Date(fechaFinUltima.getTime());
  for (var fila = ultimaFila; fila >= 0; fila--) {
    var actividad = filasOut[fila].colA;
    if (!actividad || actividad.toString().trim() === '' || _esHeaderSubgrupo(actividad)) continue;

    var dias = parseInt(filasOut[fila].dias);
    if (isNaN(dias) || dias < 1) dias = 1;

    var fechaFin = new Date(fechaFinActual.getTime());
    var fechaInicio = _restarDiasHabiles(fechaFin, dias - 1, feriados);

    filasOut[fila].fechaInicio = fechaInicio;
    filasOut[fila].fechaFin = fechaFin;
    fechaFinActual = _diaHabilAnterior(fechaInicio, feriados);
  }
  return { filas: filasOut };
}

function cascadaNormalGlobalLogica(filas, feriados) {
  var filasOut = [];
  for (var k = 0; k < filas.length; k++) {
    filasOut.push({
      colA: filas[k].colA,
      dias: filas[k].dias,
      fechaInicio: filas[k].fechaInicio ? new Date(filas[k].fechaInicio.getTime()) : null,
      fechaFin: filas[k].fechaFin ? new Date(filas[k].fechaFin.getTime()) : null
    });
  }

  // Buscar primera fila con actividad
  var primeraFila = -1;
  for (var i = 0; i < filasOut.length; i++) {
    if (filasOut[i].colA && filasOut[i].colA.toString().trim() !== '' && !_esHeaderSubgrupo(filasOut[i].colA)) {
      primeraFila = i;
      break;
    }
  }
  if (primeraFila === -1) return { filas: filasOut };

  var fechaInicioPrimera = filasOut[primeraFila].fechaInicio;
  if (!fechaInicioPrimera || !(fechaInicioPrimera instanceof Date)) return { filas: filasOut };

  var fechaInicioActual = new Date(fechaInicioPrimera.getTime());
  if (!_esDiaHabil(fechaInicioActual, feriados)) {
    fechaInicioActual = _siguienteDiaHabil(fechaInicioActual, feriados);
    filasOut[primeraFila].fechaInicio = new Date(fechaInicioActual.getTime());
  }

  for (var fila = primeraFila; fila < filasOut.length; fila++) {
    var actividad = filasOut[fila].colA;
    if (!actividad || actividad.toString().trim() === '' || _esHeaderSubgrupo(actividad)) continue;

    var dias = parseInt(filasOut[fila].dias);
    if (isNaN(dias) || dias < 1) dias = 1;

    var fechaInicio = new Date(fechaInicioActual.getTime());
    var fechaFin = _sumarDiasHabiles(fechaInicio, dias - 1, feriados);

    filasOut[fila].fechaInicio = fechaInicio;
    filasOut[fila].fechaFin = fechaFin;
    fechaInicioActual = _siguienteDiaHabil(fechaFin, feriados);
  }
  return { filas: filasOut };
}


// ============================================
// PROPERTY TESTS
// ============================================

function runPropertyTests() {
  _resetResults();

  // Feature: cascadas-por-etapa, Property 1
  _runTest('Property 1 — Detección case/whitespace-insensitive de headers', function() {
    var HEADERS_BASE = ['PROCESO CREATIVO', 'PRODUCTION PLANNING'];
    // 100 variantes que SÍ son headers
    for (var i = 0; i < 100; i++) {
      var base = HEADERS_BASE[i % 2];
      var variante = genEspaciosAleatorios(genCasingAleatorio(base));
      _assert(_esHeaderSubgrupo(variante),
        'Debería detectar como header: "' + variante + '"');
    }
    // 100 strings que NO son headers
    var noHeaders = ['Actividad A', 'PROCESO', 'PLANNING', 'PRODUCTION', 'CREATIVO',
      'proceso creativo extra', 'production planning 2', '', '  ', 'BRIEF',
      'KICK OFF', 'DELIVERY DATE', 'AIR DATE', 'Reunión', 'Producción'];
    for (var j = 0; j < 100; j++) {
      var str = noHeaders[j % noHeaders.length] + (j > 14 ? '_' + j : '');
      _assert(!_esHeaderSubgrupo(str),
        'No debería detectar como header: "' + str + '"');
    }
  });

  // Feature: cascadas-por-etapa, Property 2
  _runTest('Property 2 — Invariante de límites de subgrupo', function() {
    for (var iter = 0; iter < 100; iter++) {
      var filas = genFilasConHeaders(5 + Math.floor(Math.random() * 15));
      var subgrupos = obtenerLimitesSubgruposLogica(filas);

      // Recalcular headers manualmente
      var headerFilas = [];
      for (var i = 0; i < filas.length; i++) {
        if (_esHeaderSubgrupo(filas[i].colA)) {
          headerFilas.push(i + 1); // 1-indexed
        }
      }

      for (var s = 0; s < subgrupos.length; s++) {
        var sg = subgrupos[s];
        // filaInicio debe ser headerFila + 1
        var headerIdx = -1;
        for (var h = 0; h < headerFilas.length; h++) {
          if (headerFilas[h] + 1 === sg.filaInicio) { headerIdx = h; break; }
        }
        _assert(headerIdx !== -1, 'iter=' + iter + ' sg=' + s + ': filaInicio no sigue a un header');
        // filaFin
        var expectedFin = (headerIdx + 1 < headerFilas.length) ? headerFilas[headerIdx + 1] - 1 : filas.length;
        _assertEqual(sg.filaFin, expectedFin, 'iter=' + iter + ' sg=' + s + ': filaFin incorrecta');
        // No vacío
        _assert(sg.filaInicio <= sg.filaFin, 'iter=' + iter + ' sg=' + s + ': subgrupo vacío incluido');
      }
    }
  });

  // Feature: cascadas-por-etapa, Property 3
  _runTest('Property 3 — Cascada inversa preserva el ancla', function() {
    for (var iter = 0; iter < 100; iter++) {
      var filas = genSubgrupoConActividades();
      var subgrupos = obtenerLimitesSubgruposLogica(filas);

      // Asignar ancla válida (fecha fin) a la última actividad de cada subgrupo
      for (var s = 0; s < subgrupos.length; s++) {
        var sg = subgrupos[s];
        for (var f = sg.filaFin; f >= sg.filaInicio; f--) {
          if (filas[f - 1].colA && filas[f - 1].colA.toString().trim() !== '' && !_esHeaderSubgrupo(filas[f - 1].colA)) {
            filas[f - 1].fechaFin = new Date(2025, 5, 9 + iter % 20); // lunes variable
            break;
          }
        }
      }

      // Guardar anclas originales
      var anclasOriginales = [];
      for (var s2 = 0; s2 < subgrupos.length; s2++) {
        var sg2 = subgrupos[s2];
        var ancla = null;
        for (var f2 = sg2.filaFin; f2 >= sg2.filaInicio; f2--) {
          if (filas[f2 - 1].colA && filas[f2 - 1].colA.toString().trim() !== '' && !_esHeaderSubgrupo(filas[f2 - 1].colA)) {
            ancla = filas[f2 - 1].fechaFin ? new Date(filas[f2 - 1].fechaFin.getTime()) : null;
            break;
          }
        }
        anclasOriginales.push(ancla);
      }

      var resultado = cascadaInversaLogica(subgrupos, filas, []);

      // Verificar que el ancla se preservó
      for (var s3 = 0; s3 < subgrupos.length; s3++) {
        if (!anclasOriginales[s3]) continue;
        var sg3 = subgrupos[s3];
        for (var f3 = sg3.filaFin; f3 >= sg3.filaInicio; f3--) {
          if (resultado.filas[f3 - 1].colA && resultado.filas[f3 - 1].colA.toString().trim() !== '' && !_esHeaderSubgrupo(resultado.filas[f3 - 1].colA)) {
            _assertDatesEqual(resultado.filas[f3 - 1].fechaFin, anclasOriginales[s3],
              'iter=' + iter + ' sg=' + s3 + ': ancla no preservada');
            break;
          }
        }
      }
    }
  });

  // Feature: cascadas-por-etapa, Property 4
  _runTest('Property 4 — Aislamiento de subgrupos', function() {
    for (var iter = 0; iter < 100; iter++) {
      // Generar tabla con exactamente 2 subgrupos
      var filas = [];
      filas.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      var n1 = 2 + Math.floor(Math.random() * 3);
      for (var a = 0; a < n1; a++) {
        filas.push({ colA: 'Act1_' + a, dias: 2, fechaInicio: new Date(2025, 5, 2 + a * 3), fechaFin: new Date(2025, 5, 3 + a * 3) });
      }
      filas.push({ colA: 'PRODUCTION PLANNING', dias: '', fechaInicio: null, fechaFin: null });
      var n2 = 2 + Math.floor(Math.random() * 3);
      for (var b = 0; b < n2; b++) {
        filas.push({ colA: 'Act2_' + b, dias: 3, fechaInicio: new Date(2025, 6, 1 + b * 4), fechaFin: new Date(2025, 6, 3 + b * 4) });
      }

      // Poner ancla al último del subgrupo 1
      filas[n1].fechaFin = new Date(2025, 5, 20);

      var subgrupos = obtenerLimitesSubgruposLogica(filas);
      _assert(subgrupos.length === 2, 'iter=' + iter + ': se esperaban 2 subgrupos');

      // Guardar fechas del subgrupo 2 antes de la cascada
      var sg2 = subgrupos[1];
      var fechasAntes = [];
      for (var f = sg2.filaInicio; f <= sg2.filaFin; f++) {
        fechasAntes.push({
          fechaInicio: filas[f - 1].fechaInicio ? filas[f - 1].fechaInicio.getTime() : null,
          fechaFin: filas[f - 1].fechaFin ? filas[f - 1].fechaFin.getTime() : null
        });
      }

      // Ejecutar cascada inversa (procesa ambos subgrupos)
      var resultado = cascadaInversaLogica([subgrupos[0]], filas, []);

      // Verificar que subgrupo 2 no fue tocado
      for (var f2 = sg2.filaInicio; f2 <= sg2.filaFin; f2++) {
        var idx = f2 - sg2.filaInicio;
        var iniDespues = resultado.filas[f2 - 1].fechaInicio ? resultado.filas[f2 - 1].fechaInicio.getTime() : null;
        var finDespues = resultado.filas[f2 - 1].fechaFin ? resultado.filas[f2 - 1].fechaFin.getTime() : null;
        _assertEqual(iniDespues, fechasAntes[idx].fechaInicio, 'iter=' + iter + ' fila=' + f2 + ': fechaInicio de SG2 fue modificada');
        _assertEqual(finDespues, fechasAntes[idx].fechaFin, 'iter=' + iter + ' fila=' + f2 + ': fechaFin de SG2 fue modificada');
      }
    }
  });

  // Feature: cascadas-por-etapa, Property 5
  _runTest('Property 5 — Equivalencia con cascadas globales (un único subgrupo)', function() {
    for (var iter = 0; iter < 100; iter++) {
      // Tabla con un único header que abarca todo
      var filas = [];
      filas.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      var numAct = 2 + Math.floor(Math.random() * 4);
      for (var a = 0; a < numAct; a++) {
        filas.push({ colA: 'Actividad ' + a, dias: 1 + Math.floor(Math.random() * 4), fechaInicio: null, fechaFin: null });
      }

      // Ancla para inversa: fecha fin de la última actividad
      var anclaFin = new Date(2025, 5, 9 + iter % 20);
      // Asegurar que sea día hábil
      while (!_esDiaHabil(anclaFin, [])) {
        anclaFin.setDate(anclaFin.getDate() + 1);
      }
      filas[filas.length - 1].fechaFin = new Date(anclaFin.getTime());

      // Deep copy para la versión global
      var filasGlobal = [];
      for (var c = 0; c < filas.length; c++) {
        filasGlobal.push({
          colA: filas[c].colA, dias: filas[c].dias,
          fechaInicio: filas[c].fechaInicio ? new Date(filas[c].fechaInicio.getTime()) : null,
          fechaFin: filas[c].fechaFin ? new Date(filas[c].fechaFin.getTime()) : null
        });
      }

      var subgrupos = obtenerLimitesSubgruposLogica(filas);
      var resSub = cascadaInversaLogica(subgrupos, filas, []);
      var resGlobal = cascadaInversaGlobalLogica(filasGlobal, []);

      // Comparar fechas de cada actividad
      for (var f = 0; f < filas.length; f++) {
        if (_esHeaderSubgrupo(filas[f].colA)) continue;
        var iniSub = resSub.filas[f].fechaInicio ? resSub.filas[f].fechaInicio.getTime() : null;
        var iniGlob = resGlobal.filas[f].fechaInicio ? resGlobal.filas[f].fechaInicio.getTime() : null;
        var finSub = resSub.filas[f].fechaFin ? resSub.filas[f].fechaFin.getTime() : null;
        var finGlob = resGlobal.filas[f].fechaFin ? resGlobal.filas[f].fechaFin.getTime() : null;
        _assertEqual(iniSub, iniGlob, 'iter=' + iter + ' fila=' + f + ': fechaInicio difiere (inversa)');
        _assertEqual(finSub, finGlob, 'iter=' + iter + ' fila=' + f + ': fechaFin difiere (inversa)');
      }

      // También para cascada normal
      var filasN = [];
      filasN.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      for (var a2 = 0; a2 < numAct; a2++) {
        filasN.push({ colA: 'Actividad ' + a2, dias: 1 + Math.floor(Math.random() * 4), fechaInicio: null, fechaFin: null });
      }
      var anclaIni = new Date(2025, 5, 2 + iter % 20);
      while (!_esDiaHabil(anclaIni, [])) { anclaIni.setDate(anclaIni.getDate() + 1); }
      filasN[1].fechaInicio = new Date(anclaIni.getTime());

      var filasNGlobal = [];
      for (var c2 = 0; c2 < filasN.length; c2++) {
        filasNGlobal.push({
          colA: filasN[c2].colA, dias: filasN[c2].dias,
          fechaInicio: filasN[c2].fechaInicio ? new Date(filasN[c2].fechaInicio.getTime()) : null,
          fechaFin: filasN[c2].fechaFin ? new Date(filasN[c2].fechaFin.getTime()) : null
        });
      }

      var subgruposN = obtenerLimitesSubgruposLogica(filasN);
      var resSubN = cascadaNormalLogica(subgruposN, filasN, []);
      var resGlobalN = cascadaNormalGlobalLogica(filasNGlobal, []);

      for (var f2 = 0; f2 < filasN.length; f2++) {
        if (_esHeaderSubgrupo(filasN[f2].colA)) continue;
        var iniSubN = resSubN.filas[f2].fechaInicio ? resSubN.filas[f2].fechaInicio.getTime() : null;
        var iniGlobN = resGlobalN.filas[f2].fechaInicio ? resGlobalN.filas[f2].fechaInicio.getTime() : null;
        var finSubN = resSubN.filas[f2].fechaFin ? resSubN.filas[f2].fechaFin.getTime() : null;
        var finGlobN = resGlobalN.filas[f2].fechaFin ? resGlobalN.filas[f2].fechaFin.getTime() : null;
        _assertEqual(iniSubN, iniGlobN, 'iter=' + iter + ' fila=' + f2 + ': fechaInicio difiere (normal)');
        _assertEqual(finSubN, finGlobN, 'iter=' + iter + ' fila=' + f2 + ': fechaFin difiere (normal)');
      }
    }
  });

  // Feature: cascadas-por-etapa, Property 6
  _runTest('Property 6 — Resiliencia ante anclas ausentes', function() {
    for (var iter = 0; iter < 100; iter++) {
      var filas = [];
      filas.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      filas.push({ colA: 'Act1', dias: 2, fechaInicio: null, fechaFin: new Date(2025, 5, 9) });
      filas.push({ colA: 'PRODUCTION PLANNING', dias: '', fechaInicio: null, fechaFin: null });
      filas.push({ colA: 'Act2', dias: 3, fechaInicio: null, fechaFin: null }); // sin ancla

      var subgrupos = obtenerLimitesSubgruposLogica(filas);
      var resultado = cascadaInversaLogica(subgrupos, filas, []);

      _assertEqual(resultado.procesados, 1, 'iter=' + iter + ': debería procesar solo 1 subgrupo');
      _assertEqual(resultado.advertencias.length, 1, 'iter=' + iter + ': debería haber 1 advertencia');
      _assert(resultado.advertencias[0].indexOf('PRODUCTION PLANNING') !== -1,
        'iter=' + iter + ': advertencia debería mencionar el subgrupo omitido');
    }
  });

  // Feature: cascadas-por-etapa, Property 7
  _runTest('Property 7 — Cascada normal preserva el ancla', function() {
    for (var iter = 0; iter < 100; iter++) {
      var filas = [];
      filas.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      var numAct = 2 + Math.floor(Math.random() * 4);
      for (var a = 0; a < numAct; a++) {
        filas.push({ colA: 'Act_' + a, dias: 1 + Math.floor(Math.random() * 4), fechaInicio: null, fechaFin: null });
      }

      // Ancla en día hábil
      var ancla = new Date(2025, 5, 2 + iter % 20);
      while (!_esDiaHabil(ancla, [])) { ancla.setDate(ancla.getDate() + 1); }
      filas[1].fechaInicio = new Date(ancla.getTime());

      var subgrupos = obtenerLimitesSubgruposLogica(filas);
      var resultado = cascadaNormalLogica(subgrupos, filas, []);

      _assertDatesEqual(resultado.filas[1].fechaInicio, ancla,
        'iter=' + iter + ': ancla de cascada normal no preservada');
    }
  });

  // Feature: cascadas-por-etapa, Property 8
  _runTest('Property 8 — Ajuste de ancla a día hábil en cascada normal', function() {
    for (var iter = 0; iter < 100; iter++) {
      var filas = [];
      filas.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      filas.push({ colA: 'Actividad X', dias: 2, fechaInicio: null, fechaFin: null });

      var fechaNoHabil = genFechaNoHabil();
      filas[1].fechaInicio = new Date(fechaNoHabil.getTime());

      var subgrupos = obtenerLimitesSubgruposLogica(filas);
      var resultado = cascadaNormalLogica(subgrupos, filas, []);

      var fechaResultante = resultado.filas[1].fechaInicio;
      _assert(fechaResultante !== null, 'iter=' + iter + ': fechaInicio es null');
      _assert(_esDiaHabil(fechaResultante, []),
        'iter=' + iter + ': fechaInicio resultante no es día hábil: ' + fechaResultante.toISOString());

      // Debe ser el SIGUIENTE día hábil (no uno arbitrario)
      var esperado = _siguienteDiaHabil(fechaNoHabil, []);
      _assertDatesEqual(fechaResultante, esperado,
        'iter=' + iter + ': no es el siguiente día hábil');
    }
  });

  // Feature: cascadas-por-etapa, Property 9
  _runTest('Property 9 — Días inválidos tratados como 1', function() {
    for (var iter = 0; iter < 100; iter++) {
      var diasInv = genDiasInvalidos();

      // Test con cascada normal
      var filasN = [];
      filasN.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      var ancla = new Date(2025, 5, 2); // lunes
      filasN.push({ colA: 'Act', dias: diasInv, fechaInicio: new Date(ancla.getTime()), fechaFin: null });

      var subgruposN = obtenerLimitesSubgruposLogica(filasN);
      var resN = cascadaNormalLogica(subgruposN, filasN, []);

      // Con 1 día: fechaFin = fechaInicio (0 días hábiles sumados)
      _assertDatesEqual(resN.filas[1].fechaFin, resN.filas[1].fechaInicio,
        'iter=' + iter + ' normal: con días=' + diasInv + ', Fin debería = Inicio');

      // Test con cascada inversa
      var filasI = [];
      filasI.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });
      var anclaFin = new Date(2025, 5, 2); // lunes
      filasI.push({ colA: 'Act', dias: diasInv, fechaInicio: null, fechaFin: new Date(anclaFin.getTime()) });

      var subgruposI = obtenerLimitesSubgruposLogica(filasI);
      var resI = cascadaInversaLogica(subgruposI, filasI, []);

      // Con 1 día: fechaInicio = fechaFin (0 días hábiles restados)
      _assertDatesEqual(resI.filas[1].fechaInicio, resI.filas[1].fechaFin,
        'iter=' + iter + ' inversa: con días=' + diasInv + ', Inicio debería = Fin');
    }
  });

  // Feature: cascadas-por-etapa, Property 10
  _runTest('Property 10 — Filas con columna A vacía no son modificadas', function() {
    for (var iter = 0; iter < 100; iter++) {
      var filas = [];
      filas.push({ colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null });

      var numFilas = 3 + Math.floor(Math.random() * 4);
      var filasVacias = []; // índices 0-based de las filas vacías
      for (var a = 0; a < numFilas; a++) {
        var esVacia = Math.random() > 0.6;
        if (esVacia) {
          var fechaOrig = Math.random() > 0.5 ? new Date(2025, 3, 15) : null;
          filas.push({ colA: '', dias: 2, fechaInicio: fechaOrig, fechaFin: fechaOrig });
          filasVacias.push(filas.length - 1);
        } else {
          filas.push({ colA: 'Act_' + a, dias: 2, fechaInicio: null, fechaFin: null });
        }
      }

      // Ancla para normal
      var ancla = new Date(2025, 5, 2);
      // Buscar primera actividad no vacía
      for (var b = 1; b < filas.length; b++) {
        if (filas[b].colA && filas[b].colA.toString().trim() !== '') {
          filas[b].fechaInicio = new Date(ancla.getTime());
          break;
        }
      }

      // Guardar fechas originales de filas vacías
      var originales = [];
      for (var v = 0; v < filasVacias.length; v++) {
        var idx = filasVacias[v];
        originales.push({
          fechaInicio: filas[idx].fechaInicio ? filas[idx].fechaInicio.getTime() : null,
          fechaFin: filas[idx].fechaFin ? filas[idx].fechaFin.getTime() : null
        });
      }

      var subgrupos = obtenerLimitesSubgruposLogica(filas);
      var resultado = cascadaNormalLogica(subgrupos, filas, []);

      // Verificar que las filas vacías no fueron modificadas
      for (var v2 = 0; v2 < filasVacias.length; v2++) {
        var idx2 = filasVacias[v2];
        var iniRes = resultado.filas[idx2].fechaInicio ? resultado.filas[idx2].fechaInicio.getTime() : null;
        var finRes = resultado.filas[idx2].fechaFin ? resultado.filas[idx2].fechaFin.getTime() : null;
        _assertEqual(iniRes, originales[v2].fechaInicio,
          'iter=' + iter + ' fila=' + idx2 + ': fechaInicio de fila vacía fue modificada');
        _assertEqual(finRes, originales[v2].fechaFin,
          'iter=' + iter + ' fila=' + idx2 + ': fechaFin de fila vacía fue modificada');
      }
    }
  });

  _printResults('PROPERTY TESTS (10 properties × 100 runs)');
}


// ============================================
// UNIT TESTS / EXAMPLE-BASED TESTS
// ============================================

function runUnitTests() {
  _resetResults();

  // 8.1 Error: hoja ausente en cascada inversa
  _runTest('Unit 8.1 — Cascada inversa con subgrupos vacíos (simula hoja ausente)', function() {
    var resultado = cascadaInversaLogica([], [], []);
    _assertEqual(resultado.procesados, 0, 'Debería procesar 0 subgrupos');
    _assertEqual(resultado.advertencias.length, 0, 'Sin advertencias');
  });

  // 8.2 Error: hoja ausente en cascada normal
  _runTest('Unit 8.2 — Cascada normal con subgrupos vacíos (simula hoja ausente)', function() {
    var resultado = cascadaNormalLogica([], [], []);
    _assertEqual(resultado.procesados, 0, 'Debería procesar 0 subgrupos');
    _assertEqual(resultado.advertencias.length, 0, 'Sin advertencias');
  });

  // 8.3 Error: sin subgrupos en cascada inversa
  _runTest('Unit 8.3 — Sin subgrupos en cascada inversa', function() {
    var filas = [
      { colA: 'Actividad A', dias: 3, fechaInicio: null, fechaFin: new Date(2025, 5, 6) },
      { colA: 'Actividad B', dias: 2, fechaInicio: null, fechaFin: new Date(2025, 5, 9) }
    ];
    var subgrupos = obtenerLimitesSubgruposLogica(filas);
    _assertEqual(subgrupos.length, 0, 'No debería detectar subgrupos');
    var resultado = cascadaInversaLogica(subgrupos, filas, []);
    _assertEqual(resultado.procesados, 0, 'Debería procesar 0');
  });

  // 8.4 Error: sin subgrupos en cascada normal
  _runTest('Unit 8.4 — Sin subgrupos en cascada normal', function() {
    var filas = [
      { colA: 'Actividad A', dias: 3, fechaInicio: new Date(2025, 5, 2), fechaFin: null },
      { colA: 'Actividad B', dias: 2, fechaInicio: null, fechaFin: null }
    ];
    var subgrupos = obtenerLimitesSubgruposLogica(filas);
    _assertEqual(subgrupos.length, 0, 'No debería detectar subgrupos');
    var resultado = cascadaNormalLogica(subgrupos, filas, []);
    _assertEqual(resultado.procesados, 0, 'Debería procesar 0');
  });

  // 8.5 Cálculo correcto — cascada inversa (ejemplo fijo)
  _runTest('Unit 8.5 — Cascada inversa ejemplo fijo (3 actividades: 3/2/1 días)', function() {
    // Ancla: lunes 9 junio 2025 (Fecha Fin última actividad)
    // Act3: 1 día → Inicio=Lun9, Fin=Lun9
    // Act2: 2 días → Fin=Vie6, Inicio=Jue5 (restar 1 día hábil desde Vie6)
    // Act1: 3 días → Fin=Mie4, Inicio=Lun2 (restar 2 días hábiles desde Mie4)
    var filas = [
      { colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null },
      { colA: 'Actividad 1', dias: 3, fechaInicio: null, fechaFin: null },
      { colA: 'Actividad 2', dias: 2, fechaInicio: null, fechaFin: null },
      { colA: 'Actividad 3', dias: 1, fechaInicio: null, fechaFin: new Date(2025, 5, 9) } // Lun 9 jun
    ];

    var subgrupos = obtenerLimitesSubgruposLogica(filas);
    var resultado = cascadaInversaLogica(subgrupos, filas, []);

    _assertEqual(resultado.procesados, 1, 'Debería procesar 1 subgrupo');

    // Act3: Inicio=Lun9Jun, Fin=Lun9Jun
    _assertDatesEqual(resultado.filas[3].fechaInicio, new Date(2025, 5, 9), 'Act3 fechaInicio');
    _assertDatesEqual(resultado.filas[3].fechaFin, new Date(2025, 5, 9), 'Act3 fechaFin');

    // Act2: Fin=Vie6Jun, Inicio=Jue5Jun
    _assertDatesEqual(resultado.filas[2].fechaFin, new Date(2025, 5, 6), 'Act2 fechaFin');
    _assertDatesEqual(resultado.filas[2].fechaInicio, new Date(2025, 5, 5), 'Act2 fechaInicio');

    // Act1: Fin=Mie4Jun, Inicio=Lun2Jun
    _assertDatesEqual(resultado.filas[1].fechaFin, new Date(2025, 5, 4), 'Act1 fechaFin');
    _assertDatesEqual(resultado.filas[1].fechaInicio, new Date(2025, 5, 2), 'Act1 fechaInicio');
  });

  // 8.6 Cálculo correcto — cascada normal (ejemplo fijo)
  _runTest('Unit 8.6 — Cascada normal ejemplo fijo (3 actividades: 3/2/1 días)', function() {
    // Ancla: lunes 2 junio 2025 (Fecha Inicio primera actividad)
    // Act1: 3 días → Inicio=Lun2, Fin=Mie4
    // Act2: 2 días → Inicio=Jue5, Fin=Vie6
    // Act3: 1 día → Inicio=Lun9, Fin=Lun9
    var filas = [
      { colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null },
      { colA: 'Actividad 1', dias: 3, fechaInicio: new Date(2025, 5, 2), fechaFin: null }, // Lun 2 jun
      { colA: 'Actividad 2', dias: 2, fechaInicio: null, fechaFin: null },
      { colA: 'Actividad 3', dias: 1, fechaInicio: null, fechaFin: null }
    ];

    var subgrupos = obtenerLimitesSubgruposLogica(filas);
    var resultado = cascadaNormalLogica(subgrupos, filas, []);

    _assertEqual(resultado.procesados, 1, 'Debería procesar 1 subgrupo');

    // Act1: Inicio=Lun2Jun, Fin=Mie4Jun
    _assertDatesEqual(resultado.filas[1].fechaInicio, new Date(2025, 5, 2), 'Act1 fechaInicio');
    _assertDatesEqual(resultado.filas[1].fechaFin, new Date(2025, 5, 4), 'Act1 fechaFin');

    // Act2: Inicio=Jue5Jun, Fin=Vie6Jun
    _assertDatesEqual(resultado.filas[2].fechaInicio, new Date(2025, 5, 5), 'Act2 fechaInicio');
    _assertDatesEqual(resultado.filas[2].fechaFin, new Date(2025, 5, 6), 'Act2 fechaFin');

    // Act3: Inicio=Lun9Jun, Fin=Lun9Jun
    _assertDatesEqual(resultado.filas[3].fechaInicio, new Date(2025, 5, 9), 'Act3 fechaInicio');
    _assertDatesEqual(resultado.filas[3].fechaFin, new Date(2025, 5, 9), 'Act3 fechaFin');
  });

  // 8.7 Post-procesamiento — contador de subgrupos
  _runTest('Unit 8.7 — Contador de subgrupos procesados', function() {
    var filas = [
      { colA: 'PROCESO CREATIVO', dias: '', fechaInicio: null, fechaFin: null },
      { colA: 'Act1', dias: 2, fechaInicio: null, fechaFin: new Date(2025, 5, 9) },
      { colA: 'PRODUCTION PLANNING', dias: '', fechaInicio: null, fechaFin: null },
      { colA: 'Act2', dias: 3, fechaInicio: null, fechaFin: new Date(2025, 6, 4) }
    ];

    var subgrupos = obtenerLimitesSubgruposLogica(filas);
    var resultado = cascadaInversaLogica(subgrupos, filas, []);

    _assertEqual(resultado.procesados, 2, 'Debería reportar 2 subgrupos procesados');
    _assertEqual(resultado.advertencias.length, 0, 'Sin advertencias');
  });

  // 8.8 Wrappers de delegación (smoke test)
  _runTest('Unit 8.8 — Funciones de cascada existen y son funciones', function() {
    _assert(typeof cascadaInversaSubgrupos === 'function',
      'cascadaInversaSubgrupos debería ser una función');
    _assert(typeof cascadaNormalSubgrupos === 'function',
      'cascadaNormalSubgrupos debería ser una función');
  });

  _printResults('UNIT TESTS (8 tests)');
}

// ============================================
// RUNNERS PRINCIPALES
// ============================================

function runAllTests() {
  runPropertyTests();
  var propPassed = _testsPassed;
  var propFailed = _testsFailed;

  runUnitTests();
  var unitPassed = _testsPassed;
  var unitFailed = _testsFailed;

  Logger.log('\n╔═══════════════════════════════════════╗');
  Logger.log('║          RESUMEN FINAL               ║');
  Logger.log('╠═══════════════════════════════════════╣');
  Logger.log('║ Property tests: ' + propPassed + ' passed, ' + propFailed + ' failed');
  Logger.log('║ Unit tests:     ' + unitPassed + ' passed, ' + unitFailed + ' failed');
  Logger.log('║ TOTAL:          ' + (propPassed + unitPassed) + ' passed, ' + (propFailed + unitFailed) + ' failed');
  Logger.log('╚═══════════════════════════════════════╝');
}
