/**
 * PROVISIONER — Automatización de creación de proyectos Gantt
 * Vive en: "Meli - Gantt - Proyectos - config"
 * Spreadsheet ID: 1GodELCUQ4Qik7Mc-dESyqWQ1mQd2RhH1Hc3yzzqYDPo
 *
 * Funciones:
 * - crearNuevoProyecto(): crea folder + subcarpetas + copia template + registra
 * - obtenerSiguienteNumeroTemplate(): calcula el próximo número
 *
 * MULTI-TEMPLATE: hay un template por wrapper (ver PROV_TEMPLATES). Cada uno
 * es un spreadsheet maestro con su wrapper ya pegado, y numera sus proyectos
 * de forma independiente según su prefijo.
 *
 * IDs hardcodeados:
 * - Folder "Production Timeline Processing": 13HMLUcFLn8zE7xQf3j_FMr47lSn4176P
 * - GanttLib Script ID: 16Vg486Y1d_qY6wgh6l4JVY8JUwXmY-esWfnTaB8Miy0ZctZqFnfIA5lb
 * - Los IDs de cada template spreadsheet están en PROV_TEMPLATES.
 */

var PROV_CONFIG = {
  FOLDER_PRODUCCION_ID: '13HMLUcFLn8zE7xQf3j_FMr47lSn4176P',
  GANTTLIB_SCRIPT_ID: '16Vg486Y1d_qY6wgh6l4JVY8JUwXmY-esWfnTaB8Miy0ZctZqFnfIA5lb',
  SUBFOLDER_ENTRADA: '1) Gantt-pdf-productora-entrada',
  SUBFOLDER_PROCESADOS: '2) Gantt-pdf-productora-procesados Tabla',
  CELDA_URL_ENTRADA: 'C9',  // En tab Instrucciones
  TAB_INSTRUCCIONES: 'Instrucciones'
};

// ============================================
// TEMPLATES DISPONIBLES — uno por wrapper
// Cada template es un spreadsheet maestro que YA tiene pegado su wrapper
// correspondiente y la librería GanttLib configurada.
// Cada uno numera sus proyectos de forma independiente, según su prefijo.
//
// Para agregar un template nuevo: sumá un objeto acá y un .addItem() en onOpen().
// ============================================

var PROV_TEMPLATES = [
  {
    clave: 'gut',
    nombre: 'GUT — interno (inglés)',
    templateId: 'PEGAR_ID_DEL_TEMPLATE_GUT',
    prefijo: 'GUT Gantt - Template ',
    wrapper: 'Wrapper_Gantt_v2.gs'
  },
  {
    clave: 'meli_brasil',
    nombre: 'Meli Brasil (portugués)',
    templateId: '1HkBknMmnsGv3l33CvmTRwHDdDJg4f-cPpJgrNo_B0hs',
    prefijo: 'Meli Gantt - Template ',
    wrapper: 'Wrapper_Meli_Brasil.gs'
  },
  {
    clave: 'general_brasil',
    nombre: 'General Brasil (portugués)',
    templateId: 'PEGAR_ID_DEL_TEMPLATE_GENERAL_BRASIL',
    prefijo: 'Gantt Brasil - Template ',
    wrapper: 'Wrapper_general_Brasil.gs'
  }
];

// Devuelve la config de un template por su clave, o null si no existe.
function obtenerTemplatePorClave(clave) {
  for (var i = 0; i < PROV_TEMPLATES.length; i++) {
    if (PROV_TEMPLATES[i].clave === clave) return PROV_TEMPLATES[i];
  }
  return null;
}

// ============================================
// MENÚ DEL PROVISIONER — un ítem por template
// ============================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Provisioner')
    .addItem('➕ Nuevo proyecto — GUT (inglés)', 'crearProyectoGut')
    .addItem('➕ Nuevo proyecto — Meli Brasil (PT)', 'crearProyectoMeliBrasil')
    .addItem('➕ Nuevo proyecto — General Brasil (PT)', 'crearProyectoGeneralBrasil')
    .addToUi();
}

// Un stub por template: los ítems de menú no pueden pasar parámetros.
function crearProyectoGut() { crearNuevoProyecto('gut'); }
function crearProyectoMeliBrasil() { crearNuevoProyecto('meli_brasil'); }
function crearProyectoGeneralBrasil() { crearNuevoProyecto('general_brasil'); }

// ============================================
// CREAR NUEVO PROYECTO
// ============================================

function crearNuevoProyecto(claveTemplate) {
  var ui = SpreadsheetApp.getUi();
  
  // 0. Resolver el template elegido
  var tpl = obtenerTemplatePorClave(claveTemplate);
  if (!tpl) {
    ui.alert('No se encontró el template "' + claveTemplate + '" en PROV_TEMPLATES.');
    return;
  }
  if (tpl.templateId.indexOf('PEGAR_ID') === 0) {
    ui.alert('Falta configurar el ID del template "' + tpl.nombre + '".\n\n' +
      'Editá PROV_TEMPLATES en Provisioner.gs y pegá el ID del spreadsheet maestro.');
    return;
  }
  
  // 1. Calcular siguiente número, según el prefijo de ESTE template
  var siguienteNum = obtenerSiguienteNumeroTemplate(tpl.prefijo);
  var nombreProyecto = tpl.prefijo + siguienteNum;
  
  // Confirmar con el usuario
  var respuesta = ui.alert(
    '➕ Crear nuevo proyecto',
    '¿Crear "' + nombreProyecto + '"?\n\n' +
    'Template: ' + tpl.nombre + '\n' +
    'Wrapper: ' + tpl.wrapper + '\n\n' +
    'Se va a:\n' +
    '• Crear carpeta en Drive con subcarpetas\n' +
    '• Copiar el template del spreadsheet\n' +
    '• Pegar la URL de entrada en Instrucciones\n' +
    '• Registrar en este sheet',
    ui.ButtonSet.YES_NO
  );
  
  if (respuesta !== ui.Button.YES) return;
  
  try {
    // 2. Crear folder del proyecto dentro de "Production Timeline Processing"
    var folderPadre = DriveApp.getFolderById(PROV_CONFIG.FOLDER_PRODUCCION_ID);
    var folderProyecto = folderPadre.createFolder(nombreProyecto);
    
    // 3. Crear subcarpetas
    var folderEntrada = folderProyecto.createFolder(PROV_CONFIG.SUBFOLDER_ENTRADA);
    var folderProcesados = folderProyecto.createFolder(PROV_CONFIG.SUBFOLDER_PROCESADOS);
    
    // 4. Copiar el template del spreadsheet elegido
    var templateFile = DriveApp.getFileById(tpl.templateId);
    var nuevoFile = templateFile.makeCopy(nombreProyecto, folderProyecto);
    var nuevoSpreadsheet = SpreadsheetApp.openById(nuevoFile.getId());
    
    // 5. Escribir URL de carpeta de entrada en celda C9 de Instrucciones
    var hojaInstrucciones = nuevoSpreadsheet.getSheetByName(PROV_CONFIG.TAB_INSTRUCCIONES);
    if (hojaInstrucciones) {
      var urlEntrada = 'https://drive.google.com/drive/folders/' + folderEntrada.getId();
      hojaInstrucciones.getRange(PROV_CONFIG.CELDA_URL_ENTRADA).setValue(urlEntrada);
    }
    
    // 6. Registrar en el sheet maestro (este documento)
    registrarProyecto(nombreProyecto, folderEntrada.getId(), folderProcesados.getId(),
      nuevoFile.getId(), tpl.nombre);
    
    // 7. Confirmar éxito
    ui.alert(
      '✅ Proyecto creado',
      '"' + nombreProyecto + '" creado exitosamente.\n\n' +
      '• Spreadsheet: ' + nuevoSpreadsheet.getUrl() + '\n' +
      '• Carpeta entrada: ' + folderEntrada.getUrl() + '\n' +
      '• Carpeta procesados: ' + folderProcesados.getUrl(),
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert('❌ Error al crear proyecto: ' + error.message);
  }
}

// ============================================
// OBTENER SIGUIENTE NÚMERO DE TEMPLATE
// Verifica tanto las carpetas en Drive como la columna A del sheet maestro
// y toma el mayor de ambos para evitar duplicados.
// ============================================

// prefijo: el de cada template, así cada uno numera de forma independiente
// (Meli Gantt - Template 4 y GUT Gantt - Template 1 pueden coexistir).
function obtenerSiguienteNumeroTemplate(prefijo) {
  var maxNum = 0;
  
  // Fuente 1: Carpetas en Drive
  var folderPadre = DriveApp.getFolderById(PROV_CONFIG.FOLDER_PRODUCCION_ID);
  var subfolders = folderPadre.getFolders();
  
  while (subfolders.hasNext()) {
    var folder = subfolders.next();
    var nombre = folder.getName();
    
    if (nombre.indexOf(prefijo) === 0) {
      var numStr = nombre.substring(prefijo.length).trim();
      var num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  
  // Fuente 2: Columna A del sheet maestro
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheets()[0];
  var ultimaFila = hoja.getLastRow();
  
  if (ultimaFila >= 2) {
    var nombres = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
    for (var i = 0; i < nombres.length; i++) {
      var nom = nombres[i][0] ? nombres[i][0].toString() : '';
      if (nom.indexOf(prefijo) === 0) {
        var numStr2 = nom.substring(prefijo.length).trim();
        var num2 = parseInt(numStr2, 10);
        if (!isNaN(num2) && num2 > maxNum) {
          maxNum = num2;
        }
      }
    }
  }
  
  return maxNum + 1;
}

// ============================================
// REGISTRAR PROYECTO EN EL SHEET MAESTRO
// Agrega una fila con los datos del nuevo proyecto
// Columnas: A=nombre, B=folder_entrada_id, C=folder_procesados_id, D=spreadsheet_salida_id, E=activo, F=notas, G=template
// ============================================

function registrarProyecto(nombre, folderEntradaId, folderProcesadosId, spreadsheetId, nombreTemplate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheets()[0]; // Primera tab
  
  var ultimaFila = hoja.getLastRow();
  var nuevaFila = ultimaFila + 1;
  
  hoja.getRange(nuevaFila, 1).setValue(nombre);
  hoja.getRange(nuevaFila, 2).setValue(folderEntradaId);
  hoja.getRange(nuevaFila, 3).setValue(folderProcesadosId);
  hoja.getRange(nuevaFila, 4).setValue(spreadsheetId);
  hoja.getRange(nuevaFila, 5).setValue('SI');
  hoja.getRange(nuevaFila, 6).setValue('Creado automáticamente');
  hoja.getRange(nuevaFila, 7).setValue(nombreTemplate || '');
}
