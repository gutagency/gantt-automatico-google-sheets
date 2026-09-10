/**
 * GANTT AUTOMÁTICO - Apps Script
 * VERSIÓN 2.16 - Soporte multi-marca (Mercado Libre / Mercado Pago).
 *
 * CAMBIO vs 2.15:
 * - Tareas predeterminadas por marca: arrays TAREAS_MERCADO_LIBRE y TAREAS_MERCADO_PAGO
 *   con agrupadores y actividades de cada una.
 * - obtenerMarcaSeleccionada(): lee checkbox D10/F10 de Instrucciones.
 * - poblarTareasPredeterminadas(): al cambiar el checkbox de marca, limpia
 *   "Entrada Proceso Creativo" y escribe las tareas de la marca seleccionada
 *   en el idioma activo. Checkboxes mutuamente excluyentes.
 * - esFilaHeaderSubgrupo() y obtenerLimitesSubgrupos(): ahora reconocen los
 *   agrupadores de Mercado Pago (DESARROLLO CREATIVO, DESARROLLO ESTRATEGIA
 *   DIGITAL, PRODUCCIÓN) además de los de Mercado Libre.
 * - generarGantt(): formato condicional según marca:
 *   - ML: formato actual (2 filas header, colores por tipo de tarea).
 *   - MP: 3 filas header (Mes, Día, Letra), colores por grupo (rojo/naranja/lila),
 *     fines de semana gris claro, feriados gris oscuro, columna completa sombreada.
 * - obtenerActividadesCreativo(): ahora detecta subgrupos y asigna sección
 *   correspondiente (creativo/digital/produccion) a cada actividad.
 *
 * CAMBIO vs 2.14 (heredado):
 * - obtenerLimitesSubgrupos(hoja): detecta los rangos de filas de cada subgrupo
 *   (PROCESO CREATIVO / PRODUCTION PLANNING) en "Entrada Proceso Creativo",
 *   excluyendo las filas header del rango de actividades.
 * - cascadaInversaSubgrupos(): ejecuta la cascada inversa de forma independiente
 *   sobre cada subgrupo detectado, tomando la Fecha Fin de la última actividad
 *   de cada uno como ancla.
 * - cascadaNormalSubgrupos(): ejecuta la cascada normal de forma independiente
 *   sobre cada subgrupo detectado, tomando la Fecha Inicio de la primera
 *   actividad de cada uno como ancla (ajustando a día hábil si es necesario).
 *
 * CAMBIO vs 2.13 (heredado):
 * - marcarSuperposicionEntrada(): tras una edición a mano en Entrada Proceso
 *   Creativo, revisa todas las tareas y pinta de CELESTE (#A2DCF0) las celdas
 *   Fecha Inicio/Fecha Fin (C:D) de las filas cuyos rangos se cruzan con otra
 *   tarea; limpia las que ya no se superponen. Si hay superposición, muestra un
 *   toast "Estás superponiendo fechas a mano".
 * - Se llama desde onEdit (al editar) y desde las cascadas (para limpiar marcas
 *   viejas cuando se rearma una línea secuencial sin superposición).
 *
 * CAMBIO vs 2.12 (heredado):
 * - Gantt/timeline: celdas de superposición en azul claro (#9FC5E8).
 *
 * CAMBIO vs 2.11 (heredado):
 * - Grilla punteada (DOTTED gris) sobre el área usada del Gantt y del timeline.
 *
 * CAMBIO vs 2.10 (heredado):
 * - onEdit(e): sincronización bidireccional Días <-> Fechas en la fila editada
 *   a mano (sin cascada), para permitir superponer tareas.
 *
 * CAMBIO vs 2.9 (heredado):
 * - Feriados: normalización + validación de la columna C, vía onChange.
 *
 * CAMBIO vs 2.8 (heredado):
 * - Las barras se pintan SOLO en días hábiles (finde/feriado conservan sombreado).
 *
 * CAMBIO vs 2.7 (heredado):
 * - Traducción del texto de Instrucciones (ES <-> PT) + anclas bilingües.
 *
 * Entrada Proceso Creativo: Actividad | Días | Fecha Inicio | Fecha Fin
 * Entrada Producción: Actividad | Fecha Inicio | Fecha Fin (no se modifica)
 * Feriados: País (A) | ... | Fecha (C)
 *
 * Funciones:
 * - Cascada inversa: desde fecha fin última, calcula hacia arriba
 * - Cascada normal: desde fecha inicio primera, calcula hacia abajo
 * - Cascada desde cursor: respeta la fila del cursor, cascadea arriba (col C) o abajo (col D)
 * - Generar Gantt: unifica ambas tablas con DELIVERY/AIR DATE al final
 * - Filtro de feriados por país (Argentina, Brasil, México City, Chile)
 */

// ============================================
// CONFIGURACIÓN
// ============================================

var CONFIG = {
  HOJA_CREATIVO: 'Gantt GUT',
  HOJA_PRODUCCION: 'Entrada Producción',
  HOJA_FERIADOS: 'Feriados',
  HOJA_GANTT: 'Gantt',
  HOJA_INSTRUCCIONES: 'Instrucciones',
  HOJA_LOGS: 'Logs',
  HOJA_MELI: 'Gantt Meli',   // Hoja del cliente (layout propio, ver ESQUEMA_MELI)

  // Columnas de la tabla de entrada GUT (Gantt GUT):
  // A=Actividad, B=Días, C=Inicio, D=Fin, E=Day Off (oculta/inactiva),
  // F=Status, G=Responsible, H+=timeline
  COL_TIMELINE_INICIO: 8,    // el timeline (barras) empieza en la columna H (solo GUT)
  
  // Colores
  COLOR_CREATIVO: '#FFF5DC',       // Crema (default)
  COLOR_PRODUCCION: '#FFF5DC',     // Crema
  COLOR_CREATIVE: '#F4A460',       // Naranja - CREATIVE DEVELOPMENT, ADJUSTMENTS
  COLOR_PRESENTACION: '#FFD700',   // Amarillo - PRESENTATION, FEEDBACK, REUNIÓN, APROBACIÓN
  COLOR_DELIVERY: '#90EE90',       // Verde - DELIVERY
  COLOR_AIR: '#FF6B6B',            // Rojo - AIR DATE
  COLOR_LILA: '#DDA0DD',           // Lila - BUSQUEDA, BID, KICK OFF, PRODUCCIÓN, GO PRODUCTORA
  COLOR_FINDE_BARRA: '#D3D3D3',    // Gris claro - fines de semana en barras (igual que feriados)
  COLOR_FERIADO_BARRA: '#D3D3D3',  // Gris claro - feriados en barras
  COLOR_FERIADO_HEADER: '#FFF5DC', // Crema
  COLOR_FINDE_HEADER: '#FFF5DC',   // Crema (todo el header igual)
  COLOR_HEADER: '#FFF5DC',         // Crema para header
  COLOR_HEADER_TEXT: '#000000',    // Negro
  COLOR_SUPERPOSICION: '#9FC5E8',  // Azul claro - celdas del Gantt donde se superponen 2+ tareas
  COLOR_AVISO_SUPERPOSICION: '#A2DCF0', // Celeste - celdas de fecha (C:D) de entrada cuando hay superposición
  
  // Color de barras - Pedidos Ya (rojo suave de marca)
  PY_COLOR_BARRA: '#EF9A9A',       // Rojo suave - barras del Gantt para Pedidos Ya
  
  // Colores Mercado Pago - Gantt
  MP_COLOR_AGRUPADOR_CREATIVO: '#CC0000',       // Rojo - Desarrollo Creativo
  MP_COLOR_AGRUPADOR_DIGITAL: '#FF6D00',        // Naranja - Desarrollo Estrategia Digital
  MP_COLOR_AGRUPADOR_PRODUCCION: '#7B3F9E',     // Violeta - Producción
  MP_COLOR_AGRUPADOR_TEXT: '#FFFFFF',            // Blanco - texto agrupadores
  MP_COLOR_BARRA_CREATIVO: '#E06666',           // Rosa/rojo claro - barras Desarrollo Creativo (>1 día)
  MP_COLOR_BARRA_CREATIVO_FUERTE: '#CC0000',    // Rojo fuerte - barras Desarrollo Creativo (1 día)
  MP_COLOR_BARRA_DIGITAL: '#FF9900',            // Naranja claro - barras Desarrollo Estrategia Digital (>1 día)
  MP_COLOR_BARRA_DIGITAL_FUERTE: '#FF6D00',     // Naranja fuerte - barras Desarrollo Estrategia Digital (1 día)
  MP_COLOR_BARRA_PRODUCCION: '#B4A7D6',         // Lila claro - barras Producción (>1 día)
  MP_COLOR_BARRA_PRODUCCION_FUERTE: '#7B3F9E',  // Violeta fuerte - barras Producción (1 día)
  MP_COLOR_FINDE: '#F3F3F3',                    // Gris claro - fines de semana
  MP_COLOR_FERIADO: '#D9D9D9'                   // Gris más oscuro - feriados
};

// ============================================
// ESQUEMA DE COLUMNAS DE LA HOJA "Gantt Meli"
// Layout propio del cliente (distinto al de GUT):
//   A=Macro Tema (agrupador si B vacía), B=Tarefa, C=Owner, D=Dias,
//   E=Início, F=Fim, G=Status, H=Link, I+=timeline.
//   Las tareas arrancan en la fila 8. La cascada inversa se ancla en
//   "Fim de veiculação" (celda B5).
// ============================================

var ESQUEMA_MELI = {
  COL_MACRO: 1,        // A - Macro Tema (agrupador cuando la col Tarefa está vacía)
  COL_TAREA: 2,        // B - Tarefa (nombre de la tarea)
  COL_OWNER: 3,        // C - Owner (responsable)
  COL_DIAS: 4,         // D - Dias
  COL_INICIO: 5,       // E - Início
  COL_FIN: 6,          // F - Fim
  COL_STATUS: 7,       // G - Status
  COL_LINK: 8,         // H - Link
  COL_TIMELINE_INICIO: 9, // I - donde empieza el timeline inline
  FILA_INICIO_TAREAS: 8,  // primera fila de tareas/agrupadores
  CELDA_FIM_VEICULACAO: 'B5' // fecha ancla para la cascada inversa
};

// ============================================
// DICCIONARIO DE TRADUCCIONES (ESPAÑOL → PORTUGUÉS)
// ============================================

var TRADUCCIONES_PT = {
  // Mercado Libre - Agrupadores de etapa
  'ETAPA CREATIVA': 'ETAPA CRIATIVA',
  'ETAPA PRODUCCION': 'ETAPA PRODUÇÃO',
  'ETAPA PRODUCCIÓN': 'ETAPA PRODUÇÃO',
  'BRIEF': 'BRIEFING',
  'DEBRIEF': 'DEBRIEFING',
  'REUNIÓN MANAGEMENT': 'REUNIÃO MANAGEMENT',
  'REUNION MANAGEMENT': 'REUNIÃO MANAGEMENT',
  'KICK OFF': 'KICK OFF',
  'ESTRATEGIA & CREATIVIDAD': 'ESTRATÉGIA & CRIATIVIDADE',
  'CREATIVIDAD ROUND #1 I NARRATIVA 1.0': 'CRIATIVIDADE ROUND #1 I Narrativa 1.0',
  'FEEDBACK CLIENTE ROUND #1': 'FEEDBACK CLIENTE ROUND #1',
  'CELEBRITY I VALIDACIÓN': 'CELEBRITY I Validação',
  'CELEBRITY I VALIDACION': 'CELEBRITY I Validação',
  'MEDIOS I TOUCHPOINT BAU': 'MÍDIA I Touchpoint BAU',
  'AJUSTES CREATIVIDAD + ROLL OUT': 'AJUSTES CRIATIVIDADE + ROLL OUT',
  'CREATIVIDAD ROUND #2 I NARRATIVA 2.0': 'CRIATIVIDADE ROUND #2 I Narrativa 2.0',
  'FEEDBACK CLIENTE ROUND #2': 'FEEDBACK CLIENTE ROUND #2',
  'MEDIOS I BRIEF CON LÍNEA CREATIVA': 'MÍDIA I Brief com linha criativa',
  'MEDIOS I BRIEF CON LINEA CREATIVA': 'MÍDIA I Brief com linha criativa',
  'CREATIVIDAD ROUND #3 I NARRATIVA 3.0': 'CRIATIVIDADE ROUND #3 I Narrativa 3.0',
  'FEEDBACK CLIENTE ROUND #3': 'FEEDBACK CLIENTE ROUND #3',
  'CELEBRITY I ENVÍO GUIONES FINALES': 'CELEBRITY I envio roteiros finais',
  'CELEBRITY I ENVIO GUIONES FINALES': 'CELEBRITY I envio roteiros finais',
  'CELEBRITY I APROBACIÓN GUIONES FINALES': 'CELEBRITY I aprovação roteiros finais',
  'CELEBRITY I APROBACION GUIONES FINALES': 'CELEBRITY I aprovação roteiros finais',
  'MEDIOS I DEADLINE PLAN DE MEDIOS': 'MÍDIA I Deadline plano de mídia',
  'APROBACIÓN FINAL CREATIVIDAD': 'APROVAÇÃO FINAL CRIATIVIDADE',
  'APROBACION FINAL CREATIVIDAD': 'APROVAÇÃO FINAL CRIATIVIDADE',
  'BUSQUEDA DE PRODUCTORAS': 'BUSCA DE PRODUTORAS',
  'BÚSQUEDA DE PRODUCTORAS': 'BUSCA DE PRODUTORAS',
  'KICK OFF PRODUCCIÓN + ARMADO BID SPECS': 'KICK OFF PRODUÇÃO + ARMADO BID SPECS',
  'KICK OFF PRODUCCION + ARMADO BID SPECS': 'KICK OFF PRODUÇÃO + ARMADO BID SPECS',
  'COTIZACIÓN + TRATAMIENTOS': 'COTAÇÃO + TRATAMENTOS',
  'COTIZACION + TRATAMIENTOS': 'COTAÇÃO + TRATAMENTOS',
  'PRESENTACIÓN TRATAMIENTO AGENCIA': 'APRESENTAÇÃO TRATAMENTO AGÊNCIA',
  'PRESENTACION TRATAMIENTO AGENCIA': 'APRESENTAÇÃO TRATAMENTO AGÊNCIA',
  'PRESENTACIÓN TRATAMIENTO CLIENTE': 'APRESENTAÇÃO TRATAMENTO CLIENTE',
  'PRESENTACION TRATAMIENTO CLIENTE': 'APRESENTAÇÃO TRATAMENTO CLIENTE',
  'ASIGNACIÓN PRODUCTORA + INFORMATIVA': 'ATRIBUIÇÃO PRODUTORA + INFORMATIVA',
  'ASIGNACION PRODUCTORA + INFORMATIVA': 'ATRIBUIÇÃO PRODUTORA + INFORMATIVA',
  'DELIVERY DATE': 'DELIVERY DATE',
  'AIR DATE': 'AIR DATE',
  // Mercado Pago - Agrupadores
  'DESARROLLO CREATIVO': 'DESENVOLVIMENTO CRIATIVO',
  'DESARROLLO ESTRATEGIA DIGITAL': 'DESENVOLVIMENTO ESTRATÉGIA DIGITAL',
  'PRODUCCIÓN': 'PRODUÇÃO',
  'PRODUCCION': 'PRODUÇÃO',
  // Mercado Pago - Tareas
  'BRIEF CON CLIENTE': 'Brief com cliente',
  'KICKOFF INTERNO': 'Kickoff interno',
  'SET UP ESTRATÉGICO': 'Setup estratégico',
  'SET UP ESTRATEGICO': 'Setup estratégico',
  'DESARROLLO CREATIVO + TP INTERNOS': 'Desenvolvimento criativo + TPs internos',
  '1º ROUND (RUTAS CREATIVAS)': '1º Round (Rotas criativas)',
  'FEEDBACK (ELECCIÓN DE RUTA CREATIVA)': 'Feedback (escolha da rota criativa)',
  'FEEDBACK (ELECCION DE RUTA CREATIVA)': 'Feedback (escolha da rota criativa)',
  'ENTREGA PLAN DE MEDIOS CON FECHAS CLAVE': 'Entrega Plano de mídia com datas-chave',
  'AJUSTES CREATIVOS + BAJADA DEPLOYMENT 360º': 'Ajustes criativos + desdobramento deployment 360º',
  '2º ROUND (DEPLOYMENT)': '2º Round (Deployment)',
  'FEEDBACK': 'Feedback',
  'AJUSTES CREATIVOS DEPLOYMENT': 'Ajustes criativos deployment',
  '3º ROUND': '3º Round',
  'APROBACIÓN FINAL DEPLOYMENT': 'Aprovação final deployment',
  'APROBACION FINAL DEPLOYMENT': 'Aprovação final deployment',
  'DESARROLLO ESTRATEGIA DIGITAL': 'Desenvolvimento estratégia digital',
  'REVISIÓN ESTRATEGIA DIGITAL': 'Revisão Estratégia digital',
  'REVISION ESTRATEGIA DIGITAL': 'Revisão Estratégia digital',
  'FEEDBACK + AJUSTES + APROBACIÓN': 'Feedback + Ajustes + Aprovação',
  'FEEDBACK + AJUSTES + APROBACION': 'Feedback + Ajustes + Aprovação',
  'DESARROLLO BRIEF INFLUENCERS': 'Desenvolvimento brief influenciadores',
  'REVISIÓN BRIEF INFLUENCERS': 'Revisão brief influenciadores',
  'REVISION BRIEF INFLUENCERS': 'Revisão brief influenciadores',
  'KICK OFF PRODUCCIÓN (TODO TBC CONTRA TT REAL DE PH)': 'Kick off Produção (Tudo TBC contra TT real de PH)',
  'KICK OFF PRODUCCION (TODO TBC CONTRA TT REAL DE PH)': 'Kick off Produção (Tudo TBC contra TT real de PH)',
  'BRIEF PH': 'Brief PH',
  'COTIZACIÓN + TRATAMIENTOS': 'Cotação + Tratamentos',
  'COTIZACION + TRATAMIENTOS': 'Cotação + Tratamentos',
  'TRATAMIENTOS AGENCIA + CLIENTE': 'Tratamentos Agência + Cliente',
  'ASIGNACIÓN PRODUCTORA': 'Atribuição produtora',
  'ASIGNACION PRODUCTORA': 'Atribuição produtora',
  'PRE PRODUCCIÓN': 'Pré-produção',
  'PRE PRODUCCION': 'Pré-produção',
  'PPM | AGENCIA': 'PPM | Agência',
  'PPM | CLIENTE': 'PPM | Cliente',
  'SHOOTING FILM': 'Shooting film',
  'POST PRODUCCIÓN FOTO': 'Pós-produção foto',
  'POST PRODUCCION FOTO': 'Pós-produção foto',
  'ENTREGA KV': 'Entrega KV',
  'POST PRODUCCIÓN VIDEOS': 'Pós-produção vídeos',
  'POST PRODUCCION VIDEOS': 'Pós-produção vídeos',
  'ENTREGA ESCALONADAS VIDEOS + LLENADO GANTT': 'Entregas escalonadas vídeos + preenchimento gantt',
  'AIRE': 'Ar'
};

// ============================================
// DICCIONARIO INVERSO (PORTUGUÉS → ESPAÑOL)
// ============================================

var TRADUCCIONES_ES = {
  // Mercado Libre - Agrupadores de etapa
  'ETAPA CRIATIVA': 'ETAPA CREATIVA',
  'ETAPA PRODUÇÃO': 'ETAPA PRODUCCION',
  'BRIEFING': 'BRIEF',
  'DEBRIEFING': 'DEBRIEF',
  'REUNIÃO MANAGEMENT': 'REUNIÓN MANAGEMENT',
  'KICK OFF': 'KICK OFF',
  'ESTRATÉGIA & CRIATIVIDADE': 'ESTRATEGIA & CREATIVIDAD',
  'CRIATIVIDADE ROUND #1 I NARRATIVA 1.0': 'CREATIVIDAD ROUND #1 I Narrativa 1.0',
  'FEEDBACK CLIENTE ROUND #1': 'FEEDBACK CLIENTE ROUND #1',
  'CELEBRITY I VALIDAÇÃO': 'CELEBRITY I Validación',
  'MÍDIA I TOUCHPOINT BAU': 'MEDIOS I Touchpoint BAU',
  'AJUSTES CRIATIVIDADE + ROLL OUT': 'AJUSTES CREATIVIDAD + ROLL OUT',
  'CRIATIVIDADE ROUND #2 I NARRATIVA 2.0': 'CREATIVIDAD ROUND #2 I Narrativa 2.0',
  'FEEDBACK CLIENTE ROUND #2': 'FEEDBACK CLIENTE ROUND #2',
  'MÍDIA I BRIEF COM LINHA CRIATIVA': 'MEDIOS I Brief con línea creativa',
  'CRIATIVIDADE ROUND #3 I NARRATIVA 3.0': 'CREATIVIDAD ROUND #3 I Narrativa 3.0',
  'FEEDBACK CLIENTE ROUND #3': 'FEEDBACK CLIENTE ROUND #3',
  'CELEBRITY I ENVIO ROTEIROS FINAIS': 'CELEBRITY I envío guiones finales',
  'CELEBRITY I APROVAÇÃO ROTEIROS FINAIS': 'CELEBRITY I aprobación guiones finales',
  'MÍDIA I DEADLINE PLANO DE MÍDIA': 'MEDIOS I Deadline plan de medios',
  'APROVAÇÃO FINAL CRIATIVIDADE': 'APROBACIÓN FINAL CREATIVIDAD',
  'BUSCA DE PRODUTORAS': 'BUSQUEDA DE PRODUCTORAS',
  'KICK OFF PRODUÇÃO + ARMADO BID SPECS': 'KICK OFF PRODUCCIÓN + ARMADO BID SPECS',
  'COTAÇÃO + TRATAMENTOS': 'COTIZACIÓN + TRATAMIENTOS',
  'APRESENTAÇÃO TRATAMENTO AGÊNCIA': 'PRESENTACIÓN TRATAMIENTO AGENCIA',
  'APRESENTAÇÃO TRATAMENTO CLIENTE': 'PRESENTACIÓN TRATAMIENTO CLIENTE',
  'ATRIBUIÇÃO PRODUTORA + INFORMATIVA': 'ASIGNACIÓN PRODUCTORA + INFORMATIVA',
  'DELIVERY DATE': 'DELIVERY DATE',
  'AIR DATE': 'AIR DATE',
  // Mercado Pago - Agrupadores
  'DESENVOLVIMENTO CRIATIVO': 'DESARROLLO CREATIVO',
  'DESENVOLVIMENTO ESTRATÉGIA DIGITAL': 'DESARROLLO ESTRATEGIA DIGITAL',
  'PRODUÇÃO': 'PRODUCCIÓN',
  // Mercado Pago - Tareas
  'BRIEF COM CLIENTE': 'Brief con cliente',
  'KICKOFF INTERNO': 'Kickoff interno',
  'SETUP ESTRATÉGICO': 'Set up estratégico',
  'SETUP ESTRATEGICO': 'Set up estratégico',
  'DESENVOLVIMENTO CRIATIVO + TPS INTERNOS': 'Desarrollo creativo + TP internos',
  '1º ROUND (ROTAS CRIATIVAS)': '1º Round (Rutas creativas)',
  'FEEDBACK (ESCOLHA DA ROTA CRIATIVA)': 'Feedback (elección de ruta creativa)',
  'ENTREGA PLANO DE MÍDIA COM DATAS-CHAVE': 'Entrega Plan de medios con fechas clave',
  'AJUSTES CRIATIVOS + DESDOBRAMENTO DEPLOYMENT 360º': 'Ajustes creativos + bajada deployment 360º',
  '2º ROUND (DEPLOYMENT)': '2º Round (Deployment)',
  'FEEDBACK': 'Feedback',
  'AJUSTES CRIATIVOS DEPLOYMENT': 'Ajustes creativos deployment',
  '3º ROUND': '3º Round',
  'APROVAÇÃO FINAL DEPLOYMENT': 'Aprobación final deployment',
  'DESENVOLVIMENTO ESTRATÉGIA DIGITAL': 'Desarrollo estrategia digital',
  'REVISÃO ESTRATÉGIA DIGITAL': 'Revisión Estrategia digital',
  'FEEDBACK + AJUSTES + APROVAÇÃO': 'Feedback + Ajustes + Aprobación',
  'DESENVOLVIMENTO BRIEF INFLUENCIADORES': 'Desarrollo brief influencers',
  'REVISÃO BRIEF INFLUENCIADORES': 'Revisión brief influencers',
  'KICK OFF PRODUÇÃO (TUDO TBC CONTRA TT REAL DE PH)': 'Kick off Producción (Todo TBC contra TT real de PH)',
  'BRIEF PH': 'Brief PH',
  'COTAÇÃO + TRATAMENTOS': 'Cotización + tratamientos',
  'TRATAMENTOS AGÊNCIA + CLIENTE': 'Tratamientos Agencia + Cliente',
  'ATRIBUIÇÃO PRODUTORA': 'Asignación productora',
  'PRÉ-PRODUÇÃO': 'Pre producción',
  'PPM | AGÊNCIA': 'PPM | Agencia',
  'PPM | CLIENTE': 'PPM | Cliente',
  'SHOOTING FILM': 'Shooting film',
  'PÓS-PRODUÇÃO FOTO': 'Post producción foto',
  'ENTREGA KV': 'Entrega KV',
  'PÓS-PRODUÇÃO VÍDEOS': 'Pós-produção vídeos',
  'ENTREGAS ESCALONADAS VÍDEOS + PREENCHIMENTO GANTT': 'Entrega escalonadas videos + llenado gantt',
  'AR': 'Aire'
};

// ============================================
// TAREAS PREDETERMINADAS POR MARCA (en español)
// ============================================

var TAREAS_MERCADO_LIBRE = {
  agrupadores: ['ETAPA CREATIVA', 'ETAPA PRODUCCION'],
  tareas: [
    { agrupador: 'ETAPA CREATIVA', nombre: 'BRIEF', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'REUNIÓN MANAGEMENT', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'DEBRIEF', dias: 2 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'KICK OFF', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'ESTRATEGIA & CREATIVIDAD', dias: 7 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'CREATIVIDAD ROUND #1 I Narrativa 1.0', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'FEEDBACK CLIENTE ROUND #1', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'MEDIOS I Touchpoint BAU', dias: 4 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'AJUSTES CREATIVIDAD + ROLL OUT', dias: 6 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'CREATIVIDAD ROUND #2 I Narrativa 2.0', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'FEEDBACK CLIENTE ROUND #2', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'AJUSTES CREATIVIDAD + ROLL OUT', dias: 5 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'MEDIOS I Brief con línea creativa', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'CREATIVIDAD ROUND #3 I Narrativa 3.0', dias: 4 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'FEEDBACK CLIENTE ROUND #3', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'CELEBRITY I envío guiones finales', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'CELEBRITY I aprobación guiones finales', dias: 2 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'MEDIOS I Deadline plan de medios', dias: 1 },
    { agrupador: 'ETAPA CREATIVA', nombre: 'APROBACIÓN FINAL CREATIVIDAD', dias: 1 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'BUSQUEDA DE PRODUCTORAS', dias: 5 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'KICK OFF PRODUCCIÓN + ARMADO BID SPECS', dias: 1 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'COTIZACIÓN + TRATAMIENTOS', dias: 7 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'PRESENTACIÓN TRATAMIENTO AGENCIA', dias: 1 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'PRESENTACIÓN TRATAMIENTO CLIENTE', dias: 1 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'ASIGNACIÓN PRODUCTORA + INFORMATIVA', dias: 2 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'PRODUCCIÓN', dias: 25 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'DELIVERY DATE', dias: 5 },
    { agrupador: 'ETAPA PRODUCCION', nombre: 'AIR DATE', dias: 1 }
  ]
};

var TAREAS_MERCADO_PAGO = {
  agrupadores: ['DESARROLLO CREATIVO', 'DESARROLLO ESTRATEGIA DIGITAL', 'PRODUCCIÓN'],
  tareas: [
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Brief con cliente', dias: 1 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Kickoff interno', dias: 1 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Set up estratégico', dias: 4 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Desarrollo creativo + TP internos', dias: 12 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: '1º Round (Rutas creativas)', dias: 1 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Feedback (elección de ruta creativa)', dias: 2 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Entrega Plan de medios con fechas clave', dias: 5 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Ajustes creativos + bajada deployment 360º', dias: 6 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: '2º Round (Deployment)', dias: 1 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Feedback', dias: 2 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Ajustes creativos deployment', dias: 4 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: '3º Round', dias: 1 },
    { agrupador: 'DESARROLLO CREATIVO', nombre: 'Aprobación final deployment', dias: 1 },
    { agrupador: 'DESARROLLO ESTRATEGIA DIGITAL', nombre: 'Desarrollo estrategia digital', dias: 4 },
    { agrupador: 'DESARROLLO ESTRATEGIA DIGITAL', nombre: 'Revisión Estrategia digital', dias: 1 },
    { agrupador: 'DESARROLLO ESTRATEGIA DIGITAL', nombre: 'Feedback + Ajustes + Aprobación', dias: 4 },
    { agrupador: 'DESARROLLO ESTRATEGIA DIGITAL', nombre: 'Desarrollo brief influencers', dias: 5 },
    { agrupador: 'DESARROLLO ESTRATEGIA DIGITAL', nombre: 'Revisión brief influencers', dias: 1 },
    { agrupador: 'DESARROLLO ESTRATEGIA DIGITAL', nombre: 'Feedback + Ajustes + Aprobación', dias: 4 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Kick off Producción (Todo TBC contra TT real de PH)', dias: 1 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Brief PH', dias: 1 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Cotización + tratamientos', dias: 4 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Tratamientos Agencia + Cliente', dias: 1 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Asignación productora', dias: 2 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Pre producción', dias: 4 },
    { agrupador: 'PRODUCCIÓN', nombre: 'PPM | Agencia', dias: 1 },
    { agrupador: 'PRODUCCIÓN', nombre: 'PPM | Cliente', dias: 1 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Shooting film', dias: 2 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Post producción foto', dias: 3 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Entrega KV', dias: 1 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Post producción videos', dias: 10 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Entrega escalonadas videos + llenado gantt', dias: 10 },
    { agrupador: 'PRODUCCIÓN', nombre: 'Aire', dias: 1 }
  ]
};

// ============================================
// OBTENER MARCA SELECCIONADA DESDE INSTRUCCIONES (C11=ML / C12=MP / C13=Estándar)
// ============================================

function obtenerMarcaSeleccionada() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaInstrucciones = ss.getSheetByName(CONFIG.HOJA_INSTRUCCIONES);
  
  if (!hojaInstrucciones) return 'mercado_libre';
  
  // Marca: checkboxes en columna C, filas 11 (ML), 12 (MP), 13 (Estándar), 14 (Pedidos Ya)
  var checkMP = hojaInstrucciones.getRange('C12').getValue();
  var checkEstandar = hojaInstrucciones.getRange('C13').getValue();
  var checkPedidosYa = hojaInstrucciones.getRange('C14').getValue();
  
  if (checkMP === true || checkMP === 'TRUE' || checkMP === 'true') return 'mercado_pago';
  if (checkEstandar === true || checkEstandar === 'TRUE' || checkEstandar === 'true') return 'estandar';
  if (checkPedidosYa === true || checkPedidosYa === 'TRUE' || checkPedidosYa === 'true') return 'pedidos_ya';
  return 'mercado_libre';
}

// ============================================
// POBLAR TAREAS PREDETERMINADAS SEGÚN MARCA E IDIOMA
// Borra el contenido de "Entrada Proceso Creativo" y escribe agrupadores + tareas.
// ============================================

function poblarTareasPredeterminadas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  
  if (!hoja) return;
  
  var marca = obtenerMarcaSeleccionada();
  // Estándar usa el mismo set de tareas que Mercado Pago.
  var usaSetMercadoPago = (marca === 'mercado_pago' || marca === 'estandar');
  var datosMarca = usaSetMercadoPago ? TAREAS_MERCADO_PAGO : TAREAS_MERCADO_LIBRE;
  var idioma = obtenerIdiomaSeleccionado();
  var diccionario = (idioma === 'portugues') ? TRADUCCIONES_PT : null;
  
  // Limpiar contenido existente (preservar header fila 1)
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 2) {
    hoja.getRange(2, 1, ultimaFila - 1, hoja.getLastColumn()).clear();
  }
  
  // Escribir agrupadores + tareas
  var filaActual = 2;
  var agrupadorActual = '';
  
  for (var i = 0; i < datosMarca.tareas.length; i++) {
    var tarea = datosMarca.tareas[i];
    
    // Si cambia el agrupador, escribir la fila del agrupador
    if (tarea.agrupador !== agrupadorActual) {
      agrupadorActual = tarea.agrupador;
      // Escribir el agrupador traducido si el idioma es portugués (el valor
      // interno agrupadorActual queda en español para la lógica de colores).
      var agrupadorParaEscribir = agrupadorActual;
      if (diccionario) {
        var agrupadorUpper = agrupadorActual.toUpperCase().trim();
        if (diccionario[agrupadorUpper]) {
          agrupadorParaEscribir = diccionario[agrupadorUpper];
        }
      }
      hoja.getRange(filaActual, 1).setValue(agrupadorParaEscribir);
      
      // Colores del agrupador según marca (Estándar usa el mismo esquema que Mercado Pago)
      if (usaSetMercadoPago) {
        var normAgrup = agrupadorActual.toUpperCase().trim();
        var colorFondo, colorTexto;
        if (normAgrup === 'DESARROLLO CREATIVO') {
          colorFondo = CONFIG.MP_COLOR_AGRUPADOR_CREATIVO;
          colorTexto = CONFIG.MP_COLOR_AGRUPADOR_TEXT;
        } else if (normAgrup === 'DESARROLLO ESTRATEGIA DIGITAL') {
          colorFondo = CONFIG.MP_COLOR_AGRUPADOR_DIGITAL;
          colorTexto = CONFIG.MP_COLOR_AGRUPADOR_TEXT;
        } else {
          colorFondo = CONFIG.MP_COLOR_AGRUPADOR_PRODUCCION;
          colorTexto = CONFIG.MP_COLOR_AGRUPADOR_TEXT;
        }
        hoja.getRange(filaActual, 1, 1, 4).setBackground(colorFondo);
        hoja.getRange(filaActual, 1, 1, 4).setFontColor(colorTexto);
      } else {
        hoja.getRange(filaActual, 1, 1, 4).setBackground('#000000');
        hoja.getRange(filaActual, 1, 1, 4).setFontColor('#FFFFFF');
      }
      hoja.getRange(filaActual, 1).setFontWeight('bold');
      filaActual++;
    }
    
    // Escribir tarea (traducida si es portugués)
    var nombreTarea = tarea.nombre;
    if (diccionario) {
      var nombreUpper = nombreTarea.toUpperCase().trim();
      if (diccionario[nombreUpper]) {
        nombreTarea = diccionario[nombreUpper];
      }
    }
    
    hoja.getRange(filaActual, 1).setValue(nombreTarea);
    if (tarea.dias) {
      hoja.getRange(filaActual, 2).setValue(tarea.dias);
    }
    
    // Pintar color de fondo de la tarea (para ML usa colores por tipo, para MP/Estándar no se pinta)
    if (!usaSetMercadoPago) {
      var colorTarea = obtenerColorActividad(tarea.nombre);
      if (colorTarea !== CONFIG.COLOR_CREATIVO) {
        hoja.getRange(filaActual, 1).setBackground(colorTarea);
      }
    }
    
    filaActual++;
  }
  
  verificarHeadersCreativo(hoja);
  
  // Aplicar bordes sólidos finos a toda la tabla (header + datos, columnas A-D)
  var totalFilas = filaActual - 1; // filaActual ya avanzó una más de la última tarea
  if (totalFilas >= 1) {
    hoja.getRange(1, 1, totalFilas, 4)
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }
  
  var nombreMarca = (marca === 'mercado_pago') ? 'Mercado Pago' : (marca === 'estandar') ? 'Estándar' : (marca === 'pedidos_ya') ? 'Pedidos Ya' : 'Mercado Libre';
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Tareas predeterminadas cargadas para ' + nombreMarca + '.',
    '✅ Listo', 5);
}

// ============================================
// TRADUCIR ACTIVIDADES EN ENTRADA PROCESO CREATIVO
// ============================================

function traducirActividadesEnHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  
  if (!hoja) return;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  
  var idioma = obtenerIdiomaSeleccionado();
  var diccionario = (idioma === 'portugues') ? TRADUCCIONES_PT : TRADUCCIONES_ES;
  
  var rango = hoja.getRange(2, 1, ultimaFila - 1, 1);
  var valores = rango.getValues();
  
  for (var i = 0; i < valores.length; i++) {
    var actividad = valores[i][0];
    if (actividad) {
      var actividadUpper = actividad.toString().toUpperCase().trim();
      if (diccionario[actividadUpper]) {
        valores[i][0] = diccionario[actividadUpper];
      }
    }
  }
  
  rango.setValues(valores);
}

// ============================================
// DICCIONARIO DE TEXTOS DE LA TAB INSTRUCCIONES (ES <-> PT)
// ============================================

var PARES_INSTRUCCIONES = [
  {
    es: "Guia para usar el Gantt automatico consolidado",
    pt: "Guia para usar o Gantt automático consolidado"
  },
  {
    es: "Paso 1 - Copiar aca la URL del Spreasheet del cliente aqui donde se va pegar el drive",
    pt: "Passo 1 - Colar aqui a URL do Spreadsheet do cliente, onde o drive será conectado"
  },
  {
    es: "Recordar que la 'Tab' de salida del Gantt dentro del spreadsheet cliente, debe llamarse 'Gantt'",
    pt: "Lembrar que a 'Tab' de saída do Gantt dentro do spreadsheet do cliente deve se chamar 'Gantt'"
  },
  {
    es: "Recordar que la persona que activa el 🤖 Agente debe ser 'Editor' del spreadsheet de cliente",
    pt: "Lembrar que a pessoa que ativa o 🤖 Agente deve ser 'Editor' do spreadsheet do cliente"
  },
  {
    es: "Paso 2 - Seleccionar Feriados del pais que queremos reflejar en el Gantt de este proyecto",
    pt: "Passo 2 - Selecionar Feriados do país que queremos refletir no Gantt deste projeto"
  },
  {
    es: "México City",
    pt: "Cidade do México"
  },
  {
    es: "Paso 3 - Seleccionar idioma de las tareas en Gantt GUT",
    pt: "Passo 3 - Selecionar idioma das tarefas em Gantt GUT"
  },
  {
    es: "Español",
    pt: "Espanhol"
  },
  {
    es: "Portugues",
    pt: "Português"
  },
  {
    es: "Paso 4 - Esta es la folder en Drive para ingresar cada PDF Timeline de la productora, \ndentro de la carpeta 1) Gantt-pdf-productora-entrada.",
    pt: "Passo 4 - Esta é a pasta no Drive para inserir cada PDF Timeline da produtora, \ndentro da pasta 1) Gantt-pdf-productora-entrada."
  },
  {
    es: "🤖 Acciones disponibles en Agente",
    pt: "🤖 Ações disponíveis no Agente"
  },
  {
    es: "CASCADA INVERSA: Calcula fechas a partir de los días, respetando la fecha de Fin de la ultima actividad.",
    pt: "CASCADA INVERSA: Calcula datas a partir dos dias, respeitando a data de Fim da última atividade."
  },
  {
    es: "- Para crear la tabla inicial: Los días tiene que estar completos para que se calculas las fechas automaticamente.",
    pt: "- Para criar a tabela inicial: Os dias precisam estar completos para que as datas sejam calculadas automaticamente."
  },
  {
    es: "- Podés editar las actividades o los días como quieras (no rompe el Gantt)",
    pt: "- Você pode editar as atividades ou os dias como quiser (não quebra o Gantt)"
  },
  {
    es: "- Colocar solamente la Fecha Fin de ultima actividad de la lista (asegurar que esté en formato fecha), y click en 'Cascada inversa' para generar la primer tabla de fechas",
    pt: "- Colocar apenas a Data Fim da última atividade da lista (garantir que esteja em formato de data), e clicar em 'Cascada inversa' para gerar a primeira tabela de datas"
  },
  {
    es: "- Para editar en base a cantidad de día: Ajustar los días y luego click en 'Cascada inversa'",
    pt: "- Para editar com base na quantidade de dias: Ajustar os dias e depois clicar em 'Cascada inversa'"
  },
  {
    es: "CASCADA NORMAL: Calcula fechas a partir de los días, respetando la fecha de Inicio de la primera actividad.",
    pt: "CASCADA NORMAL: Calcula datas a partir dos dias, respeitando a data de Início da primeira atividade."
  },
  {
    es: "- Colocar solamente la Fecha Inicio de la primera actividad de la lista, y click en 'Cascada Normal' para generar la primer tabla de fechas",
    pt: "- Colocar apenas a Data Início da primeira atividade da lista, e clicar em 'Cascada Normal' para gerar a primeira tabela de datas"
  },
  {
    es: "Una vez creada la tabla con alguna de las funciones anteriores, puedo ajustar el Gantt a partir de cambiar la fecha inicio o la fecha de fin.",
    pt: "Depois de criar a tabela com alguma das funções anteriores, posso ajustar o Gantt mudando a data de início ou a data de fim."
  },
  {
    es: "Con este cambio, se ajustan automáticamente los días en función de las nuevas fechas, y se cascadea el ajuste hacia arriba o hacia abajo en la tabla",
    pt: "Com essa mudança, os dias se ajustam automaticamente em função das novas datas, e o ajuste é propagado em cascata para cima ou para baixo na tabela"
  },
  {
    es: "Para visualizar un gantt dentro del spreadsheet de GUT, click en 'Generar Gantt'",
    pt: "Para visualizar um gantt dentro do spreadsheet da GUT, clicar em 'Generar Gantt'"
  },
  {
    es: "Para visualizar el mismo gantt dentro del spreadsheet de CORP (cliente), click en 'Copiar Gantt a cliente'",
    pt: "Para visualizar o mesmo gantt dentro do spreadsheet da CORP (cliente), clicar em 'Copiar Gantt a cliente'"
  },
  {
    es: "📽️ Ingreso de PDF Timeline de Productoras",
    pt: "📽️ Inserção de PDF Timeline de Produtoras"
  },
  {
    es: "Una vez iniciado la etapa de Produccion del proyecto, vamos a recibir recibir Timelines en PDF de la Productora elegida.",
    pt: "Depois de iniciada a etapa de Produção do projeto, vamos receber Timelines em PDF da Produtora escolhida."
  },
  {
    es: "Cada nueva version que nos llega, tiene que cargarse (como lo hacemos con cualquier otro documento) en la folder 1) Gantt-pdf-productora-entrada",
    pt: "Cada nova versão que chega tem que ser carregada (como fazemos com qualquer outro documento) na pasta 1) Gantt-pdf-productora-entrada"
  },
  {
    es: "En el lapso de 3 minutos maximo, el PDF se procesa y aparecera cargado en la tab 'Entrada Produccion', con el mismo formato",
    pt: "No prazo de no máximo 3 minutos, o PDF é processado e aparecerá carregado na tab 'Entrada Produccion', com o mesmo formato"
  }
];

// ============================================
// NORMALIZAR TEXTO PARA COMPARAR (colapsa espacios/saltos de línea)
// ============================================

function normalizarTextoInstr(s) {
  if (s === null || s === undefined) return '';
  return s.toString().replace(/\s+/g, ' ').trim();
}

// ============================================
// TRADUCIR TEXTO DE LA TAB INSTRUCCIONES (ES <-> PT)
// ============================================

function traducirTextoInstrucciones() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_INSTRUCCIONES);
  
  if (!hoja) return;
  
  var idioma = obtenerIdiomaSeleccionado();
  
  var mapa = {};
  for (var p = 0; p < PARES_INSTRUCCIONES.length; p++) {
    var par = PARES_INSTRUCCIONES[p];
    if (idioma === 'portugues') {
      mapa[normalizarTextoInstr(par.es)] = par.pt;  // ES -> PT
    } else {
      mapa[normalizarTextoInstr(par.pt)] = par.es;  // PT -> ES
    }
  }
  
  var rango = hoja.getDataRange();
  var valores = rango.getValues();
  
  for (var i = 0; i < valores.length; i++) {
    for (var j = 0; j < valores[i].length; j++) {
      var celda = valores[i][j];
      if (typeof celda !== 'string') continue;
      
      var clave = normalizarTextoInstr(celda);
      if (clave === '') continue;
      
      if (mapa.hasOwnProperty(clave)) {
        hoja.getRange(i + 1, j + 1).setValue(mapa[clave]);
      }
    }
  }
}

// ============================================
// OBTENER IDIOMA SELECCIONADO DESDE INSTRUCCIONES
// ============================================

function obtenerIdiomaSeleccionado() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaInstrucciones = ss.getSheetByName(CONFIG.HOJA_INSTRUCCIONES);
  
  if (!hojaInstrucciones) return 'espanol';
  
  var datos = hojaInstrucciones.getDataRange().getValues();
  var filaIdioma = -1;
  
  for (var i = 0; i < datos.length; i++) {
    for (var j = 0; j < datos[i].length; j++) {
      var valor = datos[i][j] ? datos[i][j].toString() : '';
      if (valor.indexOf('Seleccionar idioma') !== -1 || valor.indexOf('Selecionar idioma') !== -1) {
        filaIdioma = i + 1;
        break;
      }
    }
    if (filaIdioma !== -1) break;
  }
  
  if (filaIdioma === -1) return 'espanol';
  
  var checkEspanol = hojaInstrucciones.getRange(filaIdioma, 4).getValue();    // D
  var checkPortugues = hojaInstrucciones.getRange(filaIdioma, 6).getValue();  // F
  
  if (checkPortugues === true) return 'portugues';
  return 'espanol';
}

// ============================================
// FORMATEAR FECHAS EN ENTRADA PROCESO CREATIVO
// ============================================

// nombreHoja opcional: si no se pasa, usa la hoja de GUT (compatibilidad).
function formatearFechasCreativo(nombreHoja) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(nombreHoja || CONFIG.HOJA_CREATIVO);
  
  if (!hoja) return;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  
  var rangoFechas = hoja.getRange(2, 3, ultimaFila - 1, 2);
  rangoFechas.setNumberFormat('dd/MM/yyyy');
}

// ============================================
// CASCADA INVERSA (desde fecha fin última hacia arriba)
// ============================================

function cascadaInversa() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var feriados = obtenerFeriados();
  
  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_CREATIVO + '"');
    return;
  }
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) {
    SpreadsheetApp.getUi().alert('No hay datos en la tabla.');
    return;
  }
  
  verificarHeadersCreativo(hoja);
  
  // Buscar la última fila con actividad real (no agrupador)
  var ultimaFilaActividad = -1;
  for (var f = ultimaFila; f >= 2; f--) {
    var val = hoja.getRange(f, 1).getValue();
    var valDias = hoja.getRange(f, 2).getValue();
    if (val && val.toString().trim() !== '' && !esFilaHeaderSubgrupo(val, valDias)) {
      ultimaFilaActividad = f;
      break;
    }
  }
  
  if (ultimaFilaActividad === -1) {
    SpreadsheetApp.getUi().alert('No hay actividades en la tabla.');
    return;
  }
  
  var fechaFinUltima = hoja.getRange(ultimaFilaActividad, 4).getValue();
  
  if (!fechaFinUltima || !(fechaFinUltima instanceof Date)) {
    SpreadsheetApp.getUi().alert('Por favor, ingresá la Fecha Fin de la última actividad (fila ' + ultimaFilaActividad + ', columna D).');
    return;
  }
  
  var fechaFinActual = fechaFinUltima;
  
  for (var fila = ultimaFila; fila >= 2; fila--) {
    var actividad = hoja.getRange(fila, 1).getValue();
    var dias = hoja.getRange(fila, 2).getValue();
    
    if (!actividad) continue;
    if (esFilaHeaderSubgrupo(actividad, dias)) continue;
    
    dias = parseInt(dias);
    if (isNaN(dias) || dias < 1) dias = 1;
    
    // Leer excepciones de columna E para esta fila
    var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
    
    var fechaFin = fechaFinActual;
    var fechaInicio = restarDiasHabilesConExc(fechaFin, dias - 1, feriados, excFila);
    
    hoja.getRange(fila, 3).setValue(fechaInicio);
    hoja.getRange(fila, 4).setValue(fechaFin);
    
    fechaFinActual = diaHabilAnteriorConExc(fechaInicio, feriados, excFila);
  }
  
  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Cascada inversa completada. Recordar seleccionar \'Generar Gantt en este documento\' para crearlo.', '✅ Listo', 8);
}

// ============================================
// CASCADA NORMAL (desde fecha inicio primera hacia abajo)
// ============================================

function cascadaNormal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var feriados = obtenerFeriados();
  
  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_CREATIVO + '"');
    return;
  }
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) {
    SpreadsheetApp.getUi().alert('No hay datos en la tabla.');
    return;
  }
  
  verificarHeadersCreativo(hoja);
  
  // Buscar la primera fila con actividad real (no agrupador)
  var primeraFilaActividad = -1;
  for (var f = 2; f <= ultimaFila; f++) {
    var val = hoja.getRange(f, 1).getValue();
    if (val && val.toString().trim() !== '' && !esFilaHeaderSubgrupo(val)) {
      primeraFilaActividad = f;
      break;
    }
  }
  
  if (primeraFilaActividad === -1) {
    SpreadsheetApp.getUi().alert('No hay actividades en la tabla.');
    return;
  }
  
  var fechaInicioPrimera = hoja.getRange(primeraFilaActividad, 3).getValue();
  
  if (!fechaInicioPrimera || !(fechaInicioPrimera instanceof Date)) {
    SpreadsheetApp.getUi().alert('Por favor, ingresá la Fecha Inicio de la primera actividad (fila ' + primeraFilaActividad + ', columna C).');
    return;
  }
  
  var fechaInicioActual = fechaInicioPrimera;
  if (!esDiaHabil(fechaInicioActual, feriados)) {
    fechaInicioActual = siguienteDiaHabil(fechaInicioActual, feriados);
    hoja.getRange(primeraFilaActividad, 3).setValue(fechaInicioActual);
  }
  
  for (var fila = 2; fila <= ultimaFila; fila++) {
    var actividad = hoja.getRange(fila, 1).getValue();
    var dias = hoja.getRange(fila, 2).getValue();
    
    if (!actividad) continue;
    if (esFilaHeaderSubgrupo(actividad, dias)) continue;
    
    dias = parseInt(dias);
    if (isNaN(dias) || dias < 1) dias = 1;
    
    // Leer excepciones de columna E para esta fila
    var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
    
    var fechaInicio = fechaInicioActual;
    var fechaFin = sumarDiasHabilesConExc(fechaInicio, dias - 1, feriados, excFila);
    
    hoja.getRange(fila, 3).setValue(fechaInicio);
    hoja.getRange(fila, 4).setValue(fechaFin);
    
    fechaInicioActual = siguienteDiaHabilConExc(fechaFin, feriados, excFila);
  }
  
  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Cascada normal completada. Recordar seleccionar \'Generar Gantt en este documento\' para crearlo.', '✅ Listo', 8);
}

// ============================================
// CASCADA DESDE CURSOR
// Toma la fila donde está parado el cursor. Respeta las fechas de esa fila.
// - Cursor en col C (Fecha Inicio) → cascadea secuencialmente hacia ARRIBA.
// - Cursor en col D (Fecha Fin)    → cascadea secuencialmente hacia ABAJO.
// Ideal para re-cascadear después de superponer tareas a mano.
// ============================================

function cascadaDesdeCursor() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var hojaActiva = ss.getActiveSheet();
  var feriados = obtenerFeriados();
  
  if (hojaActiva.getName() !== CONFIG.HOJA_CREATIVO) {
    SpreadsheetApp.getUi().alert('Por favor, seleccioná una celda en la hoja "' + CONFIG.HOJA_CREATIVO + '"');
    return;
  }
  
  var celdaActiva = ss.getActiveCell();
  var filaCursor = celdaActiva.getRow();
  var columnaCursor = celdaActiva.getColumn();
  
  if (filaCursor < 2) {
    SpreadsheetApp.getUi().alert('Por favor, seleccioná una celda en una fila de actividad (fila 2 o mayor).');
    return;
  }
  
  if (columnaCursor < 3 || columnaCursor > 4) {
    SpreadsheetApp.getUi().alert('Por favor, posicioná el cursor en Fecha Inicio (col C) para cascadear arriba, o Fecha Fin (col D) para cascadear abajo.');
    return;
  }
  
  var ultimaFila = hoja.getLastRow();
  
  var actividad = hoja.getRange(filaCursor, 1).getValue();
  var fechaInicio = hoja.getRange(filaCursor, 3).getValue();
  var fechaFin = hoja.getRange(filaCursor, 4).getValue();
  
  if (!actividad) {
    SpreadsheetApp.getUi().alert('La fila seleccionada no tiene actividad.');
    return;
  }
  
  if (!fechaInicio || !fechaFin) {
    SpreadsheetApp.getUi().alert('La fila del cursor debe tener Fecha Inicio y Fecha Fin.');
    return;
  }
  
  if (!(fechaInicio instanceof Date) || !(fechaFin instanceof Date)) {
    SpreadsheetApp.getUi().alert('Las fechas no tienen formato válido.');
    return;
  }
  
  var dias = calcularDiasHabiles(fechaInicio, fechaFin, feriados);
  hoja.getRange(filaCursor, 2).setValue(dias);
  
  var filasActualizadas = 0;
  
  // Cursor en FECHA INICIO (columna C) → Cascada hacia ARRIBA
  if (columnaCursor === 3) {
    var fechaFinAnterior = diaHabilAnterior(fechaInicio, feriados);
    
    for (var fila = filaCursor - 1; fila >= 2; fila--) {
      var actividadAnt = hoja.getRange(fila, 1).getValue();
      var diasAnt = hoja.getRange(fila, 2).getValue();
      
      if (!actividadAnt) continue;
      if (esFilaHeaderSubgrupo(actividadAnt)) continue;
      
      var nuevaFechaFin = fechaFinAnterior;
      
      diasAnt = parseInt(diasAnt);
      if (isNaN(diasAnt) || diasAnt < 1) diasAnt = 1;
      
      var nuevaFechaInicio = restarDiasHabiles(nuevaFechaFin, diasAnt - 1, feriados);
      
      hoja.getRange(fila, 3).setValue(nuevaFechaInicio);
      hoja.getRange(fila, 4).setValue(nuevaFechaFin);
      
      fechaFinAnterior = diaHabilAnterior(nuevaFechaInicio, feriados);
      filasActualizadas++;
    }
    
    formatearFechasCreativo();
    
    SpreadsheetApp.getUi().alert('Fila ' + filaCursor + ': ' + dias + ' día(s) hábil(es).\nActividades anteriores recalculadas: ' + filasActualizadas);
  }
  
  // Cursor en FECHA FIN (columna D) → Cascada hacia ABAJO
  if (columnaCursor === 4) {
    var fechaInicioActual = siguienteDiaHabil(fechaFin, feriados);
    
    for (var fila = filaCursor + 1; fila <= ultimaFila; fila++) {
      var actividadSig = hoja.getRange(fila, 1).getValue();
      var diasSig = hoja.getRange(fila, 2).getValue();
      
      if (!actividadSig) continue;
      if (esFilaHeaderSubgrupo(actividadSig)) continue;
      
      var nuevaFechaInicio = fechaInicioActual;
      
      diasSig = parseInt(diasSig);
      if (isNaN(diasSig) || diasSig < 1) diasSig = 1;
      
      var nuevaFechaFin = sumarDiasHabiles(nuevaFechaInicio, diasSig - 1, feriados);
      
      hoja.getRange(fila, 3).setValue(nuevaFechaInicio);
      hoja.getRange(fila, 4).setValue(nuevaFechaFin);
      
      fechaInicioActual = siguienteDiaHabil(nuevaFechaFin, feriados);
      filasActualizadas++;
    }
    
    formatearFechasCreativo();
    
    SpreadsheetApp.getUi().alert('Fila ' + filaCursor + ': ' + dias + ' día(s) hábil(es).\nActividades siguientes recalculadas: ' + filasActualizadas);
  }
}

// ============================================
// CASCADA DESDE CURSOR EN ETAPA (SUBGRUPO)
// Igual que cascadaDesdeCursor pero se detiene al llegar al límite del
// subgrupo donde está el cursor. No cruza headers de etapa.
// - Cursor en col C (Fecha Inicio) → cascadea hacia ARRIBA hasta el header.
// - Cursor en col D (Fecha Fin)    → cascadea hacia ABAJO hasta el header.
// ============================================

function cascadaDesdeCursorSubgrupo(nombreHoja) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaNombre = nombreHoja || CONFIG.HOJA_CREATIVO;
  var hoja = ss.getSheetByName(hojaNombre);
  var hojaActiva = ss.getActiveSheet();
  var feriados = obtenerFeriados();

  // El cursor debe estar en la hoja que este menú opera (GUT o Meli).
  if (hojaActiva.getName() !== hojaNombre) {
    SpreadsheetApp.getUi().alert('Por favor, seleccioná una celda en la hoja "' + hojaNombre + '"');
    return;
  }

  var celdaActiva = ss.getActiveCell();
  var filaCursor = celdaActiva.getRow();
  var columnaCursor = celdaActiva.getColumn();

  if (filaCursor < 2) {
    SpreadsheetApp.getUi().alert('Por favor, seleccioná una celda en una fila de actividad (fila 2 o mayor).');
    return;
  }

  if (columnaCursor < 3 || columnaCursor > 4) {
    SpreadsheetApp.getUi().alert('Por favor, posicioná el cursor en Fecha Inicio (col C) para cascadear arriba, o Fecha Fin (col D) para cascadear abajo.');
    return;
  }

  var actividad = hoja.getRange(filaCursor, 1).getValue();
  var fechaInicio = hoja.getRange(filaCursor, 3).getValue();
  var fechaFin = hoja.getRange(filaCursor, 4).getValue();

  if (!actividad) {
    SpreadsheetApp.getUi().alert('La fila seleccionada no tiene actividad.');
    return;
  }

  if (!fechaInicio || !fechaFin) {
    SpreadsheetApp.getUi().alert('La fila del cursor debe tener Fecha Inicio y Fecha Fin.');
    return;
  }

  if (!(fechaInicio instanceof Date) || !(fechaFin instanceof Date)) {
    SpreadsheetApp.getUi().alert('Las fechas no tienen formato válido.');
    return;
  }

  var dias = calcularDiasHabiles(fechaInicio, fechaFin, feriados);
  hoja.getRange(filaCursor, 2).setValue(dias);

  var ultimaFila = hoja.getLastRow();
  var filasActualizadas = 0;

  // Cursor en FECHA INICIO (columna C) → Cascada hacia ARRIBA
  if (columnaCursor === 3) {
    var fechaFinAnterior = diaHabilAnterior(fechaInicio, feriados);

    for (var fila = filaCursor - 1; fila >= 2; fila--) {
      var actividadAnt = hoja.getRange(fila, 1).getValue();
      var diasAnt = hoja.getRange(fila, 2).getValue();

      if (!actividadAnt || actividadAnt.toString().trim() === '') break;
      diasAnt = parseInt(diasAnt);
      if (isNaN(diasAnt)) break;
      
      if (diasAnt === 0) {
        var finAbajo = hoja.getRange(fila + 1, 4).getValue();
        if (finAbajo instanceof Date) {
          hoja.getRange(fila, 3).setValue(finAbajo);
          hoja.getRange(fila, 4).setValue(finAbajo);
        }
        filasActualizadas++;
        continue;
      }
      
      if (diasAnt < 1) diasAnt = 1;
      var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
      var nuevaFechaFin = fechaFinAnterior;
      var nuevaFechaInicio = restarDiasHabilesConExc(nuevaFechaFin, diasAnt - 1, feriados, excFila);

      hoja.getRange(fila, 3).setValue(nuevaFechaInicio);
      hoja.getRange(fila, 4).setValue(nuevaFechaFin);

      fechaFinAnterior = diaHabilAnteriorConExc(nuevaFechaInicio, feriados, excFila);
      filasActualizadas++;
    }
  }

  // Cursor en FECHA FIN (columna D) → Cascada hacia ABAJO
  if (columnaCursor === 4) {
    var fechaInicioActual = siguienteDiaHabil(fechaFin, feriados);

    for (var fila = filaCursor + 1; fila <= ultimaFila; fila++) {
      var actividadSig = hoja.getRange(fila, 1).getValue();
      var diasSig = hoja.getRange(fila, 2).getValue();

      if (!actividadSig || actividadSig.toString().trim() === '') break;
      diasSig = parseInt(diasSig);
      if (isNaN(diasSig)) break;
      
      if (diasSig === 0) {
        var finArriba = hoja.getRange(fila - 1, 4).getValue();
        if (finArriba instanceof Date) {
          hoja.getRange(fila, 3).setValue(finArriba);
          hoja.getRange(fila, 4).setValue(finArriba);
        }
        filasActualizadas++;
        continue;
      }
      
      if (diasSig < 1) diasSig = 1;
      var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
      var nuevaFechaInicio = fechaInicioActual;
      var nuevaFechaFin = sumarDiasHabilesConExc(nuevaFechaInicio, diasSig - 1, feriados, excFila);

      hoja.getRange(fila, 3).setValue(nuevaFechaInicio);
      hoja.getRange(fila, 4).setValue(nuevaFechaFin);

      fechaInicioActual = siguienteDiaHabilConExc(nuevaFechaFin, feriados, excFila);
      filasActualizadas++;
    }
  }

  formatearFechasCreativo(hojaNombre);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Cascada desde cursor: ' + filasActualizadas + ' tarea(s) recalculadas.', '✅ Listo', 5);

  registrarLog('Cascada desde cursor', filasActualizadas + ' tarea(s) recalculadas (' + hojaNombre + ')');
}

// ============================================
// DETERMINAR COLOR DE ACTIVIDAD
// ============================================

function obtenerColorActividad(nombreActividad) {
  var nombre = nombreActividad.toUpperCase();
  
  if (nombre.indexOf('AIR DATE') !== -1 || (nombre.indexOf('AIR') !== -1 && nombre.indexOf('DATE') !== -1)) {
    return CONFIG.COLOR_AIR;
  }
  
  if (nombre.indexOf('DELIVERY') !== -1) {
    return CONFIG.COLOR_DELIVERY;
  }
  
  if (nombre.indexOf('PRESENTATION') !== -1 || 
      nombre.indexOf('FEEDBACK') !== -1 || 
      nombre.indexOf('REUNIÓN') !== -1 || 
      nombre.indexOf('REUNION') !== -1 ||
      nombre.indexOf('APROBACIÓN') !== -1 ||
      nombre.indexOf('APROBACION') !== -1) {
    return CONFIG.COLOR_PRESENTACION;
  }
  
  if (nombre.indexOf('CREATIVE') !== -1) {
    return CONFIG.COLOR_CREATIVE;
  }
  
  if (nombre.indexOf('BUSQUEDA') !== -1 ||
      nombre.indexOf('BID') !== -1 ||
      nombre.indexOf('KICK OFF') !== -1 ||
      nombre.indexOf('PRODUCCIÓN') !== -1 ||
      nombre.indexOf('PRODUCCION') !== -1 ||
      nombre.indexOf('GO PRODUCTORA') !== -1 ||
      nombre.indexOf('TRATAMIENTO') !== -1) {
    return CONFIG.COLOR_LILA;
  }
  
  return CONFIG.COLOR_CREATIVO;
}

// ============================================
// DETERMINAR COLOR DE BARRA PARA MERCADO PAGO (por grupo)
// ============================================

function obtenerColorActividadMP(seccion, dias) {
  var esUnDia = (dias === 1);
  if (seccion === 'creativo') return esUnDia ? CONFIG.MP_COLOR_BARRA_CREATIVO_FUERTE : CONFIG.MP_COLOR_BARRA_CREATIVO;
  if (seccion === 'digital') return esUnDia ? CONFIG.MP_COLOR_BARRA_DIGITAL_FUERTE : CONFIG.MP_COLOR_BARRA_DIGITAL;
  if (seccion === 'produccion') return esUnDia ? CONFIG.MP_COLOR_BARRA_PRODUCCION_FUERTE : CONFIG.MP_COLOR_BARRA_PRODUCCION;
  return esUnDia ? CONFIG.MP_COLOR_BARRA_CREATIVO_FUERTE : CONFIG.MP_COLOR_BARRA_CREATIVO;
}

// ============================================
// VERIFICAR SI ES DELIVERY O AIR DATE
// ============================================

function esDeliveryOAirDate(nombreActividad) {
  var nombre = nombreActividad.toUpperCase();
  return nombre.indexOf('DELIVERY') !== -1 || 
         nombre.indexOf('AIR DATE') !== -1 ||
         (nombre.indexOf('AIR') !== -1 && nombre.indexOf('DATE') !== -1);
}

// ============================================
// OBTENER TAREAS CON EXCEPCIÓN (columna E marcada con TRUE/checkbox)
// Devuelve array de { nombre, inicio, fin, diasNoHabiles: [{fecha, tipo}] }
// ============================================

function obtenerTareasConExcepcion(hoja, feriados) {
  var resultado = [];
  if (!hoja) return resultado;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return resultado;
  
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues(); // A:E
  
  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    var inicio = datos[i][2];
    var fin = datos[i][3];
    var marcaExcepcion = datos[i][4];
    
    if (!actividad || !inicio || !fin) continue;
    if (!(inicio instanceof Date) || !(fin instanceof Date)) continue;
    if (esFilaHeaderSubgrupo(actividad)) continue;
    
    // Verificar si la columna E está marcada (TRUE = necesita seleccionar)
    // o tiene fechas ya guardadas (texto con fechas = ya seleccionado)
    // Nota: Google Sheets puede interpretar fechas como Date objects
    if (marcaExcepcion === true || marcaExcepcion === 'TRUE' || marcaExcepcion === 'SI' || marcaExcepcion === 'SÍ') {
      // OK - es una marca nueva
    } else if (marcaExcepcion instanceof Date) {
      // Google interpretó la fecha como Date - convertir a string para procesar
      var dia = ('0' + marcaExcepcion.getDate()).slice(-2);
      var mes = ('0' + (marcaExcepcion.getMonth() + 1)).slice(-2);
      var anio = marcaExcepcion.getFullYear();
      datos[i][4] = dia + '/' + mes + '/' + anio;
      marcaExcepcion = datos[i][4];
    } else if (typeof marcaExcepcion === 'string' && marcaExcepcion.trim() !== '') {
      // Ya tiene fechas guardadas como texto - OK
    } else {
      continue; // Vacío o no reconocido - saltear
    }
    
    // Obtener los días no hábiles dentro del rango de esta tarea
    var diasNoHabiles = [];
    var fecha = new Date(inicio.getTime());
    while (fecha <= fin) {
      if (!esDiaHabil(fecha, feriados)) {
        var tipo = esFeriado(fecha, feriados) ? 'feriado' : 'finde';
        var diasSemNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        diasNoHabiles.push({
          fecha: new Date(fecha.getTime()),
          timestamp: normalizarFecha(fecha),
          tipo: tipo,
          label: diasSemNombres[fecha.getDay()] + ' ' + fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear() + (tipo === 'feriado' ? ' (Feriado)' : '')
        });
      }
      fecha.setDate(fecha.getDate() + 1);
    }
    
    if (diasNoHabiles.length > 0) {
      resultado.push({
        nombre: actividad.toString(),
        fila: i + 2, // fila real en la hoja
        inicio: inicio,
        fin: fin,
        diasNoHabiles: diasNoHabiles,
        marcaOriginal: marcaExcepcion
      });
    }
  }
  
  return resultado;
}

// ============================================
// MOSTRAR MODAL HTML PARA SELECCIONAR EXCEPCIONES
// ============================================

function mostrarModalExcepciones(tareasConExcepcion, excepcionesGuardadas) {
  // Convertir las excepciones guardadas (Date objects) a strings para el JSON
  var guardadasParaJSON = {};
  if (excepcionesGuardadas) {
    for (var key in excepcionesGuardadas) {
      if (!excepcionesGuardadas.hasOwnProperty(key)) continue;
      guardadasParaJSON[key] = [];
      for (var g = 0; g < excepcionesGuardadas[key].length; g++) {
        var f = excepcionesGuardadas[key][g];
        if (f instanceof Date) {
          guardadasParaJSON[key].push(('0' + f.getDate()).slice(-2) + '/' + ('0' + (f.getMonth() + 1)).slice(-2) + '/' + f.getFullYear());
        } else {
          guardadasParaJSON[key].push(f.toString());
        }
      }
    }
  }
  var guardadasJSON = JSON.stringify(guardadasParaJSON);
  
  var html = '<html><head><style>';
  html += 'body { font-family: Arial, sans-serif; font-size: 13px; padding: 15px; }';
  html += 'h3 { margin: 15px 0 8px 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }';
  html += 'label { display: block; padding: 3px 0; cursor: pointer; }';
  html += 'label:hover { background: #f0f0f0; }';
  html += 'input[type=checkbox] { margin-right: 8px; }';
  html += '.btn { padding: 10px 20px; margin: 15px 5px 0 0; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }';
  html += '.btn-ok { background: #4CAF50; color: white; }';
  html += '.btn-cancel { background: #f44336; color: white; }';
  html += '.btn:hover { opacity: 0.85; }';
  html += '</style></head><body>';
  html += '<h2>⚙️ Días no hábiles laborables</h2>';
  html += '<p>Seleccioná qué fines de semana o feriados se trabajan para cada tarea:</p>';
  
  for (var t = 0; t < tareasConExcepcion.length; t++) {
    var tarea = tareasConExcepcion[t];
    html += '<h3>' + tarea.nombre + '</h3>';
    
    for (var d = 0; d < tarea.diasNoHabiles.length; d++) {
      var dia = tarea.diasNoHabiles[d];
      var id = 'exc_' + t + '_' + d;
      var fechaStr = ('0' + dia.fecha.getDate()).slice(-2) + '/' + ('0' + (dia.fecha.getMonth() + 1)).slice(-2) + '/' + dia.fecha.getFullYear();
      html += '<label><input type="checkbox" id="' + id + '" data-tarea="' + tarea.nombre.replace(/"/g, '&quot;') + '" data-fecha="' + fechaStr + '"> ' + dia.label + '</label>';
    }
  }
  
  html += '<div style="margin-top:20px; border-top:1px solid #ddd; padding-top:15px;">';
  html += '<button class="btn btn-ok" onclick="confirmar()">Confirmar y generar Gantt</button>';
  html += '<button class="btn btn-cancel" onclick="google.script.host.close()">Cancelar</button>';
  html += '</div>';
  
  html += '<script>';
  html += 'var guardadasPrevias = ' + guardadasJSON + ';';
  html += 'function confirmar() {';
  html += '  var checks = document.querySelectorAll("input[type=checkbox]:checked");';
  html += '  var excepciones = JSON.parse(JSON.stringify(guardadasPrevias));';
  html += '  for (var i = 0; i < checks.length; i++) {';
  html += '    var tarea = checks[i].getAttribute("data-tarea");';
  html += '    var fecha = checks[i].getAttribute("data-fecha");';
  html += '    if (!excepciones[tarea]) excepciones[tarea] = [];';
  html += '    excepciones[tarea].push(fecha);';
  html += '  }';
  html += '  google.script.run.withSuccessHandler(function() { google.script.host.close(); }).generarGanttConExcepciones(JSON.stringify(excepciones));';
  html += '}';
  html += '</script>';
  
  html += '</body></html>';
  
  var output = HtmlService.createHtmlOutput(html)
    .setWidth(450)
    .setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(output, '⚙️ Excepciones de días laborables');
}

// ============================================
// GENERAR GANTT
// ============================================

function generarGantt() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var hojaCreativo = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var hojaGantt = ss.getSheetByName(CONFIG.HOJA_GANTT);
  var feriados = obtenerFeriados();
  
  // La tab "Gantt" separada solo se exige cuando está activada. Si está
  // desactivada (CONFIG.TAB_GANTT_ACTIVA = false), el Gantt se genera únicamente
  // inline y no hace falta que exista la hoja "Gantt".
  if (CONFIG.TAB_GANTT_ACTIVA === true && !hojaGantt) {
    SpreadsheetApp.getUi().alert('Error: No se encontró la hoja "' + CONFIG.HOJA_GANTT + '"');
    return;
  }
  
  // Verificar si hay tareas con excepciones de finde/feriado (col E marcada)
  var tareasConExcepcion = obtenerTareasConExcepcion(hojaCreativo, feriados);
  
  if (tareasConExcepcion.length > 0) {
    // Separar: tareas que ya tienen fechas guardadas vs las que tienen solo TRUE
    var necesitanModal = [];
    var excepcionesGuardadas = {};
    
    for (var t = 0; t < tareasConExcepcion.length; t++) {
      var tarea = tareasConExcepcion[t];
      var marca = tarea.marcaOriginal;
      
      if (marca === true || marca === 'TRUE' || marca === 'SI' || marca === 'SÍ' || marca === 'YES' || marca === 'Yes' || marca === 'Si') {
        // Marca nueva sin fechas → necesita modal
        necesitanModal.push(tarea);
      } else if (typeof marca === 'string' && marca.trim() !== '') {
        // Ya tiene fechas guardadas → parsear
        var fechasGuardadas = parsearFechasGuardadas(marca);
        if (fechasGuardadas.length > 0) {
          excepcionesGuardadas[tarea.nombre] = fechasGuardadas;
        }
      }
    }
    
    if (necesitanModal.length > 0) {
      // Hay tareas nuevas sin selección → abrir modal (pasando también las guardadas)
      mostrarModalExcepciones(necesitanModal, excepcionesGuardadas);
      return;
    }
    
    // Todas las excepciones ya están guardadas → generar directo
    generarGanttInterno(feriados, excepcionesGuardadas);
    return;
  }
  
  // Sin excepciones → generar Gantt normal
  generarGanttInterno(feriados, {});
}

// ============================================
// GENERAR GANTT CON EXCEPCIONES (llamada desde el modal HTML)
// excepciones = { "nombreTarea": [timestamp1, timestamp2, ...], ... }
// ============================================

function generarGanttConExcepciones(excepcionesJSON) {
  var excepcionesRaw = JSON.parse(excepcionesJSON);
  var feriados = obtenerFeriados();
  
  // Guardar las fechas seleccionadas en la columna E de cada tarea
  guardarExcepcionesEnHoja(excepcionesRaw);
  
  // Convertir strings "dd/MM/yyyy" a objetos Date para el pintado
  var excepciones = {};
  for (var tarea in excepcionesRaw) {
    if (!excepcionesRaw.hasOwnProperty(tarea)) continue;
    excepciones[tarea] = [];
    for (var i = 0; i < excepcionesRaw[tarea].length; i++) {
      var fechaStr = excepcionesRaw[tarea][i];
      var fecha = convertirAFecha(fechaStr);
      if (fecha) {
        excepciones[tarea].push(fecha);
      }
    }
  }
  
  generarGanttInterno(feriados, excepciones);
}

// ============================================
// PARSEAR FECHAS GUARDADAS EN COLUMNA E (texto "dd/MM/yyyy, dd/MM/yyyy")
// Devuelve array de timestamps normalizados
// ============================================

function parsearFechasGuardadas(texto) {
  var fechas = [];
  if (!texto || typeof texto !== 'string') return fechas;
  
  var partes = texto.split(',');
  for (var i = 0; i < partes.length; i++) {
    var parte = partes[i].trim();
    if (parte === '') continue;
    var fecha = convertirAFecha(parte);
    if (fecha) {
      fechas.push(fecha);
    }
  }
  return fechas;
}

// ============================================
// GUARDAR EXCEPCIONES EN COLUMNA E DE CADA TAREA
// Escribe las fechas seleccionadas como texto "dd/MM/yyyy, dd/MM/yyyy"
// ============================================

function guardarExcepcionesEnHoja(excepciones) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues();
  
  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    if (!actividad) continue;
    
    var nombreTarea = actividad.toString();
    if (excepciones[nombreTarea] && excepciones[nombreTarea].length > 0) {
      // Las fechas ya vienen como strings "dd/MM/yyyy"
      var textoGuardar = excepciones[nombreTarea].join(', ');
      hoja.getRange(i + 2, 5).setNumberFormat('@'); // Forzar formato texto
      hoja.getRange(i + 2, 5).setValue(textoGuardar);
    }
  }
}

// ============================================
// FUNCIONES PROPIAS DE MELI ("Gantt Meli")
// Layout distinto a GUT: usan ESQUEMA_MELI para saber en qué columna está
// cada dato (Tarefa=B, Dias=D, Início=E, Fim=F, agrupador=A sin Tarefa,
// tareas desde fila 8, timeline desde columna I).
// ============================================

// ¿La fila (0-indexed dentro de datos, que arranca en FILA_INICIO_TAREAS) es
// un agrupador? Sí cuando hay Macro Tema (A) pero NO hay Tarefa (B).
function esAgrupadorMeli(macro, tarea) {
  var tieneMacro = macro && macro.toString().trim() !== '';
  var tieneTarea = tarea && tarea.toString().trim() !== '';
  return tieneMacro && !tieneTarea;
}

// Lee las tareas de Gantt Meli con fechas válidas, según ESQUEMA_MELI.
function obtenerActividadesMeli(hoja) {
  var actividades = [];
  if (!hoja) return actividades;

  var ultimaFila = hoja.getLastRow();
  var filaIni = ESQUEMA_MELI.FILA_INICIO_TAREAS;
  if (ultimaFila < filaIni) return actividades;

  var datos = hoja.getRange(filaIni, 1, ultimaFila - filaIni + 1, ESQUEMA_MELI.COL_STATUS).getValues();
  for (var i = 0; i < datos.length; i++) {
    var macro = datos[i][ESQUEMA_MELI.COL_MACRO - 1];
    var tarea = datos[i][ESQUEMA_MELI.COL_TAREA - 1];
    if (esAgrupadorMeli(macro, tarea)) continue;   // saltar agrupadores
    if (!tarea || tarea.toString().trim() === '') continue;

    var inicio = datos[i][ESQUEMA_MELI.COL_INICIO - 1];
    var fin = datos[i][ESQUEMA_MELI.COL_FIN - 1];
    if (!(inicio instanceof Date) || !(fin instanceof Date)) continue;

    actividades.push({ nombre: tarea.toString(), inicio: inicio, fin: fin });
  }
  return actividades;
}

// CASCADA INVERSA MELI: ancla en "Fim de veiculação" (B5) y cascadea hacia
// arriba desde la última tarea, respetando días hábiles y feriados.
function cascadaInversaMeliInterna() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_MELI);
  var feriados = obtenerFeriados();

  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_MELI + '"');
    return;
  }

  var fechaAncla = convertirAFecha(hoja.getRange(ESQUEMA_MELI.CELDA_FIM_VEICULACAO).getValue());
  if (!fechaAncla) {
    SpreadsheetApp.getUi().alert('No hay "Fim de veiculação" válido en ' + ESQUEMA_MELI.CELDA_FIM_VEICULACAO + '.');
    return;
  }

  var ultimaFila = hoja.getLastRow();
  var filaIni = ESQUEMA_MELI.FILA_INICIO_TAREAS;
  var fechaFinActual = fechaAncla;
  var procesadas = 0;

  // Recorrer de abajo hacia arriba
  for (var fila = ultimaFila; fila >= filaIni; fila--) {
    var macro = hoja.getRange(fila, ESQUEMA_MELI.COL_MACRO).getValue();
    var tarea = hoja.getRange(fila, ESQUEMA_MELI.COL_TAREA).getValue();
    if (esAgrupadorMeli(macro, tarea)) continue;
    if (!tarea || tarea.toString().trim() === '') continue;

    var dias = parseInt(hoja.getRange(fila, ESQUEMA_MELI.COL_DIAS).getValue());
    if (isNaN(dias) || dias < 1) continue; // sin días cargados, no cascadea

    var fechaFin = fechaFinActual;
    var fechaInicio = restarDiasHabiles(fechaFin, dias - 1, feriados);

    hoja.getRange(fila, ESQUEMA_MELI.COL_INICIO).setValue(fechaInicio);
    hoja.getRange(fila, ESQUEMA_MELI.COL_FIN).setValue(fechaFin);

    fechaFinActual = diaHabilAnterior(fechaInicio, feriados);
    procesadas++;
  }

  hoja.getRange(filaIni, ESQUEMA_MELI.COL_INICIO, ultimaFila - filaIni + 1, 2).setNumberFormat('dd/MM/yyyy');
  SpreadsheetApp.getActiveSpreadsheet().toast('Cascata inversa Meli: ' + procesadas + ' tarefa(s).', '✅ Pronto', 6);
  registrarLog('Cascada inversa', CONFIG.HOJA_MELI + ' (' + procesadas + ' tareas)');
}

// CASCADA NORMAL MELI: ancla en la Fecha Início de la primera tarea con fecha,
// y cascadea hacia abajo.
function cascadaNormalMeliInterna() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_MELI);
  var feriados = obtenerFeriados();

  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_MELI + '"');
    return;
  }

  var ultimaFila = hoja.getLastRow();
  var filaIni = ESQUEMA_MELI.FILA_INICIO_TAREAS;

  // Buscar la primera tarea con Fecha Início cargada como ancla
  var fechaInicioActual = null;
  for (var fb = filaIni; fb <= ultimaFila; fb++) {
    var macroB = hoja.getRange(fb, ESQUEMA_MELI.COL_MACRO).getValue();
    var tareaB = hoja.getRange(fb, ESQUEMA_MELI.COL_TAREA).getValue();
    if (esAgrupadorMeli(macroB, tareaB)) continue;
    if (!tareaB || tareaB.toString().trim() === '') continue;
    var ini = convertirAFecha(hoja.getRange(fb, ESQUEMA_MELI.COL_INICIO).getValue());
    if (ini) { fechaInicioActual = ini; break; }
  }

  if (!fechaInicioActual) {
    SpreadsheetApp.getUi().alert('No hay una Fecha Início de referencia en la primera tarea.');
    return;
  }

  if (!esDiaHabil(fechaInicioActual, feriados)) {
    fechaInicioActual = siguienteDiaHabil(fechaInicioActual, feriados);
  }

  var procesadas = 0;
  for (var fila = filaIni; fila <= ultimaFila; fila++) {
    var macro = hoja.getRange(fila, ESQUEMA_MELI.COL_MACRO).getValue();
    var tarea = hoja.getRange(fila, ESQUEMA_MELI.COL_TAREA).getValue();
    if (esAgrupadorMeli(macro, tarea)) continue;
    if (!tarea || tarea.toString().trim() === '') continue;

    var dias = parseInt(hoja.getRange(fila, ESQUEMA_MELI.COL_DIAS).getValue());
    if (isNaN(dias) || dias < 1) continue;

    var fechaInicio = fechaInicioActual;
    var fechaFin = sumarDiasHabiles(fechaInicio, dias - 1, feriados);

    hoja.getRange(fila, ESQUEMA_MELI.COL_INICIO).setValue(fechaInicio);
    hoja.getRange(fila, ESQUEMA_MELI.COL_FIN).setValue(fechaFin);

    fechaInicioActual = siguienteDiaHabil(fechaFin, feriados);
    procesadas++;
  }

  hoja.getRange(filaIni, ESQUEMA_MELI.COL_INICIO, ultimaFila - filaIni + 1, 2).setNumberFormat('dd/MM/yyyy');
  SpreadsheetApp.getActiveSpreadsheet().toast('Cascata normal Meli: ' + procesadas + ' tarefa(s).', '✅ Pronto', 6);
  registrarLog('Cascada normal', CONFIG.HOJA_MELI + ' (' + procesadas + ' tareas)');
}

// GENERAR GANTT INLINE MELI: dibuja el timeline dentro de "Gantt Meli",
// desde la columna I, según ESQUEMA_MELI. Sin tab aparte.
function generarGanttInlineMeli() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_MELI);
  var feriados = obtenerFeriados();

  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_MELI + '"');
    return;
  }

  var actividades = obtenerActividadesMeli(hoja);
  if (actividades.length === 0) {
    SpreadsheetApp.getUi().alert('No hay tareas con fechas válidas en "' + CONFIG.HOJA_MELI + '".');
    return;
  }

  // Rango de fechas
  var fechaMin = null, fechaMax = null;
  for (var i = 0; i < actividades.length; i++) {
    if (fechaMin === null || actividades[i].inicio < fechaMin) fechaMin = actividades[i].inicio;
    if (fechaMax === null || actividades[i].fin > fechaMax) fechaMax = actividades[i].fin;
  }

  var fechas = [];
  var fecha = new Date(fechaMin.getTime());
  while (fecha <= fechaMax) {
    fechas.push(new Date(fecha.getTime()));
    fecha.setDate(fecha.getDate() + 1);
  }

  // Meses abreviados en portugués e iniciales de días de semana en portugués
  // (Domingo, Segunda, Terça, Quarta, Quinta, Sexta, Sábado)
  var mesesPT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var diasSemanaCortoPT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  var colInicio = ESQUEMA_MELI.COL_TIMELINE_INICIO;
  var filaIni = ESQUEMA_MELI.FILA_INICIO_TAREAS;
  var ultimaFila = hoja.getLastRow();

  // Header de 3 filas: fila 5 = mes (mergeado), fila 6 = número de día,
  // fila 7 = inicial del día de semana (alineada con el header de la tabla).
  var filaMes = filaIni - 3;   // 5
  var filaNum = filaIni - 2;   // 6
  var filaDia = filaIni - 1;   // 7

  // Limpiar el área del timeline (desde columna I hacia la derecha), incluyendo el header
  var ultimaColumna = hoja.getLastColumn();
  if (ultimaColumna >= colInicio) {
    hoja.getRange(filaMes, colInicio, ultimaFila - filaMes + 1, ultimaColumna - colInicio + 1).clearContent();
    hoja.getRange(filaMes, colInicio, ultimaFila - filaMes + 1, ultimaColumna - colInicio + 1).clearFormat();
  }

  // Fila 6: número de día. Fila 7: inicial del día de semana.
  var filaNumVals = [];
  var filaDiaVals = [];
  for (var j = 0; j < fechas.length; j++) {
    var f = fechas[j];
    filaNumVals.push(f.getDate());
    filaDiaVals.push(diasSemanaCortoPT[f.getDay()]);
  }
  hoja.getRange(filaNum, colInicio, 1, filaNumVals.length).setValues([filaNumVals]);
  hoja.getRange(filaDia, colInicio, 1, filaDiaVals.length).setValues([filaDiaVals]);

  // Fila 5: mes mergeado por bloque de mes
  var mesInicioIdx = 0;
  var mesActual = fechas[0].getMonth();
  for (var jm = 1; jm <= fechas.length; jm++) {
    var esCambioMes = (jm === fechas.length) || (fechas[jm].getMonth() !== mesActual);
    if (esCambioMes) {
      var colMes = mesInicioIdx + colInicio;
      var numCols = jm - mesInicioIdx;
      if (numCols > 1) {
        hoja.getRange(filaMes, colMes, 1, numCols).merge();
      }
      hoja.getRange(filaMes, colMes).setValue(mesesPT[mesActual]);
      hoja.getRange(filaMes, colMes).setHorizontalAlignment('center');
      if (jm < fechas.length) {
        mesActual = fechas[jm].getMonth();
        mesInicioIdx = jm;
      }
    }
  }

  // Formato del header (3 filas)
  hoja.getRange(filaMes, colInicio, 3, fechas.length).setBackground(CONFIG.COLOR_HEADER);
  hoja.getRange(filaMes, colInicio, 3, fechas.length).setFontColor(CONFIG.COLOR_HEADER_TEXT);
  hoja.getRange(filaMes, colInicio, 3, fechas.length).setFontWeight('bold');
  hoja.getRange(filaMes, colInicio, 3, fechas.length).setHorizontalAlignment('center');
  hoja.getRange(filaMes, colInicio, 3, fechas.length).setFontSize(8);

  // Pintar findes/feriados de fondo (desde la fila del número de día hacia abajo)
  for (var k = 0; k < fechas.length; k++) {
    if (esFeriado(fechas[k], feriados) || esFinDeSemana(fechas[k])) {
      hoja.getRange(filaNum, k + colInicio, ultimaFila - filaNum + 1, 1).setBackground(CONFIG.COLOR_FINDE_BARRA);
    }
  }

  // Pintar barras (días hábiles dentro del rango de cada tarea)
  var datos = hoja.getRange(filaIni, 1, ultimaFila - filaIni + 1, ESQUEMA_MELI.COL_FIN).getValues();
  for (var fila = 0; fila < datos.length; fila++) {
    var tarea = datos[fila][ESQUEMA_MELI.COL_TAREA - 1];
    var ini = datos[fila][ESQUEMA_MELI.COL_INICIO - 1];
    var fin = datos[fila][ESQUEMA_MELI.COL_FIN - 1];
    if (!tarea || !(ini instanceof Date) || !(fin instanceof Date)) continue;

    var filaHoja = filaIni + fila;
    for (var d = 0; d < fechas.length; d++) {
      var fechaCol = fechas[d];
      if (fechaCol >= ini && fechaCol <= fin && esDiaHabil(fechaCol, feriados)) {
        var celda = hoja.getRange(filaHoja, d + colInicio);
        celda.setBackground(CONFIG.COLOR_PRESENTACION);
        celda.setValue('x');
        celda.setFontSize(6);
        celda.setHorizontalAlignment('center');
      }
    }
  }

  // Ancho de columnas del timeline
  for (var c = colInicio; c < colInicio + fechas.length; c++) {
    hoja.setColumnWidth(c, 40);
  }

  hoja.getRange(filaIni, ESQUEMA_MELI.COL_INICIO, ultimaFila - filaIni + 1, 2).setNumberFormat('dd/MM/yyyy');
  SpreadsheetApp.getActiveSpreadsheet().toast('Gantt de Meli generado.', '✅ Pronto', 5);
  registrarLog('Generar Gantt', CONFIG.HOJA_MELI);
}

// ============================================
// GENERAR GANTT INTERNO (lógica principal)
// excepciones = objeto { nombreTarea: [timestamps de días no hábiles que se trabajan] }
// ============================================

function generarGanttInterno(feriados, excepciones) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaCreativo = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var hojaGantt = ss.getSheetByName(CONFIG.HOJA_GANTT);

  // La tab "Gantt" separada está desactivada (CONFIG.TAB_GANTT_ACTIVA = false)
  // o directamente no existe. En ese caso NO se crea ninguna hoja: todas las
  // escrituras a hojaGantt se redirigen a un objeto "no-op" (no hace nada), y
  // lo único que se genera es el timeline INLINE (sobre hojaCreativo, más abajo).
  var usarTabGantt = (CONFIG.TAB_GANTT_ACTIVA === true) && !!hojaGantt;
  if (!usarTabGantt) {
    hojaGantt = crearHojaNoOp();
  }

  // Normalizar fechas de "Gantt GUT" (texto → Date) antes de leer las
  // actividades, para que las filas pegadas (incluida la producción) se
  // reconozcan en el Gantt visual inline.
  normalizarFechasCreativo();

  // Completar Días (B) en las filas que tienen ambas fechas pero sin días
  // (p. ej. la entrada automática de la cuenta de servicio). Respaldo por si
  // el trigger onChange no corrió.
  completarDiasFaltantesCreativo();

  // La producción ya no vive en una hoja aparte: se pega dentro de "Gantt GUT",
  // así que obtenerActividadesCreativo() ya la incluye como filas normales.
  var actividadesCreativo = obtenerActividadesCreativo(hojaCreativo);
  
  var actividadesCreativoSinFinal = [];
  var actividadesFinales = [];
  
  for (var i = 0; i < actividadesCreativo.length; i++) {
    if (esDeliveryOAirDate(actividadesCreativo[i].nombre)) {
      actividadesCreativo[i].seccion = 'final';
      actividadesFinales.push(actividadesCreativo[i]);
    } else {
      actividadesCreativoSinFinal.push(actividadesCreativo[i]);
    }
  }
  
  actividadesFinales.sort(function(a, b) {
    var aIsDelivery = a.nombre.toUpperCase().indexOf('DELIVERY') !== -1;
    var bIsDelivery = b.nombre.toUpperCase().indexOf('DELIVERY') !== -1;
    if (aIsDelivery && !bIsDelivery) return -1;
    if (!aIsDelivery && bIsDelivery) return 1;
    return 0;
  });
  
  var todasActividades = actividadesCreativoSinFinal.concat(actividadesFinales);
  
  if (todasActividades.length === 0) {
    SpreadsheetApp.getUi().alert('No hay actividades con fechas válidas para mostrar.');
    return;
  }
  
  hojaGantt.clear();
  hojaGantt.clearFormats();
  
  var fechaMin = null;
  var fechaMax = null;
  
  for (var i = 0; i < todasActividades.length; i++) {
    var act = todasActividades[i];
    if (fechaMin === null || act.inicio < fechaMin) fechaMin = act.inicio;
    if (fechaMax === null || act.fin > fechaMax) fechaMax = act.fin;
    
    // Extender fechaMax si hay excepciones posteriores a la Fecha Fin
    if (act.excepciones) {
      for (var xe = 0; xe < act.excepciones.length; xe++) {
        if (act.excepciones[xe] > fechaMax) fechaMax = act.excepciones[xe];
      }
    }
  }
  
  var fechas = [];
  var fecha = new Date(fechaMin.getTime());
  while (fecha <= fechaMax) {
    fechas.push(new Date(fecha.getTime()));
    fecha.setDate(fecha.getDate() + 1);
  }
  
  // Etiquetas de fecha según idioma seleccionado en Instrucciones.
  var idiomaGantt = obtenerIdiomaSeleccionado();
  var esPtGantt = (idiomaGantt === 'portugues');
  var diasSemana = esPtGantt
    ? ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']
    : ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
  var diasSemanaCorto = esPtGantt
    ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    : ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var meses = esPtGantt
    ? ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var mesesMayus = esPtGantt
    ? ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
    : ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  
  var marca = obtenerMarcaSeleccionada();
  var esMercadoPago = (marca === 'mercado_pago');
  var numHeaderRows;
  
  if (esMercadoPago) {
    // 3 filas: Mes (mergeado), Día número, Letra día semana
    var headerRow2 = ['TASK'];
    var headerRow3 = [''];
    
    for (var j = 0; j < fechas.length; j++) {
      var f = fechas[j];
      headerRow2.push(f.getDate());
      headerRow3.push(diasSemanaCorto[f.getDay()]);
    }
    
    // Fila 1: dejar vacía primero, luego mergear por mes
    var headerRow1Vacia = [''];
    for (var j = 0; j < fechas.length; j++) {
      headerRow1Vacia.push('');
    }
    
    hojaGantt.getRange(1, 1, 1, headerRow1Vacia.length).setValues([headerRow1Vacia]);
    hojaGantt.getRange(2, 1, 1, headerRow2.length).setValues([headerRow2]);
    hojaGantt.getRange(3, 1, 1, headerRow3.length).setValues([headerRow3]);
    
    // Mergear celdas de la fila 1 por mes
    var mesInicio = 0;
    var mesActual = fechas[0].getMonth();
    for (var j = 1; j <= fechas.length; j++) {
      var esCambioMes = (j === fechas.length) || (fechas[j].getMonth() !== mesActual);
      if (esCambioMes) {
        var colInicio = mesInicio + 2; // +2 porque col 1 es TASK
        var numCols = j - mesInicio;
        if (numCols > 1) {
          hojaGantt.getRange(1, colInicio, 1, numCols).merge();
        }
        hojaGantt.getRange(1, colInicio).setValue(mesesMayus[mesActual]);
        if (j < fechas.length) {
          mesActual = fechas[j].getMonth();
          mesInicio = j;
        }
      }
    }
    
    hojaGantt.getRange(1, 1, 3, headerRow2.length).setBackground(CONFIG.COLOR_HEADER);
    hojaGantt.getRange(1, 1, 3, headerRow2.length).setFontColor(CONFIG.COLOR_HEADER_TEXT);
    hojaGantt.getRange(1, 1, 3, headerRow2.length).setFontWeight('bold');
    hojaGantt.getRange(1, 1, 3, headerRow2.length).setHorizontalAlignment('center');
    numHeaderRows = 3;
  } else {
    // 2 filas: Fecha (día+mes), Día semana
    var headerRow1 = ['ACTIVIDAD'];
    var headerRow2 = [''];
    
    for (var j = 0; j < fechas.length; j++) {
      var f = fechas[j];
      headerRow1.push(f.getDate() + ' ' + meses[f.getMonth()]);
      headerRow2.push(diasSemana[f.getDay()]);
    }
    
    hojaGantt.getRange(1, 1, 1, headerRow1.length).setValues([headerRow1]);
    hojaGantt.getRange(2, 1, 1, headerRow2.length).setValues([headerRow2]);
    
    hojaGantt.getRange(1, 1, 2, headerRow1.length).setBackground(CONFIG.COLOR_HEADER);
    hojaGantt.getRange(1, 1, 2, headerRow1.length).setFontColor(CONFIG.COLOR_HEADER_TEXT);
    hojaGantt.getRange(1, 1, 2, headerRow1.length).setFontWeight('bold');
    hojaGantt.getRange(1, 1, 2, headerRow1.length).setHorizontalAlignment('center');
    numHeaderRows = 2;
  }
  
  // Dibujar nombres + estructura. Las barras se pintan más abajo (después de finde/feriados).
  var filaActual = numHeaderRows + 1;
  var seccionAnterior = '';
  var ultimaFilaActividad = filaActual;
  var barrasParaPintar = [];
  
  for (var a = 0; a < todasActividades.length; a++) {
    var act = todasActividades[a];
    
    if (act.seccion !== seccionAnterior && act.seccion !== 'final') {
      if (seccionAnterior !== '') filaActual++;
      
      var titulo, colorFondoSeccion, colorTextoSeccion;
      
      if (esMercadoPago) {
        if (act.seccion === 'creativo') {
          titulo = 'DESARROLLO CREATIVO';
          colorFondoSeccion = CONFIG.MP_COLOR_AGRUPADOR_CREATIVO;
        } else if (act.seccion === 'digital') {
          titulo = 'DESARROLLO ESTRATEGIA DIGITAL';
          colorFondoSeccion = CONFIG.MP_COLOR_AGRUPADOR_DIGITAL;
        } else {
          titulo = 'PRODUCCIÓN';
          colorFondoSeccion = CONFIG.MP_COLOR_AGRUPADOR_PRODUCCION;
        }
        colorTextoSeccion = CONFIG.MP_COLOR_AGRUPADOR_TEXT;
      } else {
        titulo = act.seccion === 'creativo' ? '📘 CREATIVE PROCESS' : '📗 PRODUCTION PROCESS';
        colorFondoSeccion = '#E8E8E8';
        colorTextoSeccion = '#000000';
      }
      
      hojaGantt.getRange(filaActual, 1).setValue(titulo);
      hojaGantt.getRange(filaActual, 1).setBackground(colorFondoSeccion);
      hojaGantt.getRange(filaActual, 1).setFontWeight('bold');
      hojaGantt.getRange(filaActual, 1).setFontColor(colorTextoSeccion);
      filaActual++;
      seccionAnterior = act.seccion;
    }
    
    if (act.seccion === 'final' && seccionAnterior !== 'final') {
      filaActual++;
      seccionAnterior = 'final';
    }
    
    var colorActividad;
    if (esMercadoPago) {
      var diasActividad = calcularDiasHabiles(act.inicio, act.fin, feriados);
      colorActividad = obtenerColorActividadMP(act.seccionOriginal || act.seccion, diasActividad);
    } else {
      colorActividad = CONFIG.COLOR_PRESENTACION; // Amarillo uniforme para todas las barras
    }
    
    hojaGantt.getRange(filaActual, 1).setValue(act.nombre);
    hojaGantt.getRange(filaActual, 1).setFontWeight('bold');
    // Fondo blanco para tareas (solo agrupadores tienen color)
    hojaGantt.getRange(filaActual, 1).setBackground('#FFFFFF');
    
    barrasParaPintar.push({
      fila: filaActual,
      inicio: act.inicio,
      fin: act.fin,
      color: colorActividad,
      nombre: act.nombre,
      excepciones: act.excepciones || [],
      seccion: act.seccion,
      esProductora: act.esProductora || false
    });
    
    ultimaFilaActividad = filaActual;
    filaActual++;
  }
  
  // PASO 1: Pintar fines de semana y feriados (capa de fondo)
  var colorFinde = esMercadoPago ? CONFIG.MP_COLOR_FINDE : CONFIG.COLOR_FINDE_BARRA;
  var colorFeriado = esMercadoPago ? CONFIG.MP_COLOR_FERIADO : CONFIG.COLOR_FERIADO_BARRA;
  
  for (var k = 0; k < fechas.length; k++) {
    var col = k + 2;
    var f = fechas[k];
    
    if (esFeriado(f, feriados) || esFinDeSemana(f)) {
      // Pintar toda la columna de gris (incluye header y actividades)
      hojaGantt.getRange(1, col, ultimaFilaActividad, 1).setBackground(colorFinde);
    }
  }
  
  // PASO 1b: Pintar evento empresa (05/10 al 09/10) en verde claro — solo fondo
  var eventoInicio = new Date(2026, 9, 5);  // 05/10/2026
  var eventoFin = new Date(2026, 9, 9);     // 09/10/2026
  var colorEvento = '#C8E6C9'; // Verde claro
  
  for (var ke = 0; ke < fechas.length; ke++) {
    var fe = fechas[ke];
    if (fe >= eventoInicio && fe <= eventoFin) {
      var colE = ke + 2;
      hojaGantt.getRange(1, colE, ultimaFilaActividad, 1).setBackground(colorEvento);
    }
  }
  
  // PASO 2: Pintar barras. Días hábiles: siempre. Días no hábiles: solo si
  // la tarea tiene esa fecha en columna E (excepciones vienen en barra.excepciones).
  var excEncontradas = 0;
  for (var b = 0; b < barrasParaPintar.length; b++) {
    var barra = barrasParaPintar[b];
    if (barra.excepciones && barra.excepciones.length > 0) excEncontradas += barra.excepciones.length;
    
    for (var d = 0; d < fechas.length; d++) {
      var fechaCol = fechas[d];
      var col2 = d + 2;
      
      if (fechaCol < barra.inicio || fechaCol > barra.fin) {
        continue;
      }
      
      if (esDiaHabil(fechaCol, feriados)) {
        hojaGantt.getRange(barra.fila, col2).setBackground(barra.color);
        hojaGantt.getRange(barra.fila, col2).setValue('x');
        hojaGantt.getRange(barra.fila, col2).setFontSize(6);
        hojaGantt.getRange(barra.fila, col2).setFontColor('#000000');
        hojaGantt.getRange(barra.fila, col2).setHorizontalAlignment('center');
      } else if (barra.esProductora) {
        // Productora externa: pintar TODOS los días del rango (la fecha fue indicada explícitamente)
        hojaGantt.getRange(barra.fila, col2).setBackground(barra.color);
        hojaGantt.getRange(barra.fila, col2).setValue('x');
        hojaGantt.getRange(barra.fila, col2).setFontSize(6);
        hojaGantt.getRange(barra.fila, col2).setFontColor('#000000');
        hojaGantt.getRange(barra.fila, col2).setHorizontalAlignment('center');
      } else if (barra.excepciones && barra.excepciones.length > 0) {
        var diaC = fechaCol.getDate();
        var mesC = fechaCol.getMonth();
        var anioC = fechaCol.getFullYear();
        for (var ex = 0; ex < barra.excepciones.length; ex++) {
          var ef = barra.excepciones[ex];
          if (ef.getDate() === diaC && ef.getMonth() === mesC && ef.getFullYear() === anioC) {
            hojaGantt.getRange(barra.fila, col2).setBackground(barra.color);
            hojaGantt.getRange(barra.fila, col2).setValue('x');
            hojaGantt.getRange(barra.fila, col2).setHorizontalAlignment('center');
            hojaGantt.getRange(barra.fila, col2).setFontSize(6);
            break;
          }
        }
      }
    }
  }
  
  // PASO 3: Marcar en azul las celdas donde 2+ tareas se superponen (mismo día hábil)
  // Para MP: no se marca en azul, cada barra conserva su color de grupo
  if (!esMercadoPago) {
    for (var ds = 0; ds < fechas.length; ds++) {
      var fechaSup = fechas[ds];
      if (!esDiaHabil(fechaSup, feriados)) continue;
      
      var filasCubren = [];
      for (var bs = 0; bs < barrasParaPintar.length; bs++) {
        var barraSup = barrasParaPintar[bs];
        if (fechaSup >= barraSup.inicio && fechaSup <= barraSup.fin) {
          filasCubren.push(barraSup.fila);
        }
      }
      
      if (filasCubren.length >= 2) {
        var colSup = ds + 2;
        for (var fs = 0; fs < filasCubren.length; fs++) {
          hojaGantt.getRange(filasCubren[fs], colSup).setBackground(CONFIG.COLOR_SUPERPOSICION);
        }
      }
    }
  }
  
  hojaGantt.setColumnWidth(1, 220);
  for (var c = 2; c <= fechas.length + 1; c++) {
    hojaGantt.setColumnWidth(c, 30);
  }
  
  // GRILLA PUNTEADA sobre toda el área usada (header + actividades + fechas)
  hojaGantt.getRange(1, 1, ultimaFilaActividad, fechas.length + 1)
    .setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.DOTTED);
  
  hojaGantt.setFrozenRows(numHeaderRows);
  hojaGantt.setFrozenColumns(1);
  
  formatearFechasCreativo();
  generarTimelineInline(hojaCreativo, actividadesCreativo, fechas, feriados, meses, diasSemana);
  
  // PASO FINAL: Forzar pintado de excepciones DENTRO del rango (último paso, gana sobre todo)
  var pintadas = 0;
  var infoPin = '';
  for (var bf = 0; bf < barrasParaPintar.length; bf++) {
    var barraF = barrasParaPintar[bf];
    if (!barraF.excepciones || barraF.excepciones.length === 0) continue;
    
    for (var ef = 0; ef < barraF.excepciones.length; ef++) {
      var fechaExc = barraF.excepciones[ef];
      
      // Solo pintar si la excepción cae dentro del rango inicio-fin de la barra
      if (fechaExc < barraF.inicio || fechaExc > barraF.fin) continue;
      
      var diaExc = fechaExc.getDate();
      var mesExc = fechaExc.getMonth();
      var anioExc = fechaExc.getFullYear();
      
      // Buscar la columna del Gantt que corresponde a esta fecha
      for (var cf = 0; cf < fechas.length; cf++) {
        if (fechas[cf].getDate() === diaExc && fechas[cf].getMonth() === mesExc && fechas[cf].getFullYear() === anioExc) {
          var colF = cf + 2;
          hojaGantt.getRange(barraF.fila, colF).setBackground(barraF.color);
          hojaGantt.getRange(barraF.fila, colF).setValue('x');
          hojaGantt.getRange(barraF.fila, colF).setHorizontalAlignment('center');
          hojaGantt.getRange(barraF.fila, colF).setFontSize(6);
          pintadas++;
          infoPin = barraF.nombre + ' F' + barraF.fila + 'C' + colF + ' fecha=' + diaExc + '/' + (mesExc+1) + '/' + anioExc;
          break;
        }
      }
    }
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Exc:' + excEncontradas + ' Pintadas:' + pintadas + ' ' + infoPin, 'DEBUG', 10);
  
  // PASO FINAL 2: Escribir "Feriado" en columnas de feriado (al final para no ser pisado)
  for (var kf = 0; kf < fechas.length; kf++) {
    if (esFeriado(fechas[kf], feriados)) {
      var colFer = kf + 2;
      for (var rf = numHeaderRows + 1; rf <= ultimaFilaActividad; rf++) {
        var celdaFer = hojaGantt.getRange(rf, colFer);
        // Si la celda ya tiene una barra pintada ('x'), la tarea trabaja ese
        // feriado: conservar la 'x' para que se vea claramente la actividad.
        if (celdaFer.getValue() === 'x') continue;
        celdaFer.setValue('Feriado');
        celdaFer.setFontSize(6);
        celdaFer.setFontColor('#000000');
        celdaFer.setHorizontalAlignment('center');
      }
    }
  }
  
  SpreadsheetApp.getUi().alert('Gantt generado correctamente.');
}

// Objeto "no-op" que imita la API de una hoja para redirigir las escrituras
// cuando la tab "Gantt" está desactivada. Ningún método hace nada real, así
// no se crea ninguna hoja (ni temporal) y solo queda el timeline inline.
function crearHojaNoOp() {
  var rangoNoOp = {
    setValue: function () { return rangoNoOp; },
    setValues: function () { return rangoNoOp; },
    setBackground: function () { return rangoNoOp; },
    setBackgrounds: function () { return rangoNoOp; },
    setFontColor: function () { return rangoNoOp; },
    setFontColors: function () { return rangoNoOp; },
    setFontWeight: function () { return rangoNoOp; },
    setFontSize: function () { return rangoNoOp; },
    setFontLine: function () { return rangoNoOp; },
    setFontStyle: function () { return rangoNoOp; },
    setHorizontalAlignment: function () { return rangoNoOp; },
    setVerticalAlignment: function () { return rangoNoOp; },
    setWrap: function () { return rangoNoOp; },
    setNumberFormat: function () { return rangoNoOp; },
    setBorder: function () { return rangoNoOp; },
    merge: function () { return rangoNoOp; },
    getValue: function () { return ''; },
    getValues: function () { return [['']]; },
    clearContent: function () { return rangoNoOp; },
    clearFormat: function () { return rangoNoOp; }
  };
  var hojaNoOp = {
    clear: function () { return hojaNoOp; },
    clearContents: function () { return hojaNoOp; },
    clearFormats: function () { return hojaNoOp; },
    getRange: function () { return rangoNoOp; },
    getLastRow: function () { return 0; },
    getLastColumn: function () { return 0; },
    getMaxRows: function () { return 1000; },
    getMaxColumns: function () { return 26; },
    setColumnWidth: function () { return hojaNoOp; },
    setColumnWidths: function () { return hojaNoOp; },
    setRowHeight: function () { return hojaNoOp; },
    setFrozenRows: function () { return hojaNoOp; },
    setFrozenColumns: function () { return hojaNoOp; },
    hideColumns: function () { return hojaNoOp; },
    hideRows: function () { return hojaNoOp; },
    getName: function () { return '__noop__'; },
    activate: function () { return hojaNoOp; }
  };
  return hojaNoOp;
}

// ============================================
// DEBUG: Pintado directo de excepciones — correr después de Generar Gantt
// ============================================

function debugPintarExcepcion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var hojaGantt = ss.getSheetByName(CONFIG.HOJA_GANTT);
  
  if (!hoja || !hojaGantt) { SpreadsheetApp.getUi().alert('Falta hoja'); return; }
  
  var ultFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultFila - 1, 5).getValues();
  
  // 1. Encontrar la primera tarea con excepción
  var tareaExc = null;
  var fechaExc = null;
  for (var i = 0; i < datos.length; i++) {
    var colE = datos[i][4];
    if (!colE) continue;
    if (colE === true || colE === 'TRUE' || colE === 'SI') continue;
    
    if (colE instanceof Date) {
      tareaExc = datos[i][0];
      fechaExc = colE;
      break;
    } else {
      var parsed = convertirAFecha(colE.toString().split(',')[0].trim());
      if (parsed) {
        tareaExc = datos[i][0];
        fechaExc = parsed;
        break;
      }
    }
  }
  
  if (!fechaExc) { SpreadsheetApp.getUi().alert('No encontré excepción válida en col E'); return; }
  
  // 2. Buscar la columna en el Gantt que corresponde a esa fecha
  var ganttRow1 = hojaGantt.getRange(1, 1, 1, hojaGantt.getLastColumn()).getValues()[0];
  var msg = 'Tarea: ' + tareaExc + '\nFecha excepción: ' + fechaExc.getDate() + '/' + (fechaExc.getMonth()+1) + '/' + fechaExc.getFullYear();
  msg += '\nColumnas en Gantt: ' + ganttRow1.length;
  msg += '\nBuscando columna...';
  
  var colEncontrada = -1;
  for (var c = 1; c < ganttRow1.length; c++) {
    var val = ganttRow1[c];
    if (val instanceof Date) {
      if (val.getDate() === fechaExc.getDate() && val.getMonth() === fechaExc.getMonth() && val.getFullYear() === fechaExc.getFullYear()) {
        colEncontrada = c + 1;
        break;
      }
    }
  }
  
  msg += '\nColumna encontrada: ' + colEncontrada;
  
  // 3. Si encontré la columna, buscar la fila de la tarea y pintar de ROJO
  if (colEncontrada > 0) {
    var ultFilaGantt = hojaGantt.getLastRow();
    for (var r = 1; r <= ultFilaGantt; r++) {
      var celda = hojaGantt.getRange(r, 1).getValue();
      if (celda && celda.toString() === tareaExc.toString()) {
        hojaGantt.getRange(r, colEncontrada).setBackground('#FF0000');
        hojaGantt.getRange(r, colEncontrada).setValue('TEST');
        msg += '\nPINTADO en fila ' + r + ' col ' + colEncontrada;
        break;
      }
    }
  }
  
  SpreadsheetApp.getUi().alert(msg);
}

// ============================================
// GENERAR TIMELINE INLINE EN ENTRADA PROCESO CREATIVO
// ============================================

function generarTimelineInline(hojaCreativo, actividadesCreativo, fechas, feriados, meses, diasSemana) {
  if (!hojaCreativo) return;
  
  var ultimaFila = hojaCreativo.getLastRow();
  if (ultimaFila < 2) return;
  
  var ultimaColumna = hojaCreativo.getLastColumn();
  if (ultimaColumna >= CONFIG.COL_TIMELINE_INICIO) {
    var columnasALimpiar = ultimaColumna - (CONFIG.COL_TIMELINE_INICIO - 1);
    if (columnasALimpiar > 0) {
      hojaCreativo.getRange(1, CONFIG.COL_TIMELINE_INICIO, ultimaFila, columnasALimpiar).clearContent();
      hojaCreativo.getRange(1, CONFIG.COL_TIMELINE_INICIO, ultimaFila, columnasALimpiar).clearFormat();
    }
  }

  // Encabezados de las columnas de entrada F=Status y G=Responsible
  hojaCreativo.getRange(1, 6).setValue('Status');
  hojaCreativo.getRange(1, 7).setValue('Responsible');
  hojaCreativo.getRange(1, 6, 1, 2).setBackground(CONFIG.COLOR_HEADER);
  hojaCreativo.getRange(1, 6, 1, 2).setFontColor(CONFIG.COLOR_HEADER_TEXT);
  hojaCreativo.getRange(1, 6, 1, 2).setFontWeight('bold');
  
  if (!fechas || fechas.length === 0) return;
  
  var marca = obtenerMarcaSeleccionada();
  // Estándar comparte el esquema visual de Mercado Pago.
  var esMercadoPago = (marca === 'mercado_pago' || marca === 'estandar');
  var colInicio = CONFIG.COL_TIMELINE_INICIO; // Columna H (E=Day Off oculto, F=Status, G=Responsible)
  
  // Header de fechas (mismo formato ML para ambas marcas)
  var headerFechas = [];
  for (var j = 0; j < fechas.length; j++) {
    var f = fechas[j];
    headerFechas.push(f.getDate() + ' ' + meses[f.getMonth()]);
  }
  hojaCreativo.getRange(1, colInicio, 1, headerFechas.length).setValues([headerFechas]);
  hojaCreativo.getRange(1, colInicio, 1, headerFechas.length).setBackground(CONFIG.COLOR_HEADER);
  hojaCreativo.getRange(1, colInicio, 1, headerFechas.length).setFontColor(CONFIG.COLOR_HEADER_TEXT);
  hojaCreativo.getRange(1, colInicio, 1, headerFechas.length).setFontWeight('bold');
  hojaCreativo.getRange(1, colInicio, 1, headerFechas.length).setHorizontalAlignment('center');
  
  var datos = hojaCreativo.getRange(2, 1, ultimaFila - 1, 5).getValues(); // A:E
  
  // PASO 1: Pintar fines de semana y feriados (capa de fondo)
  var colorFinde = esMercadoPago ? CONFIG.MP_COLOR_FINDE : CONFIG.COLOR_FINDE_BARRA;
  var colorFeriado = esMercadoPago ? CONFIG.MP_COLOR_FERIADO : CONFIG.COLOR_FERIADO_BARRA;
  
  for (var k = 0; k < fechas.length; k++) {
    var col = k + colInicio;
    var f = fechas[k];
    
    if (esFeriado(f, feriados) || esFinDeSemana(f)) {
      hojaCreativo.getRange(1, col, ultimaFila, 1).setBackground(colorFinde);
    }
  }
  
  // PASO 1b: Pintar evento empresa (05/10 al 09/10) en verde claro
  var eventoIni2 = new Date(2026, 9, 5);
  var eventoFin2 = new Date(2026, 9, 9);
  for (var ke2 = 0; ke2 < fechas.length; ke2++) {
    var fe2 = fechas[ke2];
    if (fe2 >= eventoIni2 && fe2 <= eventoFin2) {
      hojaCreativo.getRange(1, ke2 + colInicio, ultimaFila, 1).setBackground('#C8E6C9');
    }
  }
  
  // Determinar sección de cada fila para colores MP
  var seccionPorFila = [];
  if (esMercadoPago) {
    var seccionActual = 'creativo';
    for (var i = 0; i < datos.length; i++) {
      var act = datos[i][0];
      if (act && esFilaHeaderSubgrupo(act)) {
        var norm = act.toString().toUpperCase().trim();
        if (norm === 'DESARROLLO CREATIVO' || norm === 'DESENVOLVIMENTO CRIATIVO') seccionActual = 'creativo';
        else if (norm === 'DESARROLLO ESTRATEGIA DIGITAL' || norm === 'DESENVOLVIMENTO ESTRATÉGIA DIGITAL' || norm === 'DESENVOLVIMENTO ESTRATEGIA DIGITAL') seccionActual = 'digital';
        else if (norm === 'PRODUCCIÓN' || norm === 'PRODUCCION' || norm === 'PRODUÇÃO') seccionActual = 'produccion';
      }
      seccionPorFila.push(seccionActual);
    }
  }
  
  // PASO 2: Pintar las barras (hábiles + excepciones de col E)
  for (var fila = 0; fila < datos.length; fila++) {
    var actividad = datos[fila][0];
    var fechaInicio = datos[fila][2];
    var fechaFin = datos[fila][3];
    var colE = datos[fila][4];
    
    if (!actividad || !fechaInicio || !fechaFin) continue;
    if (!(fechaInicio instanceof Date) || !(fechaFin instanceof Date)) continue;
    if (esFilaHeaderSubgrupo(actividad)) continue;
    
    // Parsear excepciones de col E
    var excFila = parsearExcepcionesColE(colE);
    
    var colorActividad;
    if (esMercadoPago) {
      var diasActividad = calcularDiasHabiles(fechaInicio, fechaFin, feriados);
      colorActividad = obtenerColorActividadMP(seccionPorFila[fila], diasActividad);
    } else if (marca === 'pedidos_ya') {
      colorActividad = CONFIG.PY_COLOR_BARRA; // Rojo suave de marca Pedidos Ya
    } else {
      colorActividad = CONFIG.COLOR_PRESENTACION; // Amarillo uniforme
    }
    
    var filaHoja = fila + 2;
    
    for (var d = 0; d < fechas.length; d++) {
      var fechaCol = fechas[d];
      var col2 = d + colInicio;
      
      // Dentro del rango de la tarea
      if (fechaCol >= fechaInicio && fechaCol <= fechaFin) {
        if (esDiaHabil(fechaCol, feriados)) {
          hojaCreativo.getRange(filaHoja, col2).setBackground(colorActividad);
          hojaCreativo.getRange(filaHoja, col2).setValue('x');
          hojaCreativo.getRange(filaHoja, col2).setFontSize(6);
          hojaCreativo.getRange(filaHoja, col2).setFontColor('#000000');
          hojaCreativo.getRange(filaHoja, col2).setHorizontalAlignment('center');
        } else if (excFila.length > 0) {
          var dc = fechaCol.getDate(), mc = fechaCol.getMonth(), ac = fechaCol.getFullYear();
          for (var xe = 0; xe < excFila.length; xe++) {
            if (excFila[xe].getDate() === dc && excFila[xe].getMonth() === mc && excFila[xe].getFullYear() === ac) {
              hojaCreativo.getRange(filaHoja, col2).setBackground(colorActividad);
              hojaCreativo.getRange(filaHoja, col2).setValue('x');
              hojaCreativo.getRange(filaHoja, col2).setHorizontalAlignment('center');
              hojaCreativo.getRange(filaHoja, col2).setFontSize(6);
              break;
            }
          }
        }
      } else if (excFila.length > 0) {
        // Fuera del rango: no pintar. Las excepciones dentro del rango
        // ya se manejan en el bloque de arriba (else if dentro del rango).
      }
    }
  }
  
  // PASO 3: Marcar en azul las celdas donde 2+ tareas se superponen (solo para ML)
  if (!esMercadoPago) {
    for (var ds = 0; ds < fechas.length; ds++) {
      var fechaSup = fechas[ds];
      if (!esDiaHabil(fechaSup, feriados)) continue;
      
      var filasCubren = [];
      for (var fs2 = 0; fs2 < datos.length; fs2++) {
        var actSup = datos[fs2][0];
        var iniSup = datos[fs2][2];
        var finSup = datos[fs2][3];
        if (!actSup || !iniSup || !finSup) continue;
        if (!(iniSup instanceof Date) || !(finSup instanceof Date)) continue;
        if (fechaSup >= iniSup && fechaSup <= finSup) {
          filasCubren.push(fs2 + 2);
        }
      }
      
      if (filasCubren.length >= 2) {
        var colSup = ds + colInicio;
        for (var fsf = 0; fsf < filasCubren.length; fsf++) {
          hojaCreativo.getRange(filasCubren[fsf], colSup).setBackground(CONFIG.COLOR_SUPERPOSICION);
        }
      }
    }
  }
  
  // Ancho de columnas
  for (var c = colInicio; c < colInicio + fechas.length; c++) {
    hojaCreativo.setColumnWidth(c, 40);
  }
  
  // GRILLA PUNTEADA sobre el área del timeline
  hojaCreativo.getRange(1, colInicio, ultimaFila, fechas.length)
    .setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.DOTTED);
  
  // Escribir "Feriado" en columnas de feriado del timeline
  for (var kf2 = 0; kf2 < fechas.length; kf2++) {
    if (esFeriado(fechas[kf2], feriados)) {
      var colFer2 = kf2 + colInicio;
      for (var rf2 = 2; rf2 <= ultimaFila; rf2++) {
        hojaCreativo.getRange(rf2, colFer2).setValue('Feriado');
        hojaCreativo.getRange(rf2, colFer2).setFontSize(6);
        hojaCreativo.getRange(rf2, colFer2).setFontColor('#000000');
        hojaCreativo.getRange(rf2, colFer2).setHorizontalAlignment('center');
      }
    }
  }
}

// ============================================
// OBTENER ACTIVIDADES
// ============================================

function obtenerActividadesCreativo(hoja) {
  var actividades = [];
  
  if (!hoja) return actividades;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return actividades;
  
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues(); // A:E
  var marca = obtenerMarcaSeleccionada();
  // Estándar comparte el esquema de agrupadores de Mercado Pago.
  var esMercadoPago = (marca === 'mercado_pago' || marca === 'estandar');
  
  // Determinar sección de cada actividad según su agrupador
  var seccionActual = 'creativo';
  
  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    var inicio = datos[i][2];
    var fin = datos[i][3];
    var colE = datos[i][4];
    
    if (!actividad) continue;
    
    // Detectar agrupadores para determinar sección
    if (esFilaHeaderSubgrupo(actividad)) {
      var norm = actividad.toString().toUpperCase().trim();
      if (esMercadoPago) {
        if (norm === 'DESARROLLO CREATIVO' || norm === 'DESENVOLVIMENTO CRIATIVO') {
          seccionActual = 'creativo';
        } else if (norm === 'DESARROLLO ESTRATEGIA DIGITAL' || norm === 'DESENVOLVIMENTO ESTRATÉGIA DIGITAL' || norm === 'DESENVOLVIMENTO ESTRATEGIA DIGITAL') {
          seccionActual = 'digital';
        } else if (norm === 'PRODUCCIÓN' || norm === 'PRODUCCION' || norm === 'PRODUÇÃO') {
          seccionActual = 'produccion';
        }
      } else {
        if (norm === 'ETAPA CREATIVA' || norm === 'ETAPA CRIATIVA' || norm === 'PROCESO CREATIVO') {
          seccionActual = 'creativo';
        } else if (norm === 'ETAPA PRODUCCION' || norm === 'ETAPA PRODUCCIÓN' || norm === 'ETAPA PRODUÇÃO' || norm === 'PRODUCTION PLANNING') {
          seccionActual = 'produccion';
        }
      }
      continue;
    }
    
    if (!inicio || !fin) continue;
    if (!(inicio instanceof Date) || !(fin instanceof Date)) continue;
    
    // Parsear excepciones de columna E
    var excepciones = [];
    if (colE) {
      if (colE instanceof Date) {
        excepciones.push(colE);
      } else if (typeof colE === 'string' && colE.trim() !== '' && colE !== 'TRUE' && colE !== 'SI' && colE !== 'SÍ') {
        var partes = colE.split(',');
        for (var p = 0; p < partes.length; p++) {
          var fp = convertirAFecha(partes[p].trim());
          if (fp) excepciones.push(fp);
        }
      }
    }
    
    actividades.push({
      nombre: actividad,
      inicio: inicio,
      fin: fin,
      seccion: seccionActual,
      seccionOriginal: seccionActual,
      excepciones: excepciones
    });
  }
  
  return actividades;
}

function obtenerActividadesProduccion(hoja) {
  var actividades = [];
  
  if (!hoja) return actividades;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return actividades;
  
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 3).getValues();
  
  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    var inicioRaw = datos[i][1];
    var finRaw = datos[i][2];
    
    if (!actividad) continue;
    
    var inicio = convertirAFecha(inicioRaw);
    var fin = convertirAFecha(finRaw);
    
    if (!inicio || !fin) continue;
    
    actividades.push({
      nombre: actividad,
      inicio: inicio,
      fin: fin,
      seccion: 'produccion',
      excepciones: [],
      esProductora: true
    });
  }
  
  return actividades;
}

// ============================================
// VERIFICAR HEADERS
// ============================================

function verificarHeadersCreativo(hoja) {
  var headers = ['Actividad', 'Días', 'Fecha Inicio', 'Fecha Fin', '¿Se trabaja en Día Off?'];
  
  for (var col = 1; col <= headers.length; col++) {
    var headerActual = hoja.getRange(1, col).getValue();
    if (headerActual !== headers[col - 1]) {
      hoja.getRange(1, col).setValue(headers[col - 1]);
    }
  }
}

// ============================================
// FUNCIONES DE FECHAS
// ============================================

function obtenerFeriados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaFeriados = ss.getSheetByName(CONFIG.HOJA_FERIADOS);
  var feriados = [];
  
  if (!hojaFeriados) return feriados;
  
  var ultimaFila = hojaFeriados.getLastRow();
  if (ultimaFila < 2) return feriados;
  
  var paisesSeleccionados = obtenerPaisesSeleccionados();
  
  if (paisesSeleccionados.length === 0) return feriados;
  
  var datos = hojaFeriados.getRange(2, 1, ultimaFila - 1, 3).getValues();
  
  for (var i = 0; i < datos.length; i++) {
    var pais = datos[i][0] ? datos[i][0].toString().trim() : '';
    var fechaRaw = datos[i][2];
    
    if (paisesSeleccionados.indexOf(pais) === -1) continue;
    
    var fecha = convertirAFecha(fechaRaw);
    
    if (fecha) {
      feriados.push(normalizarFecha(fecha));
    }
  }
  
  return feriados;
}

// ============================================
// CONVERTIR TEXTO O DATE A FECHA
// ============================================

function convertirAFecha(valor) {
  if (valor instanceof Date) {
    return valor;
  }
  
  if (typeof valor === 'string' && valor.trim() !== '') {
    var partes = valor.trim().split('/');
    if (partes.length === 3) {
      var dia = parseInt(partes[0], 10);
      var mes = parseInt(partes[1], 10) - 1;
      var anio = parseInt(partes[2], 10);
      
      if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
        return new Date(anio, mes, dia);
      }
    }
  }
  
  return null;
}

// ============================================
// OBTENER PAÍSES SELECCIONADOS DESDE INSTRUCCIONES
// ============================================

function obtenerPaisesSeleccionados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaInstrucciones = ss.getSheetByName(CONFIG.HOJA_INSTRUCCIONES);
  var paises = [];
  
  if (!hojaInstrucciones) return paises;
  
  var datos = hojaInstrucciones.getDataRange().getValues();
  var filaFeriados = -1;
  
  for (var i = 0; i < datos.length; i++) {
    for (var j = 0; j < datos[i].length; j++) {
      var valor = datos[i][j] ? datos[i][j].toString() : '';
      if (valor.indexOf('Seleccionar Feriados') !== -1 || valor.indexOf('Selecionar Feriados') !== -1) {
        filaFeriados = i + 1;
        break;
      }
    }
    if (filaFeriados !== -1) break;
  }
  
  if (filaFeriados === -1) return paises;
  
  var checkArgentina = hojaInstrucciones.getRange(filaFeriados, 4).getValue(); // D
  var checkBrasil = hojaInstrucciones.getRange(filaFeriados, 6).getValue();    // F
  var checkMexico = hojaInstrucciones.getRange(filaFeriados, 8).getValue();    // H
  var checkChile = hojaInstrucciones.getRange(filaFeriados, 10).getValue();    // J
  var checkPeru = hojaInstrucciones.getRange(filaFeriados, 12).getValue();     // L
  
  if (checkArgentina === true) paises.push('Argentina');
  if (checkBrasil === true) paises.push('Brasil');
  if (checkMexico === true) paises.push('México City');
  if (checkChile === true) paises.push('Chile');
  if (checkPeru === true) paises.push('Peru');
  
  return paises;
}

function normalizarFecha(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

function esFinDeSemana(fecha) {
  var dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

function esFeriado(fecha, feriados) {
  var fechaNorm = normalizarFecha(fecha);
  for (var i = 0; i < feriados.length; i++) {
    if (feriados[i] === fechaNorm) return true;
  }
  return false;
}

function esDiaHabil(fecha, feriados) {
  return !esFinDeSemana(fecha) && !esFeriado(fecha, feriados);
}

// ============================================
// MOSTRAR AYUDA DAY OFF (una sola vez por documento)
// ============================================

function mostrarAyudaDayOffSiPrimeraVez() {
  var props = PropertiesService.getDocumentProperties();
  if (props.getProperty('dayoff_ayuda_mostrada') === 'si') return;
  
  SpreadsheetApp.getUi().alert(
    '👷 ¿Se trabaja en Día Off? — Columna E',
    'Si una tarea se trabaja en fin de semana o feriado, escribí la fecha en la columna E de esa tarea (ej: 25/07/2026).\n\n' +
    'Si hay más de una fecha, separarlas con coma (ej: 25/07/2026, 26/07/2026).\n\n' +
    'También podés escribir "SI" y al generar el Gantt te aparece un selector con los fines de semana y feriados de esa tarea.\n\n' +
    'Al correr la cascada, esos días se cuentan como laborables para esa tarea.\n\n' +
    'En el Gantt aparecen marcados con ⚙️.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  
  props.setProperty('dayoff_ayuda_mostrada', 'si');
}

// Parsear el valor de la columna E de una fila. Devuelve array de Date.
function parsearExcepcionesColE(valor) {
  var excepciones = [];
  if (!valor) return excepciones;
  if (valor instanceof Date) {
    excepciones.push(valor);
  } else {
    var texto = valor.toString().trim();
    if (texto === '' || texto === 'TRUE' || texto === 'true' || texto === 'SI' || texto === 'SÍ' || texto === 'Si' || texto === 'YES' || texto === 'Yes' || texto === 'yes' || texto === 'FALSE' || texto === 'false') return excepciones;
    var partes = texto.split(',');
    for (var i = 0; i < partes.length; i++) {
      var f = convertirAFecha(partes[i].trim());
      if (f) excepciones.push(f);
    }
  }
  return excepciones;
}

// Versión que considera excepciones: un día no hábil se trata como hábil
// si está en la lista de excepciones de la tarea.
function esDiaHabilConExc(fecha, feriados, excepciones) {
  if (esDiaHabil(fecha, feriados)) return true;
  if (!excepciones || excepciones.length === 0) return false;
  var d = fecha.getDate(), m = fecha.getMonth(), a = fecha.getFullYear();
  for (var i = 0; i < excepciones.length; i++) {
    var e = excepciones[i];
    if (e.getDate() === d && e.getMonth() === m && e.getFullYear() === a) return true;
  }
  return false;
}

function siguienteDiaHabil(fecha, feriados) {
  var siguiente = new Date(fecha.getTime());
  siguiente.setDate(siguiente.getDate() + 1);
  
  while (!esDiaHabil(siguiente, feriados)) {
    siguiente.setDate(siguiente.getDate() + 1);
  }
  
  return siguiente;
}

function siguienteDiaHabilConExc(fecha, feriados, excepciones) {
  var siguiente = new Date(fecha.getTime());
  siguiente.setDate(siguiente.getDate() + 1);
  while (!esDiaHabilConExc(siguiente, feriados, excepciones)) {
    siguiente.setDate(siguiente.getDate() + 1);
  }
  return siguiente;
}

function diaHabilAnterior(fecha, feriados) {
  var anterior = new Date(fecha.getTime());
  anterior.setDate(anterior.getDate() - 1);
  
  while (!esDiaHabil(anterior, feriados)) {
    anterior.setDate(anterior.getDate() - 1);
  }
  
  return anterior;
}

function diaHabilAnteriorConExc(fecha, feriados, excepciones) {
  var anterior = new Date(fecha.getTime());
  anterior.setDate(anterior.getDate() - 1);
  while (!esDiaHabilConExc(anterior, feriados, excepciones)) {
    anterior.setDate(anterior.getDate() - 1);
  }
  return anterior;
}

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

function sumarDiasHabilesConExc(fechaInicio, diasHabiles, feriados, excepciones) {
  var fecha = new Date(fechaInicio.getTime());
  var diasAgregados = 0;
  if (diasHabiles === 0) return fecha;
  while (diasAgregados < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1);
    if (esDiaHabilConExc(fecha, feriados, excepciones)) {
      diasAgregados++;
    }
  }
  return fecha;
}

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

function restarDiasHabilesConExc(fechaFin, diasHabiles, feriados, excepciones) {
  var fecha = new Date(fechaFin.getTime());
  var diasRestados = 0;
  if (diasHabiles === 0) return fecha;
  while (diasRestados < diasHabiles) {
    fecha.setDate(fecha.getDate() - 1);
    if (esDiaHabilConExc(fecha, feriados, excepciones)) {
      diasRestados++;
    }
  }
  return fecha;
}

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
// ELIMINAR FILAS PLACEHOLDER DE PRODUCCIÓN EN CREATIVO
// ============================================

function eliminarFilasProduccionPlaceholder() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaCreativo = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  
  if (!hojaCreativo) return;
  
  var ultimaFila = hojaCreativo.getLastRow();
  if (ultimaFila < 2) return;
  
  var nombresEliminar = [
    'PRE PRODUCCIÓN',
    'PRE PRODUCCION', 
    'SHOOTING',
    'POST PRODUCCIÓN',
    'POST PRODUCCION'
  ];
  
  for (var fila = ultimaFila; fila >= 2; fila--) {
    var actividad = hojaCreativo.getRange(fila, 1).getValue();
    
    if (actividad) {
      var nombreUpper = actividad.toString().toUpperCase().trim();
      
      for (var i = 0; i < nombresEliminar.length; i++) {
        if (nombreUpper === nombresEliminar[i]) {
          hojaCreativo.deleteRow(fila);
          break;
        }
      }
    }
  }
}

// ============================================
// TRIGGER AUTOMÁTICO
// ============================================

function onChange(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaActiva = ss.getActiveSheet();
  
  if (!hojaActiva) return;
  
  var nombreHoja = hojaActiva.getName();
  
  if (nombreHoja === CONFIG.HOJA_CREATIVO) {
    var ultimaFila = hojaActiva.getLastRow();
    if (ultimaFila < 2) return;
    
    // Al pegar datos (incluida la tabla de producción) en "Gantt GUT", las
    // fechas pueden entrar como texto. Se normalizan a Date real para que el
    // Gantt visual inline las reconozca.
    normalizarFechasCreativo();
    
    // Cuando la cuenta de servicio inserta la entrada automática, viene con
    // Fecha Inicio (C) y Fecha Fin (D) pero sin Días (B). onEdit no se dispara
    // con escrituras programáticas, así que acá se calculan los días hábiles
    // y se completan en la columna B (solo filas con Días vacío).
    completarDiasFaltantesCreativo();
  }
  
  if (nombreHoja === CONFIG.HOJA_INSTRUCCIONES) {
    traducirActividadesEnHoja();
    traducirTextoInstrucciones();
  }
  
  if (nombreHoja === CONFIG.HOJA_FERIADOS) {
    normalizarFechasFeriados();
    aplicarValidacionFeriadosSiFalta();
  }
}

// ============================================
// onEdit - SINCRONIZACIÓN BIDIRECCIONAL DÍAS <-> FECHAS (solo la fila editada)
// ============================================
// Se dispara cuando el usuario edita A MANO en Entrada Proceso Creativo:
// - Si edita una FECHA (col C o D)  -> recalcula los Días (col B) de ESA fila.
// - Si edita los DÍAS (col B)       -> recalcula la Fecha Fin (col D) de ESA fila,
//                                       manteniendo la Fecha Inicio (col C) como ancla.
//                                       (Si no hay Inicio pero sí Fin, hace el inverso.)
// NUNCA toca otras filas, así no rompe superposiciones armadas a mano.
// Los cambios programáticos (setValue) NO re-disparan onEdit -> no hay loop.
// Días = días hábiles (excluye finde/feriado), igual que las cascadas.

function onEdit(e) {
  if (!e || !e.range) return;
  
  var hoja = e.range.getSheet();
  var nombreHoja = hoja.getName();
  
  // Detectar cambio de checkbox de marca en Instrucciones.
  // Marca: columna C (3), filas 11 (ML), 12 (MP), 13 (Estándar), 14 (Pedidos Ya).
  if (nombreHoja === CONFIG.HOJA_INSTRUCCIONES) {
    var filaEdit = e.range.getRow();
    var colEdit = e.range.getColumn();
    
    var filasMarca = [11, 12, 13, 14]; // C11=ML, C12=MP, C13=Estándar, C14=Pedidos Ya
    var esFilaMarca = false;
    for (var fm = 0; fm < filasMarca.length; fm++) {
      if (filaEdit === filasMarca[fm]) { esFilaMarca = true; break; }
    }
    
    if (colEdit === 3 && esFilaMarca) {
      // Checkboxes mutuamente excluyentes: al marcar uno, se desmarcan los demás.
      var valor = e.range.getValue();
      if (valor === true) {
        for (var fd = 0; fd < filasMarca.length; fd++) {
          if (filasMarca[fd] !== filaEdit) {
            hoja.getRange('C' + filasMarca[fd]).setValue(false);
          }
        }
      }
      poblarTareasPredeterminadas();
    }
    return;
  }
  
  // La sincronización automática Días<->Fechas del onEdit asume el layout de
  // GUT (Días=B, Inicio=C, Fin=D). La hoja "Gantt Meli" tiene otro layout
  // (Días=D, Inicio=E, Fin=F), así que NO se sincroniza automáticamente ahí:
  // el cliente recalcula con el menú Agente Meli (que usa ESQUEMA_MELI).
  var esGut = (nombreHoja === CONFIG.HOJA_CREATIVO);
  if (!esGut) return;
  
  var filaIni = e.range.getRow();
  var filaFin = filaIni + e.range.getNumRows() - 1;
  var colIni = e.range.getColumn();
  var colFin = colIni + e.range.getNumColumns() - 1;
  
  // ¿Qué columnas relevantes se tocaron? B=2 (Días), C=3 (Inicio), D=4 (Fin), E=5 (Day Off)
  var tocoFecha = (colIni <= 4 && colFin >= 3); // intersecta C o D
  var tocoDias  = (colIni <= 2 && colFin >= 2); // intersecta B
  var tocoDayOff = (colIni <= 5 && colFin >= 5); // intersecta E
  
  if (!tocoFecha && !tocoDias && !tocoDayOff) return;
  
  var feriados = obtenerFeriados();
  
  for (var fila = filaIni; fila <= filaFin; fila++) {
    if (fila < 2) continue; // saltear header
    
    var actividad = hoja.getRange(fila, 1).getValue();
    if (!actividad || actividad.toString().trim() === '') continue;
    
    // Si es agrupador, saltar
    if (esFilaHeaderSubgrupo(actividad)) continue;
    
    if (tocoDayOff) {
      // Edición en columna E → recalcular Fecha Fin con excepciones
      recalcularFechaFinConExcepciones(hoja, fila, feriados);
    } else if (tocoFecha) {
      registrarCambioFecha(hoja, fila, colIni, colFin, e);
      sincronizarDiasDesdeFechas(hoja, fila, feriados);
    } else {
      // Cambio de días (columna B)
      var actB = hoja.getRange(fila, 1).getValue();
      var nuevoDias = hoja.getRange(fila, 2).getValue();
      registrarLog('Cambio de días', actB + ' — Días: ' +
        ((e && colIni === 2 && e.oldValue !== undefined) ? (e.oldValue + ' → ') : '') + nuevoDias);
      sincronizarFechasDesdeDias(hoja, fila, feriados);
    }
  }
  
  // Tras sincronizar, re-evaluar superposición de fechas en la tabla de entrada.
  // Pinta de celeste las celdas C:D de las filas que se solapan; limpia las que no.
  var haySuperposicion = marcarSuperposicionEntrada(hoja);
  if (haySuperposicion) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Estás superponiendo fechas a mano (hay tareas en paralelo).',
      '⚠️ Fechas superpuestas', 6);
  }

  // Si se cambiaron DÍAS, el desvío pudo cambiar → mostrar estado y
  // regenerar el resumen. Una sola vez por edición (no por fila).
  // El desvío/resumen es SOLO del mundo GUT; Meli no lo usa.
  if (tocoDias && esGut) {
    mostrarEstadoDesvio();
    generarResumenEnDoc(true);
  }
}

// Marca en celeste las celdas de fecha (C:D) de las filas cuyas fechas se cruzan
// con otra tarea (intersección de rangos), y limpia las que no. Devuelve true si
// hay al menos una superposición. NO toca otras columnas ni otras filas.
function marcarSuperposicionEntrada(hoja) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return false;
  
  var n = ultimaFila - 1;
  var datos = hoja.getRange(2, 1, n, 4).getValues(); // A:D
  
  // Reset del fondo de C:D en toda la tabla (queda blanco = sin marca)
  hoja.getRange(2, 3, n, 2).setBackground('#FFFFFF');
  
  // Armar lista de rangos válidos
  var tareas = [];
  for (var i = 0; i < n; i++) {
    var act = datos[i][0];
    var ini = convertirAFecha(datos[i][2]);
    var fin = convertirAFecha(datos[i][3]);
    tareas.push({ valida: !!(act && ini && fin), ini: ini, fin: fin });
  }
  
  var hay = false;
  for (var a = 0; a < n; a++) {
    if (!tareas[a].valida) continue;
    for (var b = 0; b < n; b++) {
      if (b === a || !tareas[b].valida) continue;
      // Intersección de rangos: a.ini <= b.fin && b.ini <= a.fin
      if (tareas[a].ini <= tareas[b].fin && tareas[b].ini <= tareas[a].fin) {
        hoja.getRange(a + 2, 3, 1, 2).setBackground(CONFIG.COLOR_AVISO_SUPERPOSICION);
        hay = true;
        break;
      }
    }
  }
  
  return hay;
}

// Dirección A: fechas -> Días (recalcula los días hábiles de la fila)
function sincronizarDiasDesdeFechas(hoja, fila, feriados) {
  var inicio = convertirAFecha(hoja.getRange(fila, 3).getValue());
  var fin = convertirAFecha(hoja.getRange(fila, 4).getValue());
  
  if (!inicio || !fin) return; // faltan fechas, no se puede calcular
  
  var dias = calcularDiasHabiles(inicio, fin, feriados);
  hoja.getRange(fila, 2).setValue(dias);
  hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
}

// Recalcular Fecha Fin al editar columna E (Day Off).
// Recalcular Fecha Inicio y Fecha Fin al editar columna E (Day Off).
// Caso "antes inmediato": Fecha Inicio se mueve a la excepción, Fecha Fin se adelanta.
// Caso "en el medio" o "al final": Fecha Inicio no cambia, Fecha Fin se adelanta.
function recalcularFechaFinConExcepciones(hoja, fila, feriados) {
  var dias = parseInt(hoja.getRange(fila, 2).getValue(), 10);
  if (isNaN(dias) || dias < 1) return;
  
  var inicio = convertirAFecha(hoja.getRange(fila, 3).getValue());
  if (!inicio) return;
  
  var excValor = hoja.getRange(fila, 5).getValue();
  var excepciones = parsearExcepcionesColE(excValor);
  
  if (!excepciones || excepciones.length === 0) {
    // Sin excepciones, recalcular normal
    var nuevaFin = sumarDiasHabiles(inicio, dias - 1, feriados);
    hoja.getRange(fila, 4).setValue(nuevaFin);
    hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
    return;
  }
  
  // Buscar excepciones que caen ANTES del inicio (contiguas hacia atrás)
  // Iterar hasta que no haya más contiguas
  var inicioEfectivo = new Date(inicio.getTime());
  var huboMovimiento = true;
  while (huboMovimiento) {
    huboMovimiento = false;
    for (var e = 0; e < excepciones.length; e++) {
      var exc = excepciones[e];
      var diaAnterior = new Date(inicioEfectivo.getTime());
      diaAnterior.setDate(diaAnterior.getDate() - 1);
      if (exc.getTime() === diaAnterior.getTime()) {
        inicioEfectivo = new Date(exc.getTime());
        huboMovimiento = true;
      }
    }
  }
  
  // Mover Fecha Inicio si cambió
  if (inicioEfectivo.getTime() !== inicio.getTime()) {
    hoja.getRange(fila, 3).setValue(inicioEfectivo);
  }
  
  // Calcular Fecha Fin: sumar dias-1 días hábiles desde inicio efectivo,
  // contando las excepciones como hábiles
  var nuevaFin = sumarDiasHabilesConExc(inicioEfectivo, dias - 1, feriados, excepciones);
  hoja.getRange(fila, 4).setValue(nuevaFin);
  hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
}

// Dirección B: Días -> Fecha Fin (ancla = Fecha Inicio). Fallback: ancla = Fecha Fin.
function sincronizarFechasDesdeDias(hoja, fila, feriados) {
  var dias = parseInt(hoja.getRange(fila, 2).getValue(), 10);
  if (isNaN(dias) || dias < 1) return; // días inválido, no toco fechas
  
  var inicio = convertirAFecha(hoja.getRange(fila, 3).getValue());
  var fin = convertirAFecha(hoja.getRange(fila, 4).getValue());
  
  if (inicio) {
    // Ancla = Fecha Inicio -> recalculo Fecha Fin
    var nuevaFin = sumarDiasHabiles(inicio, dias - 1, feriados);
    hoja.getRange(fila, 4).setValue(nuevaFin);
    hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
  } else if (fin) {
    // No hay Inicio pero sí Fin -> ancla = Fecha Fin -> recalculo Fecha Inicio
    var nuevaInicio = restarDiasHabiles(fin, dias - 1, feriados);
    hoja.getRange(fila, 3).setValue(nuevaInicio);
    hoja.getRange(fila, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
  }
  // si no hay ninguna fecha, no hay ancla -> no se hace nada
}

// ============================================
// NORMALIZAR FECHAS EN ENTRADA PRODUCCIÓN (texto → Date)
// ============================================

// Normaliza las fechas de "Gantt GUT" (columnas C=Fecha Inicio y D=Fecha Fin):
// convierte cualquier texto de fecha (ej. "15/01/2026") en una fecha real (Date)
// y aplica el formato dd/MM/yyyy. Es el ajuste que antes hacía la hoja
// "Entrada Producción"; ahora que la data de producción se pega dentro de
// "Gantt GUT", esto asegura que el Gantt visual inline reconozca esas fechas.
function normalizarFechasCreativo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  
  if (!hoja) return;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  
  // Columnas C (Inicio) y D (Fin), desde la fila 2.
  var rango = hoja.getRange(2, 3, ultimaFila - 1, 2);
  var valores = rango.getValues();
  var cambios = false;
  
  // IMPORTANTE: solo tocar las celdas que son TEXTO. Las que ya son Date se
  // dejan intactas (no se reformatean) para no alterar fechas que ya entraban
  // bien desde la entrada automática.
  for (var i = 0; i < valores.length; i++) {
    for (var j = 0; j < 2; j++) {
      var valor = valores[i][j];
      
      if (typeof valor === 'string' && valor.trim() !== '') {
        var fecha = convertirAFecha(valor);
        if (fecha) {
          // Escribir la fecha convertida + formato solo en esa celda.
          var celda = hoja.getRange(2 + i, 3 + j);
          celda.setValue(fecha);
          celda.setNumberFormat('dd/MM/yyyy');
          cambios = true;
        }
      }
    }
  }
}

// Completa la columna Días (B) de "Gantt GUT" para las filas que tienen
// Fecha Inicio (C) y Fecha Fin (D) pero Días vacío. Calcula días HÁBILES
// (excluye findes y feriados), igual que el resto del Gantt. NO pisa valores
// de Días ya existentes ni toca las filas agrupadoras (col A con texto y B vacía,
// que se dejan vacías a propósito).
// Pensado para cuando la cuenta de servicio inserta la entrada automática:
// onEdit no se dispara con escrituras programáticas, así que se llama desde onChange.
function completarDiasFaltantesCreativo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  
  if (!hoja) return;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  
  var feriados = obtenerFeriados();
  
  // Columnas A (Actividad), B (Días), C (Inicio), D (Fin), desde la fila 2.
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 4).getValues();
  var columnaDias = [];
  var hayCambios = false;
  
  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    var diasActual = datos[i][1];
    var inicio = convertirAFecha(datos[i][2]);
    var fin = convertirAFecha(datos[i][3]);
    
    var diasEstaVacio = (diasActual === '' || diasActual === null || diasActual === undefined);
    
    // Solo completar filas de tarea (no agrupadores) con ambas fechas y Días vacío.
    if (actividad && diasEstaVacio && inicio && fin && !esFilaHeaderSubgrupo(actividad, diasActual)) {
      columnaDias.push([calcularDiasHabiles(inicio, fin, feriados)]);
      hayCambios = true;
    } else {
      // Dejar el valor como está (agrupadores, filas ya con días, o incompletas).
      columnaDias.push([diasActual]);
    }
  }
  
  if (hayCambios) {
    hoja.getRange(2, 2, columnaDias.length, 1).setValues(columnaDias);
  }
}

// ============================================
// DIAGNÓSTICO: correr a mano desde el editor de Apps Script (Ejecutar →
// diagnosticarDiasCreativo) y mirar el Log (Ver → Registros / Ctrl+Enter).
// Muestra, fila por fila, qué ve el código en A/B/C/D y por qué completa o no.
// ============================================
function diagnosticarDiasCreativo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) { Logger.log('NO existe la hoja "' + CONFIG.HOJA_CREATIVO + '"'); return; }

  var ultimaFila = hoja.getLastRow();
  Logger.log('Hoja: ' + hoja.getName() + ' | ultimaFila: ' + ultimaFila);

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 4).getValues();
  for (var i = 0; i < datos.length; i++) {
    var fila = i + 2;
    var actividad = datos[i][0];
    var diasActual = datos[i][1];
    var cRaw = datos[i][2];
    var dRaw = datos[i][3];
    var inicio = convertirAFecha(cRaw);
    var fin = convertirAFecha(dRaw);
    var diasEstaVacio = (diasActual === '' || diasActual === null || diasActual === undefined);

    Logger.log(
      'Fila ' + fila +
      ' | A="' + actividad + '"' +
      ' | B(dias)="' + diasActual + '" (vacio=' + diasEstaVacio + ')' +
      ' | C tipo=' + (typeof cRaw) + ' val="' + cRaw + '" -> ' + (inicio ? inicio : 'NULL') +
      ' | D tipo=' + (typeof dRaw) + ' val="' + dRaw + '" -> ' + (fin ? fin : 'NULL') +
      ' | COMPLETA=' + (actividad && diasEstaVacio && inicio && fin)
    );
  }
}

// NORMALIZAR FECHAS EN FERIADOS (texto dd/MM/yyyy → Date) - Columna C
// ============================================
// Convierte cualquier texto dd/MM/yyyy de la columna C en fecha real (Date)
// y aplica el formato dd/MM/yyyy. Así obtenerFeriados() siempre los reconoce.

function normalizarFechasFeriados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_FERIADOS);
  
  if (!hoja) return;
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;
  
  // Columna C (Fecha) desde la fila 2
  var rango = hoja.getRange(2, 3, ultimaFila - 1, 1);
  var valores = rango.getValues();
  var cambios = false;
  
  for (var i = 0; i < valores.length; i++) {
    var valor = valores[i][0];
    
    if (typeof valor === 'string' && valor.trim() !== '') {
      var fecha = convertirAFecha(valor);
      if (fecha) {
        valores[i][0] = fecha;
        cambios = true;
      }
    }
  }
  
  if (cambios) {
    rango.setValues(valores);
  }
  
  // Formato dd/MM/yyyy en toda la columna de datos (idempotente)
  rango.setNumberFormat('dd/MM/yyyy');
}

// ============================================
// VALIDACIÓN DE DATOS EN FERIADOS - Columna C (solo si falta)
// ============================================
// Aplica una regla "requiere fecha válida" a la columna C, que rechaza
// cualquier cosa que no sea una fecha. Se aplica una sola vez (chequea si
// ya está) para no recargar cada edición.

function aplicarValidacionFeriadosSiFalta() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_FERIADOS);
  
  if (!hoja) return;
  
  // Si C2 ya tiene validación, asumimos que la columna ya está configurada.
  var celdaTest = hoja.getRange(2, 3);
  if (celdaTest.getDataValidation() !== null) return;
  
  var regla = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Ingresá la fecha en formato Día/Mes/Año (dd/mm/aaaa). Solo se aceptan fechas válidas.')
    .build();
  
  var filas = hoja.getMaxRows() - 1;
  if (filas < 1) return;
  
  hoja.getRange(2, 3, filas, 1).setDataValidation(regla);
}

// ============================================
// INSTALAR TRIGGER AUTOMÁTICO
// ============================================

function instalarTriggerAutomatico() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onChange') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger('onChange')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();
  
  SpreadsheetApp.getUi().alert('Trigger automático instalado. El formato se aplicará automáticamente cuando haya cambios en Entrada Producción.');
}

// ============================================
// COPIAR GANTT A SPREADSHEET DEL CLIENTE
// ============================================

function copiarGanttACliente() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var hojaInstrucciones = ss.getSheetByName(CONFIG.HOJA_INSTRUCCIONES);
  if (!hojaInstrucciones) {
    SpreadsheetApp.getUi().alert('Error: No se encontró la hoja "Instrucciones"');
    return;
  }
  
  var urlCliente = hojaInstrucciones.getRange('C4').getValue();
  if (!urlCliente || urlCliente.toString().trim() === '') {
    SpreadsheetApp.getUi().alert('Error: No hay URL del cliente en la celda C4 de "Instrucciones"');
    return;
  }
  
  var idCliente = extraerIdDeUrl(urlCliente.toString());
  if (!idCliente) {
    SpreadsheetApp.getUi().alert('Error: La URL no es válida. Debe ser una URL de Google Sheets.');
    return;
  }
  
  var hojaGanttOrigen = ss.getSheetByName(CONFIG.HOJA_GANTT);
  if (!hojaGanttOrigen) {
    SpreadsheetApp.getUi().alert('Error: No se encontró la hoja "Gantt" en este documento. Generá el Gantt primero.');
    return;
  }
  
  try {
    var ssDestino = SpreadsheetApp.openById(idCliente);
    
    var hojaGanttDestino = ssDestino.getSheetByName('Gantt');
    if (!hojaGanttDestino) {
      hojaGanttDestino = ssDestino.insertSheet('Gantt');
    }
    
    // Limpiar contenido y formatos de la hoja destino
    hojaGanttDestino.clear();
    hojaGanttDestino.clearFormats();
    
    // Copiar datos y formatos desde la hoja origen
    var ultimaFila = hojaGanttOrigen.getLastRow();
    var ultimaCol = hojaGanttOrigen.getLastColumn();
    
    if (ultimaFila > 0 && ultimaCol > 0) {
      var datos = hojaGanttOrigen.getRange(1, 1, ultimaFila, ultimaCol).getValues();
      var fondos = hojaGanttOrigen.getRange(1, 1, ultimaFila, ultimaCol).getBackgrounds();
      var coloresTexto = hojaGanttOrigen.getRange(1, 1, ultimaFila, ultimaCol).getFontColors();
      var pesos = hojaGanttOrigen.getRange(1, 1, ultimaFila, ultimaCol).getFontWeights();
      
      // Ajustar tamaño de la hoja destino
      if (hojaGanttDestino.getMaxRows() < ultimaFila) {
        hojaGanttDestino.insertRows(1, ultimaFila - hojaGanttDestino.getMaxRows());
      }
      if (hojaGanttDestino.getMaxColumns() < ultimaCol) {
        hojaGanttDestino.insertColumns(1, ultimaCol - hojaGanttDestino.getMaxColumns());
      }
      
      hojaGanttDestino.getRange(1, 1, ultimaFila, ultimaCol).setValues(datos);
      hojaGanttDestino.getRange(1, 1, ultimaFila, ultimaCol).setBackgrounds(fondos);
      hojaGanttDestino.getRange(1, 1, ultimaFila, ultimaCol).setFontColors(coloresTexto);
      hojaGanttDestino.getRange(1, 1, ultimaFila, ultimaCol).setFontWeights(pesos);
      
      // Copiar anchos de columna
      for (var c = 1; c <= ultimaCol; c++) {
        hojaGanttDestino.setColumnWidth(c, hojaGanttOrigen.getColumnWidth(c));
      }
      
      // Copiar filas/columnas congeladas
      hojaGanttDestino.setFrozenRows(hojaGanttOrigen.getFrozenRows());
      hojaGanttDestino.setFrozenColumns(hojaGanttOrigen.getFrozenColumns());
    }
    
    SpreadsheetApp.getUi().alert('✅ Gantt copiado exitosamente al spreadsheet del cliente.');
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error al copiar: ' + error.message + '\n\nVerificá que tenés acceso de edición al spreadsheet del cliente.');
  }
}

// ============================================
// EXTRAER ID DE URL DE GOOGLE SHEETS
// ============================================

function extraerIdDeUrl(url) {
  var match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

// ============================================
// DETECTAR SI UNA FILA ES HEADER DE SUBGRUPO
// ============================================

function esFilaHeaderSubgrupo(valor, dias) {
  if (!valor) return false;
  if (valor.toString().trim() === '') return false;
  
  // Si no se pasó el parámetro dias, no podemos determinar → retornar false
  // (la función necesita ambos parámetros para decidir correctamente)
  if (dias === undefined) return false;
  
  // Un agrupador es una fila con texto en col A pero columna B (Días) VACÍA.
  // Si B tiene cualquier valor (incluso 0), es una tarea, no agrupador.
  if (dias !== null && dias.toString().trim() !== '') {
    return false;
  }
  
  // Columna B vacía → es agrupador
  return true;
}

// ============================================
// OBTENER LÍMITES DE SUBGRUPOS EN ENTRADA PROCESO CREATIVO
// Busca filas header de subgrupo (col A = 'PROCESO CREATIVO' o 'PRODUCTION PLANNING').
// Devuelve un array de objetos { nombre, filaInicio, filaFin }
// donde filaInicio y filaFin son las filas de ACTIVIDADES (no el header en sí).
// Los nombres de header quedan EXCLUIDOS del rango de actividades.
// ============================================

function obtenerLimitesSubgrupos(hoja) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 2).getValues(); // Columnas A y B desde fila 2

  // Encontrar las filas donde están los agrupadores (texto en A, B vacía)
  var headerFilas = []; // { nombre, fila }
  for (var i = 0; i < datos.length; i++) {
    var val = datos[i][0];
    var dias = datos[i][1];
    if (esFilaHeaderSubgrupo(val, dias)) {
      headerFilas.push({ nombre: val.toString().trim(), fila: i + 2 }); // +2 porque empieza en fila 2
    }
  }

  if (headerFilas.length === 0) return [];

  // Construir rangos: filaInicio = headerFila + 1 (la fila del header queda excluida)
  // filaFin = siguiente headerFila - 1 (o ultimaFila)
  var subgrupos = [];
  for (var j = 0; j < headerFilas.length; j++) {
    var filaInicio = headerFilas[j].fila + 1;
    var filaFin = (j + 1 < headerFilas.length) ? headerFilas[j + 1].fila - 1 : ultimaFila;

    // Solo incluir si hay filas de actividad dentro del rango
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
// CASCADA INVERSA POR SUBGRUPOS
// Corre la cascada inversa de forma independiente sobre cada subgrupo
// (PROCESO CREATIVO y PRODUCTION PLANNING), tomando la fecha fin de la
// última actividad de cada subgrupo como ancla.
// Lógica idéntica a cascadaInversa() pero acotada a cada subgrupo.
// ============================================

function cascadaInversaSubgrupos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var feriados = obtenerFeriados();

  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_CREATIVO + '"');
    return;
  }

  var subgrupos = obtenerLimitesSubgrupos(hoja);

  if (subgrupos.length === 0) {
    SpreadsheetApp.getUi().alert('No se encontraron subgrupos en la tabla.\nDeben existir filas agrupador (ej: PROCESO CREATIVO, PRODUCTION PLANNING, DESARROLLO CREATIVO, etc.).');
    return;
  }

  verificarHeadersCreativo(hoja);

  var subgruposProcesados = 0;
  var advertencias = [];

  for (var s = 0; s < subgrupos.length; s++) {
    var sg = subgrupos[s];

    // Buscar la última fila con actividad dentro del subgrupo
    var ultimaFilaConActividad = -1;
    for (var f = sg.filaFin; f >= sg.filaInicio; f--) {
      var act = hoja.getRange(f, 1).getValue();
      if (act && act.toString().trim() !== '') {
        ultimaFilaConActividad = f;
        break;
      }
    }

    if (ultimaFilaConActividad === -1) continue;

    // Verificar que la última actividad tiene Fecha Fin
    var fechaFinUltima = hoja.getRange(ultimaFilaConActividad, 4).getValue();
    if (!fechaFinUltima || !(fechaFinUltima instanceof Date)) {
      advertencias.push('Subgrupo "' + sg.nombre + '": no tiene Fecha Fin en la última actividad (fila ' + ultimaFilaConActividad + '). Se omitió.');
      continue;
    }

    // Correr cascada inversa solo dentro de este subgrupo
    var fechaFinActual = fechaFinUltima;

    for (var fila = ultimaFilaConActividad; fila >= sg.filaInicio; fila--) {
      var actividad = hoja.getRange(fila, 1).getValue();
      var dias = hoja.getRange(fila, 2).getValue();

      if (!actividad || actividad.toString().trim() === '') continue;

      dias = parseInt(dias);
      if (isNaN(dias) || dias < 1) dias = 1;

      var fechaFin = fechaFinActual;
      var fechaInicio = restarDiasHabiles(fechaFin, dias - 1, feriados);

      hoja.getRange(fila, 3).setValue(fechaInicio);
      hoja.getRange(fila, 4).setValue(fechaFin);

      fechaFinActual = diaHabilAnterior(fechaInicio, feriados);
    }

    subgruposProcesados++;
  }

  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);

  var msg = 'Cascada inversa por subgrupos completada (' + subgruposProcesados + ' subgrupo(s) procesado(s)).';
  if (advertencias.length > 0) msg += '\n\n⚠️ ' + advertencias.join('\n');
  msg += '\n\nRecordá seleccionar \'Generar Gantt en este documento\' para actualizarlo.';

  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '✅ Listo', 10);
}

// ============================================
// CASCADA NORMAL POR SUBGRUPOS
// Corre la cascada normal de forma independiente sobre cada subgrupo
// (PROCESO CREATIVO y PRODUCTION PLANNING), tomando la fecha inicio de la
// primera actividad de cada subgrupo como ancla.
// Lógica idéntica a cascadaNormal() pero acotada a cada subgrupo.
// ============================================

function cascadaNormalSubgrupos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var feriados = obtenerFeriados();

  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_CREATIVO + '"');
    return;
  }

  var subgrupos = obtenerLimitesSubgrupos(hoja);

  if (subgrupos.length === 0) {
    SpreadsheetApp.getUi().alert('No se encontraron subgrupos en la tabla.\nDeben existir filas agrupador (ej: PROCESO CREATIVO, PRODUCTION PLANNING, DESARROLLO CREATIVO, etc.).');
    return;
  }

  verificarHeadersCreativo(hoja);

  var subgruposProcesados = 0;
  var advertencias = [];

  for (var s = 0; s < subgrupos.length; s++) {
    var sg = subgrupos[s];

    // Buscar la primera fila con actividad dentro del subgrupo
    var primeraFilaConActividad = -1;
    for (var f = sg.filaInicio; f <= sg.filaFin; f++) {
      var act = hoja.getRange(f, 1).getValue();
      if (act && act.toString().trim() !== '') {
        primeraFilaConActividad = f;
        break;
      }
    }

    if (primeraFilaConActividad === -1) continue;

    // Verificar que la primera actividad tiene Fecha Inicio
    var fechaInicioPrimera = hoja.getRange(primeraFilaConActividad, 3).getValue();
    if (!fechaInicioPrimera || !(fechaInicioPrimera instanceof Date)) {
      advertencias.push('Subgrupo "' + sg.nombre + '": no tiene Fecha Inicio en la primera actividad (fila ' + primeraFilaConActividad + '). Se omitió.');
      continue;
    }

    // Ajustar al próximo día hábil si cae en finde/feriado
    var fechaInicioActual = fechaInicioPrimera;
    if (!esDiaHabil(fechaInicioActual, feriados)) {
      fechaInicioActual = siguienteDiaHabil(fechaInicioActual, feriados);
      hoja.getRange(primeraFilaConActividad, 3).setValue(fechaInicioActual);
    }

    // Correr cascada normal solo dentro de este subgrupo
    for (var fila = primeraFilaConActividad; fila <= sg.filaFin; fila++) {
      var actividad = hoja.getRange(fila, 1).getValue();
      var dias = hoja.getRange(fila, 2).getValue();

      if (!actividad || actividad.toString().trim() === '') continue;

      dias = parseInt(dias);
      if (isNaN(dias) || dias < 1) dias = 1;

      var fechaInicio = fechaInicioActual;
      var fechaFin = sumarDiasHabiles(fechaInicio, dias - 1, feriados);

      hoja.getRange(fila, 3).setValue(fechaInicio);
      hoja.getRange(fila, 4).setValue(fechaFin);

      fechaInicioActual = siguienteDiaHabil(fechaFin, feriados);
    }

    subgruposProcesados++;
  }

  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);

  var msg = 'Cascada normal por subgrupos completada (' + subgruposProcesados + ' subgrupo(s) procesado(s)).';
  if (advertencias.length > 0) msg += '\n\n⚠️ ' + advertencias.join('\n');
  msg += '\n\nRecordá seleccionar \'Generar Gantt en este documento\' para actualizarlo.';

  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '✅ Listo', 10);
}

// ============================================
// CASCADA INVERSA — SOLO ETAPA ACTUAL (según posición del cursor)
// Desde el cursor hacia arriba, se detiene al encontrar un agrupador o fila vacía.
// ============================================

function cascadaInversaEtapaActual(nombreHoja) {
  mostrarAyudaDayOffSiPrimeraVez();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaNombre = nombreHoja || CONFIG.HOJA_CREATIVO;
  var hoja = ss.getSheetByName(hojaNombre);
  var feriados = obtenerFeriados();

  if (!hoja) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + hojaNombre + '"');
    return;
  }

  var filaActiva = ss.getActiveCell().getRow();
  if (filaActiva < 2) return;
  
  // Leer todas las filas de la tabla
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues(); // A, B, C, D, E
  
  // Determinar los límites del grupo desde el cursor:
  // Hacia arriba: buscar el primer agrupador o fila vacía
  // Hacia abajo: buscar el próximo agrupador o fila vacía
  var filaInicioGrupo = filaActiva;
  var filaFinGrupo = filaActiva;
  
  // Buscar límite superior (hacia arriba)
  for (var i = filaActiva - 2; i >= 0; i--) { // i es index en datos (fila real = i+2)
    var val = datos[i][0];
    var dias = datos[i][1];
    if (!val || val.toString().trim() === '' || esFilaHeaderSubgrupo(val, dias)) {
      filaInicioGrupo = i + 3; // la fila siguiente al agrupador/vacía
      break;
    }
    if (i === 0) filaInicioGrupo = 2; // llegamos al principio
  }
  
  // Buscar límite inferior (hacia abajo)
  for (var j = filaActiva - 1; j < datos.length; j++) { // j es index en datos
    var val2 = datos[j][0];
    var dias2 = datos[j][1];
    if (!val2 || val2.toString().trim() === '' || esFilaHeaderSubgrupo(val2, dias2)) {
      filaFinGrupo = j + 1; // la fila anterior al agrupador/vacía
      break;
    }
    if (j === datos.length - 1) filaFinGrupo = j + 2; // llegamos al final
  }
  
  // Encontrar el nombre del grupo (buscar el agrupador arriba del grupo)
  var nombreGrupo = 'Grupo actual';
  for (var k = filaInicioGrupo - 3; k >= 0; k--) {
    var valK = datos[k][0];
    var diasK = datos[k][1];
    if (valK && esFilaHeaderSubgrupo(valK, diasK)) {
      nombreGrupo = valK.toString().trim();
      break;
    }
  }

  verificarHeadersCreativo(hoja);

  // Construir subgrupo virtual para reusar la función existente
  var sgActual = { nombre: nombreGrupo, filaInicio: filaInicioGrupo, filaFin: filaFinGrupo };
  
  // Confirmación del usuario
  var respuesta = SpreadsheetApp.getUi().alert(
    '⬆️ Cascada inversa',
    '¿Ejecutar cascada inversa en "' + nombreGrupo + '"?',
    SpreadsheetApp.getUi().ButtonSet.YES_NO);
  if (respuesta !== SpreadsheetApp.getUi().Button.YES) return;

  // Detectar si hay tareas con "SI" en col E
  var tareasConSI = detectarSIenSubgrupo(hoja, sgActual, feriados);
  if (tareasConSI.length > 0) {
    ejecutarCascadaInversaEnSubgrupo(hoja, sgActual, feriados);
    tareasConSI = detectarSIenSubgrupo(hoja, sgActual, feriados);
    mostrarModalExcepcionesCascada(tareasConSI, 'inversa', sgActual.nombre);
    return;
  }

  ejecutarCascadaInversaEnSubgrupo(hoja, sgActual, feriados);
  formatearFechasCreativo(hojaNombre);
  marcarSuperposicionEntrada(hoja);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Cascada inversa completada en "' + nombreGrupo + '".', '✅ Listo', 8);

  registrarLog('Cascada inversa', 'Etapa "' + nombreGrupo + '" (' + hojaNombre + ')');
}

// ============================================
// CASCADA NORMAL — SOLO ETAPA ACTUAL (según posición del cursor)
// Empieza desde la fila del cursor hacia abajo. Para cuando no hay más días.
// ============================================

function cascadaNormalEtapaActual(nombreHoja) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaNombre = nombreHoja || CONFIG.HOJA_CREATIVO;
  var hoja = ss.getSheetByName(hojaNombre);
  if (!hoja) return;
  
  var feriados = obtenerFeriados();
  var filaActiva = ss.getActiveCell().getRow();
  if (filaActiva < 2) return;
  
  var ultimaFila = hoja.getLastRow();
  
  // Leer Fecha Inicio de la fila del cursor como ancla
  var fechaAncla = hoja.getRange(filaActiva, 3).getValue();
  if (!(fechaAncla instanceof Date)) {
    SpreadsheetApp.getUi().alert('No hay Fecha Inicio en la fila del cursor (fila ' + filaActiva + ').');
    return;
  }
  
  var fechaInicioActual = fechaAncla;
  if (!esDiaHabil(fechaInicioActual, feriados)) {
    fechaInicioActual = siguienteDiaHabil(fechaInicioActual, feriados);
  }
  
  // Cascadear desde la fila del cursor hacia abajo
  for (var fila = filaActiva; fila <= ultimaFila; fila++) {
    var actividad = hoja.getRange(fila, 1).getValue();
    var dias = hoja.getRange(fila, 2).getValue();
    
    // Si no hay actividad o no hay días → parar
    if (!actividad || actividad.toString().trim() === '') break;
    dias = parseInt(dias);
    if (isNaN(dias)) break;
    
    // Días = 0: tarea solapada, comparte el último día (Fecha Fin) de la anterior
    if (dias === 0) {
      var finAnterior = hoja.getRange(fila - 1, 4).getValue();
      if (finAnterior instanceof Date) {
        hoja.getRange(fila, 3).setValue(finAnterior);
        hoja.getRange(fila, 4).setValue(finAnterior);
      }
      continue;
    }
    
    if (dias < 1) dias = 1;
    var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
    
    var fechaInicio = fechaInicioActual;
    var fechaFin = sumarDiasHabilesConExc(fechaInicio, dias - 1, feriados, excFila);
    
    hoja.getRange(fila, 3).setValue(fechaInicio);
    hoja.getRange(fila, 4).setValue(fechaFin);
    
    fechaInicioActual = siguienteDiaHabil(fechaFin, feriados);
  }
  
  formatearFechasCreativo(hojaNombre);
  SpreadsheetApp.getActiveSpreadsheet().toast('Cascada normal completada.', '✅ Listo', 5);

  registrarLog('Cascada normal', 'Desde fila ' + filaActiva + ' (' + hojaNombre + ')');
}

// ============================================
// LEER GANTT → ACTUALIZAR FECHAS
// Recorre la tab Gantt, detecta barras por color, y actualiza C/D/B en Entrada Proceso Creativo.
// ============================================

function leerGanttActualizarFechas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaCreativo = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var feriados = obtenerFeriados();
  
  if (!hojaCreativo) {
    SpreadsheetApp.getUi().alert('No se encontró la hoja "' + CONFIG.HOJA_CREATIVO + '"');
    return;
  }
  
  var ultimaFila = hojaCreativo.getLastRow();
  var ultimaCol = hojaCreativo.getLastColumn();
  var colInicio = CONFIG.COL_TIMELINE_INICIO; // Columna H es donde empieza el timeline
  
  if (ultimaFila < 2 || ultimaCol < colInicio) {
    SpreadsheetApp.getUi().alert('No hay timeline generado en Entrada Proceso Creativo.');
    return;
  }
  
  // Construir array de fechas desde fechaMin
  var datosCreativo = hojaCreativo.getRange(2, 1, ultimaFila - 1, 4).getValues();
  var fechaMin = null;
  for (var i = 0; i < datosCreativo.length; i++) {
    var ini = datosCreativo[i][2];
    if (ini instanceof Date && (fechaMin === null || ini < fechaMin)) fechaMin = ini;
  }
  
  if (!fechaMin) {
    SpreadsheetApp.getUi().alert('No hay fechas en Entrada Proceso Creativo.');
    return;
  }
  
  var numColsTimeline = ultimaCol - colInicio + 1;
  var fechasTimeline = [];
  var f = new Date(fechaMin.getTime());
  for (var c = 0; c < numColsTimeline; c++) {
    fechasTimeline.push(new Date(f.getTime()));
    f.setDate(f.getDate() + 1);
  }
  
  // Leer valores del timeline (buscar "x" o "⚙️")
  var valores = hojaCreativo.getRange(2, colInicio, ultimaFila - 1, numColsTimeline).getValues();
  var nombres = hojaCreativo.getRange(2, 1, ultimaFila - 1, 1).getValues();
  
  var actualizadas = 0;
  
  for (var fila = 0; fila < valores.length; fila++) {
    var nombre = nombres[fila][0];
    if (!nombre || nombre.toString().trim() === '') continue;
    if (esFilaHeaderSubgrupo(nombre)) continue;
    
    var primeraCol = -1;
    var ultimaColEncontrada = -1;
    
    for (var col = 0; col < valores[fila].length; col++) {
      var val = valores[fila][col] ? valores[fila][col].toString().toLowerCase().trim() : '';
      if (val === 'x' || val === '⚙️' || val === '⚙') {
        if (primeraCol === -1) primeraCol = col;
        ultimaColEncontrada = col;
      }
    }
    
    if (primeraCol !== -1 && ultimaColEncontrada !== -1 && primeraCol < fechasTimeline.length && ultimaColEncontrada < fechasTimeline.length) {
      var filaHoja = fila + 2;
      var nuevaInicio = fechasTimeline[primeraCol];
      var nuevaFin = fechasTimeline[ultimaColEncontrada];
      var dias = calcularDiasHabiles(nuevaInicio, nuevaFin, feriados);
      
      hojaCreativo.getRange(filaHoja, 3).setValue(nuevaInicio);
      hojaCreativo.getRange(filaHoja, 4).setValue(nuevaFin);
      hojaCreativo.getRange(filaHoja, 2).setValue(dias);
      actualizadas++;
    }
  }
  
  formatearFechasCreativo();
  SpreadsheetApp.getUi().alert('Fechas actualizadas desde el timeline: ' + actualizadas + ' tarea(s).');
}

// ============================================
// FUNCIONES AUXILIARES PARA CASCADA CON MODAL DE EXCEPCIONES
// ============================================

// Detecta filas con "SI"/"YES"/"TRUE" en col E dentro de un subgrupo.
// Devuelve array de { nombre, fila, diasNoHabiles: [{fecha, label}] }
function detectarSIenSubgrupo(hoja, sg, feriados) {
  var resultado = [];
  for (var fila = sg.filaInicio; fila <= sg.filaFin; fila++) {
    var actividad = hoja.getRange(fila, 1).getValue();
    if (!actividad || actividad.toString().trim() === '') continue;
    
    var colE = hoja.getRange(fila, 5).getValue();
    if (!colE) continue;
    var valE = colE.toString().toUpperCase().trim();
    if (valE !== 'SI' && valE !== 'SÍ' && valE !== 'YES' && valE !== 'TRUE') continue;
    
    // Leer fechas de la tarea para saber el rango
    var inicio = hoja.getRange(fila, 3).getValue();
    var fin = hoja.getRange(fila, 4).getValue();
    if (!inicio || !fin || !(inicio instanceof Date) || !(fin instanceof Date)) continue;
    
    // Listar fines de semana y feriados dentro del rango
    var diasNoHabiles = [];
    var fecha = new Date(inicio.getTime());
    var diasSemNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    while (fecha <= fin) {
      if (!esDiaHabil(fecha, feriados)) {
        var tipo = esFeriado(fecha, feriados) ? 'feriado' : 'finde';
        var fechaStr = ('0' + fecha.getDate()).slice(-2) + '/' + ('0' + (fecha.getMonth() + 1)).slice(-2) + '/' + fecha.getFullYear();
        diasNoHabiles.push({
          fechaStr: fechaStr,
          label: diasSemNombres[fecha.getDay()] + ' ' + fechaStr + (tipo === 'feriado' ? ' (Feriado)' : '')
        });
      }
      fecha.setDate(fecha.getDate() + 1);
    }
    
    if (diasNoHabiles.length > 0) {
      resultado.push({ nombre: actividad.toString(), fila: fila, diasNoHabiles: diasNoHabiles });
    }
  }
  return resultado;
}

// Ejecuta cascada inversa en un subgrupo (usa excepciones de col E si las hay)
function ejecutarCascadaInversaEnSubgrupo(hoja, sg, feriados) {
  var ultimaFilaConActividad = -1;
  for (var f = sg.filaFin; f >= sg.filaInicio; f--) {
    var act = hoja.getRange(f, 1).getValue();
    if (act && act.toString().trim() !== '') { ultimaFilaConActividad = f; break; }
  }
  if (ultimaFilaConActividad === -1) return;
  
  var fechaFinUltima = hoja.getRange(ultimaFilaConActividad, 4).getValue();
  if (!fechaFinUltima || !(fechaFinUltima instanceof Date)) return;
  
  var fechaFinActual = fechaFinUltima;
  for (var fila = ultimaFilaConActividad; fila >= sg.filaInicio; fila--) {
    var actividad = hoja.getRange(fila, 1).getValue();
    var dias = hoja.getRange(fila, 2).getValue();
    if (!actividad || actividad.toString().trim() === '') continue;
    if (esFilaHeaderSubgrupo(actividad, dias)) continue;
    dias = parseInt(dias);
    if (isNaN(dias) || dias < 1) dias = 1;
    
    // Días = 0: tarea solapada, comparte Fecha Fin con la tarea siguiente (abajo)
    if (dias === 0) {
      var finSiguiente = hoja.getRange(fila + 1, 4).getValue();
      if (finSiguiente instanceof Date) {
        hoja.getRange(fila, 3).setValue(finSiguiente);
        hoja.getRange(fila, 4).setValue(finSiguiente);
      }
      // No modifica fechaFinActual — la cadena sigue como si esta tarea no existiera
      continue;
    }
    
    var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
    var fechaFin = fechaFinActual;
    var fechaInicio = restarDiasHabilesConExc(fechaFin, dias - 1, feriados, excFila);
    hoja.getRange(fila, 3).setValue(fechaInicio);
    hoja.getRange(fila, 4).setValue(fechaFin);
    fechaFinActual = diaHabilAnteriorConExc(fechaInicio, feriados, excFila);
  }
}

// Ejecuta cascada normal en un subgrupo (usa excepciones de col E si las hay)
function ejecutarCascadaNormalEnSubgrupo(hoja, sg, feriados) {
  var primeraFila = -1;
  for (var f = sg.filaInicio; f <= sg.filaFin; f++) {
    var act = hoja.getRange(f, 1).getValue();
    if (act && act.toString().trim() !== '') { primeraFila = f; break; }
  }
  if (primeraFila === -1) return;
  
  var fechaInicioPrimera = hoja.getRange(primeraFila, 3).getValue();
  if (!fechaInicioPrimera || !(fechaInicioPrimera instanceof Date)) return;
  
  var fechaInicioActual = fechaInicioPrimera;
  if (!esDiaHabil(fechaInicioActual, feriados)) {
    fechaInicioActual = siguienteDiaHabil(fechaInicioActual, feriados);
    hoja.getRange(primeraFila, 3).setValue(fechaInicioActual);
  }
  
  for (var fila = primeraFila; fila <= sg.filaFin; fila++) {
    var actividad = hoja.getRange(fila, 1).getValue();
    var dias = hoja.getRange(fila, 2).getValue();
    if (!actividad || actividad.toString().trim() === '') continue;
    if (esFilaHeaderSubgrupo(actividad, dias)) continue;
    dias = parseInt(dias);
    if (isNaN(dias) || dias < 1) dias = 1;
    
    // Días = 0: tarea solapada, comparte Fecha Inicio con la tarea anterior
    if (dias === 0) {
      // fechaInicioActual ya apunta al día siguiente de la anterior.
      // Queremos que empiece donde empezó la anterior.
      var fechaAnteriorInicio = hoja.getRange(fila - 1, 3).getValue();
      if (fechaAnteriorInicio instanceof Date) {
        hoja.getRange(fila, 3).setValue(fechaAnteriorInicio);
        hoja.getRange(fila, 4).setValue(fechaAnteriorInicio);
      } else {
        hoja.getRange(fila, 3).setValue(fechaInicioActual);
        hoja.getRange(fila, 4).setValue(fechaInicioActual);
      }
      // No modifica fechaInicioActual — la cadena sigue como si esta tarea no existiera
      continue;
    }
    
    var excFila = parsearExcepcionesColE(hoja.getRange(fila, 5).getValue());
    var fechaInicio = fechaInicioActual;
    var fechaFin = sumarDiasHabilesConExc(fechaInicio, dias - 1, feriados, excFila);
    hoja.getRange(fila, 3).setValue(fechaInicio);
    hoja.getRange(fila, 4).setValue(fechaFin);
    fechaInicioActual = siguienteDiaHabilConExc(fechaFin, feriados, excFila);
  }
}

// Modal para elegir excepciones durante la cascada
function mostrarModalExcepcionesCascada(tareasConSI, tipoCascada, nombreEtapa) {
  var html = '<html><head><style>';
  html += 'body { font-family: Arial, sans-serif; font-size: 13px; padding: 15px; }';
  html += 'h3 { margin: 15px 0 8px 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }';
  html += 'label { display: block; padding: 3px 0; cursor: pointer; }';
  html += 'label:hover { background: #f0f0f0; }';
  html += 'input[type=checkbox] { margin-right: 8px; }';
  html += '.btn { padding: 10px 20px; margin: 15px 5px 0 0; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }';
  html += '.btn-ok { background: #4CAF50; color: white; }';
  html += '.btn-cancel { background: #f44336; color: white; }';
  html += '</style></head><body>';
  html += '<h2>¿Se trabaja en Día Off? — Seleccionar días laborables</h2>';
  html += '<p>Elegí qué fines de semana o feriados se trabajan:</p>';
  
  for (var t = 0; t < tareasConSI.length; t++) {
    var tarea = tareasConSI[t];
    html += '<h3>' + tarea.nombre + ' (fila ' + tarea.fila + ')</h3>';
    for (var d = 0; d < tarea.diasNoHabiles.length; d++) {
      var dia = tarea.diasNoHabiles[d];
      var id = 'exc_' + t + '_' + d;
      html += '<label><input type="checkbox" id="' + id + '" data-fila="' + tarea.fila + '" data-fecha="' + dia.fechaStr + '"> ' + dia.label + '</label>';
    }
  }
  
  html += '<div style="margin-top:20px; border-top:1px solid #ddd; padding-top:15px;">';
  html += '<button class="btn btn-ok" onclick="confirmar()">Confirmar y re-cascadear</button>';
  html += '<button class="btn btn-cancel" onclick="google.script.host.close()">Cancelar</button>';
  html += '</div>';
  
  html += '<script>';
  html += 'function confirmar() {';
  html += '  var checks = document.querySelectorAll("input[type=checkbox]:checked");';
  html += '  var excepciones = {};';
  html += '  for (var i = 0; i < checks.length; i++) {';
  html += '    var fila = checks[i].getAttribute("data-fila");';
  html += '    var fecha = checks[i].getAttribute("data-fecha");';
  html += '    if (!excepciones[fila]) excepciones[fila] = [];';
  html += '    excepciones[fila].push(fecha);';
  html += '  }';
  html += '  google.script.run.withSuccessHandler(function() { google.script.host.close(); }).reejecutarCascadaConExcepciones(JSON.stringify(excepciones), "' + tipoCascada + '");';
  html += '}';
  html += '</script></body></html>';
  
  var output = HtmlService.createHtmlOutput(html).setWidth(450).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(output, '¿Se trabaja en Día Off? — ' + nombreEtapa);
}

// Callback del modal: guarda fechas en col E y re-ejecuta la cascada
function reejecutarCascadaConExcepciones(excepcionesJSON, tipoCascada) {
  var excepciones = JSON.parse(excepcionesJSON);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  var feriados = obtenerFeriados();
  
  // Guardar fechas en col E (reemplazar "SI" por las fechas)
  for (var fila in excepciones) {
    if (!excepciones.hasOwnProperty(fila)) continue;
    var fechas = excepciones[fila];
    hoja.getRange(parseInt(fila), 5).setNumberFormat('@');
    hoja.getRange(parseInt(fila), 5).setValue(fechas.join(', '));
  }
  
  // Detectar el subgrupo de la primera fila para re-cascadear
  var subgrupos = obtenerLimitesSubgrupos(hoja);
  var primeraFila = parseInt(Object.keys(excepciones)[0]);
  var sgActual = null;
  for (var s = 0; s < subgrupos.length; s++) {
    if (primeraFila >= subgrupos[s].filaInicio && primeraFila <= subgrupos[s].filaFin) {
      sgActual = subgrupos[s];
      break;
    }
  }
  
  if (!sgActual) return;
  
  // Re-ejecutar cascada con las excepciones ahora guardadas
  if (tipoCascada === 'inversa') {
    ejecutarCascadaInversaEnSubgrupo(hoja, sgActual, feriados);
  } else {
    ejecutarCascadaNormalEnSubgrupo(hoja, sgActual, feriados);
  }
  
  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Cascada re-ejecutada con excepciones Day Off.', '✅ Listo', 8);
}

// ============================================
// MENÚ
// ============================================

function crearMenu() {
  SpreadsheetApp.getUi()
    .createMenu('🤖 Agente')
    .addItem('⬆️ Cascada inversa — poner Fecha Fin en última tarea de la etapa', 'cascadaInversaEtapaActual')
    .addItem('⬇️ Cascada normal — poner Fecha Inicio en primera tarea de la etapa', 'cascadaNormalEtapaActual')
    .addItem('↕️ Cascada desde ubicación del cursor. Ubicado en Fecha Inicio cascadea arriba, ubicado en Fecha Fin cascadea abajo.', 'cascadaDesdeCursorSubgrupo')
    .addSeparator()
    .addItem('📊 Generar Gantt en este documento', 'generarGantt')
    .addItem('� Leer Gantt → Actualizar fechas', 'leerGanttActualizarFechas')
    .addItem('�📤 Copiar Gantt a Cliente', 'copiarGanttACliente')
    .addSeparator()
    .addItem('⚙️ Instalar trigger automático', 'instalarTriggerAutomatico')
    .addSeparator()
    .addItem('🤖 Asistente AI', 'abrirAsistenteAI')
    .addToUi();
}

function onOpen() {
  crearMenu();
  instalarTriggerSiNoExiste();
}

// ============================================
// INSTALAR TRIGGER SI NO EXISTE (silencioso)
// ============================================

function instalarTriggerSiNoExiste() {
  var triggers = ScriptApp.getProjectTriggers();
  var existeTrigger = false;
  
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onChange') {
      existeTrigger = true;
      break;
    }
  }
  
  if (!existeTrigger) {
    ScriptApp.newTrigger('onChange')
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onChange()
      .create();
  }
}

// ============================================
// GEMINI BOT — Asistente AI para el Gantt
// Integrado en la library para funcionar en copias dependientes.
// ============================================

var SYSTEM_PROMPT_ES = 'Sos un asistente que ejecuta acciones en un Gantt de Google Sheets. Respondé siempre en español, EXCEPTO si el usuario te escribe en portugués — en ese caso respondé en portugués. Sé directo y ejecutá sin preguntar de más.\n\n' +
  'TABLA: La hoja "Gantt GUT" tiene columnas: A=Actividad, B=Días, C=Fecha Inicio, D=Fecha Fin\n\n' +
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
  '7. solaparTareas — Solapar una tarea con la siguiente (requiere confirmación)\n' +
  '   El usuario quiere que una tarea se superponga X días con la tarea siguiente.\n' +
  '   PASO 1: Primero respondé en TEXTO explicando qué vas a hacer y pedí confirmación. Ejemplo:\n' +
  '   "Voy a solapar CREATIVIDAD 3 días con FEEDBACK CLIENTE ROUND #1. La tarea siguiente va a empezar 3 días hábiles antes de que termine CREATIVIDAD, y las tareas posteriores se recalculan manteniendo la secuencia. ¿Confirmo?"\n' +
  '   PASO 2: Cuando el usuario confirme (sí, dale, ok, confirmá), devolvé el JSON:\n' +
  '   {"accion":"solaparTareas","parametros":{"tarea":"CREATIVIDAD","diasSolapamiento":3},"mensaje":"Solapando 3 días..."}\n' +
  '   - "solapar", "superponer", "en paralelo X días" = solaparTareas.\n' +
  '   - Si dice "alargar X y solapar Y días con la siguiente", primero cambiá los días (cambiarDiasTarea) y después solapá.\n\n' +
  '8. agregarDayOff — Marcar que una tarea trabaja un fin de semana o feriado\n' +
  '   Esto escribe las fechas en la columna E (Day Off) de esa tarea.\n' +
  '   Ejemplo: "SHOOTING trabaja el sábado 26 de julio"\n' +
  '   Respuesta: {"accion":"agregarDayOff","parametros":{"tarea":"SHOOTING","fechas":["26/07/2026"]},"mensaje":"Marcando 26/07/2026 como día laboral para SHOOTING..."}\n\n' +
  '   Ejemplo: "CREATIVIDAD trabaja el finde del 26 y 27 de julio"\n' +
  '   Respuesta: {"accion":"agregarDayOff","parametros":{"tarea":"CREATIVIDAD","fechas":["26/07/2026","27/07/2026"]},"mensaje":"Marcando sábado y domingo como laborables para CREATIVIDAD..."}\n\n' +
  '   Ejemplo: "En BRIEF se trabaja el feriado del 9 de julio"\n' +
  '   Respuesta: {"accion":"agregarDayOff","parametros":{"tarea":"BRIEF","fechas":["09/07/2026"]},"mensaje":"Marcando feriado 09/07 como laboral para BRIEF..."}\n\n' +
  'REGLAS IMPORTANTES:\n' +
  '- Si el usuario pide una ACCIÓN (mover, cascada, generar, etc.), respondé con el JSON directo. No expliques el proceso.\n' +
  '- Si el usuario hace una PREGUNTA (cómo funciona? qué es? explicame?), respondé en texto normal con la explicación.\n' +
  '- EXCEPCIÓN: para solaparTareas, primero explicá qué vas a hacer y pedí confirmación. Recién cuando confirme, devolvé el JSON.\n' +
  '- NUNCA digas "mi función es generar JSON" ni "no puedo explicar". Si te preguntan algo, explicá.\n' +
  '- Si dice "correr X al lunes" o "mover X a tal fecha", usá moverTareaAFecha.\n' +
  '- Si dice "correr X 3 días" (sin fecha específica), usá moverTarea.\n' +
  '- "Correr" = "mover". "Cascadear" = cascada.\n' +
  '- "Solapar X días", "superponer X días", "en paralelo X días con la siguiente" = solaparTareas.\n' +
  '- Las fechas se interpretan como dd/mm/aaaa. Si dice "06 de julio" y estamos en 2026, es 06/07/2026.\n' +
  '- Si dice "sábado y domingo" de una semana específica, calculá las fechas exactas.\n' +
  '- "Se trabaja", "sea laborable", "es laboral", "trabaja el finde" = agregarDayOff.\n' +
  '- Si el usuario da la fecha y la tarea en mensajes separados, combiná la info del historial.\n' +
  '- Si solo dice un nombre de tarea sin más contexto, preguntá qué quiere hacer con ella.\n' +
  '- No pidas confirmación en las demás acciones. Ejecutá directo.\n\n' +
  'SI EL USUARIO PREGUNTA CÓMO FUNCIONAN LAS CASCADAS, explicale esto:\n' +
  '- CASCADA INVERSA: Ponés la Fecha Fin en la última tarea de la etapa, y calcula todas las fechas hacia arriba. Cada tarea se ubica secuencialmente (una termina → la anterior termina el día hábil anterior). Útil cuando tenés una fecha de entrega/aire fija.\n' +
  '- CASCADA NORMAL: Ponés la Fecha Inicio en la primera tarea de la etapa, y calcula hacia abajo. Útil cuando sabés cuándo arrancás y querés ver cuándo termina.\n' +
  '- Ambas respetan feriados, fines de semana, y los Day Off de columna E.\n' +
  '- Operan por etapa independientemente (CREATIVA y PRODUCCIÓN se cascadean por separado).\n' +
  '- Para usarlas desde acá, decime la etapa y la fecha. Ejemplo: "Cascada inversa en etapa producción desde fecha fin 01 de noviembre".\n' +
  '- CASCADA DESDE CURSOR: Desde el menú del sheet, se ubica el cursor en una celda de Fecha Inicio (col C) o Fecha Fin (col D) de una tarea. Si está en col C, cascadea hacia arriba. Si está en col D, cascadea hacia abajo. Respeta la fila del cursor como ancla fija.\n';

var SYSTEM_PROMPT_PT = 'Você é um assistente que executa ações em um Gantt no Google Sheets. Responda sempre em português. Se o usuário escrever em espanhol, responda em espanhol. Seja direto e execute sem perguntar demais.\n\n' +
  'TABELA: A aba "Gantt GUT" tem colunas: A=Atividade, B=Dias, C=Data Início, D=Data Fim\n\n' +
  'AÇÕES QUE VOCÊ PODE EXECUTAR (responda SEMPRE com JSON quando o usuário pede uma ação):\n\n' +
  '1. moverTareaAFecha — Mover uma tarefa para uma data específica\n' +
  '   Exemplo: "Mova BRIEFING para segunda 06 de julho"\n' +
  '   Resposta: {"accion":"moverTareaAFecha","parametros":{"tarea":"BRIEFING","fechaInicio":"06/07/2026"},"mensaje":"Movendo BRIEFING para 06/07/2026..."}\n\n' +
  '2. moverTarea — Mover uma tarefa X dias para frente ou para trás\n' +
  '   Exemplo: "Mova SHOOTING 3 dias para frente"\n' +
  '   Resposta: {"accion":"moverTarea","parametros":{"tarea":"SHOOTING","dias":3,"direccion":"adelante"},"mensaje":"Movendo SHOOTING 3 dias..."}\n\n' +
  '3. cambiarDiasTarea — Mudar a duração de uma tarefa\n' +
  '   Exemplo: "CRIATIVIDADE deve durar 5 dias"\n' +
  '   Resposta: {"accion":"cambiarDiasTarea","parametros":{"tarea":"CRIATIVIDADE","dias":5},"mensaje":"Alterando para 5 dias..."}\n\n' +
  '4. generarGantt — Gerar o Gantt visual\n' +
  '   Exemplo: "Gere o Gantt" / "Crie o Gantt"\n' +
  '   Resposta: {"accion":"generarGantt","parametros":{},"mensaje":"Gerando Gantt..."}\n\n' +
  '5. cascadaInversaEtapaActual — Executar cascata inversa\n' +
  '   Exemplo: "Cascata inversa na etapa produção desde data fim 01 de novembro"\n' +
  '   Resposta: {"accion":"cascadaInversaEtapaActual","parametros":{"etapa":"PRODUCCION","fechaFin":"01/11/2026"},"mensaje":"Executando cascata inversa..."}\n' +
  '   Se não diz etapa nem data: {"accion":"cascadaInversaEtapaActual","parametros":{},"mensaje":"Executando cascata inversa..."}\n\n' +
  '6. cascadaNormalEtapaActual — Executar cascata normal\n' +
  '   Exemplo: "Cascata normal na etapa criativa desde 15 de julho"\n' +
  '   Resposta: {"accion":"cascadaNormalEtapaActual","parametros":{"etapa":"CREATIVA","fechaInicio":"15/07/2026"},"mensaje":"Executando cascata normal..."}\n' +
  '   Se não diz etapa nem data: {"accion":"cascadaNormalEtapaActual","parametros":{},"mensaje":"Executando cascata normal..."}\n\n' +
  'REGRAS IMPORTANTES:\n' +
  '- Se o usuário pede uma AÇÃO (mover, cascata, gerar, etc.), responda com o JSON direto. Não explique o processo.\n' +
  '- Se o usuário faz uma PERGUNTA (como funciona? o que é? me explica?), responda em texto normal com a explicação.\n' +
  '- NUNCA diga "minha função é gerar JSON" nem "não posso explicar". Se te perguntam algo, explique.\n' +
  '- Se diz "mover X para segunda" ou "mover X para tal data", use moverTareaAFecha.\n' +
  '- Se diz "mover X 3 dias" (sem data específica), use moverTarea.\n' +
  '- "Mover" = mover. "Cascatear" = cascata.\n' +
  '- "Sobrepor", "superpor", "em paralelo" = mover a tarefa para começar na mesma data que a outra. Use moverTareaAFecha com a Data Início da tarefa de referência (leia do estado atual do sheet).\n' +
  '- As datas são interpretadas como dd/mm/aaaa. Se diz "06 de julho" e estamos em 2026, é 06/07/2026.\n' +
  '- Se diz "sábado e domingo" de uma semana específica, calcule as datas exatas.\n' +
  '- "Trabalha", "é dia útil", "trabalha no finde" = agregarDayOff.\n' +
  '- Se o usuário dá a data e a tarefa em mensagens separadas, combine a info do histórico.\n' +
  '- Se só diz um nome de tarefa sem mais contexto, pergunte o que quer fazer com ela.\n' +
  '- Não peça confirmação nem faça perguntas desnecessárias. Execute direto.\n\n' +
  '7. agregarDayOff — Marcar que uma tarefa trabalha em um fim de semana ou feriado\n' +
  '   Isso escreve as datas na coluna E (Day Off) dessa tarefa.\n' +
  '   Exemplo: "SHOOTING trabalha no sábado 26 de julho"\n' +
  '   Resposta: {"accion":"agregarDayOff","parametros":{"tarea":"SHOOTING","fechas":["26/07/2026"]},"mensaje":"Marcando 26/07/2026 como dia útil para SHOOTING..."}\n\n' +
  '   Exemplo: "CRIATIVIDADE trabalha no finde 26 e 27 de julho"\n' +
  '   Resposta: {"accion":"agregarDayOff","parametros":{"tarea":"CRIATIVIDADE","fechas":["26/07/2026","27/07/2026"]},"mensaje":"Marcando sábado e domingo como úteis para CRIATIVIDADE..."}\n\n' +
  '   Exemplo: "Em BRIEFING se trabalha no feriado de 9 de julho"\n' +
  '   Resposta: {"accion":"agregarDayOff","parametros":{"tarea":"BRIEFING","fechas":["09/07/2026"]},"mensaje":"Marcando feriado 09/07 como útil para BRIEFING..."}\n\n' +
  'SE O USUÁRIO PERGUNTAR COMO FUNCIONAM AS CASCATAS, explique isto:\n' +
  '- CASCATA INVERSA: Você coloca a Data Fim na última tarefa da etapa, e calcula todas as datas para cima. Cada tarefa se posiciona sequencialmente (uma termina → a anterior termina no dia útil anterior). Útil quando você tem uma data de entrega/air fixa.\n' +
  '- CASCATA NORMAL: Você coloca a Data Início na primeira tarefa da etapa, e calcula para baixo. Útil quando sabe quando começa e quer ver quando termina.\n' +
  '- Ambas respeitam feriados, fins de semana, e os Day Off da coluna E.\n' +
  '- Operam por etapa independentemente (CRIATIVA e PRODUÇÃO se cascateiam separadamente).\n' +
  '- Para usá-las daqui, me diga a etapa e a data. Exemplo: "Cascata inversa na etapa produção desde data fim 01 de novembro".\n' +
  '- CASCATA DESDE O CURSOR: No menu do sheet, posicione o cursor em uma célula de Data Início (col C) ou Data Fim (col D) de uma tarefa. Se está na col C, cascateia para cima. Se está na col D, cascateia para baixo. Respeita a linha do cursor como âncora fixa.\n';

function obtenerSystemPrompt() {
  var idioma = obtenerIdiomaSeleccionado();
  return (idioma === 'portugues') ? SYSTEM_PROMPT_PT : SYSTEM_PROMPT_ES;
}

// ============================================
// HTML DEL SIDEBAR (embebido para funcionar desde la library)
// ============================================

function obtenerBotHTML() {
  var idioma = obtenerIdiomaSeleccionado();
  var esPT = (idioma === 'portugues');
  var titulo = esPT ? '🤖 Assistente Gantt' : '🤖 Asistente Gantt';
  var nombre = obtenerNombreUsuarioBot();
  var saludo = nombre ? (esPT ? 'Olá ' + nombre + '!' : 'Hola ' + nombre + '!') : (esPT ? 'Olá!' : 'Hola!');
  var greeting = esPT
    ? saludo + ' Sou seu assistente de Gantt. Posso te ajudar com: 📅 Cascatas: "Cascata inversa na etapa produção desde data fim 01 de novembro" | ➡️ Mover tarefas: "Mova BRIEFING para segunda 06 de julho" | 📏 Duração: "CRIATIVIDADE deve durar 5 dias" | ⚙️ Dia laborável: "SHOOTING trabalha no sábado 26 de julho" | 📊 Gantt: "Gere o Gantt"'
    : saludo + ' Soy tu asistente de Gantt. Puedo ayudarte con: 📅 Cascadas: "Cascada inversa en etapa producción desde fecha fin 01 de noviembre" | ➡️ Mover tareas: "Mové BRIEF al lunes 06 de julio" | 📏 Duración: "Que CREATIVIDAD dure 5 días" | ⚙️ Día laborable: "SHOOTING trabaja el sábado 26 de julio" | 📊 Gantt: "Generá el Gantt"';
  var placeholder = esPT ? 'Escreva sua instrução...' : 'Escribí tu instrucción...';
  var thinking = esPT ? 'Pensando...' : 'Pensando...';

  return '<!DOCTYPE html>' +
    '<html><head><base target="_top"><style>' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }' +
    'body { font-family: "Segoe UI", Arial, sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f5f5f5; }' +
    '.header { background: #1a1a2e; color: #FFD700; padding: 12px; text-align: center; font-weight: bold; font-size: 14px; }' +
    '.chat-container { flex: 1; overflow-y: auto; padding: 10px; }' +
    '.msg { margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; font-size: 13px; max-width: 90%; line-height: 1.4; }' +
    '.msg-user { background: #DCF8C6; margin-left: auto; text-align: right; }' +
    '.msg-bot { background: #fff; border: 1px solid #e0e0e0; }' +
    '.msg-action { background: #E3F2FD; border: 1px solid #90CAF9; font-style: italic; }' +
    '.msg-error { background: #FFEBEE; border: 1px solid #EF9A9A; color: #C62828; }' +
    '.input-area { display: flex; padding: 10px; background: #fff; border-top: 1px solid #ddd; }' +
    '.input-area input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; font-size: 13px; outline: none; }' +
    '.input-area input:focus { border-color: #FFD700; }' +
    '.input-area button { margin-left: 8px; padding: 10px 15px; background: #FFD700; border: none; border-radius: 20px; cursor: pointer; font-weight: bold; }' +
    '.input-area button:hover { background: #e6c200; }' +
    '.input-area button:disabled { background: #ccc; cursor: not-allowed; }' +
    '.typing { color: #888; font-size: 12px; padding: 5px 10px; }' +
    '</style></head><body>' +
    '<div class="header">' + titulo + '</div>' +
    '<div class="chat-container" id="chat">' +
    '<div class="msg msg-bot">' + greeting + '</div>' +
    '</div>' +
    '<div class="input-area">' +
    '<input type="text" id="inputMsg" placeholder="' + placeholder + '" onkeypress="if(event.key===\'Enter\') enviar()">' +
    '<button id="btnEnviar" onclick="enviar()">➤</button>' +
    '</div>' +
    '<script>' +
    'var historial = [];' +
    'var msgCounter = 0;' +
    'var txtThinking = "' + thinking + '";' +
    'function enviar() {' +
    '  var input = document.getElementById("inputMsg");' +
    '  var msg = input.value.trim();' +
    '  if (!msg) return;' +
    '  agregarMensaje(msg, "user");' +
    '  input.value = "";' +
    '  document.getElementById("btnEnviar").disabled = true;' +
    '  historial.push("USUARIO: " + msg);' +
    '  var typingId = agregarMensaje(txtThinking, "typing");' +
    '  var historialStr = historial.join("\\n");' +
    '  google.script.run' +
    '    .withSuccessHandler(function(respuesta) {' +
    '      removerMensaje(typingId);' +
    '      document.getElementById("btnEnviar").disabled = false;' +
    '      if (respuesta.tipo === "accion") {' +
    '        agregarMensaje(respuesta.contenido, "action");' +
    '        historial.push("BOT: " + respuesta.contenido);' +
    '        if (respuesta.resultado) {' +
    '          agregarMensaje(respuesta.resultado, "bot");' +
    '          historial.push("RESULTADO: " + respuesta.resultado);' +
    '        }' +
    '      } else if (respuesta.tipo === "error") {' +
    '        agregarMensaje(respuesta.contenido, "error");' +
    '      } else {' +
    '        agregarMensaje(respuesta.contenido, "bot");' +
    '        historial.push("BOT: " + respuesta.contenido);' +
    '      }' +
    '    })' +
    '    .withFailureHandler(function(err) {' +
    '      removerMensaje(typingId);' +
    '      document.getElementById("btnEnviar").disabled = false;' +
    '      agregarMensaje("Error: " + err.message, "error");' +
    '    })' +
    '    .procesarMensajeBot(historialStr);' +
    '}' +
    'function agregarMensaje(texto, tipo) {' +
    '  var chat = document.getElementById("chat");' +
    '  var div = document.createElement("div");' +
    '  var id = "msg-" + (++msgCounter);' +
    '  div.id = id;' +
    '  div.className = "msg";' +
    '  if (tipo === "user") div.className += " msg-user";' +
    '  else if (tipo === "action") div.className += " msg-action";' +
    '  else if (tipo === "error") div.className += " msg-error";' +
    '  else if (tipo === "typing") { div.className = "typing"; }' +
    '  else div.className += " msg-bot";' +
    '  div.textContent = texto;' +
    '  chat.appendChild(div);' +
    '  chat.scrollTop = chat.scrollHeight;' +
    '  return id;' +
    '}' +
    'function removerMensaje(id) {' +
    '  var el = document.getElementById(id);' +
    '  if (el) el.remove();' +
    '}' +
    '</script></body></html>';
}

// ============================================
// ABRIR SIDEBAR DEL BOT
// ============================================

function abrirAsistenteAI() {
  var idioma = obtenerIdiomaSeleccionado();
  var titulo = (idioma === 'portugues') ? '🤖 Assistente Gantt' : '🤖 Asistente Gantt';
  var html = HtmlService.createHtmlOutput(obtenerBotHTML())
    .setWidth(500)
    .setHeight(800);
  SpreadsheetApp.getUi().showModelessDialog(html, titulo);
}

// ============================================
// ONBOARDING — AVATAR D-ID
// El avatar corre en una página propia (GitHub Pages) porque el widget
// de D-ID no carga dentro del iframe sandbox de Google (CORS).
// Acá solo abrimos esa URL en una pestaña nueva desde un modal chico.
// ============================================

var ONBOARDING_URL = 'https://gutagency.github.io/gantt-onboarding/';

function abrirOnboarding() {
  var idioma = obtenerIdiomaSeleccionado();
  var titulo = (idioma === 'portugues') ? '👋 Bem-vindo' : '👋 Bienvenida';
  var html = HtmlService.createHtmlOutput(obtenerOnboardingHTML())
    .setWidth(360)
    .setHeight(200);
  SpreadsheetApp.getUi().showModelessDialog(html, titulo);
}

function obtenerOnboardingHTML() {
  var idioma = obtenerIdiomaSeleccionado();
  var esPt = (idioma === 'portugues');
  var texto = esPt
    ? 'Clique no botão para abrir o assistente de boas-vindas em uma nova aba.'
    : 'Hacé clic en el botón para abrir el asistente de bienvenida en una pestaña nueva.';
  var boton = esPt ? 'Abrir assistente' : 'Abrir asistente';
  var cerrar = esPt ? 'Fechar' : 'Cerrar';
  // Patrón robusto para Apps Script: el link abre con target=_blank y NO
  // cerramos el host en el mismo click (eso mataba la pestaña antes de abrir).
  // El cierre queda en un botón aparte.
  return '<!DOCTYPE html><html><head><base target="_top"><style>' +
    '*{box-sizing:border-box;margin:0;padding:0;}' +
    'body{font-family:"Segoe UI",Arial,sans-serif;background:#1a1a2e;color:#fff;' +
    'height:100vh;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;text-align:center;padding:20px;gap:14px;}' +
    'p{font-size:13px;line-height:1.4;color:#ddd;}' +
    'a.btn{background:#FFD700;color:#1a1a2e;text-decoration:none;font-weight:bold;' +
    'padding:10px 18px;border-radius:20px;font-size:14px;display:inline-block;}' +
    'a.btn:hover{background:#e6c200;}' +
    'button.close{background:transparent;color:#aaa;border:1px solid #555;' +
    'padding:6px 14px;border-radius:16px;font-size:12px;cursor:pointer;}' +
    'button.close:hover{color:#fff;border-color:#888;}' +
    '</style></head><body>' +
    '<p>' + texto + '</p>' +
    '<a class="btn" href="' + ONBOARDING_URL + '" target="_blank" rel="noopener">' + boton + '</a>' +
    '<button class="close" onclick="google.script.host.close()">' + cerrar + '</button>' +
    '</body></html>';
}

// ============================================
// ESTADO VS PLAN — días a solapar para llegar al AIR DATE
// La campaña tiene una duración ideal fija por marca (días hábiles).
// El AIR DATE es el ancla fija. Se calcula la ventana real (del inicio
// de la primera tarea hasta el AIR DATE) y se compara contra el ideal.
//   días a solapar = ventana real − ideal
//   > 0 → hay que solapar esa cantidad para entrar en el ideal
//   <= 0 → hay margen, entra holgado
// ============================================

// ============================================
// REGISTRO DE LOGS — hoja "Logs" en el spreadsheet
// Registra eventos importantes (cascadas, generar Gantt, desvíos) y
// cambios de fecha manuales. Nunca interrumpe la acción si algo falla.
// Columnas: Fecha/Hora | Usuario | Evento | Detalle
// ============================================

function obtenerHojaLogs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_LOGS);
  if (!hoja) {
    hoja = ss.insertSheet(CONFIG.HOJA_LOGS);
    hoja.getRange(1, 1, 1, 4).setValues([['Fecha/Hora', 'Usuario', 'Evento', 'Detalle']]);
    hoja.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#FFD700');
    hoja.setColumnWidth(1, 150);
    hoja.setColumnWidth(2, 200);
    hoja.setColumnWidth(3, 180);
    hoja.setColumnWidth(4, 380);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function obtenerUsuarioActual() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'desconocido';
  } catch (e) {
    return 'desconocido';
  }
}

// Formatea un valor de fecha (Date o texto) a dd/MM/yyyy para el log.
function formatearFechaLog(valor) {
  if (valor instanceof Date) {
    return ('0' + valor.getDate()).slice(-2) + '/' + ('0' + (valor.getMonth() + 1)).slice(-2) + '/' + valor.getFullYear();
  }
  if (valor === '' || valor === null || valor === undefined) return '(vacío)';
  return valor.toString();
}

// Registra un cambio manual de fecha (columna C o D) en la hoja Logs,
// con formato "viejo → nuevo" cuando el valor anterior está disponible.
function registrarCambioFecha(hoja, fila, colIni, colFin, e) {
  try {
    var actividad = hoja.getRange(fila, 1).getValue();
    if (!actividad) return;

    // e.oldValue solo viene en ediciones de UNA sola celda.
    var edicionUnaCelda = e && (colIni === colFin) && (fila === e.range.getRow()) &&
      (e.range.getNumRows() === 1) && (e.range.getNumColumns() === 1);

    // Determinar qué columna(s) de fecha se tocaron (C=3 Inicio, D=4 Fin)
    var cols = [];
    if (colIni <= 3 && colFin >= 3) cols.push({ col: 3, etq: 'Fecha Inicio' });
    if (colIni <= 4 && colFin >= 4) cols.push({ col: 4, etq: 'Fecha Fin' });

    for (var c = 0; c < cols.length; c++) {
      var col = cols[c].col;
      var etq = cols[c].etq;
      var nuevo = formatearFechaLog(hoja.getRange(fila, col).getValue());
      var detalle;
      if (edicionUnaCelda && col === colIni && e.oldValue !== undefined) {
        detalle = actividad + ' — ' + etq + ': ' + formatearFechaLog(e.oldValue) + ' → ' + nuevo;
      } else {
        detalle = actividad + ' — ' + etq + ': ' + nuevo;
      }
      registrarLog('Cambio de fecha', detalle);
    }
  } catch (err) {
    // Nunca interrumpir la edición por un fallo de logging.
  }
}

// Registra un evento en la hoja Logs. Envuelto en try/catch: si falla,
// no interrumpe la acción que lo disparó.
function registrarLog(evento, detalle) {
  try {
    var hoja = obtenerHojaLogs();
    var ahora = new Date();
    var fechaHora = ('0' + ahora.getDate()).slice(-2) + '/' +
      ('0' + (ahora.getMonth() + 1)).slice(-2) + '/' + ahora.getFullYear() + ' ' +
      ('0' + ahora.getHours()).slice(-2) + ':' + ('0' + ahora.getMinutes()).slice(-2) + ':' +
      ('0' + ahora.getSeconds()).slice(-2);
    // Escribir la fila forzando formato TEXTO en las 4 columnas. Así un
    // detalle que empiece con +, =, - o @ no se interpreta como fórmula
    // (era la causa del #ERROR! en la celda de detalle).
    var filaDestino = hoja.getLastRow() + 1;
    var rango = hoja.getRange(filaDestino, 1, 1, 4);
    rango.setNumberFormat('@');
    rango.setValues([[fechaHora, obtenerUsuarioActual(), evento, detalle || '']]);
  } catch (e) {
    // Nunca romper la acción por un fallo de logging.
  }
}

// ============================================
// RESUMEN NARRATIVO EN GOOGLE DOC (vía Gemini)
// Lee la hoja Logs, le pide a Gemini un resumen descriptivo y lo escribe
// en un Google Doc fijo por proyecto (se reutiliza y actualiza).
// ============================================

// Lee las filas de la hoja Logs y las devuelve como texto plano para Gemini.
function obtenerTextoLogs() {
  var hoja = obtenerHojaLogs();
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return '';

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 4).getValues();
  var lineas = [];
  for (var i = 0; i < datos.length; i++) {
    var fh = datos[i][0];
    var usuario = datos[i][1];
    var evento = datos[i][2];
    var detalle = datos[i][3];
    if (!evento) continue;
    lineas.push(fh + ' | ' + usuario + ' | ' + evento + (detalle ? ' | ' + detalle : ''));
  }
  return lineas.join('\n');
}

// Genera (o actualiza) el Google Doc con el resumen narrativo del proyecto.
// silencioso=true → no muestra alerts ni modal (para uso automático tras cascada).
function generarResumenEnDoc(silencioso) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var idioma = obtenerIdiomaSeleccionado();
  var esPt = (idioma === 'portugues');

  var textoLogs = obtenerTextoLogs();
  if (!textoLogs) {
    if (!silencioso) {
      SpreadsheetApp.getUi().alert(esPt
        ? 'Ainda não há eventos registrados na aba Logs.'
        : 'Todavía no hay eventos registrados en la pestaña Logs.');
    }
    return;
  }

  // Pedir a Gemini un resumen narrativo
  var token = ScriptApp.getOAuthToken();
  var systemPrompt = esPt
    ? 'Você é um assistente que resume a atividade de um cronograma (Gantt) de uma campanha. ' +
      'Vou te passar uma lista de eventos (data | usuário | evento | detalhe). ' +
      'Escreva um resumo narrativo, claro e profissional, em parágrafos (NÃO em tabela nem em lista). ' +
      'Destaque as cascatas executadas, mudanças de datas, e principalmente os desvios em relação ao timeline ideal. ' +
      'Seja conciso. Responda só com o texto do resumo.'
    : 'Sos un asistente que resume la actividad de un cronograma (Gantt) de una campaña. ' +
      'Te voy a pasar una lista de eventos (fecha | usuario | evento | detalle). ' +
      'Escribí un resumen narrativo, claro y profesional, en párrafos (NO en tabla ni en lista). ' +
      'Destacá las cascadas ejecutadas, los cambios de fechas, y sobre todo los desvíos respecto al timeline ideal. ' +
      'Sé conciso. Respondé solo con el texto del resumen.';

  var resumen = llamarGeminiVertexAI(token, systemPrompt, textoLogs);
  if (!resumen || resumen.charAt(0) === '❌') {
    if (!silencioso) {
      SpreadsheetApp.getUi().alert(esPt
        ? 'Não foi possível gerar o resumo: ' + (resumen || 'sem resposta')
        : 'No se pudo generar el resumen: ' + (resumen || 'sin respuesta'));
    }
    return;
  }

  // Obtener o crear el Doc fijo del proyecto (ID guardado en propiedades del documento)
  var props = PropertiesService.getDocumentProperties();
  var docId = props.getProperty('RESUMEN_DOC_ID');
  var doc;
  if (docId) {
    try {
      doc = DocumentApp.openById(docId);
    } catch (e) {
      doc = null; // el doc fue borrado o no accesible → crear uno nuevo
    }
  }
  if (!doc) {
    doc = DocumentApp.create(ss.getName());
    props.setProperty('RESUMEN_DOC_ID', doc.getId());
  }

  // Reescribir el contenido del Doc
  var body = doc.getBody();
  body.clear();

  var ahora = new Date();
  var fechaGen = ('0' + ahora.getDate()).slice(-2) + '/' + ('0' + (ahora.getMonth() + 1)).slice(-2) +
    '/' + ahora.getFullYear() + ' ' + ('0' + ahora.getHours()).slice(-2) + ':' + ('0' + ahora.getMinutes()).slice(-2);

  var tituloDoc = (esPt ? 'Resumo do Gantt — ' : 'Resumen del Gantt — ') + ss.getName();
  body.appendParagraph(tituloDoc).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph((esPt ? 'Gerado em: ' : 'Generado el: ') + fechaGen)
    .setForegroundColor('#888888');
  body.appendParagraph('');

  // El resumen puede venir con saltos de línea → un párrafo por bloque
  var bloques = resumen.split('\n');
  for (var b = 0; b < bloques.length; b++) {
    if (bloques[b].trim() !== '') {
      body.appendParagraph(bloques[b]);
    }
  }

  doc.saveAndClose();

  var url = 'https://docs.google.com/document/d/' + doc.getId() + '/edit';

  // Link fijo y clickeable en la celda E1 de la tab Logs, para acceso rápido.
  var hojaLogs = obtenerHojaLogs();
  var etiquetaLink = esPt ? 'Ver resumo (Doc)' : 'Ver resumen (Doc)';
  hojaLogs.getRange('E1').setFormula('=HYPERLINK("' + url + '";"' + etiquetaLink + '")');
  hojaLogs.getRange('E1').setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#FFD700');
  hojaLogs.setColumnWidth(5, 160);

  registrarLog('Resumen generado', 'Google Doc actualizado');

  // Mostrar el link al Doc solo en modo manual
  if (!silencioso) {
    mostrarLinkResumen(url, esPt);
  }
}

function mostrarLinkResumen(url, esPt) {
  var texto = esPt ? 'Resumo gerado. Abra o documento:' : 'Resumen generado. Abrí el documento:';
  var boton = esPt ? 'Abrir documento' : 'Abrir documento';
  var cerrar = esPt ? 'Fechar' : 'Cerrar';
  var html = '<!DOCTYPE html><html><head><base target="_top"><style>' +
    '*{box-sizing:border-box;margin:0;padding:0;}' +
    'body{font-family:"Segoe UI",Arial,sans-serif;background:#fff;color:#222;' +
    'height:100vh;padding:22px;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;text-align:center;gap:16px;}' +
    'p{font-size:14px;color:#444;}' +
    'a.btn{background:#1a73e8;color:#fff;text-decoration:none;font-weight:bold;' +
    'padding:10px 18px;border-radius:20px;font-size:14px;}' +
    'button{background:transparent;color:#666;border:1px solid #ccc;padding:6px 16px;' +
    'border-radius:16px;font-size:12px;cursor:pointer;}' +
    '</style></head><body>' +
    '<p>' + texto + '</p>' +
    '<a class="btn" href="' + url + '" target="_blank" rel="noopener">' + boton + '</a>' +
    '<button onclick="google.script.host.close()">' + cerrar + '</button>' +
    '</body></html>';
  var out = HtmlService.createHtmlOutput(html).setWidth(380).setHeight(220);
  SpreadsheetApp.getUi().showModelessDialog(out, esPt ? '📄 Resumo' : '📄 Resumen');
}

var DURACION_IDEAL_POR_MARCA = {
  mercado_libre: 73,
  mercado_pago: 0,   // TODO: completar con el ideal de Mercado Pago
  estandar: 0        // TODO: completar si aplica
};

// Suma los días (columna B) del proyecto con el criterio de paralelismo:
// - Toda la etapa creativa se cuenta.
// - En la etapa de producción, se cuenta SOLO desde la tarea "PRODUCCIÓN"
//   en adelante (lo anterior corre en paralelo con la creativa y no suma).
// Los agrupadores no se cuentan (no tienen días de tarea).
// Devuelve un objeto con todos los datos del desvío, o { error: '...' }.
function calcularSolapamientoNecesario() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return { error: 'No se encontró la hoja "' + CONFIG.HOJA_CREATIVO + '".' };

  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return { error: 'La tabla de actividades está vacía.' };

  var marca = obtenerMarcaSeleccionada();
  var ideal = DURACION_IDEAL_POR_MARCA[marca] || 0;
  if (!ideal) {
    return { error: 'Todavía no hay una duración ideal definida para la marca seleccionada (' + marca + ').' };
  }

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 2).getValues(); // A (nombre), B (días)

  var totalTimeline = 0;
  var enProduccion = false;      // ya pasamos el agrupador de producción
  var contandoProduccion = false; // ya encontramos la tarea "PRODUCCIÓN"
  var hubTareas = false;

  for (var i = 0; i < datos.length; i++) {
    var actividad = datos[i][0];
    if (!actividad || actividad.toString().trim() === '') continue;

    var nombreNorm = actividad.toString().toUpperCase().trim();
    var diasCol = datos[i][1];

    // Agrupadores: detectar la etapa de producción y saltear la fila.
    // (esFilaHeaderSubgrupo necesita nombre Y días: un agrupador tiene B vacía.)
    if (esFilaHeaderSubgrupo(actividad, diasCol)) {
      if (nombreNorm.indexOf('PRODUCCION') !== -1 || nombreNorm.indexOf('PRODUCCIÓN') !== -1 ||
          nombreNorm.indexOf('PRODUCTION') !== -1) {
        enProduccion = true;
      }
      continue;
    }

    var dias = parseInt(diasCol);
    if (isNaN(dias)) dias = 0;

    if (!enProduccion) {
      // Etapa creativa (u otras previas): se cuenta todo
      totalTimeline += dias;
      hubTareas = true;
    } else {
      // Etapa producción: contar solo desde la tarea "PRODUCCIÓN" en adelante
      if (!contandoProduccion) {
        // ¿esta tarea ES "PRODUCCIÓN"? (el corte). Coincidencia exacta del nombre.
        if (nombreNorm === 'PRODUCCION' || nombreNorm === 'PRODUCCIÓN' || nombreNorm === 'PRODUCTION') {
          contandoProduccion = true;
        }
      }
      if (contandoProduccion) {
        totalTimeline += dias;
        hubTareas = true;
      }
    }
  }

  if (!hubTareas) {
    return { error: 'No hay tareas con días cargados.' };
  }

  var diasASolapar = totalTimeline - ideal;

  return {
    marca: marca,
    ideal: ideal,
    totalTimeline: totalTimeline,
    diasASolapar: diasASolapar
  };
}

function abrirEstadoVsPlan() {
  var idioma = obtenerIdiomaSeleccionado();
  var titulo = (idioma === 'portugues') ? '📊 Estado vs plano' : '📊 Estado vs plan';
  var html = HtmlService.createHtmlOutput(obtenerEstadoVsPlanHTML())
    .setWidth(480)
    .setHeight(440);
  SpreadsheetApp.getUi().showModelessDialog(html, titulo);
}

// Aviso automático del desvío (se dispara al cambiar los días de una tarea).
// Modal si hay desvío positivo; toast si está en plan o con margen.
// Si no se puede calcular (ideal sin definir, etc.), no muestra nada.
function mostrarEstadoDesvio() {
  try {
    var r = calcularSolapamientoNecesario();
    if (r.error) return;

    // Registrar el desvío detectado
    if (r.diasASolapar > 0) {
      registrarLog('Desvío detectado', '+' + r.diasASolapar + ' días vs plan ideal (timeline ' + r.totalTimeline + ' / ideal ' + r.ideal + ')');
    } else if (r.diasASolapar < 0) {
      registrarLog('Estado del plan', Math.abs(r.diasASolapar) + ' días de margen (timeline ' + r.totalTimeline + ' / ideal ' + r.ideal + ')');
    } else {
      registrarLog('Estado del plan', 'Sin desvío (timeline ' + r.totalTimeline + ' = ideal ' + r.ideal + ')');
    }

    var idioma = obtenerIdiomaSeleccionado();
    var esPt = (idioma === 'portugues');
    var uDias = esPt ? 'dias' : 'días';

    // Si hay que solapar (desvío positivo = problema), abrir el modal grande
    // para que sea imposible pasarlo por alto. Si no, un toast rápido.
    if (r.diasASolapar > 0) {
      abrirEstadoVsPlan();
      return;
    }

    var mensaje, titulo;
    if (r.diasASolapar === 0) {
      titulo = esPt ? '✅ No plano' : '✅ En el plan';
      mensaje = esPt ? 'Está exatamente no plano ideal.' : 'Estás justo en el plan ideal.';
    } else {
      titulo = esPt ? '✅ Com margem' : '✅ Con margen';
      mensaje = esPt
        ? 'Tem ' + Math.abs(r.diasASolapar) + ' ' + uDias + ' de margem.'
        : 'Tenés ' + Math.abs(r.diasASolapar) + ' ' + uDias + ' de margen.';
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(mensaje, titulo, 10);
  } catch (e) {
    // Nunca interrumpir la cascada por el aviso.
  }
}

function obtenerEstadoVsPlanHTML() {
  var idioma = obtenerIdiomaSeleccionado();
  var esPt = (idioma === 'portugues');
  var r = calcularSolapamientoNecesario();

  var css = '<style>*{box-sizing:border-box;margin:0;padding:0;}' +
    'body{font-family:"Segoe UI",Arial,sans-serif;background:#ffffff;color:#222;' +
    'height:100vh;padding:22px;display:flex;flex-direction:column;gap:14px;}' +
    'h2{color:#1a1a2e;font-size:15px;text-align:center;}' +
    '.row{display:flex;justify-content:space-between;font-size:13px;' +
    'border-bottom:1px solid #e5e5e5;padding:8px 2px;color:#555;}' +
    '.row b{color:#111;}' +
    '.big{margin-top:6px;text-align:center;padding:14px;border-radius:10px;font-size:14px;}' +
    '.big .num{font-size:30px;font-weight:bold;display:block;margin-top:4px;}' +
    '.ok{background:#E6F7ED;color:#1B7A46;}' +
    '.warn{background:#FDECEE;color:#C62838;}' +
    '.neutral{background:#EEF0FB;color:#3A45A0;}' +
    '.err{background:#FDECEE;color:#C62838;padding:16px;border-radius:10px;font-size:13px;text-align:center;}' +
    '.foot{margin-top:auto;text-align:center;}' +
    'button{background:transparent;color:#666;border:1px solid #ccc;padding:6px 16px;' +
    'border-radius:16px;font-size:12px;cursor:pointer;}button:hover{color:#111;border-color:#999;}' +
    '</style>';

  var cerrar = esPt ? 'Fechar' : 'Cerrar';
  // Auto-cierre a los 5 segundos (el usuario igual puede cerrarlo antes).
  var autoClose = '<script>setTimeout(function(){try{google.script.host.close();}catch(e){}},5000);<\/script>';
  var head = '<!DOCTYPE html><html><head><base target="_top">' + css + '</head><body>';
  var foot = '<div class="foot"><button onclick="google.script.host.close()">' + cerrar + '</button></div>' + autoClose + '</body></html>';

  if (r.error) {
    return head + '<h2>' + (esPt ? 'Estado vs plano' : 'Estado vs plan') + '</h2>' +
      '<div class="err">' + r.error + '</div>' + foot;
  }

  var labelIdeal = esPt ? 'Dias ideais (plano)' : 'Días ideales (plan)';
  var labelTimeline = esPt ? 'Dias do timeline atual' : 'Días del timeline actual';
  var uDias = esPt ? 'dias' : 'días';

  var bloque, clase, mensaje;
  if (r.diasASolapar > 0) {
    clase = 'warn';
    mensaje = esPt
      ? 'Desvio em relação ao timeline ideal:'
      : 'Desvío respecto al timeline ideal:';
    bloque = '<span class="num">+' + r.diasASolapar + '</span>' + uDias;
  } else if (r.diasASolapar === 0) {
    clase = 'neutral';
    mensaje = esPt ? 'Sem desvio: está no timeline ideal.' : 'Sin desvío: estás en el timeline ideal.';
    bloque = '<span class="num">0</span>' + uDias;
  } else {
    clase = 'ok';
    mensaje = esPt ? 'Margem em relação ao timeline ideal:' : 'Margen respecto al timeline ideal:';
    bloque = '<span class="num">' + r.diasASolapar + '</span>' + uDias;
  }

  return head +
    '<h2>' + (esPt ? 'Estado vs plano' : 'Estado vs plan') + '</h2>' +
    '<div class="row"><span>' + labelIdeal + '</span><b>' + r.ideal + ' ' + uDias + '</b></div>' +
    '<div class="row"><span>' + labelTimeline + '</span><b>' + r.totalTimeline + ' ' + uDias + '</b></div>' +
    '<div class="big ' + clase + '">' + mensaje + bloque + '</div>' +
    foot;
}

function obtenerNombreUsuarioBot() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return '';
    var parteNombre = email.split('@')[0];
    parteNombre = parteNombre.replace(/[._-]/g, ' ');
    var palabras = parteNombre.split(' ');
    for (var i = 0; i < palabras.length; i++) {
      if (palabras[i].length > 0) {
        palabras[i] = palabras[i].charAt(0).toUpperCase() + palabras[i].substring(1).toLowerCase();
      }
    }
    return palabras[0] || '';
  } catch(e) {
    return '';
  }
}

// ============================================
// PROCESAR MENSAJE DEL USUARIO
// ============================================

function procesarMensajeBot(mensajeUsuario) {
  var token = ScriptApp.getOAuthToken();
  if (!token) {
    return { tipo: 'texto', contenido: '❌ No se pudo obtener token OAuth. Verificá permisos.' };
  }
  
  // Agregar contexto actual del sheet
  var contextoActual = obtenerContextoBot();
  
  // Agregar ejemplos aprendidos al prompt
  var ejemplosAprendidos = obtenerEjemplosAprendidos();
  var promptCompleto = obtenerSystemPrompt();
  if (ejemplosAprendidos) {
    promptCompleto += '\n\nEJEMPLOS APRENDIDOS DE ESTE EQUIPO:\n' + ejemplosAprendidos;
  }
  promptCompleto += '\n\nESTADO ACTUAL DEL SHEET:\n' + contextoActual;
  
  // Llamar a Gemini via Vertex AI
  var respuestaGemini = llamarGeminiVertexAI(token, promptCompleto, mensajeUsuario);
  
  if (!respuestaGemini) {
    return { tipo: 'texto', contenido: '❌ Error al comunicar con Gemini.' };
  }
  
  // Intentar parsear como JSON (acción)
  try {
    var jsonMatch = respuestaGemini.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var accion = JSON.parse(jsonMatch[0]);
      if (accion.accion) {
        var resultado = ejecutarAccionBot(accion);
        // Guardar ejemplo exitoso para aprendizaje
        if (resultado && resultado.indexOf('Error') === -1 && resultado.indexOf('No encontré') === -1) {
          guardarEjemploExitoso(mensajeUsuario, accion);
        }
        return { tipo: 'accion', contenido: accion.mensaje || 'Ejecutado.', resultado: resultado };
      }
    }
  } catch(e) {
    // No es JSON, es texto normal
  }
  
  return { tipo: 'texto', contenido: respuestaGemini };
}

// ============================================
// APRENDIZAJE — Few-shot dinámico
// Guarda pares {pedido, acción} exitosos en Script Properties
// y los inyecta en el prompt para mejorar la interpretación.
// ============================================

function guardarEjemploExitoso(pedido, accion) {
  var props = PropertiesService.getScriptProperties();
  var historial = [];
  
  try {
    var raw = props.getProperty('BOT_EJEMPLOS');
    if (raw) historial = JSON.parse(raw);
  } catch(e) { historial = []; }
  
  // Extraer solo la última línea del pedido (el mensaje actual, no todo el historial)
  var lineas = pedido.split('\n');
  var ultimoMensaje = '';
  for (var i = lineas.length - 1; i >= 0; i--) {
    if (lineas[i].indexOf('USUARIO:') === 0) {
      ultimoMensaje = lineas[i].substring(9).trim();
      break;
    }
  }
  if (!ultimoMensaje) ultimoMensaje = lineas[lineas.length - 1] || pedido;
  
  historial.push({
    pedido: ultimoMensaje,
    accion: accion.accion,
    parametros: accion.parametros
  });
  
  // Mantener máximo 15 ejemplos (los más recientes)
  if (historial.length > 15) {
    historial = historial.slice(historial.length - 15);
  }
  
  props.setProperty('BOT_EJEMPLOS', JSON.stringify(historial));
}

function obtenerEjemplosAprendidos() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('BOT_EJEMPLOS');
  if (!raw) return '';
  
  try {
    var historial = JSON.parse(raw);
    if (historial.length === 0) return '';
    
    var lineas = [];
    for (var i = 0; i < historial.length; i++) {
      var ej = historial[i];
      lineas.push('- Usuario dijo: "' + ej.pedido + '" → Acción: ' + ej.accion + ' con ' + JSON.stringify(ej.parametros));
    }
    return lineas.join('\n');
  } catch(e) {
    return '';
  }
}

// ============================================
// OBTENER CONTEXTO ACTUAL DEL SHEET (para el bot)
// ============================================

function obtenerContextoBot() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return 'No se encontró la hoja.';
  
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return 'La tabla está vacía.';
  
  var datos = hoja.getRange(2, 1, Math.min(ultimaFila - 1, 30), 5).getValues();
  var lineas = [];
  
  for (var i = 0; i < datos.length; i++) {
    var act = datos[i][0];
    if (!act) continue;
    var dias = datos[i][1] || '';
    var ini = datos[i][2] instanceof Date ? formatFechaCortaBot(datos[i][2]) : '';
    var fin = datos[i][3] instanceof Date ? formatFechaCortaBot(datos[i][3]) : '';
    var exc = datos[i][4] || '';
    lineas.push('Fila ' + (i+2) + ': ' + act + ' | ' + dias + ' días | ' + ini + ' → ' + fin + (exc ? ' | DayOff: ' + exc : ''));
  }
  
  return lineas.join('\n');
}

function formatFechaCortaBot(fecha) {
  return ('0' + fecha.getDate()).slice(-2) + '/' + ('0' + (fecha.getMonth()+1)).slice(-2) + '/' + fecha.getFullYear();
}

// ============================================
// LLAMAR A VERTEX AI (Gemini)
// ============================================

function llamarGeminiVertexAI(token, systemPrompt, mensajeUsuario) {
  var projectId = 'gantt-consolidation';
  var location = 'us-central1';
  var model = 'gemini-2.5-flash';
  
  var url = 'https://' + location + '-aiplatform.googleapis.com/v1/projects/' + projectId + '/locations/' + location + '/publishers/google/models/' + model + ':generateContent';
  
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
      // Devolver el error en vez de null para poder diagnosticar
      return '❌ Vertex AI respondió ' + code + ': ' + body.substring(0, 200);
    }
    
    var json = JSON.parse(body);
    
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      return json.candidates[0].content.parts[0].text;
    }
    
    return null;
  } catch(e) {
    Logger.log('Vertex AI exception: ' + e.message);
    return '❌ Excepción: ' + e.message;
  }
}

// ============================================
// EJECUTAR ACCIÓN DEVUELTA POR GEMINI
// ============================================

function ejecutarAccionBot(accion) {
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
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
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
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return 'Hoja no encontrada.';
  
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues();
  
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString().toUpperCase().indexOf(nombreTarea.toUpperCase()) !== -1) {
      var fila = i + 2;
      var valorActual = datos[i][4] ? datos[i][4].toString().trim() : '';
      
      var nuevasFechas = fechas.join(', ');
      if (valorActual && valorActual !== 'TRUE' && valorActual !== 'SI' && valorActual !== 'YES') {
        nuevasFechas = valorActual + ', ' + nuevasFechas;
      }
      
      hoja.getRange(fila, 5).setNumberFormat('@');
      hoja.getRange(fila, 5).setValue(nuevasFechas);
      
      // Recalcular fechas (el trigger onEdit no se dispara con setValue programático)
      var feriados = obtenerFeriados();
      recalcularFechaFinConExcepciones(hoja, fila, feriados);
      
      return 'Day Off agregado para "' + datos[i][0] + '": ' + fechas.join(', ') + '. Fechas recalculadas automáticamente.';
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}

function moverTareaAFechaBot(nombreTarea, fechaInicioStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
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
      
      return 'Tarea "' + datos[i][0] + '" movida al ' + fechaInicioStr + '. Fecha Fin: ' + formatFechaCortaBot(nuevaFin) + ' (' + dias + ' días).';
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}

function cambiarDiasTareaBot(nombreTarea, nuevoDias) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
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
      
      return 'Tarea "' + datos[i][0] + '" cambiada a ' + nuevoDias + ' días. Nueva Fecha Fin: ' + formatFechaCortaBot(nuevaFin);
    }
  }
  
  return 'No encontré la tarea "' + nombreTarea + '".';
}

// ============================================
// CASCADAS DESDE EL BOT (no dependen del cursor)
// ============================================

function cascadaInversaEtapaBot(nombreEtapa, fechaFinStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return 'Hoja no encontrada.';
  
  var feriados = obtenerFeriados();
  var subgrupos = obtenerLimitesSubgrupos(hoja);
  
  if (subgrupos.length === 0) return 'No se encontraron etapas en la tabla.';
  
  // Buscar la etapa por nombre
  var sgActual = null;
  for (var s = 0; s < subgrupos.length; s++) {
    if (subgrupos[s].nombre.toUpperCase().indexOf(nombreEtapa.toUpperCase()) !== -1) {
      sgActual = subgrupos[s];
      break;
    }
  }
  
  if (!sgActual) {
    // Si no encuentra por nombre, usar la primera etapa
    sgActual = subgrupos[0];
  }
  
  // Escribir la fecha fin en la última tarea de la etapa
  var fechaFin = convertirAFecha(fechaFinStr);
  if (!fechaFin) return 'No pude interpretar la fecha: ' + fechaFinStr;
  
  var ultimaFilaConActividad = -1;
  for (var f = sgActual.filaFin; f >= sgActual.filaInicio; f--) {
    var act = hoja.getRange(f, 1).getValue();
    if (act && act.toString().trim() !== '') { ultimaFilaConActividad = f; break; }
  }
  if (ultimaFilaConActividad === -1) return 'No se encontraron tareas en la etapa.';
  
  hoja.getRange(ultimaFilaConActividad, 4).setValue(fechaFin);
  hoja.getRange(ultimaFilaConActividad, 4).setNumberFormat('dd/MM/yyyy');
  
  // Ejecutar cascada inversa
  ejecutarCascadaInversaEnSubgrupo(hoja, sgActual, feriados);
  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);
  
  return 'Cascada inversa ejecutada en "' + sgActual.nombre + '" con fecha fin ' + fechaFinStr + '.';
}

function cascadaNormalEtapaBot(nombreEtapa, fechaInicioStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return 'Hoja no encontrada.';
  
  var feriados = obtenerFeriados();
  var subgrupos = obtenerLimitesSubgrupos(hoja);
  
  if (subgrupos.length === 0) return 'No se encontraron etapas en la tabla.';
  
  // Buscar la etapa por nombre
  var sgActual = null;
  for (var s = 0; s < subgrupos.length; s++) {
    if (subgrupos[s].nombre.toUpperCase().indexOf(nombreEtapa.toUpperCase()) !== -1) {
      sgActual = subgrupos[s];
      break;
    }
  }
  
  if (!sgActual) {
    sgActual = subgrupos[0];
  }
  
  // Escribir la fecha inicio en la primera tarea de la etapa
  var fechaInicio = convertirAFecha(fechaInicioStr);
  if (!fechaInicio) return 'No pude interpretar la fecha: ' + fechaInicioStr;
  
  var primeraFila = -1;
  for (var f = sgActual.filaInicio; f <= sgActual.filaFin; f++) {
    var act = hoja.getRange(f, 1).getValue();
    if (act && act.toString().trim() !== '') { primeraFila = f; break; }
  }
  if (primeraFila === -1) return 'No se encontraron tareas en la etapa.';
  
  hoja.getRange(primeraFila, 3).setValue(fechaInicio);
  hoja.getRange(primeraFila, 3).setNumberFormat('dd/MM/yyyy');
  
  // Ejecutar cascada normal
  ejecutarCascadaNormalEnSubgrupo(hoja, sgActual, feriados);
  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);
  
  return 'Cascada normal ejecutada en "' + sgActual.nombre + '" con fecha inicio ' + fechaInicioStr + '.';
}

// ============================================
// SOLAPAR TAREAS DESDE EL BOT
// Alarga una tarea y solapa X días con la siguiente, manteniendo la cadena.
// ============================================

function solaparTareasBot(nombreTarea, diasSolapamiento) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.HOJA_CREATIVO);
  if (!hoja) return 'Hoja no encontrada.';
  
  var ultimaFila = hoja.getLastRow();
  var datos = hoja.getRange(2, 1, ultimaFila - 1, 5).getValues();
  var feriados = obtenerFeriados();
  
  // Buscar la tarea
  var filaTarea = -1;
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString().toUpperCase().indexOf(nombreTarea.toUpperCase()) !== -1) {
      if (!esFilaHeaderSubgrupo(datos[i][0])) {
        filaTarea = i;
        break;
      }
    }
  }
  
  if (filaTarea === -1) return 'No encontré la tarea "' + nombreTarea + '".';
  
  var finTarea = datos[filaTarea][3];
  if (!(finTarea instanceof Date)) return 'La tarea no tiene Fecha Fin válida.';
  
  // Buscar la tarea siguiente (saltando agrupadores)
  var filaSiguiente = -1;
  for (var j = filaTarea + 1; j < datos.length; j++) {
    if (datos[j][0] && datos[j][0].toString().trim() !== '' && !esFilaHeaderSubgrupo(datos[j][0])) {
      filaSiguiente = j;
      break;
    }
  }
  
  if (filaSiguiente === -1) return 'No hay tarea siguiente después de "' + nombreTarea + '".';
  
  // Calcular nueva Fecha Inicio de la tarea siguiente:
  // Empieza "diasSolapamiento" días hábiles ANTES de que termine la tarea actual
  var nuevaInicioSiguiente = restarDiasHabiles(finTarea, diasSolapamiento - 1, feriados);
  
  // Escribir la nueva Fecha Inicio de la tarea siguiente
  var filaRealSiguiente = filaSiguiente + 2;
  var diasSiguiente = parseInt(datos[filaSiguiente][1]) || 1;
  var excSiguiente = parsearExcepcionesColE(datos[filaSiguiente][4]);
  
  var nuevaFinSiguiente = sumarDiasHabilesConExc(nuevaInicioSiguiente, diasSiguiente - 1, feriados, excSiguiente);
  
  hoja.getRange(filaRealSiguiente, 3).setValue(nuevaInicioSiguiente);
  hoja.getRange(filaRealSiguiente, 4).setValue(nuevaFinSiguiente);
  hoja.getRange(filaRealSiguiente, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
  
  // Cascadear las tareas subsiguientes (mantener la cadena secuencial)
  var fechaFinActual = nuevaFinSiguiente;
  for (var k = filaSiguiente + 1; k < datos.length; k++) {
    var act = datos[k][0];
    if (!act || act.toString().trim() === '') continue;
    if (esFilaHeaderSubgrupo(act)) continue;
    
    var diasK = parseInt(datos[k][1]) || 1;
    var excK = parsearExcepcionesColE(datos[k][4]);
    var filaRealK = k + 2;
    
    var nuevaInicioK = siguienteDiaHabil(fechaFinActual, feriados);
    var nuevaFinK = sumarDiasHabilesConExc(nuevaInicioK, diasK - 1, feriados, excK);
    
    hoja.getRange(filaRealK, 3).setValue(nuevaInicioK);
    hoja.getRange(filaRealK, 4).setValue(nuevaFinK);
    hoja.getRange(filaRealK, 3, 1, 2).setNumberFormat('dd/MM/yyyy');
    
    fechaFinActual = nuevaFinK;
  }
  
  formatearFechasCreativo();
  marcarSuperposicionEntrada(hoja);
  
  return 'Tarea siguiente solapada ' + diasSolapamiento + ' días con "' + datos[filaTarea][0] + '". Cadena subsiguiente mantenida.';
}