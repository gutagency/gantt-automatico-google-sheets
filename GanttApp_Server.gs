/**
 * GANTT APP — Backend para la web app interactiva con drag
 * Vive en: "Meli - Gantt - Proyectos - config"
 *
 * Funciones:
 * - doGet(): sirve la web app (GanttApp_UI.html)
 * - obtenerTareasParaGantt(): lee tareas de todos los proyectos activos
 * - guardarCambioFecha(): guarda una fecha modificada por drag en el sheet
 */

function doGet(e) {
  var page = e && e.parameter && e.parameter.page ? e.parameter.page : 'gantt';
  
  if (page === 'dashboard') {
    return HtmlService.createHtmlOutputFromFile('Dashboard_UI')
      .setTitle('Gantt Consolidado — Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  if (page === 'grid') {
    return HtmlService.createHtmlOutputFromFile('GanttGrid_UI')
      .setTitle('Gantt Grid — Edición por día')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  return HtmlService.createHtmlOutputFromFile('GanttApp_UI')
    .setTitle('Gantt Interactivo')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// OBTENER TAREAS PARA EL GANTT INTERACTIVO
// ============================================

function obtenerTareasParaGantt(spreadsheetId) {
  var tareas = [];
  
  try {
    var ssProyecto = SpreadsheetApp.openById(spreadsheetId);
    var hojaCreativo = ssProyecto.getSheetByName('Entrada Proceso Creativo');
    
    if (!hojaCreativo) return tareas;
    
    var ultimaFila = hojaCreativo.getLastRow();
    if (ultimaFila < 2) return tareas;
    
    var datos = hojaCreativo.getRange(2, 1, ultimaFila - 1, 4).getValues();
    
    for (var i = 0; i < datos.length; i++) {
      var actividad = datos[i][0];
      var dias = datos[i][1];
      var inicio = datos[i][2];
      var fin = datos[i][3];
      
      if (!actividad || !inicio || !fin) continue;
      if (!(inicio instanceof Date) || !(fin instanceof Date)) continue;
      
      // Saltar agrupadores
      var norm = actividad.toString().toUpperCase().trim();
      if (norm === 'ETAPA CREATIVA' || norm === 'ETAPA PRODUCCION' ||
          norm === 'PROCESO CREATIVO' || norm === 'PRODUCTION PLANNING' ||
          norm === 'DESARROLLO CREATIVO' || norm === 'DESARROLLO ESTRATEGIA DIGITAL' ||
          norm === 'PRODUCCIÓN' || norm === 'PRODUCCION') continue;
      
      tareas.push({
        id: 'task_' + i,
        name: actividad.toString(),
        start: formatDate(inicio),
        end: formatDate(fin),
        progress: 0,
        fila: i + 2
      });
    }
  } catch (e) {
    // Error al leer el sheet
  }
  
  return tareas;
}

// ============================================
// OBTENER LISTA DE PROYECTOS ACTIVOS
// ============================================

function obtenerProyectosActivos() {
  var ss = SpreadsheetApp.openById('1GodELCUQ4Qik7Mc-dESyqWQ1mQd2RhH1Hc3yzzqYDPo');
  var hoja = ss.getSheets()[0];
  var ultimaFila = hoja.getLastRow();
  
  if (ultimaFila < 2) return [];
  
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues();
  var proyectos = [];
  
  for (var i = 0; i < datos.length; i++) {
    var nombre = datos[i][0];
    var spreadsheetId = datos[i][3];
    var activo = datos[i][4];
    
    if (!activo || activo.toString().toUpperCase() !== 'SI') continue;
    if (!spreadsheetId || spreadsheetId.toString().trim() === '') continue;
    
    proyectos.push({
      nombre: nombre.toString(),
      spreadsheetId: spreadsheetId.toString().trim()
    });
  }
  
  return proyectos;
}

// ============================================
// GUARDAR CAMBIO DE FECHA (desde drag en el Gantt)
// ============================================

function guardarCambioFecha(spreadsheetId, fila, nuevaInicio, nuevaFin) {
  var ssProyecto = SpreadsheetApp.openById(spreadsheetId);
  var hojaCreativo = ssProyecto.getSheetByName('Entrada Proceso Creativo');
  
  if (!hojaCreativo) return { ok: false, error: 'Hoja no encontrada' };
  
  var partsIni = nuevaInicio.split('-');
  var inicioDate = new Date(parseInt(partsIni[0]), parseInt(partsIni[1]) - 1, parseInt(partsIni[2]));
  var partsFin = nuevaFin.split('-');
  var finDate = new Date(parseInt(partsFin[0]), parseInt(partsFin[1]) - 1, parseInt(partsFin[2]));
  
  hojaCreativo.getRange(fila, 3).setValue(inicioDate);
  hojaCreativo.getRange(fila, 4).setValue(finDate);
  
  // Recalcular días hábiles
  var feriados = obtenerFeriadosDeProyecto(ssProyecto);
  var dias = calcularDiasHabilesSimple(inicioDate, finDate, feriados);
  hojaCreativo.getRange(fila, 2).setValue(dias);
  
  // Formatear
  hojaCreativo.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
  
  return { ok: true, dias: dias };
}

// ============================================
// OBTENER DATOS COMPLETOS PARA LA GRILLA (tareas + rango + feriados)
// ============================================

function obtenerDatosParaGrilla(spreadsheetId) {
  var resultado = { tareas: [], fechaMin: '', fechaMax: '', feriados: [] };
  
  try {
    var ssProyecto = SpreadsheetApp.openById(spreadsheetId);
    var hojaCreativo = ssProyecto.getSheetByName('Entrada Proceso Creativo');
    if (!hojaCreativo) return resultado;
    
    var ultimaFila = hojaCreativo.getLastRow();
    if (ultimaFila < 2) return resultado;
    
    var datos = hojaCreativo.getRange(2, 1, ultimaFila - 1, 5).getValues();
    
    var fechaMin = null;
    var fechaMax = null;
    
    for (var i = 0; i < datos.length; i++) {
      var actividad = datos[i][0];
      var dias = datos[i][1];
      var inicio = datos[i][2];
      var fin = datos[i][3];
      var colE = datos[i][4];
      
      if (!actividad) continue;
      var norm = actividad.toString().toUpperCase().trim();
      if (norm === 'ETAPA CREATIVA' || norm === 'ETAPA PRODUCCION' ||
          norm === 'DESARROLLO CREATIVO' || norm === 'DESARROLLO ESTRATEGIA DIGITAL' ||
          norm === 'PRODUCCIÓN' || norm === 'PRODUCCION') continue;
      
      if (!inicio || !fin || !(inicio instanceof Date) || !(fin instanceof Date)) continue;
      
      if (fechaMin === null || inicio < fechaMin) fechaMin = inicio;
      if (fechaMax === null || fin > fechaMax) fechaMax = fin;
      
      resultado.tareas.push({
        nombre: actividad.toString(),
        fila: i + 2,
        inicio: formatDate(inicio),
        fin: formatDate(fin),
        dias: dias ? parseInt(dias) : 0,
        excepcion: colE ? colE.toString() : ''
      });
    }
    
    if (fechaMin) resultado.fechaMin = formatDate(fechaMin);
    if (fechaMax) resultado.fechaMax = formatDate(fechaMax);
    
    // Feriados
    var hojaFeriados = ssProyecto.getSheetByName('Feriados');
    if (hojaFeriados) {
      var ultFilaF = hojaFeriados.getLastRow();
      if (ultFilaF >= 2) {
        var datosF = hojaFeriados.getRange(2, 3, ultFilaF - 1, 1).getValues();
        for (var f = 0; f < datosF.length; f++) {
          if (datosF[f][0] instanceof Date) {
            resultado.feriados.push(formatDate(datosF[f][0]));
          }
        }
      }
    }
  } catch(e) {}
  
  return resultado;
}

// ============================================
// GUARDAR GRILLA (recibe array de {fila, fechaInicio, fechaFin, dias})
// ============================================

function guardarCambiosGrilla(spreadsheetId, cambiosJSON) {
  var cambios = JSON.parse(cambiosJSON);
  var ssProyecto = SpreadsheetApp.openById(spreadsheetId);
  var hojaCreativo = ssProyecto.getSheetByName('Entrada Proceso Creativo');
  if (!hojaCreativo) return { ok: false };
  
  for (var i = 0; i < cambios.length; i++) {
    var c = cambios[i];
    var parts1 = c.fechaInicio.split('-');
    var parts2 = c.fechaFin.split('-');
    var ini = new Date(parseInt(parts1[0]), parseInt(parts1[1])-1, parseInt(parts1[2]));
    var fin = new Date(parseInt(parts2[0]), parseInt(parts2[1])-1, parseInt(parts2[2]));
    
    hojaCreativo.getRange(c.fila, 3).setValue(ini);
    hojaCreativo.getRange(c.fila, 4).setValue(fin);
    hojaCreativo.getRange(c.fila, 2).setValue(c.dias);
    hojaCreativo.getRange(c.fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
  }
  
  return { ok: true, count: cambios.length };
}

// ============================================
// OBTENER FERIADOS DE UN PROYECTO (para pintar en el HTML)
// ============================================

function obtenerFeriadosParaHTML(spreadsheetId) {
  var feriados = [];
  try {
    var ssProyecto = SpreadsheetApp.openById(spreadsheetId);
    var hojaFeriados = ssProyecto.getSheetByName('Feriados');
    if (!hojaFeriados) return feriados;
    
    var ultimaFila = hojaFeriados.getLastRow();
    if (ultimaFila < 2) return feriados;
    
    var datos = hojaFeriados.getRange(2, 3, ultimaFila - 1, 1).getValues();
    for (var i = 0; i < datos.length; i++) {
      if (datos[i][0] instanceof Date) {
        var f = datos[i][0];
        feriados.push(f.getFullYear() + '-' + ('0' + (f.getMonth()+1)).slice(-2) + '-' + ('0' + f.getDate()).slice(-2));
      }
    }
  } catch(e) {}
  return feriados;
}

// ============================================
// HELPERS
// ============================================

function formatDate(fecha) {
  var d = fecha.getDate();
  var m = fecha.getMonth() + 1;
  var y = fecha.getFullYear();
  return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2) + 'T12:00:00';
}

function obtenerFeriadosDeProyecto(ss) {
  var hojaFeriados = ss.getSheetByName('Feriados');
  var feriados = [];
  if (!hojaFeriados) return feriados;
  
  var ultimaFila = hojaFeriados.getLastRow();
  if (ultimaFila < 2) return feriados;
  
  var datos = hojaFeriados.getRange(2, 3, ultimaFila - 1, 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] instanceof Date) {
      feriados.push(new Date(datos[i][0].getFullYear(), datos[i][0].getMonth(), datos[i][0].getDate()).getTime());
    }
  }
  return feriados;
}

function calcularDiasHabilesSimple(fechaInicio, fechaFin, feriados) {
  var dias = 0;
  var fecha = new Date(fechaInicio.getTime());
  while (fecha <= fechaFin) {
    var dow = fecha.getDay();
    if (dow !== 0 && dow !== 6) {
      var ts = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
      if (feriados.indexOf(ts) === -1) dias++;
    }
    fecha.setDate(fecha.getDate() + 1);
  }
  return Math.max(dias, 1);
}
