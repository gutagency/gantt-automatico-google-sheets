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
  // Cascatas no primeiro nível (bem visíveis): a data sob o cursor é a âncora
  // (fica fixa) e a direção é definida pela opção escolhida, NÃO pela coluna.
  ui.createMenu('🤖 Agente GUT')
    .addItem('⬇️ Cascata normal — Recalcular as seguintes (cursor na linha da tarefa)', 'cascadaNormalDesdeFecha')
    .addItem('⬆️ Cascata inversa — Recalcular as anteriores (cursor na linha da tarefa)', 'cascadaInversaDesdeFecha')
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
  // Cascatas no primeiro nível para que o cliente as veja de imediato.
  ui.createMenu('🤝 Agente Meli')
    .addItem('⬇️ Cascata normal — Recalcular as seguintes (cursor na linha da tarefa)', 'cascadaNormalMeli')
    .addItem('⬆️ Cascata inversa — Recalcular as anteriores (cursor na linha da tarefa)', 'cascadaInversaMeli')
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
// Cascadas GUT desde la fecha del cursor (las que usa el menú Agente GUT).
function cascadaNormalDesdeFecha() { GanttLib.cascadaNormalDesdeFecha(); }
function cascadaInversaDesdeFecha() { GanttLib.cascadaInversaDesdeFecha(); }
// Stubs Meli: cascadas desde la fecha del cursor sobre la hoja "Gantt Meli".
function cascadaNormalMeli() { GanttLib.cascadaNormalDesdeFechaMeli(); }
function cascadaInversaMeli() { GanttLib.cascadaInversaDesdeFechaMeli(); }
// Cascada inversa anclada en "Fim de veiculação" (B5): DESACTIVADA del menú.
// El ancla en una celda fija es frágil (si el cliente agrega o reordena filas,
// la referencia apunta a otra celda). Ahora todas las fechas se tratan igual:
// el usuario se ubica en la fecha y elige la dirección.
// function cascadaInversaMeliFimVeiculacao() { GanttLib.cascadaInversaMeliInterna(); }
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
