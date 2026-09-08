/**
 * GANTT - WRAPPER (v2)
 * Usa la biblioteca maestra "GanttLib" (proyecto de Copia Juli).
 *
 * Config de la librería (panel izquierdo → Libraries → +):
 *   Script ID:   16Vg486Y1d_qY6wgh6l4JVY8JUwXmY-esWfnTaB8Miy0ZctZqFnfIA5lb
 *   Version:     HEAD (Development mode)
 *   Identifier:  GanttLib
 *
 * NOVEDAD vs wrapper anterior:
 * - Se agrega el handler de EDICIÓN de celdas (alEditar) que delega en
 *   GanttLib.onEdit(e). Esto habilita la sincronización Días <-> Fechas al
 *   editar a mano en Entrada Proceso Creativo (requiere librería v2.11+).
 * - instalarTriggerAutomatico() ahora instala DOS triggers: onChange (cambios)
 *   y onEdit (edición de celdas, vía alEditar). Hay que correrlo una vez por copia.
 *
 * Por qué el handler de edición se llama "alEditar" y no "onEdit":
 * - "onEdit" es nombre de trigger SIMPLE: si la función se llamara así, Google
 *   la correría sola, sin autorización, y choca con la librería en HEAD (igual
 *   que nos pasó con onOpen). Usándola como trigger INSTALABLE con otro nombre,
 *   corre con la autorización del que la instaló y es confiable.
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
    .addItem('⬆️ Cascata inversa — a partir de "Fim de veiculação"', 'cascadaInversaMeli')
    .addItem('⬇️ Cascata normal — a partir da Data Início da primeira tarefa', 'cascadaNormalMeli')
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
// Stubs Meli: funciones propias de Meli (layout ESQUEMA_MELI, hoja "Gantt Meli")
function cascadaInversaMeli() { GanttLib.cascadaInversaMeliInterna(); }
function cascadaNormalMeli() { GanttLib.cascadaNormalMeliInterna(); }
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
