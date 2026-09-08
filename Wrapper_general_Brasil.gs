/**
 * GANTT - WRAPPER General Brasil
 * Copia del wrapper base. Usa la biblioteca maestra "GanttLib".
 *
 * Config de la librería (panel izquierdo → Libraries → +):
 *   Script ID:   16Vg486Y1d_qY6wgh6l4JVY8JUwXmY-esWfnTaB8Miy0ZctZqFnfIA5lb
 *   Version:     HEAD (Development mode)
 *   Identifier:  GanttLib
 *
 * De momento es idéntico al wrapper base. Se diferenciará más adelante.
 */

// ============================================
// MENÚ - se construye LOCAL (sin auth, sin depender de la librería)
// ============================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  // Menú interno de la agencia (todas las opciones)
  ui.createMenu('🤖 Agente GUT')
    .addItem('⬆️ Cascada inversa — poner Fecha Fin en última tarea de la etapa', 'cascadaInversaEtapaActual')
    .addItem('⬇️ Cascada normal — poner Fecha Inicio en primera tarea de la etapa', 'cascadaNormalEtapaActual')
    .addItem('↕️ Cascada desde ubicación del cursor. Ubicado en Fecha Inicio cascadea arriba, ubicado en Fecha Fin cascadea abajo.', 'cascadaDesdeCursorSubgrupo')
    .addSeparator()
    .addItem('📊 Generar Gantt en este documento', 'generarGantt')
    .addItem('🔄 Leer Gantt → Actualizar fechas', 'leerGanttActualizarFechas')
    .addItem('📤 Copiar Gantt a Cliente', 'copiarGanttACliente')
    .addItem('📄 Generar resumen (Google Doc)', 'generarResumenEnDoc')
    .addSeparator()
    .addItem('⚙️ Instalar trigger automático', 'instalarTriggerAutomatico')
    .addSeparator()
    .addItem('🤖 Asistente AI', 'abrirAsistenteAI')
    .addItem('👋 Onboarding (avatar)', 'abrirOnboarding')
    .addToUi();

  // Menú do cliente (opções reduzidas, operam sobre a aba "Gantt Meli") — em português
  ui.createMenu('🤝 Agente Meli')
    .addItem('⬆️ Cascata inversa — colocar Data Fim na última tarefa da etapa', 'cascadaInversaMeli')
    .addItem('⬇️ Cascata normal — colocar Data Início na primeira tarefa da etapa', 'cascadaNormalMeli')
    .addItem('↕️ Cascata a partir da posição do cursor. Em Data Início cascateia para cima; em Data Fim cascateia para baixo.', 'cascadaDesdeCursorMeli')
    .addSeparator()
    .addItem('📊 Gerar Gantt neste documento', 'generarGanttMeli')
    .addSeparator()
    .addItem('🤖 Assistente AI', 'abrirAsistenteAI')
    .addToUi();
}

// ============================================
// HANDLERS DE TRIGGERS (instalables) - delegan en la librería
// ============================================

// Cambios estructurales / de contenido (Producción, Feriados, Instrucciones)
function onChange(e) {
  GanttLib.onChange(e);
}

// Edición de celdas a mano -> sincroniza Días <-> Fechas en la fila editada
function alEditar(e) {
  GanttLib.onEdit(e);
}

// ============================================
// WRAPPERS DEL MENÚ - delegan en la librería al clickear
// ============================================

function cascadaInversa() { GanttLib.cascadaInversa(); }
function cascadaNormal() { GanttLib.cascadaNormal(); }
function cascadaDesdeCursor() { GanttLib.cascadaDesdeCursor(); }
function cascadaInversaSubgrupos() { GanttLib.cascadaInversaSubgrupos(); }
function cascadaNormalSubgrupos() { GanttLib.cascadaNormalSubgrupos(); }
function cascadaDesdeCursorSubgrupo() { GanttLib.cascadaDesdeCursorSubgrupo(); }
function cascadaInversaEtapaActual() { GanttLib.cascadaInversaEtapaActual(); }
function cascadaNormalEtapaActual() { GanttLib.cascadaNormalEtapaActual(); }
// Stubs Meli: llaman a las mismas funciones pero sobre la hoja "Gantt Meli"
function cascadaInversaMeli() { GanttLib.cascadaInversaEtapaActual('Gantt Meli'); }
function cascadaNormalMeli() { GanttLib.cascadaNormalEtapaActual('Gantt Meli'); }
function cascadaDesdeCursorMeli() { GanttLib.cascadaDesdeCursorSubgrupo('Gantt Meli'); }
function generarGanttMeli() { GanttLib.generarGanttInlineMeli(); }
function generarGantt() { GanttLib.generarGantt(); }
function leerGanttActualizarFechas() { GanttLib.leerGanttActualizarFechas(); }
function generarGanttConExcepciones(excepcionesJSON) { GanttLib.generarGanttConExcepciones(excepcionesJSON); }
function reejecutarCascadaConExcepciones(excepcionesJSON, tipoCascada) { GanttLib.reejecutarCascadaConExcepciones(excepcionesJSON, tipoCascada); }
function copiarGanttACliente() { GanttLib.copiarGanttACliente(); }
function abrirAsistenteAI() { GanttLib.abrirAsistenteAI(); }
function abrirOnboarding() { GanttLib.abrirOnboarding(); }
function generarResumenEnDoc() { GanttLib.generarResumenEnDoc(); }
function procesarMensajeBot(msg) { return GanttLib.procesarMensajeBot(msg); }

// ============================================
// INSTALAR TRIGGERS - una sola vez por copia (lo corre el admin)
// Instala onChange + onEdit (alEditar). Requiere autorización.
// ============================================

function instalarTriggerAutomatico() {
  // Limpiar triggers previos de estos handlers para no duplicar
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'onChange' || fn === 'alEditar') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.newTrigger('onChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  ScriptApp.newTrigger('alEditar')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert('Triggers instalados: cambios (onChange) + edición de celdas (onEdit).');
}
