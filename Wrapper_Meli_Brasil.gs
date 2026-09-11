/**
 * GANTT - WRAPPER Meli Brasil
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

  // Menu interno da agência (todas as opções) — em português
  ui.createMenu('🤖 Agente GUT')
    .addItem('⬆️ Cascata inversa — colocar Data Fim na última tarefa da etapa', 'cascadaInversaEtapaActual')
    .addItem('⬇️ Cascata normal — colocar Data Início na primeira tarefa da etapa', 'cascadaNormalEtapaActual')
    .addItem('↕️ Cascata a partir da posição do cursor. Na Data Início cascateia para cima, na Data Fim cascateia para baixo.', 'cascadaDesdeCursorSubgrupo')
    .addSeparator()
    .addItem('📊 Gerar Gantt neste documento', 'generarGantt')
    .addItem('🔄 Ler Gantt → Atualizar datas', 'leerGanttActualizarFechas')
    .addItem('📤 Copiar Gantt para o Cliente', 'copiarGanttACliente')
    .addItem('📄 Gerar resumo (Google Doc)', 'generarResumenEnDoc')
    .addSeparator()
    .addItem('⚙️ Instalar gatilho automático', 'instalarTriggerAutomatico')
    .addSeparator()
    .addItem('🤖 Assistente AI', 'abrirAsistenteAI')
    .addItem('👋 Onboarding (avatar) — em desenvolvimento', 'abrirOnboarding')
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
function abrirOnboarding() {
  // Aviso: funcionalidade em desenvolvimento (evita gerar falsa expectativa).
  SpreadsheetApp.getUi().alert('👋 Onboarding (avatar)\n\nEsta funcionalidade ainda está em desenvolvimento. Em breve estará disponível.');
  GanttLib.abrirOnboarding();
}
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

  SpreadsheetApp.getUi().alert('Gatilhos instalados: mudanças (onChange) + edição de células (onEdit).');
}
