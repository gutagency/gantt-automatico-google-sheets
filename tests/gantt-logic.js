/**
 * gantt-logic.js
 *
 * Pure-logic extraction of Code_v2.14.gs for Node.js / Jest testing.
 * Contains NO Google Apps Script API dependencies.
 *
 * All functions use ES5 style (var, for loops) to match the source code.
 */

// ============================================
// DATE UTILITY FUNCTIONS (copied verbatim from Code_v2.14.gs)
// ============================================

/**
 * Returns a normalized timestamp (midnight) for the given date.
 * @param {Date} fecha
 * @returns {number}
 */
function normalizarFecha(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

/**
 * Returns true if the given date falls on a Saturday or Sunday.
 * @param {Date} fecha
 * @returns {boolean}
 */
function esFinDeSemana(fecha) {
  var dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

/**
 * Returns true if the given date is in the feriados array.
 * @param {Date} fecha
 * @param {number[]} feriados - array of normalized timestamps from normalizarFecha
 * @returns {boolean}
 */
function esFeriado(fecha, feriados) {
  var fechaNorm = normalizarFecha(fecha);
  for (var i = 0; i < feriados.length; i++) {
    if (feriados[i] === fechaNorm) return true;
  }
  return false;
}

/**
 * Returns true if the given date is a business day (not weekend, not holiday).
 * @param {Date} fecha
 * @param {number[]} feriados
 * @returns {boolean}
 */
function esDiaHabil(fecha, feriados) {
  return !esFinDeSemana(fecha) && !esFeriado(fecha, feriados);
}

/**
 * Returns the next business day after the given date.
 * @param {Date} fecha
 * @param {number[]} feriados
 * @returns {Date}
 */
function siguienteDiaHabil(fecha, feriados) {
  var siguiente = new Date(fecha.getTime());
  siguiente.setDate(siguiente.getDate() + 1);

  while (!esDiaHabil(siguiente, feriados)) {
    siguiente.setDate(siguiente.getDate() + 1);
  }

  return siguiente;
}

/**
 * Returns the previous business day before the given date.
 * @param {Date} fecha
 * @param {number[]} feriados
 * @returns {Date}
 */
function diaHabilAnterior(fecha, feriados) {
  var anterior = new Date(fecha.getTime());
  anterior.setDate(anterior.getDate() - 1);

  while (!esDiaHabil(anterior, feriados)) {
    anterior.setDate(anterior.getDate() - 1);
  }

  return anterior;
}

/**
 * Adds N business days to a start date.
 * @param {Date} fechaInicio
 * @param {number} diasHabiles
 * @param {number[]} feriados
 * @returns {Date}
 */
function sumarDiasHabiles(fechaInicio, diasHabiles, feriados) {
  var fecha = new Date(fechaInicio.getTime());
  var diasAgregados = 0;

  if (diasHabiles === 0) return fecha;

  while (diasAgregados < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1);
    if (esDiaHabil(fecha, feriados)) {
      diasAgregados++;
    }
  }

  return fecha;
}

/**
 * Subtracts N business days from an end date.
 * @param {Date} fechaFin
 * @param {number} diasHabiles
 * @param {number[]} feriados
 * @returns {Date}
 */
function restarDiasHabiles(fechaFin, diasHabiles, feriados) {
  var fecha = new Date(fechaFin.getTime());
  var diasRestados = 0;

  if (diasHabiles === 0) return fecha;

  while (diasRestados < diasHabiles) {
    fecha.setDate(fecha.getDate() - 1);
    if (esDiaHabil(fecha, feriados)) {
      diasRestados++;
    }
  }

  return fecha;
}

/**
 * Counts the number of business days between two dates (inclusive).
 * Returns at least 1.
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @param {number[]} feriados
 * @returns {number}
 */
function calcularDiasHabiles(fechaInicio, fechaFin, feriados) {
  var dias = 0;
  var fecha = new Date(fechaInicio.getTime());

  while (fecha <= fechaFin) {
    if (esDiaHabil(fecha, feriados)) {
      dias++;
    }
    fecha.setDate(fecha.getDate() + 1);
  }

  return Math.max(dias, 1);
}

// ============================================
// PURE VERSION OF obtenerLimitesSubgrupos
// ============================================

/**
 * Known subgroup header names (uppercase for comparison).
 */
var HEADERS_SUBGRUPO = ['PROCESO CREATIVO', 'PRODUCTION PLANNING'];

/**
 * Pure version of obtenerLimitesSubgrupos — no Sheets API.
 *
 * @param {Array<{ colA: string }>} filas
 *   0-indexed array of row objects. Index 0 = sheet row 1.
 * @returns {Array<{ nombre: string, filaInicio: number, filaFin: number }>}
 *   1-indexed row numbers, same convention as the GAS version.
 */
function obtenerLimitesSubgruposLogica(filas) {
  // Encontrar las filas donde están los headers de subgrupo
  var headerFilas = []; // { nombre, fila } — fila is 1-indexed
  for (var i = 0; i < filas.length; i++) {
    var val = filas[i].colA ? filas[i].colA.toString().toUpperCase().trim() : '';
    if (HEADERS_SUBGRUPO.indexOf(val) !== -1) {
      headerFilas.push({ nombre: filas[i].colA.toString().trim(), fila: i + 1 });
    }
  }

  if (headerFilas.length === 0) return [];

  var ultimaFila = filas.length; // 1-indexed last row

  // Construir rangos
  var subgrupos = [];
  for (var j = 0; j < headerFilas.length; j++) {
    var filaInicio = headerFilas[j].fila + 1; // exclude the header row itself
    var filaFin = (j + 1 < headerFilas.length) ? headerFilas[j + 1].fila - 1 : ultimaFila;

    // Only include if there are activity rows within the range
    if (filaInicio <= filaFin) {
      subgrupos.push({
        nombre: headerFilas[j].nombre,
        filaInicio: filaInicio,
        filaFin: filaFin
      });
    }
  }

  return subgrupos;
}

// ============================================
// PURE VERSION OF cascadaInversaSubgrupos
// ============================================

/**
 * Pure version of cascadaInversaSubgrupos — no Sheets API, no side effects.
 *
 * @param {Array<{ nombre: string, filaInicio: number, filaFin: number }>} subgrupos
 *   1-indexed, as returned by obtenerLimitesSubgruposLogica.
 * @param {Array<{ colA: string, dias: any, fechaInicio: Date|null, fechaFin: Date|null }>} filas
 *   0-indexed (index 0 = sheet row 1). Must be large enough that filas[filaFin - 1] is valid.
 * @param {number[]} feriados
 *   Array of normalized timestamps from normalizarFecha.
 * @returns {{ procesados: number, advertencias: string[], filas: Array }}
 *   Returns a deep copy of filas with modifications applied.
 */
function cascadaInversaLogica(subgrupos, filas, feriados) {
  // Deep copy filas so we never mutate the input
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

    // Buscar la última fila con actividad dentro del subgrupo (filas son 1-indexed)
    var ultimaFilaConActividad = -1;
    for (var f = sg.filaFin; f >= sg.filaInicio; f--) {
      var act = filasOut[f - 1].colA; // convert 1-indexed to 0-indexed
      if (act && act.toString().trim() !== '') {
        ultimaFilaConActividad = f;
        break;
      }
    }

    if (ultimaFilaConActividad === -1) continue;

    // Verificar que la última actividad tiene Fecha Fin
    var fechaFinUltima = filasOut[ultimaFilaConActividad - 1].fechaFin;
    if (!fechaFinUltima || !(fechaFinUltima instanceof Date)) {
      advertencias.push('Subgrupo "' + sg.nombre + '": no tiene Fecha Fin en la última actividad (fila ' + ultimaFilaConActividad + '). Se omitió.');
      continue;
    }

    // Correr cascada inversa solo dentro de este subgrupo
    var fechaFinActual = new Date(fechaFinUltima.getTime());

    for (var fila = ultimaFilaConActividad; fila >= sg.filaInicio; fila--) {
      var actividad = filasOut[fila - 1].colA;
      var dias = filasOut[fila - 1].dias;

      if (!actividad || actividad.toString().trim() === '') continue;

      dias = parseInt(dias);
      if (isNaN(dias) || dias < 1) dias = 1;

      var fechaFin = new Date(fechaFinActual.getTime());
      var fechaInicio = restarDiasHabiles(fechaFin, dias - 1, feriados);

      filasOut[fila - 1].fechaInicio = fechaInicio;
      filasOut[fila - 1].fechaFin = fechaFin;

      fechaFinActual = diaHabilAnterior(fechaInicio, feriados);
    }

    subgruposProcesados++;
  }

  return {
    procesados: subgruposProcesados,
    advertencias: advertencias,
    filas: filasOut
  };
}

// ============================================
// PURE VERSION OF cascadaNormalSubgrupos
// ============================================

/**
 * Pure version of cascadaNormalSubgrupos — no Sheets API, no side effects.
 *
 * @param {Array<{ nombre: string, filaInicio: number, filaFin: number }>} subgrupos
 *   1-indexed, as returned by obtenerLimitesSubgruposLogica.
 * @param {Array<{ colA: string, dias: any, fechaInicio: Date|null, fechaFin: Date|null }>} filas
 *   0-indexed (index 0 = sheet row 1).
 * @param {number[]} feriados
 *   Array of normalized timestamps from normalizarFecha.
 * @returns {{ procesados: number, advertencias: string[], filas: Array }}
 *   Returns a deep copy of filas with modifications applied.
 */
function cascadaNormalLogica(subgrupos, filas, feriados) {
  // Deep copy filas so we never mutate the input
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

    // Buscar la primera fila con actividad dentro del subgrupo
    var primeraFilaConActividad = -1;
    for (var f = sg.filaInicio; f <= sg.filaFin; f++) {
      var act = filasOut[f - 1].colA; // convert 1-indexed to 0-indexed
      if (act && act.toString().trim() !== '') {
        primeraFilaConActividad = f;
        break;
      }
    }

    if (primeraFilaConActividad === -1) continue;

    // Verificar que la primera actividad tiene Fecha Inicio
    var fechaInicioPrimera = filasOut[primeraFilaConActividad - 1].fechaInicio;
    if (!fechaInicioPrimera || !(fechaInicioPrimera instanceof Date)) {
      advertencias.push('Subgrupo "' + sg.nombre + '": no tiene Fecha Inicio en la primera actividad (fila ' + primeraFilaConActividad + '). Se omitió.');
      continue;
    }

    // Ajustar al próximo día hábil si cae en finde/feriado
    var fechaInicioActual = new Date(fechaInicioPrimera.getTime());
    if (!esDiaHabil(fechaInicioActual, feriados)) {
      fechaInicioActual = siguienteDiaHabil(fechaInicioActual, feriados);
      filasOut[primeraFilaConActividad - 1].fechaInicio = new Date(fechaInicioActual.getTime());
    }

    // Correr cascada normal solo dentro de este subgrupo
    for (var fila = primeraFilaConActividad; fila <= sg.filaFin; fila++) {
      var actividad = filasOut[fila - 1].colA;
      var dias = filasOut[fila - 1].dias;

      if (!actividad || actividad.toString().trim() === '') continue;

      dias = parseInt(dias);
      if (isNaN(dias) || dias < 1) dias = 1;

      var fechaInicio = new Date(fechaInicioActual.getTime());
      var fechaFin = sumarDiasHabiles(fechaInicio, dias - 1, feriados);

      filasOut[fila - 1].fechaInicio = fechaInicio;
      filasOut[fila - 1].fechaFin = fechaFin;

      fechaInicioActual = siguienteDiaHabil(fechaFin, feriados);
    }

    subgruposProcesados++;
  }

  return {
    procesados: subgruposProcesados,
    advertencias: advertencias,
    filas: filasOut
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  normalizarFecha: normalizarFecha,
  esFinDeSemana: esFinDeSemana,
  esFeriado: esFeriado,
  esDiaHabil: esDiaHabil,
  siguienteDiaHabil: siguienteDiaHabil,
  diaHabilAnterior: diaHabilAnterior,
  sumarDiasHabiles: sumarDiasHabiles,
  restarDiasHabiles: restarDiasHabiles,
  calcularDiasHabiles: calcularDiasHabiles,
  obtenerLimitesSubgruposLogica: obtenerLimitesSubgruposLogica,
  cascadaInversaLogica: cascadaInversaLogica,
  cascadaNormalLogica: cascadaNormalLogica
};
