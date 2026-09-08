/**
 * DASHBOARD SERVER — Backend para la web app consolidada
 * Vive en: "Meli - Gantt - Proyectos - config"
 *
 * Funciones:
 * - doGet(): sirve la web app (Dashboard_UI.html)
 * - obtenerDatosConsolidados(): lee todos los sheets activos y devuelve JSON
 */

// ============================================
// WEB APP ENTRY POINT
// ============================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard_UI')
    .setTitle('Gantt Consolidado — Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// OBTENER DATOS CONSOLIDADOS DE TODOS LOS PROYECTOS ACTIVOS
// ============================================

function obtenerDatosConsolidados() {
  var ss = SpreadsheetApp.openById('1GodELCUQ4Qik7Mc-dESyqWQ1mQd2RhH1Hc3yzzqYDPo');
  var hoja = ss.getSheets()[0];
  var ultimaFila = hoja.getLastRow();
  
  if (ultimaFila < 2) return [];
  
  // Leer columnas: A=nombre, B=folder_entrada, C=folder_procesados, D=spreadsheet_id, E=activo
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues();
  
  var resultado = [];
  
  for (var i = 0; i < datos.length; i++) {
    var nombre = datos[i][0];
    var spreadsheetId = datos[i][3];
    var activo = datos[i][4];
    
    // Solo procesar proyectos activos
    if (!activo || activo.toString().toUpperCase() !== 'SI') continue;
    if (!spreadsheetId || spreadsheetId.toString().trim() === '') continue;
    
    try {
      var tareas = leerTareasDeProyecto(spreadsheetId.toString().trim(), nombre.toString());
      resultado = resultado.concat(tareas);
    } catch (e) {
      // Si falla un sheet, seguir con los demás
      resultado.push({
        proyecto: nombre.toString(),
        actividad: '⚠️ Error al leer: ' + e.message,
        dias: '',
        fechaInicio: '',
        fechaFin: '',
        etapa: ''
      });
    }
  }
  
  return resultado;
}

// ============================================
// LEER TAREAS DE UN PROYECTO (un spreadsheet)
// ============================================

function leerTareasDeProyecto(spreadsheetId, nombreProyecto) {
  var tareas = [];
  
  var ssProyecto = SpreadsheetApp.openById(spreadsheetId);
  var hojaCreativo = ssProyecto.getSheetByName('Entrada Proceso Creativo');
  
  if (!hojaCreativo) return tareas;
  
  var ultimaFila = hojaCreativo.getLastRow();
  if (ultimaFila < 2) return tareas;
  
  var datos = hojaCreativo.getRange(2, 1, ultimaFila - 1, 4).getValues(); // A:D
  var etapaActual = '';
  
  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    var dias = datos[i][1];
    var inicio = datos[i][2];
    var fin = datos[i][3];
    
    if (!actividad) continue;
    
    var actStr = actividad.toString().toUpperCase().trim();
    
    // Detectar headers de etapa
    if (actStr === 'ETAPA CREATIVA' || actStr === 'PROCESO CREATIVO' || 
        actStr === 'DESARROLLO CREATIVO' || actStr === 'DESENVOLVIMENTO CRIATIVO') {
      etapaActual = 'Creativo';
      continue;
    }
    if (actStr === 'ETAPA PRODUCCION' || actStr === 'PRODUCTION PLANNING' ||
        actStr === 'PRODUCCIÓN' || actStr === 'PRODUCCION' || actStr === 'PRODUÇÃO') {
      etapaActual = 'Producción';
      continue;
    }
    if (actStr === 'DESARROLLO ESTRATEGIA DIGITAL' || actStr === 'DESENVOLVIMENTO ESTRATÉGIA DIGITAL') {
      etapaActual = 'Digital';
      continue;
    }
    
    // Solo incluir tareas con fechas
    if (!inicio || !fin) continue;
    if (!(inicio instanceof Date) || !(fin instanceof Date)) continue;
    
    tareas.push({
      proyecto: nombreProyecto,
      actividad: actividad.toString(),
      dias: dias ? dias.toString() : '',
      fechaInicio: formatearFechaParaHTML(inicio),
      fechaFin: formatearFechaParaHTML(fin),
      etapa: etapaActual
    });
  }
  
  return tareas;
}

// ============================================
// FORMATEAR FECHA PARA HTML (dd/MM/yyyy)
// ============================================

function formatearFechaParaHTML(fecha) {
  if (!fecha || !(fecha instanceof Date)) return '';
  var d = ('0' + fecha.getDate()).slice(-2);
  var m = ('0' + (fecha.getMonth() + 1)).slice(-2);
  var a = fecha.getFullYear();
  return d + '/' + m + '/' + a;
}
