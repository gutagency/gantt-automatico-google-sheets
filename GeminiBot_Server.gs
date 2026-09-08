/**
 * GEMINI BOT — Asistente AI para el Gantt
 * Sidebar dentro del Google Sheet con chat en lenguaje natural.
 * Usa la API de Gemini para interpretar instrucciones y ejecutar funciones.
 */

// ============================================
// SYSTEM PROMPT — Define el comportamiento del bot
// ============================================

var SYSTEM_PROMPT = 'Sos un asistente que ejecuta acciones en un Gantt de Google Sheets. Respondé en el idioma en que te escriba el usuario (español o portugués). Sé directo y ejecutá sin preguntar de más.\n\n' +
  'TABLA: La hoja "Entrada Proceso Creativo" tiene columnas: A=Actividad, B=Días, C=Fecha Inicio, D=Fecha Fin, E=Day Off\n\n' +
  'ACCIONES QUE PODÉS EJECUTAR (respondé SIEMPRE con JSON cuando el usuario pide una acción):\n\n' +
  '1. moverTareaAFecha — Mover una tarea a una fecha específica\n' +
  '   Ejemplo usuario: "Mové BRIEF al lunes 06 de julio"\n' +
  '   Respuesta: {"accion":"moverTareaAFecha","parametros":{"tarea":"BRIEF","fechaInicio":"06/07/2026"},"mensaje":"Moviendo BRIEF al 06/07/2026..."}\n\n' +
  '2. moverTarea — Mover una tarea X días adelante o atrás\n' +
  '   Ejemplo: "Corré SHOOTING 3 días para adelante"\n' +
  '   Respuesta: {"accion":"moverTarea","parametros":{"tarea":"SHOOTING","dias":3,"direccion":"adelante"},"mensaje":"Moviendo SHOOTING 3 días..."}\n\n' +
  '3. cambiarDiasTarea — Cambiar la duración de una tarea\n' +
  '   Ejemplo: "Que CREATIVIDAD dure 5 días"\n' +
  '   Respuesta: {"accion":"cambiarDiasTarea","parametros":{"tarea":"CREATIVIDAD","dias":5},"mensaje":"Cambiando a 5 días..."}\n\n' +
  '4. generarGantt — Generar el Gantt visual\n' +
  '   Ejemplo: "Generá el Gantt" / "Creá el Gantt"\n' +
  '   Respuesta: {"accion":"generarGantt","parametros":{},"mensaje":"Generando Gantt..."}\n\n' +
  '5. cascadaInversaEtapaActual — Correr cascada inversa\n' +
  '   Ejemplo: "Cascada inversa en etapa produccion desde fecha fin 01 de noviembre"\n' +
  '   Respuesta: {"accion":"cascadaInversaEtapaActual","parametros":{"etapa":"PRODUCCION","fechaFin":"01/11/2026"},"mensaje":"Ejecutando cascada inversa..."}\n' +
  '   Si no dice etapa ni fecha: {"accion":"cascadaInversaEtapaActual","parametros":{},"mensaje":"Ejecutando cascada inversa..."}\n\n' +
  '6. cascadaNormalEtapaActual — Correr cascada normal\n' +
  '   Ejemplo: "Cascada normal en etapa creativa desde 15 de julio"\n' +
  '   Respuesta: {"accion":"cascadaNormalEtapaActual","parametros":{"etapa":"CREATIVA","fechaInicio":"15/07/2026"},"mensaje":"Ejecutando cascada normal..."}\n' +
  '   Si no dice etapa ni fecha: {"accion":"cascadaNormalEtapaActual","parametros":{},"mensaje":"Ejecutando cascada normal..."}\n\n' +
  'REGLAS IMPORTANTES:\n' +
  '- Si el usuario pide una ACCIÓN (mover, cascada, generar, etc.), respondé con el JSON directo. No expliques el proceso.\n' +
  '- Si el usuario hace una PREGUNTA (cómo funciona? qué es? explicame?), respondé en texto normal con la explicación.\n' +
  '- NUNCA digas "mi función es generar JSON" ni "no puedo explicar". Si te preguntan algo, explicá.\n' +
  '- Si dice "correr X al lunes" o "mover X a tal fecha", usá moverTareaAFecha.\n' +
  '- Si dice "correr X 3 días" (sin fecha específica), usá moverTarea.\n' +
  '- "Correr" = "mover". "Cascadear" = cascada.\n' +
  '- "Solapar", "superponer", "en paralelo" = mover la tarea para que empiece en la misma fecha que la otra. Usá moverTareaAFecha con la Fecha Inicio de la tarea de referencia (leéla del estado actual del sheet).\n' +
  '- Las fechas se interpretan como dd/mm/aaaa. Si dice "06 de julio" y estamos en 2026, es 06/07/2026.\n' +
  '- Si dice "sábado y domingo" de una semana específica, calculá las fechas exactas.\n' +
  '- "Se trabaja", "sea laborable", "es laboral", "trabaja el finde" = agregarDayOff.\n' +
  '- Si el usuario da la fecha y la tarea en mensajes separados, combiná la info del historial.\n' +
  '- Si solo dice un nombre de tarea sin más contexto, preguntá qué quiere hacer con ella.\n' +
  '- No pidas confirmación ni hagas preguntas innecesarias. Ejecutá directo.\n\n' +
  '7. agregarDayOff — Marcar que una tarea trabaja un fin de semana o feriado\n' +
  '   Esto escribe las fechas en la columna E (Day Off) de esa tarea.\n' +
  '   Ejemplo: "SHOOTING trabaja el sábado 26 de julio"\n' +
  '   Respuesta: {"accion":"agregarDayOff","parametros":{"tarea":"SHOOTING","fechas":["26/07/2026"]},"mensaje":"Marcando 26/07/2026 como día laboral para SHOOTING..."}\n\n' +
  '   Ejemplo: "CREATIVIDAD trabaja el finde del 26 y 27 de julio"\n' +
  '   Respuesta: {"accion":"agregarDayOff","parametros":{"tarea":"CREATIVIDAD","fechas":["26/07/2026","27/07/2026"]},"mensaje":"Marcando sábado y domingo como laborables para CREATIVIDAD..."}\n\n' +
  '   Ejemplo: "En BRIEF se trabaja el feriado del 9 de julio"\n' +
  '   Respuesta: {"accion":"agregarDayOff","parametros":{"tarea":"BRIEF","fechas":["09/07/2026"]},"mensaje":"Marcando feriado 09/07 como laboral para BRIEF..."}\n';

// ============================================
// ABRIR SIDEBAR
// ============================================

function abrirAsistenteAI() {
  var nombre = obtenerNombreUsuarioBot();
  var html = HtmlService.createHtmlOutputFromFile('GeminiBot_UI')
    .setWidth(500)
    .setHeight(800);
  // Inyectar el nombre del usuario en el HTML
  var htmlContent = html.getContent().replace('{{NOMBRE_USUARIO}}', nombre);
  var htmlFinal = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(500)
    .setHeight(800);
  SpreadsheetApp.getUi().showModelessDialog(htmlFinal, '🤖 Asistente Gantt');
}

function obtenerNombreUsuarioBot() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return '';
    // Tomar la parte antes del @ y capitalizar
    var parteNombre = email.split('@')[0];
    // Reemplazar puntos y guiones por espacios
    parteNombre = parteNombre.replace(/[._-]/g, ' ');
    // Capitalizar cada palabra
    var palabras = parteNombre.split(' ');
    for (var i = 0; i < palabras.length; i++) {
      if (palabras[i].length > 0) {
        palabras[i] = palabras[i].charAt(0).toUpperCase() + palabras[i].substring(1).toLowerCase();
      }
    }
    return palabras[0] || ''; // Solo el primer nombre
  } catch(e) {
    return '';
  }
}

// ============================================
// PROCESAR MENSAJE DEL USUARIO
// ============================================

function procesarMensajeBot(mensajeUsuario) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { tipo: 'texto', contenido: '❌ No se encontró la API key de Gemini. Contactá al admin.' };
  }
  
  // Agregar contexto actual del sheet
  var contextoActual = obtenerContextoActual();
  var promptCompleto = SYSTEM_PROMPT + '\n\nESTADO ACTUAL DEL SHEET:\n' + contextoActual;
  
  // Llamar a Gemini
  var respuestaGemini = llamarGemini(apiKey, promptCompleto, mensajeUsuario);
  
  if (!respuestaGemini) {
    return { tipo: 'texto', contenido: '❌ Error al comunicar con Gemini.' };
  }
  
  // Intentar parsear como JSON (acción)
  try {
    // Buscar JSON en la respuesta
    var jsonMatch = respuestaGemini.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var accion = JSON.parse(jsonMatch[0]);
      if (accion.accion) {
        // Ejecutar la acción
        var resultado = ejecutarAccion(accion);
        return { tipo: 'accion', contenido: accion.mensaje || 'Ejecutado.', resultado: resultado };
      }
    }
  } catch(e) {
    // No es JSON, es texto normal
  }
  
  // Respuesta de texto
  return { tipo: 'texto', contenido: respuestaGemini };
}

// ============================================
// OBTENER CONTEXTO ACTUAL DEL SHEET
// ============================================

function obtenerContextoActual() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Entrada Proceso Creativo');
  if (!hoja) return 'No se encontró la hoja.';
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return 'La tabla está vacía.';
  
  var datos = hoja.getRange(2, 1, Math.min(ultimaFila - 1, 30), 5).getValues();
  var lineas = [];
  
  for (var i = 0; i < datos.length; i++) {
    var act = datos[i][0];
    if (!act) continue;
    var dias = datos[i][1] || '';
    var ini = datos[i][2] instanceof Date ? formatFechaCorta(datos[i][2]) : '';
    var fin = datos[i][3] instanceof Date ? formatFechaCorta(datos[i][3]) : '';
    var exc = datos[i][4] || '';
    lineas.push('Fila ' + (i+2) + ': ' + act + ' | ' + dias + ' días | ' + ini + ' → ' + fin + (exc ? ' | DayOff: ' + exc : ''));
  }
  
  return lineas.join('\n');
}

function formatFechaCorta(fecha) {
  return ('0' + fecha.getDate()).slice(-2) + '/' + ('0' + (fecha.getMonth()+1)).slice(-2) + '/' + fecha.getFullYear();
}

// ============================================
// LLAMAR A LA API DE GEMINI
// ============================================

function llamarGemini(apiKey, systemPrompt, mensajeUsuario) {
  // Usar Vertex AI con OAuth (funciona en orgs Workspace)
  var projectId = 'gantt-consolidation';
  var location = 'us-central1';
  var model = 'gemini-2.5-flash';
  
  var url = 'https://' + location + '-aiplatform.googleapis.com/v1/projects/' + projectId + '/locations/' + location + '/publishers/google/models/' + model + ':generateContent';
  
  var token = ScriptApp.getOAuthToken();
  
  var payload = {
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\n---\n\nUSUARIO: ' + mensajeUsuario }] }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024
    }
  };
  
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var code = response.getResponseCode();
    var body = response.getContentText();
    
    if (code !== 200) {
      Logger.log('Vertex AI error ' + code + ': ' + body.substring(0, 500));
      return null;
    }
    
    var json = JSON.parse(body);
    
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      return json.candidates[0].content.parts[0].text;
    }
    
    return null;
  } catch(e) {
    Logger.log('Vertex AI exception: ' + e.message);
    return null;
  }
}

// ============================================
// EJECUTAR ACCIÓN DEVUELTA POR GEMINI
// ============================================

function ejecutarAccion(accion) {
  var nombre = accion.accion;
  var params = accion.parametros || {};
  
  try {
    switch(nombre) {
      case 'cascadaInversaEtapaActual':
        var etapaInv = params.etapa || '';
        var fechaFinInv = params.fechaFin || '';
        if (etapaInv && fechaFinInv) {
          return cascadaInversaEtapaBot(etapaInv, fechaFinInv);
        }
        cascadaInversaEtapaActual();
        return 'Cascada inversa ejecutada.';
        
      case 'cascadaNormalEtapaActual':
        var etapaNorm = params.etapa || '';
        var fechaInicioNorm = params.fechaInicio || '';
        if (etapaNorm && fechaInicioNorm) {
          return cascadaNormalEtapaBot(etapaNorm, fechaInicioNorm);
        }
        cascadaNormalEtapaActual();
        return 'Cascada normal ejecutada.';
        
      case 'generarGantt':
        generarGantt();
        return 'Gantt generado.';
        
      case 'leerGanttActualizarFechas':
        leerGanttActualizarFechas();
        return 'Fechas actualizadas desde el timeline.';
        
      case 'copiarGanttACliente':
        copiarGanttACliente();
        return 'Gantt copiado al cliente.';
        
      case 'moverTarea':
        return moverTareaBot(params.tarea, params.dias, params.direccion);
        
      case 'moverTareaAFecha':
        return moverTareaAFechaBot(params.tarea, params.fechaInicio);
      
      case 'agregarDayOff':
        return agregarDayOffBot(params.tarea, params.fechas);
        
      case 'cambiarDiasTarea':
        return cambiarDiasTareaBot(params.tarea, params.dias);
      
      case 'solaparTareas':
        return solaparTareasBot(params.tarea, params.diasSolapamiento);
        
      default:
        return 'Acción no reconocida: ' + nombre;
    }
  } catch(e) {
    return 'Error al ejecutar: ' + e.message;
  }
}

// ============================================
// ACCIONES CUSTOM PARA EL BOT
// ============================================

function moverTareaBot(nombreTarea, dias, direccion) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Entrada Proceso Creativo');
  if (!hoja) return 'Hoja no encontrada.';
  
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 4).getValues();
  
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString().toUpperCase().indexOf(nombreTarea.toUpperCase()) !== -1) {
      var fila = i + 2;
      var inicio = datos[i][2];
      var fin = datos[i][3];
      
      if (!(inicio instanceof Date) || !(fin instanceof Date)) return 'La tarea no tiene fechas válidas.';
      
      var offset = (direccion === 'adelante' || direccion === 'forward') ? dias : -dias;
      
      var nuevoInicio = new Date(inicio.getTime());
      nuevoInicio.setDate(nuevoInicio.getDate() + offset);
      var nuevoFin = new Date(fin.getTime());
      nuevoFin.setDate(nuevoFin.getDate() + offset);
      
      hoja.getRange(fila, 3).setValue(nuevoInicio);
      hoja.getRange(fila, 4).setValue(nuevoFin);
      hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
      
      return 'Tarea "' + datos[i][0] + '" movida ' + dias + ' días ' + direccion + '.';
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}

function agregarDayOffBot(nombreTarea, fechas) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Entrada Proceso Creativo');
  if (!hoja) return 'Hoja no encontrada.';
  
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues();
  
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString().toUpperCase().indexOf(nombreTarea.toUpperCase()) !== -1) {
      var fila = i + 2;
      var valorActual = datos[i][4] ? datos[i][4].toString().trim() : '';
      
      // Si ya tiene fechas, agregar las nuevas
      var nuevasFechas = fechas.join(', ');
      if (valorActual && valorActual !== 'TRUE' && valorActual !== 'SI' && valorActual !== 'YES') {
        nuevasFechas = valorActual + ', ' + nuevasFechas;
      }
      
      hoja.getRange(fila, 5).setNumberFormat('@');
      hoja.getRange(fila, 5).setValue(nuevasFechas);
      
      return 'Day Off agregado para "' + datos[i][0] + '": ' + fechas.join(', ') + '. Recordá correr la cascada para recalcular.';
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}

function moverTareaAFechaBot(nombreTarea, fechaInicioStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Entrada Proceso Creativo');
  if (!hoja) return 'Hoja no encontrada.';
  
  var nuevaInicio = convertirAFecha(fechaInicioStr);
  if (!nuevaInicio) return 'No pude interpretar la fecha: ' + fechaInicioStr;
  
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 4).getValues();
  var feriados = obtenerFeriados();
  
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString().toUpperCase().indexOf(nombreTarea.toUpperCase()) !== -1) {
      var fila = i + 2;
      var dias = parseInt(datos[i][1]) || 1;
      
      var nuevaFin = sumarDiasHabiles(nuevaInicio, dias - 1, feriados);
      
      hoja.getRange(fila, 3).setValue(nuevaInicio);
      hoja.getRange(fila, 4).setValue(nuevaFin);
      hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
      
      return 'Tarea "' + datos[i][0] + '" movida al ' + fechaInicioStr + '. Fecha Fin: ' + formatFechaCorta(nuevaFin) + ' (' + dias + ' días).';
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}

function cambiarDiasTareaBot(nombreTarea, nuevoDias) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Entrada Proceso Creativo');
  if (!hoja) return 'Hoja no encontrada.';
  
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 4).getValues();
  var feriados = obtenerFeriados();
  
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString().toUpperCase().indexOf(nombreTarea.toUpperCase()) !== -1) {
      var fila = i + 2;
      var inicio = datos[i][2];
      
      if (!(inicio instanceof Date)) return 'La tarea no tiene Fecha Inicio.';
      
      hoja.getRange(fila, 2).setValue(nuevoDias);
      var nuevaFin = sumarDiasHabiles(inicio, nuevoDias - 1, feriados);
      hoja.getRange(fila, 4).setValue(nuevaFin);
      hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
      
      return 'Tarea "' + datos[i][0] + '" cambiada a ' + nuevoDias + ' días. Nueva Fecha Fin: ' + formatFechaCorta(nuevaFin);
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}
 