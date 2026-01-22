/* All U Moves PF – v3.2 (sin siglas/inglés en UI)
   - Paleta + tipografía actualizadas (CSS)
   - “usuaria” en toda la interfaz/export
   - “Músculo-esquelético” en vez de MSK
   - “acompañante/testigo” en vez de chaperón
   - Módulo 8 y 9 reorganizados: checkbox → se despliega 0–10 + campo específico
   - ICIQ-UI SF interpretación automática (0–5 leve / 6–12 moderada / 13–21 grave)
   - Dispareunia: Marinoff 0–3 + explicación
   - Botones: “Añadir hipótesis y tareas” y “Vaciar sección”
   - Motor: hipótesis + tareas + próxima sesión (auto)
*/

const STORAGE_KEY = "pf_ficha_v32";
const EXTRAS_KEY  = "pf_ficha_v32_extras";

let MODE = "10"; // "10" | "full"

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function nowISODate(){
  const d = new Date();
  const tzOff = d.getTimezoneOffset()*60000;
  return new Date(d - tzOff).toISOString().slice(0,10);
}

function deepSet(obj, path, value){
  const parts = path.split(".");
  let cur = obj;
  for (let i=0;i<parts.length-1;i++){
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length-1]] = value;
}
function deepGet(obj, path){
  return path.split(".").reduce((a,p)=> (a && a[p]!==undefined ? a[p] : undefined), obj);
}

function sanitizeFilePart(s){
  return String(s || "")
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu,"_")
    .replace(/_+/g,"_")
    .slice(0,60) || "usuaria";
}
function fileBaseName(st){
  const name = sanitizeFilePart(st?.id?.nombre);
  const date = st?.id?.fecha || nowISODate();
  return `Ficha_PisoPelvico_${name}_${date}`;
}

function el(tag, attrs={}, children=[]){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  children.forEach(ch=>{
    if (typeof ch === "string") n.appendChild(document.createTextNode(ch));
    else if (ch) n.appendChild(ch);
  });
  return n;
}

function toast(msg){
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=> t.classList.add("hidden"), 2200);
}

/* =======================
   Extras (motor)
   ======================= */

const ExtrasDefault = () => ({
  settings: {
    musculoEsqOn: false,
    activeHypTab: "Músculo",
  },
  hypotheses: [],
  exercisePlan: { selectedIds: [], notes: "" },
  tasks: { usuaria: [], kine: [], compartidas: [] },
  nextSession: []
});

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function loadExtras(){
  const raw = localStorage.getItem(EXTRAS_KEY);
  if (!raw) return ExtrasDefault();
  try { return { ...ExtrasDefault(), ...JSON.parse(raw) }; }
  catch { return ExtrasDefault(); }
}
function saveExtras(extras){
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
}

/* =======================
   Utilidades de interpretación
   ======================= */

function levelFrom010(v){
  const n = Number(v || 0);
  if (n >= 7) return "Alto";
  if (n >= 4) return "Moderado";
  if (n >= 1) return "Leve";
  return "0";
}

function iciqInterpret(score){
  const s = Number(score);
  if (!Number.isFinite(s)) return "—";
  if (s <= 5) return "Leve (0–5)";
  if (s <= 12) return "Moderada (6–12)";
  return "Grave (13–21)";
}

function shouldShow(mode){
  if (MODE === "full") return true;
  return mode !== "full";
}

function requiresMusculoEsq(sec, extras){
  if (!sec.requiresMusculoEsq) return true;
  return !!extras.settings.musculoEsqOn;
}

/* =======================
   Biblioteca de ejercicios (nombres en español)
   ======================= */

const EXERCISES = [
  {
    id:"resp_coord",
    name:"Respiración diafragmática + coordinación del piso pélvico (inhala relaja / exhala activa suave)",
    goal:["relajación","coordinación"],
    stage:["general","postparto_0_2","postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","postparto_12plus","menopausia"],
    tol:"baja",
    dose:"2–3 min diarios o 5–8 respiraciones x 2–3 veces/día",
    cues:["Inhala: suelta abdomen y piso pélvico","Exhala: activa suave (sin apnea)","Relaja completamente al final"],
    errors:["Apnea/pujo","Activación fuerte que aumenta dolor/pesadez"],
    prog:"Aplicar exhalación en esfuerzos (sentarse/levantar/cargar) sin síntomas",
  },
  {
    id:"pp_short",
    name:"Piso pélvico (PFM): contracción/relajación – sostén corto + relajación completa",
    goal:["fuerza","coordinación"],
    stage:["general","postparto_0_2","postparto_2_4","postparto_4_6","menopausia"],
    tol:"baja",
    dose:"6–10 repeticiones de 3–5s + 6–10s relajación (según tolerancia)",
    cues:["Calidad > cantidad","Relaja completamente entre repeticiones","Sin apnea"],
    errors:["Compensar con glúteos/abdomen","No relajar entre repeticiones"],
    prog:"Aumentar sostén o sumar rápidas si corresponde",
  },
  {
    id:"core_suave",
    name:"Core suave postparto: basculación pélvica / caída de rodilla (según tolerancia)",
    goal:["core","pared_abdominal"],
    stage:["postparto_0_2","postparto_2_4","postparto_4_6","postparto_6_8"],
    tol:"baja",
    dose:"2–3 series de 6–10 repeticiones",
    cues:["Exhala en el esfuerzo","Evita empuje","Control suave"],
    errors:["Apnea","Aumenta dolor/pesadez"],
    prog:"Progresar a fuerza funcional leve",
  },
  {
    id:"caminar_suave",
    name:"Caminata suave (bajo impacto) según tolerancia",
    goal:["cardio_bajo_impacto"],
    stage:["postparto_0_2","postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","postparto_12plus","menopausia","general"],
    tol:"baja",
    dose:"5–20 min según tolerancia, progresión gradual",
    cues:["Sin gatillar pesadez/escape/dolor moderado-severo","Pausa si hay síntomas persistentes"],
    errors:["Subir volumen rápido","Ignorar señales"],
    prog:"Aumentar tiempo o ritmo (caminata vigorosa)",
  },
  {
    id:"cadera_dec_lat",
    name:"Apertura de cadera en decúbito lateral (según tolerancia)",
    goal:["cadera","fuerza_funcional"],
    stage:["postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","postparto_12plus","general"],
    tol:"media",
    dose:"2–3 series de 8–12 repeticiones",
    cues:["Exhala al esfuerzo","Control de cadera","Sin síntomas pélvicos relevantes"],
    errors:["Compensar lumbar","Aumenta pesadez/escape"],
    prog:"Progresar carga o unipodal",
  },
  {
    id:"relajacion_pp",
    name:"Relajación del piso pélvico: respiración + relajación guiada + escaneo corporal",
    goal:["relajación","dolor","sexualidad"],
    stage:["general","menopausia","postparto_6_8","postparto_8_12","postparto_12plus"],
    tol:"baja",
    dose:"5–8 min, 4–6 días/semana",
    cues:["Escaneo sin juicio","Relaja en exhalación","Progresión solo si no aumenta dolor"],
    errors:["Forzar","Apnea","Contracción defensiva"],
    prog:"Sumar coordinación sin dolor",
  },
  {
    id:"exposicion_gradual",
    name:"Exposición gradual no dolorosa (educación + estrategias; dilatadores = opcional)",
    goal:["exposición","sexualidad"],
    stage:["general","menopausia"],
    tol:"baja",
    dose:"Muy gradual, según tolerancia; registrar contexto",
    cues:["Evitar dolor fuerte: objetivo = tolerancia","Lubricación/posición/ritmo","Parar si dolor sube y no baja"],
    errors:["Aguantar dolor","No registrar gatillantes"],
    prog:"Aumentar tolerancia y control",
  },
  {
    id:"cuidado_tejidos",
    name:"Cuidado de tejidos: lubricación, ritmo y fricción (si aplica)",
    goal:["tejidos","sexualidad","educación"],
    stage:["menopausia","general"],
    tol:"baja",
    dose:"Educación + aplicar estrategias; registrar respuesta",
    cues:["Prioriza fricción baja","Explorar lubricantes","Coordinar con profesional médico si corresponde"],
    errors:["Irritantes","Ignorar ardor/disuria persistente"],
    prog:"Mejorar tolerancia/actividad",
  },
  {
    id:"exhalar_esfuerzo",
    name:"Exhalación en esfuerzo (sentarse/levantar/cargar) + coordinación del piso pélvico",
    goal:["presion","core"],
    stage:["general","postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","postparto_12plus"],
    tol:"baja",
    dose:"2–3 min práctica + aplicar en actividades diarias",
    cues:["Exhala antes y durante el esfuerzo","Evita empuje","Suave y consistente"],
    errors:["Apnea","Empuje fuerte"],
    prog:"Aplicar en fuerza funcional",
  }
];

/* =======================
   Secciones (incluye módulos 8/9 rearmados + motor + músculo-esquelético)
   ======================= */

const SECTIONS = [
  {
    id:"identificacion",
    title:"1) Identificación completa",
    badge:"Obligatorio",
    badgeKind:"req",
    mode:"min",
    fields:[
      { type:"text", key:"id.nombre", label:"Nombre:", mode:"min"},
      { type:"number", key:"id.edad", label:"Edad:", mode:"min"},
      { type:"text", key:"id.rut", label:"Rut:", mode:"min"},
      { type:"date", key:"id.fecha", label:"Fecha de ingreso", mode:"min"},
      { type:"text", key:"id.contacto_emergencia", label:"Contacto / Contacto de emergencia:", mode:"min"},

      { type:"text", key:"id.medico_tratante", label:"Médico tratante:", mode:"full"},
      { type:"text", key:"id.matrona", label:"Matrona", mode:"full"},
      { type:"text", key:"id.contacto_medico", label:"Contacto médico tratante", mode:"full"},
      { type:"text", key:"id.ocupacion", label:"Ocupación:", mode:"min"},
      { type:"text", key:"id.deportes", label:"Deportes", mode:"full"},
      { type:"text", key:"id.prevision", label:"Previsión", mode:"full"},
      { type:"text", key:"id.nivel_educacional", label:"Nivel educacional:", mode:"full"},
    ]
  },

  {
    id:"motivo",
    title:"2) Motivo de consulta",
    badge:"Obligatorio",
    badgeKind:"req",
    mode:"min",
    hint:"Pregunta abierta + mínimo comparable (0–10 + actividad) para re-evaluar.",
    fields:[
      { type:"textarea", key:"motivo.motivo", label:"Motivo de consulta:", rows:3, mode:"min" },
      { type:"textarea", key:"motivo.meta", label:"Meta (en palabras de la usuaria)", rows:2, mode:"min" },
      { type:"textarea", key:"motivo.historia", label:"Historia breve / contexto", rows:2, mode:"min" },
      { type:"range", key:"medicion.sintoma_0_10", label:"Escala 0–10 del síntoma principal", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"text", key:"medicion.actividad_1", label:"Actividad importante 1 + 0–10", mode:"min", placeholder:"Ej: correr 2/10" },
      { type:"text", key:"medicion.actividad_2", label:"Actividad importante 2 + 0–10", mode:"full" },
      { type:"text", key:"medicion.actividad_3", label:"Actividad importante 3 + 0–10", mode:"full" },
    ]
  },

  {
    id:"seguridad",
    title:"3) Seguridad / derivación",
    badge:"P0",
    badgeKind:"p0",
    mode:"min",
    hint:"Si marcas algo relevante: detener, coordinar, derivar según criterio clínico.",
    fields:[
      { type:"check", key:"seg.fiebre", label:"Fiebre/escalofríos + dolor pélvico o urinario", mode:"min"},
      { type:"check", key:"seg.hematuria", label:"Hematuria visible", mode:"min"},
      { type:"check", key:"seg.retencion", label:"Retención / incapacidad para orinar / dolor suprapúbico severo", mode:"min"},
      { type:"check", key:"seg.sangrado", label:"Sangrado genital anormal importante / postmenopáusico", mode:"min"},
      { type:"check", key:"seg.dolor_agudo", label:"Dolor pélvico agudo severo “nuevo”", mode:"min"},
      { type:"check", key:"seg.neuro", label:"Síntomas neurológicos nuevos (anestesia silla de montar / debilidad progresiva / cambios esfínteres no explicados)", mode:"min"},
      { type:"check", key:"seg.tvp", label:"Sospecha TVP/TEP (derivar según clínica)", mode:"min"},
      { type:"check", key:"seg.emb_alerta", label:"Embarazo: sangrado/pérdida de líquido/dolor severo (derivar)", mode:"full"},
      { type:"textarea", key:"seg.accion", label:"Acción tomada / notas", rows:2, mode:"full" },

      { type:"textarea", key:"seg.detalles_tvp", label:"TVP/TEP: por qué sospechas + acción", rows:2, mode:"full" },
      { type:"textarea", key:"seg.detalles_emb_alerta", label:"Embarazo alerta: detalle + acción", rows:2, mode:"full" },
    ]
  },

  {
    id:"gineco_obst",
    title:"4) Antecedentes gineco-obstétricos (embarazo y postparto)",
    badge:"Obligatorio",
    badgeKind:"req",
    mode:"min",
    hint:"Embarazadas en cualquier trimestre: acá ordenas, no recortas.",
    fields:[
      { type:"text", key:"go.gestaciones", label:"Gestaciones", mode:"min" },
      { type:"text", key:"go.abortos", label:"Abortos", mode:"min" },
      { type:"text", key:"go.partos", label:"Partos", mode:"min" },
      { type:"text", key:"go.cesareas", label:"Cesáreas", mode:"min" },
      { type:"text", key:"go.desgarros_epi", label:"Desgarros / Episiotomías", mode:"min" },
      { type:"text", key:"go.fecha_probable_parto", label:"Fecha probable parto", mode:"min" },
      { type:"text", key:"go.peso_rn", label:"Peso RN", mode:"min" },
      { type:"text", key:"go.suplementos", label:"Suplementos", mode:"min" },

      { type:"div", mode:"min" },
      { type:"number", key:"ciclo.embarazo_semanas", label:"Embarazo: semanas de gestación (si aplica)", mode:"min", min:0, max:45 },
      { type:"number", key:"ciclo.postparto_semanas", label:"Postparto: semanas desde el parto (si aplica)", mode:"min", min:0, max:520 },

      { type:"div", mode:"full" },
      { type:"check", key:"ciclo.gsm", label:"Menopausia/perimenopausia con síntomas GSM (sequedad/ardor/disuria/dispareunia)", mode:"full"},
      { type:"textarea", key:"ciclo.gsm_detalles", label:"GSM: describe síntomas y gatillantes", rows:2, mode:"full"},
    ]
  },

  /* ===== MÓDULO 8 REORGANIZADO ===== */
  {
    id:"mod8_pf",
    title:"8) Disfunción del piso pélvico (screen por síntoma)",
    badge:"Obligatorio",
    badgeKind:"req",
    mode:"min",
    hint:"Marca el síntoma → aparece cuantificación (0–10) + campo específico. Botones al final para convertir a hipótesis/tareas.",
    fields:[],
    customRender:(card)=> renderModule8(card)
  },

  /* ===== MÓDULO 9 REORGANIZADO ===== */
  {
    id:"mod9_urinario",
    title:"9) Tracto urinario inferior (organizado por pregunta)",
    badge:"10 min / Completo",
    badgeKind:"req",
    mode:"min",
    hint:"Cada ítem despliega su campo específico. Incluye ICIQ-UI SF con interpretación.",
    fields:[],
    customRender:(card)=> renderModule9(card)
  },

  /* ===== EXAMEN: acompañante/testigo + subcampos condicionales ===== */
  {
    id:"examen",
    title:"10) Examen físico / ginecológico",
    badge:"10 min / Completo",
    badgeKind:"req",
    mode:"min",
    hint:"Si seleccionas “Sí” en examen intracavitario → aparecen subcampos (consentimiento y hallazgos).",
    fields:[
      { type:"textarea", key:"ex.obs", label:"Observación", rows:2, mode:"min" },
      { type:"text", key:"ex.respiracion", label:"Patrón respiratorio", mode:"min" },

      { type:"div", mode:"min" },
      { type:"check", key:"cons.explico", label:"Expliqué objetivo, alternativas y derecho a parar", mode:"min"},
      { type:"check", key:"cons.testigo_ofrecido", label:"Ofrecí acompañante/testigo", mode:"min"},
      { type:"select", key:"cons.interno", label:"¿Se realizará examen intracavitario hoy?", mode:"min",
        options:["—","No","Sí (vaginal)","Sí (rectal)","No aplica hoy"]
      },
      { type:"textarea", key:"cons.detalles", label:"Consentimiento / tolerancia / razones para NO hacerlo", rows:2, mode:"min" },

      { type:"div", mode:"min" },
      { type:"range", key:"int.dolor_0_10", label:"Dolor a palpación (0–10) (si aplica)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"text", key:"int.dolor_donde", label:"Dolor: ¿dónde?", mode:"min" },

      { type:"select", key:"int.tono_simple", label:"Tono basal (si aplica)", mode:"min", options:["—","bajo","normal","alto"] },
      { type:"text", key:"int.tono_detalles", label:"Tono: hallazgos específicos", mode:"min", placeholder:"Ej: tono alto, hipertonía del piso pélvico" },

      { type:"select", key:"int.coord_simple", label:"Coordinación contracción-relajación (si aplica)", mode:"min", options:["—","adecuada","limitada"] },
      { type:"text", key:"int.coord_detalles", label:"Coordinación: qué falla", mode:"min", placeholder:"Ej: no logra relajar, apnea en contracción" },

      { type:"text", key:"int.fuerza_simple", label:"Fuerza/endurance (escala que uses) + observaciones", mode:"min" },
    ],
    customRender:(card)=> renderExamConditional(card)
  },

  /* ===== MÓDULO MÚSCULO-ESQUELÉTICO (toggle) ===== */
  {
    id:"musculo_esq",
    title:"Módulo músculo-esquelético (integral)",
    badge:"Toggle",
    badgeKind:"req",
    mode:"min",
    requiresMusculoEsq:true,
    hint:"OFF por defecto. En 10 min: screening. En completo: dominios + 1–2 tests.",
    fields:[
      { type:"select", key:"me.dolor_principal", label:"Dolor músculo-esquelético principal hoy:", mode:"min",
        options:["—","Ninguno","Lumbar","Cadera","Pubalgia","Sacroilíaco","Pared abdominal","Otro"]
      },
      { type:"range", key:"me.dolor_0_10", label:"Dolor músculo-esquelético (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"select", key:"me.neuro", label:"Irradiación/neurológico:", mode:"min", options:["—","No","Sí"] },
      { type:"select", key:"me.carga_impacto", label:"Relación con carga/impacto:", mode:"min",
        options:["—","Mejora con reposo","Empeora con impacto","No claro"]
      },
      { type:"select", key:"me.irritabilidad", label:"Sensibilidad/irritabilidad:", mode:"min", options:["—","Baja","Media","Alta"] },
      { type:"textarea", key:"me.detalles", label:"Detalles (dónde, cuándo, qué gatilla)", rows:2, mode:"min" },

      { type:"div", mode:"full" },
      { type:"select", key:"me.presion", label:"Respiración/estrategia de presión:", mode:"full", options:["—","OK","Sospecha disfunción"] },
      { type:"textarea", key:"me.presion_detalles", label:"Detalles (apnea, empuje, hiperpresión)", rows:2, mode:"full" },

      { type:"select", key:"me.pared_abdominal", label:"Pared abdominal / DRA (postparto):", mode:"full", options:["—","No aplica","Sospecha","Confirmada"] },
      { type:"textarea", key:"me.pared_detalles", label:"Detalles (si hay medición, anotar)", rows:2, mode:"full" },

      { type:"select", key:"me.cadera", label:"Cadera:", mode:"full", options:["—","OK","Limitación ROM","Dolor con carga","Debilidad sospechada"] },
      { type:"textarea", key:"me.cadera_detalles", label:"Detalles", rows:2, mode:"full" },

      { type:"select", key:"me.lumbo", label:"Lumbopélvico:", mode:"full", options:["—","OK","Dolor mecánico","Rigidez","Inestabilidad percibida"] },
      { type:"textarea", key:"me.lumbo_detalles", label:"Detalles", rows:2, mode:"full" },

      { type:"select", key:"me.tol_impacto", label:"Tolerancia a impacto:", mode:"full", options:["—","No aplica","Baja","Media","Alta"] },
      { type:"textarea", key:"me.tol_detalles", label:"Detalles", rows:2, mode:"full" },

      { type:"div", mode:"full" },
      { type:"select", key:"me.test1", label:"Test 1 (elige 1–2):", mode:"full",
        options:["—","Sentadilla","Bisagra","Step-down","Puente unilateral","Marcha/carrera (si aplica)"]
      },
      { type:"select", key:"me.test1_estado", label:"Test 1 estado:", mode:"full", options:["—","Normal","Alterado","No evaluado"] },
      { type:"textarea", key:"me.test1_detalles", label:"Test 1: qué se vio", rows:2, mode:"full" },

      { type:"select", key:"me.test2", label:"Test 2 (opcional):", mode:"full",
        options:["—","Sentadilla","Bisagra","Step-down","Puente unilateral","Marcha/carrera (si aplica)"]
      },
      { type:"select", key:"me.test2_estado", label:"Test 2 estado:", mode:"full", options:["—","Normal","Alterado","No evaluado"] },
      { type:"textarea", key:"me.test2_detalles", label:"Test 2: qué se vio", rows:2, mode:"full" },
    ]
  },

  /* ===== MOTOR ===== */
  {
    id:"motor_hyp",
    title:"Motor · Hipótesis (sugeridas + editables)",
    badge:"Motor",
    badgeKind:"rel",
    mode:"min",
    hint:"Sugerencias activables (sin inventar). En 10 min: máx 2 activas. En completo: máx 5 activas.",
    fields:[],
    customRender:(card)=> renderHypotheses(card)
  },
  {
    id:"motor_ex",
    title:"Motor · Ejercicios (biblioteca + autoplan)",
    badge:"Motor",
    badgeKind:"rel",
    mode:"min",
    hint:"En 10 min: 3 ejercicios máx. En completo: 5–7 (editable).",
    fields:[],
    customRender:(card)=> renderExercises(card)
  },
  {
    id:"motor_tasks",
    title:"Motor · Tareas (auto + editable)",
    badge:"Motor",
    badgeKind:"rel",
    mode:"min",
    hint:"3 columnas: tareas para usuaria / tareas para la kine / compartidas.",
    fields:[],
    customRender:(card)=> renderTasks(card)
  },
  {
    id:"motor_next",
    title:"Motor · Próxima sesión (qué ver / reevaluar)",
    badge:"Motor",
    badgeKind:"rel",
    mode:"min",
    hint:"Se auto-llena según positivos y lo trabajado. Edita en 1 click.",
    fields:[],
    customRender:(card)=> renderNextSession(card)
  },

  /* ===== PLAN FINAL (tu texto) ===== */
  {
    id:"plan",
    title:"Plan final (tu texto)",
    badge:"Obligatorio",
    badgeKind:"req",
    mode:"min",
    hint:"Tu juicio final + plan 2–4 semanas + tareas. El motor ayuda, no reemplaza.",
    fields:[
      { type:"text", key:"plan.clasificacion", label:"Clasificación final (tu juicio)", mode:"min",
        placeholder:"Ej: pérdidas con esfuerzo + estrategia de presión; dolor en relaciones: trabajaremos relajación y cuidado de tejidos…"
      },
      { type:"textarea", key:"plan.hipotesis", label:"Hipótesis (tu texto, máx 3)", rows:2, mode:"min" },
      { type:"textarea", key:"plan.plan_2_4", label:"Plan 2–4 semanas (tu lenguaje)", rows:3, mode:"min" },
      { type:"textarea", key:"plan.tareas", label:"Tareas (tu lenguaje)", rows:3, mode:"min" },
      { type:"text", key:"plan.retest", label:"Re-evaluación (cuándo)", mode:"full", placeholder:"Ej: 2–4 semanas o 4–6 sesiones" },
      { type:"select", key:"plan.cuestionario", label:"Cuestionario baseline (si aplica)", mode:"full",
        options:["—","ICIQ-UI SF","PFDI-20","PGQ","Wexner/Vaizey","FSFI (si sexualidad es foco)","Otro"]
      },
    ]
  },
];
/* =======================
   Render base
   ======================= */

function renderForm(extras){
  const root = $("#formRoot");
  root.innerHTML = "";

  SECTIONS.forEach(sec=>{
    if (!shouldShow(sec.mode)) return;
    if (!requiresMusculoEsq(sec, extras)) return;

    const card = el("section", { class:"card", "data-sec": sec.id }, []);
    const h = el("div", { class:"card-h" }, [
      el("div", {}, [
        el("h2", {}, [sec.title]),
        sec.hint ? el("div",{class:"hint"},[sec.hint]) : null
      ]),
      el("span", { class: `badge ${sec.badgeKind || ""}`}, [sec.badge || ""])
    ]);
    card.appendChild(h);

    const grid = el("div",{class:"grid2"},[]);
    let hasGrid = false;

    (sec.fields || []).forEach(f=>{
      if (!shouldShow(f.mode || sec.mode)) return;

      if (f.type === "div"){
        card.appendChild(el("div",{class:"div"},[]));
        return;
      }

      if (f.type === "check"){
        const row = el("label",{class:"symRow"},[
          el("div",{class:"symHead"},[
            el("div",{class:"symLeft"},[
              el("input",{type:"checkbox","data-key":f.key}),
              el("span",{},[f.label])
            ]),
          ])
        ]);
        card.appendChild(row);
        return;
      }

      if (f.type === "range"){
        const field = el("div",{class:"field"},[]);
        const lbl = el("label",{},[
          el("span",{},[f.label]),
          f.showValue ? el("span",{class:"small", "data-range-for": f.key},["0"]) : null
        ]);
        field.appendChild(lbl);

        const input = el("input",{
          type:"range",
          "data-key": f.key,
          min: String(f.min ?? 0),
          max: String(f.max ?? 10),
          step: String(f.step ?? 1),
          value: "0"
        },[]);
        field.appendChild(input);

        hasGrid = true;
        grid.appendChild(field);
        return;
      }

      const field = el("div",{class:"field"},[
        el("label",{},[f.label]),
      ]);

      let input;
      if (f.type === "textarea"){
        input = el("textarea",{
          "data-key": f.key,
          rows: String(f.rows || 2),
          placeholder: f.placeholder || ""
        },[]);
      } else if (f.type === "select"){
        input = el("select",{"data-key":f.key}, []);
        (f.options||["—"]).forEach(opt=>{
          input.appendChild(el("option",{value: opt === "—" ? "" : opt},[opt]));
        });
      } else {
        input = el("input",{
          type: f.type || "text",
          "data-key": f.key,
          placeholder: f.placeholder || ""
        },[]);
        if (f.min !== undefined) input.min = String(f.min);
        if (f.max !== undefined) input.max = String(f.max);
      }

      field.appendChild(input);
      hasGrid = true;
      grid.appendChild(field);
    });

    if (hasGrid) card.appendChild(grid);

    if (typeof sec.customRender === "function"){
      sec.customRender(card);
    }

    root.appendChild(card);
  });

  bindInputs();
  applyLoadedState(extras);
  saveAndRefresh(extras);
}

function getBaseState(includeMeta=true){
  const st = includeMeta ? { _meta:{mode:MODE, updatedAt:new Date().toISOString()} } : {};
  $$("[data-key]").forEach(node=>{
    const k = node.getAttribute("data-key");
    let v = "";
    if (node.type === "checkbox") v = !!node.checked;
    else v = node.value ?? "";
    deepSet(st, k, v);
  });
  return st;
}

function applyBaseState(st){
  if (!st) return;
  $$("[data-key]").forEach(node=>{
    const k = node.getAttribute("data-key");
    const v = deepGet(st, k);
    if (v === undefined) return;
    if (node.type === "checkbox") node.checked = !!v;
    else node.value = v;
  });

  // update badges range
  $$("[data-range-for]").forEach(b=>{
    const key = b.getAttribute("data-range-for");
    const v = deepGet(st, key);
    b.textContent = (v === undefined || v === null || v === "") ? "0" : String(v);
  });
}

function loadBaseState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveBaseState(st){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
}

function getMergedState(){
  const base = getBaseState(true);
  const extras = window.__extras || ExtrasDefault();
  base.__extras = extras;
  return base;
}

function clearAll(){
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(EXTRAS_KEY);
  window.__extras = ExtrasDefault();
  renderForm(window.__extras);
}

/* =======================
   Modo / toggle músculo-esquelético
   ======================= */

function modeHiddenLine(){
  const extras = window.__extras || ExtrasDefault();
  if (MODE === "full") return "Vista completa activada.";

  const me = extras.settings.musculoEsqOn
    ? "Músculo-esquelético: ON (screening)"
    : "Músculo-esquelético: OFF";

  return `Modo 10 min: se muestra lo esencial. ${me}`;
}

function setMode(mode, rerender=true){
  MODE = mode;

  const btn10 = $("#btnMode10");
  const btnFull = $("#btnModeFull");

  btn10.classList.toggle("active", MODE==="10");
  btnFull.classList.toggle("active", MODE==="full");

  btn10.setAttribute("aria-pressed", MODE==="10" ? "true" : "false");
  btnFull.setAttribute("aria-pressed", MODE==="full" ? "true" : "false");

  const pill = $("#pillMode");
  if (pill) pill.textContent = `Modo actual: ${MODE==="full" ? "Completo" : "10 min"}`;

  saveBaseState(getBaseState(true));

  if (rerender) renderForm(window.__extras);
  else saveAndRefresh(window.__extras);

  toast(`Modo cambiado a ${MODE==="full" ? "Completo" : "10 min"}`);
}

function toggleMusculoEsq(){
  const extras = window.__extras;
  extras.settings.musculoEsqOn = !extras.settings.musculoEsqOn;
  saveExtras(extras);

  const btn = $("#btnMsk");
  btn.setAttribute("aria-pressed", extras.settings.musculoEsqOn ? "true" : "false");
  btn.textContent = extras.settings.musculoEsqOn ? "Músculo-esquelético: ON" : "Músculo-esquelético: OFF";

  renderForm(extras);
  toast(`Módulo músculo-esquelético ${extras.settings.musculoEsqOn ? "activado" : "desactivado"}`);
}

/* =======================
   Gráficos (completitud + perfil)
   ======================= */

const REQUIRED_KEYS_10 = [
  "id.nombre","id.rut","id.fecha",
  "motivo.motivo",
  "medicion.sintoma_0_10",
  "medicion.actividad_1",
  "plan.plan_2_4","plan.tareas"
];
const REQUIRED_KEYS_FULL_EXTRA = ["plan.cuestionario","plan.retest"];

function completion(st){
  const base = REQUIRED_KEYS_10.slice();
  if (MODE === "full") base.push(...REQUIRED_KEYS_FULL_EXTRA);

  let filled = 0;
  base.forEach(k=>{
    const v = deepGet(st, k);
    if (v === undefined || v === null) return;
    if (typeof v === "boolean") { if (v) filled++; return; }
    if (String(v).trim() !== "") filled++;
  });

  const total = base.length;
  return { filled, total, pct: total ? Math.round((filled/total)*100) : 0 };
}

/* Perfil (0–10) se alimenta desde módulo 8 (por síntoma) */
function domainScores(st){
  // Calcula directo desde Módulo 8 (en vivo) → SIEMPRE se actualiza y exporta
  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
  };

  const urin = Math.max(
    toNum(st?.m8?.urinario_esfuerzo_0_10),
    toNum(st?.m8?.urinario_urgencia_0_10),
    toNum(st?.m8?.urinario_sin_causa_0_10)
  );
  const intestinal = Math.max(
    toNum(st?.m8?.perdida_heces_gases_0_10),
    toNum(st?.m8?.estrenimiento_0_10)
  );

  return [
    { name:"Urinario", v: urin },
    { name:"Intestinal", v: intestinal },
    { name:"Dolor pélvico", v: toNum(st?.m8?.dolor_pelvico_0_10) },
    { name:"Relaciones", v: toNum(st?.m8?.dolor_relaciones_0_10) },
    { name:"Bulto/peso", v: toNum(st?.m8?.bulto_peso_0_10) },
  ];
}

function drawDonut(canvas, pct){
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;
  const r = Math.min(w,h)*0.36;
  ctx.clearRect(0,0,w,h);

  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(16,32,36,.14)";
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.stroke();

  const start = -Math.PI/2;
  const end = start + (Math.PI*2)*(pct/100);
  ctx.strokeStyle = "rgba(194,106,90,.70)";
  ctx.beginPath();
  ctx.arc(cx,cy,r,start,end);
  ctx.stroke();

  ctx.fillStyle = "#102024";
  ctx.font = "800 26px Montserrat, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${pct}%`, cx, cy);

  ctx.fillStyle = "rgba(16,32,36,.70)";
  ctx.font = "600 12px Montserrat, Arial";
  ctx.fillText("completo", cx, cy + 26);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (w <= 0) return;
  const rr = Math.min(r, h/2, w/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawBars(canvas, scores){
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const pad = 14;
  const labelW = 110;
  const barW = w - pad*2 - labelW - 54;
  const rowH = 26;
  const top = 10;

  ctx.font = "600 12px Montserrat, Arial";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(16,32,36,.75)";

  scores.forEach((s, i)=>{
    const y = top + i*rowH + 8;
    ctx.fillText(s.name, pad, y);

    const x0 = pad + labelW;
    ctx.fillStyle = "rgba(16,32,36,.10)";
    roundRect(ctx, x0, y-7, barW, 14, 7, true, false);

    const fw = Math.max(0, Math.round(barW*(s.v/10)));
    ctx.fillStyle = "rgba(194,106,90,.70)";
    roundRect(ctx, x0, y-7, fw, 14, 7, true, false);

    ctx.fillStyle = "#102024";
    ctx.font = "800 12px Montserrat, Arial";
    ctx.fillText(String(s.v), x0 + barW + 16, y);
    ctx.font = "600 12px Montserrat, Arial";
    ctx.fillStyle = "rgba(16,32,36,.75)";
  });
}

/* =======================
   UI hero + save
   ======================= */

function refreshHeroUI(st){
  const extras = window.__extras || ExtrasDefault();

  const setText = (sel, txt) => {
    const n = $(sel);
    if (n) n.textContent = txt;
  };

  const name = st?.id?.nombre || "—";
  const rut = st?.id?.rut ? ` · ${st.id.rut}` : "";
  setText("#chipUsuaria", `Usuaria: ${name}${rut}`);

  setText("#chipEtapa", `Embarazo/postparto: ${etapaStr(st)}`);

  const safe = safetyFlag(st);
  setText("#chipSeguridad", safe ? "Seguridad: OJO (marcado)" : "Seguridad: sin alertas");

  setText("#chipMsk", extras.settings.musculoEsqOn ? "Músculo-esquelético: ON" : "Músculo-esquelético: OFF");

  const clasifManual = (st?.plan?.clasificacion || st?.plan?.clasificacion_manual || "").trim();
  const clasif = clasifManual || suggestedClassification(st);

  const questManual = (st?.plan?.cuestionario || st?.plan?.cuestionario_elegido || "").trim();
  const quest = questManual || suggestedQuestionnaire(st);

  const activeHyps = (extras.hypotheses || []).filter(h => h.active);
  const top2 = activeHyps.slice(0,2).map(h => h.title).filter(Boolean).join(" · ");

  setText(
    "#heroClasif",
    `Clasificación sugerida: ${clasif} · Hipótesis activas: ${activeHyps.length}${top2 ? " ("+top2+")" : ""}`
  );
  setText("#heroSug", `Cuestionario recomendado: ${quest}`);

  setText("#miniMotivo", (st?.motivo?.motivo || "—").toString().slice(0,120) || "—");
  setText("#miniPlan", (st?.plan?.plan_2_4 || "—").toString().slice(0,120) || "—");
  setText("#miniOculto", modeHiddenLine());

  const c = completion(st);
  const cv = $("#cvProgress");
  if (cv) drawDonut(cv, c.pct);
  setText("#progressText", `${c.filled}/${c.total} campos clave`);

  const bars = $("#cvProfile");
  if (bars) drawBars(bars, domainScores(st));
}


function saveAndRefresh(extras){
  const st = getBaseState(true);
  saveBaseState(st);

  refreshHeroUI(getMergedState());
  renderMotorSections();
}

function bindInputs(){
  $$("[data-key]").forEach(node=>{
    node.addEventListener("input", () => {
      if (node.type === "range"){
        const key = node.getAttribute("data-key");
        const badge = document.querySelector(`[data-range-for="${key}"]`);
        if (badge) badge.textContent = String(node.value);
      }
      saveAndRefresh(window.__extras);
      // módulos 8/9 dependen de toggles
      if (node.closest && node.closest("[data-module8]")) updateModule8Visibility();
      if (node.closest && node.closest("[data-module9]")) updateModule9Visibility();
      if (node.getAttribute("data-key")==="cons.interno") updateExamConditionalVisibility();
    });
    node.addEventListener("change", () => {
      saveAndRefresh(window.__extras);
      if (node.closest && node.closest("[data-module8]")) updateModule8Visibility();
      if (node.closest && node.closest("[data-module9]")) updateModule9Visibility();
      if (node.getAttribute("data-key")==="cons.interno") updateExamConditionalVisibility();
    });
  });
}

function applyLoadedState(extras){
  const st = loadBaseState();
  if (!st) {
    const dateInput = $$("[data-key='id.fecha']")[0];
    if (dateInput && !dateInput.value) dateInput.value = nowISODate();
    return;
  }
  MODE = st?._meta?.mode || MODE;
  applyBaseState(st);
  setMode(MODE, false);
}

/* =======================
   Seguridad / etapa / cuestionarios sugeridos
   ======================= */

function safetyFlag(st){
  const s = st?.seg || {};
  const keys = ["fiebre","hematuria","retencion","sangrado","dolor_agudo","neuro","tvp","emb_alerta"];
  return keys.some(k=> !!s[k]);
}

function etapaStr(st){
  const parts = [];
  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const gw  = Number(st?.ciclo?.embarazo_semanas || 0);
  if (gw > 0) parts.push(`Embarazo: ${gw} sem`);
  if (ppw > 0) parts.push(`Postparto: ${ppw} sem`);
  if (st?.go?.fecha_probable_parto) parts.push(`FPP: ${st.go.fecha_probable_parto}`);
  if (st?.go?.peso_rn) parts.push(`RN: ${st.go.peso_rn}`);
  return parts.length ? parts.join(" · ") : "—";
}

function suggestedClassification(st){
  if (safetyFlag(st)) return "Prioridad: seguridad/derivación";

  const effort = !!st?.m8?.urinario_esfuerzo;
  const urg    = !!st?.m8?.urinario_urgencia;
  const fi     = !!st?.m8?.perdida_heces_gases;
  const constip= !!st?.m8?.estrenimiento;
  const dysp   = !!st?.m8?.dolor_relaciones;
  const pelvic = !!st?.m8?.dolor_pelvico;
  const prol   = !!st?.m8?.bulto_peso;

  const tags = [];
  if (effort && urg) tags.push("Pérdidas de orina: esfuerzo + urgencia (mixta probable)");
  else if (effort) tags.push("Pérdidas de orina con esfuerzo (probable)");
  else if (urg) tags.push("Urgencia para orinar (probable)");

  if (prol) tags.push("Síntomas de bulto/peso (prolapso sintomático probable)");
  if (fi) tags.push("Pérdida de gases/heces (evaluar severidad)");
  if (constip) tags.push("Estreñimiento / disfunción defecatoria");
  if (dysp) tags.push("Dolor en relaciones (dispareunia)");
  if (pelvic) tags.push("Dolor pélvico/vulvar");

  if (!tags.length) return "—";
  return tags.slice(0,2).join(" + ") + (tags.length>2 ? " (y otros)" : "");
}

function suggestedQuestionnaire(st){
  if (safetyFlag(st)) return "— (resolver seguridad primero)";

  const iciqOn = !!st?.m8?.urinario_esfuerzo || !!st?.m8?.urinario_urgencia || !!st?.m9?.iciq_aplicar;
  const dysp   = !!st?.m8?.dolor_relaciones;
  const fi     = !!st?.m8?.perdida_heces_gases;
  const pelvic = !!st?.m8?.dolor_pelvico;

  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const pregnancy = Number(st?.ciclo?.embarazo_semanas || 0) > 0;

  if (iciqOn) return "ICIQ-UI SF";
  if (fi) return "Wexner/Vaizey";
  if (dysp && MODE==="full") return "FSFI (si sexualidad es foco)";
  if (pelvic) return "PFDI-20 (si síntomas globales) o escala dolor 0–10";
  if (pregnancy || ppw>0) return "PGQ (si dolor de cintura pélvica) o PFDI-20 según síntomas";
  return "—";
}

/* =======================
   MÓDULO 8 – Disfunción del piso pélvico (screen por síntoma)
   - 1 renglón por síntoma
   - Si se marca → aparece 0–10 + campo específico (y extra según síntoma)
   - Botones: Añadir hipótesis y tareas / Vaciar sección
   - Actualiza perfil (para gráfico): urinario/intestinal/dolor pélvico/relaciones/bulto-peso
======================= */

const M8_ITEMS = [
  {
    key:"m8.urinario_esfuerzo",
    label:"Pérdida de orina al toser, estornudar, reír o hacer ejercicio",
    severityKey:"m8.urinario_esfuerzo_0_10",
    detailsKey:"m8.urinario_esfuerzo_detalles",
    severityLabel:"Molestia (0–10)",
    detailsPlaceholder:"Describe cuándo ocurre, qué lo empeora o alivia, tolerancia y modificaciones.",
    profileMap: { target:"perfil.urinario_0_10", from:"m8.urinario_esfuerzo_0_10" }
  },
  {
    key:"m8.urinario_urgencia",
    label:"Necesidad urgente de orinar y dificultad para llegar al baño a tiempo",
    severityKey:"m8.urinario_urgencia_0_10",
    detailsKey:"m8.urinario_urgencia_detalles",
    severityLabel:"Urgencia/molestia (0–10)",
    detailsPlaceholder:"Describe gatillantes, control, horarios, líquidos, irritantes, relación con estreñimiento.",
    profileMap: { target:"perfil.urinario_0_10", from:"m8.urinario_urgencia_0_10" }
  },
  {
    key:"m8.urinario_sin_causa",
    label:"Pérdida de orina sin causa aparente",
    severityKey:"m8.urinario_sin_causa_0_10",
    detailsKey:"m8.urinario_sin_causa_detalles",
    severityLabel:"Molestia (0–10)",
    detailsPlaceholder:"Describe cuándo ocurre, si se asocia a urgencia o no, frecuencia.",
    profileMap: { target:"perfil.urinario_0_10", from:"m8.urinario_sin_causa_0_10" }
  },
  {
    key:"m8.perdida_heces_gases",
    label:"Pérdida involuntaria de gases o heces",
    severityKey:"m8.perdida_heces_gases_0_10",
    detailsKey:"m8.perdida_heces_gases_detalles",
    severityLabel:"Molestia/impacto (0–10)",
    detailsPlaceholder:"Describe frecuencia, urgencia, tipo de heces, situaciones y barreras (Bristol opcional).",
    profileMap: { target:"perfil.intestinal_0_10", from:"m8.perdida_heces_gases_0_10" }
  },
  {
    key:"m8.estrenimiento",
    label:"Estreñimiento",
    severityKey:"m8.estrenimiento_0_10",
    detailsKey:"m8.estrenimiento_detalles",
    severityLabel:"Molestia/impacto (0–10)",
    detailsPlaceholder:"Describe frecuencia, esfuerzo, dolor, maniobras, tipo de heces (Bristol opcional).",
    profileMap: { target:"perfil.intestinal_0_10", from:"m8.estrenimiento_0_10" }
  },
  {
    key:"m8.dolor_relaciones",
    label:"Dolor durante las relaciones sexuales (dispareunia)",
    severityKey:"m8.dolor_relaciones_0_10",
    detailsKey:"m8.dolor_relaciones_detalles",
    severityLabel:"Dolor en relaciones (0–10)",
    detailsPlaceholder:"Describe localización (entrada/profundo), momento (entrada/fricción/post), posiciones, lubricación, ansiedad.",
    extra: { type:"marinoff" },
    profileMap: { target:"perfil.dolor_relaciones_0_10", from:"m8.dolor_relaciones_0_10" }
  },
  {
    key:"m8.dolor_pelvico",
    label:"Dolor en zona pélvica, vulvar o abdomen bajo (dolor pélvico crónico)",
    severityKey:"m8.dolor_pelvico_0_10",
    detailsKey:"m8.dolor_pelvico_detalles",
    severityLabel:"Dolor pélvico/vulvar (0–10)",
    detailsPlaceholder:"Describe dónde, cuándo, qué lo agrava/atenúa, irritabilidad, relación con carga o estrés.",
    profileMap: { target:"perfil.dolor_pelvico_0_10", from:"m8.dolor_pelvico_0_10" }
  },
  {
    key:"m8.bulto_peso",
    label:"Sensación de bulto/peso/pesadez vaginal (prolapso sintomático)",
    severityKey:"m8.bulto_peso_0_10",
    detailsKey:"m8.bulto_peso_detalles",
    severityLabel:"Molestia (0–10)",
    detailsPlaceholder:"Describe cuándo aparece (final del día, al cargar, al caminar), y qué alivia.",
    profileMap: { target:"perfil.prolapso_0_10", from:"m8.bulto_peso_0_10" }
  },
];

function renderModule8(card){
  const wrap = el("div", { "data-module8":"true" }, []);

  M8_ITEMS.forEach(item=>{
    wrap.appendChild(renderSymptomRow(item));
  });

  // Bloque ICIQ dentro del módulo 8 si hay síntomas urinarios (requisito)
  const iciqBlock = el("div",{class:"symRow", id:"m8IciqBlock"},[
    el("div",{class:"symHead"},[
      el("div",{class:"symLeft"},[
        el("input",{type:"checkbox","data-key":"out.iciq_aplicar"}),
        el("div",{class:"symLabel"},["ICIQ-UI SF (0–21) · (si aplica)"])
      ]),
      el("div",{class:"symRight"},[
        el("span",{class:"tag"},["Escala validada"]),
        (()=> {
          const a = document.createElement("a");
          a.href = "https://iciq.net/iciq-ui-sf";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = "Abrir cuestionario";
          a.style.color = "var(--terra)";
          a.style.fontWeight = "800";
          a.style.textDecoration = "underline";
          return a;
        })()
      ])
    ]),
    el("div",{class:"symExtras", id:"m8IciqExtras"},[
      el("div",{class:"symGrid"},[
        el("div",{class:"rangeCompact"},[
          el("div",{class:"rangeTop"},[
            el("div",{},["Puntaje ICIQ-UI SF"]),
            el("div",{class:"rangeValue", id:"iciqBadge"},["—"])
          ]),
          el("input",{type:"number","data-key":"out.iciq_score", min:"0", max:"21", placeholder:"0–21", style:"margin-top:10px; width:100%; padding:10px; border-radius:14px; border:1px solid rgba(16,32,36,.18); background:rgba(255,255,255,.70); font-weight:700;"})
        ]),
        el("div",{class:"field"},[
          el("label",{},["Situaciones / contexto (opcional)"]),
          el("textarea",{rows:"2","data-key":"out.iciq_contexto", placeholder:"Ej: al saltar, al toser, al llegar a casa, etc."},[])
        ])
      ])
    ])
  ]);

  wrap.appendChild(iciqBlock);

  // Botones rápidos
  wrap.appendChild(el("div",{style:"margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;"},[
    el("button",{class:"smallBtn primary", type:"button", onclick:()=>module8ToMotor()},["Añadir hipótesis y tareas"]),
    el("button",{class:"smallBtn", type:"button", onclick:()=>clearModule8()},["Vaciar sección"]),
  ]));

  card.appendChild(wrap);
  setTimeout(()=>updateModule8Visibility(), 0);
}

function renderSymptomRow(item){
  const row = el("div",{class:"symRow", "data-sym-row": item.key},[]);

  // icono info solo donde abruma (intestinal)
  const hasInfo = (item.key === "m8.perdida_heces_gases" || item.key === "m8.estrenimiento");

  const infoBtn = hasInfo
    ? el("button",{class:"infoBtn", type:"button", onclick:()=>toggleInfo(item.key)},["i"])
    : null;

  const tags = [];
  tags.push(el("span",{class:"tag"},["0–10"]));
  if (item.extra && item.extra.type === "marinoff") tags.push(el("span",{class:"tag"},["Marinoff 0–3"]));

  const head = el("div",{class:"symHead"},[
    el("div",{class:"symLeft"},[
      el("input",{type:"checkbox","data-key":item.key, "data-sym-toggle":"true"}),
      el("div",{class:"symLabel"},[item.label])
    ]),
    el("div",{class:"symRight"},[
      ...tags,
      infoBtn
    ].filter(Boolean))
  ]);

  row.appendChild(head);

  if (hasInfo){
    row.appendChild(el("div",{class:"infoPop hidden", "data-info-for": item.key},[
      "Guía breve: frecuencia, urgencia, tipo de heces (Bristol opcional), dolor, maniobras, gatillantes."
    ]));
  }

  const extras = el("div",{class:"symExtras hidden", "data-sym-extras-for": item.key},[]);

  const range = el("div",{class:"rangeCompact"},[
    el("div",{class:"rangeTop"},[
      el("div",{},[item.severityLabel]),
      el("div",{class:"rangeValue", "data-range-value": item.severityKey},["0 · 0"])
    ]),
    el("input",{type:"range", min:"0", max:"10", step:"1", value:"0", "data-key": item.severityKey})
  ]);

  const details = el("div",{class:"field"},[
    el("label",{},["Describe (específico)"]),
    el("textarea",{"data-key": item.detailsKey, rows:"2", placeholder:item.detailsPlaceholder},[])
  ]);

  const grid = el("div",{class:"symGrid"},[range, details]);

  extras.appendChild(grid);

  if (item.extra && item.extra.type === "marinoff"){
    extras.appendChild(el("div",{class:"field"},[
      el("label",{},["Escala de dispareunia de Marinoff (0–3)"]),
      el("select",{"data-key":"m8.marinoff"},[
        el("option",{value:""},["—"]),
        el("option",{value:"0"},["0: sin dolor"]),
        el("option",{value:"1"},["1: disconfort, no impide"]),
        el("option",{value:"2"},["2: a veces interrumpe"]),
        el("option",{value:"3"},["3: impide siempre"]),
      ])
    ]));
  }

  row.appendChild(extras);
  return row;
}

function toggleInfo(key){
  const pop = document.querySelector(`[data-info-for="${key}"]`);
  if (!pop) return;
  pop.classList.toggle("hidden");
}

function renderMarinoffBlock(){
  return el("div",{class:"rangeBox"},[
    el("div",{class:"rangeTop"},[
      el("div",{},["Escala de dispareunia de Marinoff (0–3)"]),
      el("div",{class:"rangeValue", "data-marinoff-label":"true"},["—"])
    ]),
    el("select",{"data-key":"m8.marinoff"},[
      el("option",{value:""},["—"]),
      el("option",{value:"0"},["0: sin dolor"]),
      el("option",{value:"1"},["1: disconfort, no impide"]),
      el("option",{value:"2"},["2: a veces interrumpe"]),
      el("option",{value:"3"},["3: impide siempre"]),
    ]),
    el("div",{class:"symHint", style:"margin-top:10px;"},[
      "0 = sin dolor; 1 = disconfort sin impedir; 2 = a veces interrumpe; 3 = impide."
    ]),
  ]);
}

function updateModule8Visibility(){
  const st = getMergedState();

  // muestra extras solo si se activa la casilla
  M8_ITEMS.forEach(item=>{
    const on = !!deepGet(st, item.key);
    const extras = document.querySelector(`[data-sym-extras-for="${item.key}"]`);
    if (extras) extras.classList.toggle("hidden", !on);

    const v = Number(deepGet(st, item.severityKey) || 0);
    const badge = document.querySelector(`[data-range-value="${item.severityKey}"]`);
    if (badge) badge.textContent = `${v} · ${levelFrom010(v)}`;
  });

  // ICIQ block visible solo si hay urinario marcado
  const urinOn = !!st?.m8?.urinario_esfuerzo || !!st?.m8?.urinario_urgencia || !!st?.m8?.urinario_sin_causa;
  const iciqBlock = $("#m8IciqBlock");
  if (iciqBlock) iciqBlock.classList.toggle("hidden", !urinOn);

  const iciqExtras = $("#m8IciqExtras");
  const iciqOn = !!st?.out?.iciq_aplicar;
  if (iciqExtras) iciqExtras.classList.toggle("hidden", !iciqOn);

  const iciqBadge = $("#iciqBadge");
  if (iciqBadge && iciqOn){
    const score = Number(st?.out?.iciq_score);
    iciqBadge.textContent = Number.isFinite(score) ? `${score}/21 · ${iciqInterpret(score)}` : "—";
  }
}

function updateProfileFromModule8(){
  const st = getBaseState(true); // base
  // urinario = max de 3 urinarios si activos
  const urin = Math.max(
    Number(deepGet(st,"m8.urinario_esfuerzo_0_10") || 0),
    Number(deepGet(st,"m8.urinario_urgencia_0_10") || 0),
    Number(deepGet(st,"m8.urinario_sin_causa_0_10") || 0)
  );
  const intestinal = Math.max(
    Number(deepGet(st,"m8.perdida_heces_gases_0_10") || 0),
    Number(deepGet(st,"m8.estrenimiento_0_10") || 0)
  );
  const pelv = Number(deepGet(st,"m8.dolor_pelvico_0_10") || 0);
  const rel  = Number(deepGet(st,"m8.dolor_relaciones_0_10") || 0);
  const prol = Number(deepGet(st,"m8.bulto_peso_0_10") || 0);

  // set fields (sin disparar input events; actualiza directo y guarda)
  deepSet(st, "perfil.urinario_0_10", urin);
  deepSet(st, "perfil.intestinal_0_10", intestinal);
  deepSet(st, "perfil.dolor_pelvico_0_10", pelv);
  deepSet(st, "perfil.dolor_relaciones_0_10", rel);
  deepSet(st, "perfil.prolapso_0_10", prol);

  saveBaseState(st);
}

function clearModule8(){
  // apaga y limpia todo m8.*
  const keys = [
    "m8.urinario_esfuerzo","m8.urinario_esfuerzo_0_10","m8.urinario_esfuerzo_detalles",
    "m8.urinario_urgencia","m8.urinario_urgencia_0_10","m8.urinario_urgencia_detalles",
    "m8.urinario_sin_causa","m8.urinario_sin_causa_0_10","m8.urinario_sin_causa_detalles",
    "m8.perdida_heces_gases","m8.perdida_heces_gases_0_10","m8.perdida_heces_gases_detalles",
    "m8.estrenimiento","m8.estrenimiento_0_10","m8.estrenimiento_detalles",
    "m8.dolor_relaciones","m8.dolor_relaciones_0_10","m8.dolor_relaciones_detalles",
    "m8.marinoff",
    "m8.dolor_pelvico","m8.dolor_pelvico_0_10","m8.dolor_pelvico_detalles",
    "m8.bulto_peso","m8.bulto_peso_0_10","m8.bulto_peso_detalles",
    "perfil.urinario_0_10","perfil.intestinal_0_10","perfil.dolor_pelvico_0_10","perfil.dolor_relaciones_0_10","perfil.prolapso_0_10"
  ];
  const st = getBaseState(true);
  keys.forEach(k=>{
    const input = document.querySelector(`[data-key="${k}"]`);
    if (input){
      if (input.type==="checkbox") input.checked = false;
      else input.value = "";
    }
    // state
    deepSet(st, k, (k.includes("_0_10") || k.includes("perfil.")) ? 0 : (k.includes("m8.") ? false : ""));
  });
  saveBaseState(st);
  updateModule8Visibility();
  saveAndRefresh(window.__extras);
  toast("Sección 8 vaciada");
}

function module8ToMotor(){
  // convierte positivos → hipótesis + tareas + próxima sesión
  const st = getMergedState();
  const extras = window.__extras;

  // hipótesis base por reglas (activar sugerencias relevantes)
  const sug = getHypothesisSuggestions(st);

  // toma las que se disparen por módulo 8 (dominios variados), respeta límite por modo
  const limit = MODE==="full" ? 5 : 2;
  let count = extras.hypotheses.filter(h=>h.active).length;

  for (const s of sug){
    if (count >= limit) break;
    const exists = extras.hypotheses.some(h => (h.title||"") === (s.title||""));
    if (!exists){
      addHypothesisFromSuggestion(s);
      count++;
    }
  }

  // tareas asociadas (gatillos)
  // urinario
  if (st?.m8?.urinario_esfuerzo || st?.m8?.urinario_urgencia || st?.m8?.urinario_sin_causa){
    ensureTask(extras.tasks.usuaria, "Registro 2–3 días: frecuencia, urgencia, escapes y gatillantes", "Media");
    ensureTask(extras.tasks.kine, "Revisar síntomas urinarios y ajustar plan", "Alta");
    ensureNext("Reevaluar urinario: puntaje ICIQ-UI SF + situaciones de escape/urgencia", "Alta");
  }
  // dispareunia
  if (st?.m8?.dolor_relaciones){
    ensureTask(extras.tasks.usuaria, "Registrar contexto del dolor en relaciones (qué, cuándo, qué ayudó)", "Alta");
    ensureTask(extras.tasks.usuaria, "Practicar relajación del piso pélvico (según plan)", "Media");
    ensureTask(extras.tasks.kine, "Revisar escala de Marinoff + tolerancia y ajustar enfoque", "Alta");
    ensureNext("Reevaluar dolor en relaciones (0–10) + Marinoff (0–3)", "Alta");
  }
  // dolor pélvico
  if (st?.m8?.dolor_pelvico){
    ensureTask(extras.tasks.usuaria, "Registrar patrón del dolor pélvico (gatillantes, alivios, 24h)", "Media");
    ensureTask(extras.tasks.kine, "Revisar irritabilidad del dolor pélvico + ajustar progresión", "Media");
    ensureNext("Reevaluar dolor pélvico/vulvar (0–10) + tolerancia a actividades", "Alta");
  }
  // intestinal
  if (st?.m8?.estrenimiento || st?.m8?.perdida_heces_gases){
    ensureTask(extras.tasks.usuaria, "Registrar hábitos intestinales (frecuencia, tipo de heces, urgencia, pujo)", "Media");
    ensureTask(extras.tasks.kine, "Revisar factores intestinales y su relación con síntomas", "Media");
    ensureNext("Reevaluar síntomas intestinales (0–10) + hábitos", "Media");
  }
  // bulto/peso
  if (st?.m8?.bulto_peso){
    ensureTask(extras.tasks.usuaria, "Registrar cuándo aparece pesadez/bulto (carga, final del día) y qué alivia", "Media");
    ensureNext("Reevaluar pesadez/bulto (0–10) + relación con carga", "Media");
  }

  saveExtras(extras);
  renderMotorSections();
  saveAndRefresh(extras);
  toast("Hipótesis y tareas agregadas desde sección 8");
}

/* =======================
   MÓDULO 9 – Tracto urinario inferior (por pregunta)
   - Urgencia: checkbox + 0–10 + gatillantes
   - Frecuencia: checkbox + número + hábitos
   - Nicturia: checkbox + número + hábitos
   - Incontinencia: checkbox + tipo (esfuerzo/urgencia/mixta) + situaciones
   - ICIQ-UI SF: checkbox + 0–21 + interpretación + link
   - Botón “Añadir hipótesis y tareas” + “Vaciar sección”
======================= */

function renderModule9(card){
  const wrap = el("div",{"data-module9":"true"},[]);

  wrap.appendChild(renderUroRow({
    key:"m9.urgencia",
    label:"Urgencia",
    severityKey:"m9.urgencia_0_10",
    severityLabel:"Urgencia (0–10)",
    detailsKey:"m9.urgencia_detalles",
    detailsPlaceholder:"Describe gatillantes (llegar a casa, agua, frío), control y estrategias."
  }));

  wrap.appendChild(renderUroNumberRow({
    key:"m9.frecuencia_aplica",
    label:"Frecuencia urinaria",
    numberKey:"m9.frecuencia_dia",
    numberLabel:"¿Cuántas veces al día?",
    detailsKey:"m9.frecuencia_notas",
    detailsPlaceholder:"Notas de hábitos (líquidos, horarios, irritantes)."
  }));

  wrap.appendChild(renderUroNumberRow({
    key:"m9.nicturia_aplica",
    label:"Nicturia",
    numberKey:"m9.nicturia_noche",
    numberLabel:"Veces por noche",
    detailsKey:"m9.nicturia_notas",
    detailsPlaceholder:"Notas de hábitos (líquidos tarde, sueño, urgencia)."
  }));

  wrap.appendChild(renderUroIncontRow());

  wrap.appendChild(renderICIQRow());

  const btns = el("div",{style:"margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;"},[
    el("button",{class:"smallBtn primary", type:"button", onclick:()=>module9ToMotor()},["Añadir hipótesis y tareas"]),
    el("button",{class:"smallBtn", type:"button", onclick:()=>clearModule9()},["Vaciar sección"]),
  ]);
  wrap.appendChild(btns);

  card.appendChild(wrap);

  setTimeout(()=>updateModule9Visibility(), 0);
}

function renderUroRow(cfg){
  const row = el("div",{class:"symRow", "data-uro-row":cfg.key},[]);
  row.appendChild(el("div",{class:"symHead"},[
    el("div",{class:"symLeft"},[
      el("input",{type:"checkbox","data-key":cfg.key, "data-uro-toggle":"true"}),
      el("span",{},[cfg.label])
    ])
  ]));

  const extras = el("div",{class:"symExtras hidden", "data-uro-extras-for":cfg.key},[]);

  const rangeBox = el("div",{class:"rangeBox"},[
    el("div",{class:"rangeTop"},[
      el("div",{},[cfg.severityLabel]),
      el("div",{class:"rangeValue", "data-range-value": cfg.severityKey},["0 · 0"])
    ]),
    el("input",{type:"range", min:"0", max:"10", step:"1", value:"0", "data-key":cfg.severityKey})
  ]);
  extras.appendChild(rangeBox);

  extras.appendChild(el("div",{class:"field"},[
    el("label",{},["Describe (específico)"]),
    el("textarea",{rows:"2","data-key":cfg.detailsKey, placeholder:cfg.detailsPlaceholder},[])
  ]));

  row.appendChild(extras);
  return row;
}

function renderUroNumberRow(cfg){
  const row = el("div",{class:"symRow", "data-uro-row":cfg.key},[]);
  row.appendChild(el("div",{class:"symHead"},[
    el("div",{class:"symLeft"},[
      el("input",{type:"checkbox","data-key":cfg.key, "data-uro-toggle":"true"}),
      el("span",{},[cfg.label])
    ])
  ]));

  const extras = el("div",{class:"symExtras hidden", "data-uro-extras-for":cfg.key},[]);

  extras.appendChild(el("div",{class:"field"},[
    el("label",{},[cfg.numberLabel]),
    el("input",{type:"number","data-key":cfg.numberKey, min:"0", max:"60"})
  ]));

  extras.appendChild(el("div",{class:"field"},[
    el("label",{},["Notas de hábitos"]),
    el("textarea",{rows:"2","data-key":cfg.detailsKey, placeholder:cfg.detailsPlaceholder},[])
  ]));

  row.appendChild(extras);
  return row;
}

function renderUroIncontRow(){
  const key = "m9.incontinencia";
  const row = el("div",{class:"symRow", "data-uro-row":key},[]);
  row.appendChild(el("div",{class:"symHead"},[
    el("div",{class:"symLeft"},[
      el("input",{type:"checkbox","data-key":key, "data-uro-toggle":"true"}),
      el("span",{},["Incontinencia"])
    ])
  ]));

  const extras = el("div",{class:"symExtras hidden", "data-uro-extras-for":key},[]);

  extras.appendChild(el("div",{class:"field"},[
    el("label",{},["Tipo (si aplica)"]),
    el("select",{"data-key":"m9.incontinencia_tipo"},[
      el("option",{value:""},["—"]),
      el("option",{value:"Esfuerzo"},["Esfuerzo"]),
      el("option",{value:"Urgencia"},["Urgencia"]),
      el("option",{value:"Mixta"},["Mixta"]),
    ])
  ]));

  extras.appendChild(el("div",{class:"field"},[
    el("label",{},["Situaciones de escape (describe)"]),
    el("textarea",{rows:"2","data-key":"m9.incontinencia_situaciones", placeholder:"Ej: al saltar, al toser, al llegar a casa, etc."},[])
  ]));

  row.appendChild(extras);
  return row;
}

function renderICIQRow(){
  const key = "out.iciq_aplicar";

  const row = el("div",{class:"symRow", "data-uro-row":key},[]);
  row.appendChild(el("div",{class:"symHead"},[
    el("div",{class:"symLeft"},[
      el("input",{type:"checkbox","data-key":key, "data-uro-toggle":"true"}),
      el("div",{class:"symLabel"},["ICIQ-UI SF (0–21) · (si aplica)"])
    ]),
    el("div",{class:"symRight"},[
      el("span",{class:"tag"},["Escala validada"]),
      (()=> {
        const a = document.createElement("a");
        a.href = "https://iciq.net/iciq-ui-sf";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Abrir cuestionario";
        a.style.color = "var(--terra)";
        a.style.fontWeight = "800";
        a.style.textDecoration = "underline";
        return a;
      })()
    ])
  ]));

  const extras = el("div",{class:"symExtras hidden", "data-uro-extras-for":key},[
    el("div",{class:"symGrid"},[
      el("div",{class:"rangeCompact"},[
        el("div",{class:"rangeTop"},[
          el("div",{},["Puntaje ICIQ-UI SF"]),
          el("div",{class:"rangeValue", "data-iciq-label":"true"},["—"])
        ]),
        el("input",{type:"number","data-key":"out.iciq_score", min:"0", max:"21", placeholder:"0–21",
          style:"margin-top:10px; width:100%; padding:10px; border-radius:14px; border:1px solid rgba(16,32,36,.18); background:rgba(255,255,255,.70); font-weight:700;"
        })
      ]),
      el("div",{class:"field"},[
        el("label",{},["Situaciones / contexto (opcional)"]),
        el("textarea",{rows:"2","data-key":"out.iciq_contexto", placeholder:"Describe situaciones de escape/urgencia (si aplica)."},[])
      ])
    ])
  ]);

  row.appendChild(extras);
  return row;
}


function updateModule9Visibility(){
  const st = getMergedState();

  const toggles = $$("[data-uro-toggle]");
  toggles.forEach(t=>{
    const key = t.getAttribute("data-key");
    const on = !!deepGet(st, key);
    const extras = document.querySelector(`[data-uro-extras-for="${key}"]`);
    if (extras) extras.classList.toggle("hidden", !on);
  });

  // etiquetas de rango + interpretación
  const setRangeLabel = (key) => {
    const v = Number(deepGet(st, key) || 0);
    const badge = document.querySelector(`[data-range-value="${key}"]`);
    if (badge) badge.textContent = `${v} · ${levelFrom010(v)}`;
  };
  setRangeLabel("m9.urgencia_0_10");

  // ICIQ etiqueta
  const iciqOn = !!deepGet(st,"m9.iciq_aplicar");
  const iciqScore = Number(deepGet(st,"m9.iciq_score"));
  const lab = $("[data-iciq-label]");
  if (lab){
    if (!iciqOn) lab.textContent = "Interpretación: —";
    else lab.textContent = `Interpretación: ${iciqInterpret(iciqScore)}`;
  }
}

function clearModule9(){
  const keys = [
    "m9.urgencia","m9.urgencia_0_10","m9.urgencia_detalles",
    "m9.frecuencia_aplica","m9.frecuencia_dia","m9.frecuencia_notas",
    "m9.nicturia_aplica","m9.nicturia_noche","m9.nicturia_notas",
    "m9.incontinencia","m9.incontinencia_tipo","m9.incontinencia_situaciones",
    "m9.iciq_aplicar","m9.iciq_score"
  ];
  const st = getBaseState(true);
  keys.forEach(k=>{
    const input = document.querySelector(`[data-key="${k}"]`);
    if (input){
      if (input.type==="checkbox") input.checked = false;
      else input.value = "";
    }
    if (k.endsWith("_0_10") || k.endsWith("_dia") || k.endsWith("_noche") || k.endsWith("_score")) deepSet(st,k,0);
    else deepSet(st,k,false);
  });
  saveBaseState(st);
  updateModule9Visibility();
  saveAndRefresh(window.__extras);
  toast("Sección 9 vaciada");
}

function module9ToMotor(){
  const st = getMergedState();
  const extras = window.__extras;

  // Si hay ICIQ, lo usamos como evidencia
  if (st?.m9?.iciq_aplicar){
    ensureTask(extras.tasks.kine, "Revisar puntaje ICIQ-UI SF y ajustar plan", "Alta");
    ensureNext("Reevaluar puntaje ICIQ-UI SF (0–21) y su interpretación", "Alta");
  }

  // Urgencia/frecuencia/nicturia/incontinencia → hipótesis + tareas
  const hasUro = !!st?.m9?.urgencia || !!st?.m9?.frecuencia_aplica || !!st?.m9?.nicturia_aplica || !!st?.m9?.incontinencia;
  if (hasUro){
    // activar sugerencias relevantes
    const sug = getHypothesisSuggestions(st);
    const limit = MODE==="full" ? 5 : 2;
    let count = extras.hypotheses.filter(h=>h.active).length;
    for (const s of sug){
      if (count >= limit) break;
      const exists = extras.hypotheses.some(h => (h.title||"") === (s.title||""));
      if (!exists){
        addHypothesisFromSuggestion(s);
        count++;
      }
    }
    ensureTask(extras.tasks.usuaria, "Registro 2–3 días: frecuencia, urgencia, escapes y gatillantes", "Media");
    ensureTask(extras.tasks.kine, "Revisar patrones urinarios y gatillantes; ajustar estrategias", "Alta");
    ensureNext("Reevaluar síntomas urinarios (0–10) + hábitos + escapes", "Alta");
  }

  saveExtras(extras);
  renderMotorSections();
  saveAndRefresh(extras);
  toast("Hipótesis y tareas agregadas desde sección 9");
}

/* =======================
   Examen: mostrar/ocultar subcampos si examen intracavitario = Sí
======================= */

function renderExamConditional(card){
  const btn = el("button",{class:"smallBtn primary", type:"button", onclick:()=>convertExamToHypotheses()},[
    "Convertir hallazgos en hipótesis"
  ]);
  card.appendChild(el("div",{style:"margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;"},[btn]));
  setTimeout(()=>updateExamConditionalVisibility(),0);
}

function updateExamConditionalVisibility(){
  const st = getMergedState();
  const val = String(st?.cons?.interno || "");
  const yes = val.includes("Sí");
  // Subcampos ya están siempre, pero acá podrías ocultar algunos si quisieras.
  // Por requerimiento, se muestran cuando es “Sí” -> dejamos un aviso visual.
  // (Implementación simple: si no es Sí, no toca.)
  return yes;
}

/* =======================
   Motor: hipótesis (reglas + sin siglas/inglés en títulos)
======================= */

function autoEvidence(st, keys){
  const lines = [];
  keys.forEach(k=>{
    const v = deepGet(st, k);
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    if (s === "false" || s === "False") return;
    lines.push(`${k}: ${s}`);
  });
  return lines.slice(0,10).join("\n");
}

function marinoffExplain(m){
  const map = {
    0:"0 (sin dolor)",
    1:"1 (disconfort no impide)",
    2:"2 (dolor que interrumpe ocasionalmente)",
    3:"3 (dolor que impide siempre)"
  };
  return map[m] || "—";
}

function getHypothesisSuggestions(st){
  const sug = [];

  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const iciqOn = !!st?.m9?.iciq_aplicar;
  const iciqScore = Number(st?.m9?.iciq_score);
  const dysp = !!st?.m8?.dolor_relaciones;
  const marinoff = Number(st?.m8?.marinoff);
  const pelvicPain = !!st?.m8?.dolor_pelvico;
  const urg = !!st?.m8?.urinario_urgencia || !!st?.m9?.urgencia;
  const effort = !!st?.m8?.urinario_esfuerzo;
  const incont = !!st?.m9?.incontinencia;
  const gs = !!st?.ciclo?.gsm;

  // URINARIO: ICIQ alto + evidencia -> hipótesis y tareas
  if (effort || urg || incont || iciqOn){
    const interp = iciqOn ? `Puntaje ICIQ-UI SF: ${Number.isFinite(iciqScore)?iciqScore:"—"}/21 (${iciqInterpret(iciqScore)})` : "";
    sug.push({
      domain:"Músculo",
      title:`Síntomas urinarios con impacto. ${interp}`.trim(),
      evidence: autoEvidence(st, [
        "m8.urinario_esfuerzo","m8.urinario_esfuerzo_0_10","m8.urinario_esfuerzo_detalles",
        "m8.urinario_urgencia","m8.urinario_urgencia_0_10","m8.urinario_urgencia_detalles",
        "m9.incontinencia","m9.incontinencia_tipo","m9.incontinencia_situaciones",
        "m9.frecuencia_dia","m9.nicturia_noche","m9.iciq_score"
      ]),
      toConfirm:[
        "Gatillantes (esfuerzo vs urgencia)",
        "Patrón de ingesta/horarios/irritantes",
        "Relación con estreñimiento",
        "Estrategia de presión en esfuerzo"
      ],
      interventions:"Entrenamiento supervisado del piso pélvico + educación de hábitos + estrategias para urgencia (editable).",
      priority:"Alta",
      confidence:"Media"
    });

    if (urg){
      sug.push({
        domain:"Hábitos/Comportamiento",
        title:"Componente de urgencia: gatillantes y control. Enfoque en hábitos, respiración y estrategias de urgencia.",
        evidence:autoEvidence(st, ["m8.urinario_urgencia_0_10","m8.urinario_urgencia_detalles","m9.urgencia_0_10","m9.urgencia_detalles","m9.frecuencia_dia","m9.nicturia_noche"]),
        toConfirm:["Irritantes","Volumen","Estrategias actuales","Ansiedad/estrés como modulador"],
        interventions:"Registro breve + educación + estrategias de urgencia (editable).",
        priority:"Alta",
        confidence:"Media"
      });
    }
  }

  // DISPAREUNIA: Marinoff 2–3 -> hipótesis funcional
  if (dysp){
    const m = Number.isFinite(marinoff) ? marinoff : null;
    sug.push({
      domain:"Tejidos",
      title:`Dolor en relaciones con impacto funcional: evaluar contribución de irritabilidad de tejidos y/o hiperactividad del piso pélvico. ${m!==null?`Marinoff: ${marinoffExplain(m)}`:""}`.trim(),
      evidence:autoEvidence(st, ["m8.dolor_relaciones_0_10","m8.dolor_relaciones_detalles","m8.marinoff","ciclo.gsm","ciclo.gsm_detalles"]),
      toConfirm:["Localización (entrada vs profundo)","Momento (entrada/fricción/post)","Sequedad/ardor","Respuesta a lubricante/descanso"],
      interventions:"Relajación del piso pélvico + educación (lubricación/ritmo/posiciones) + exposición gradual no dolorosa (editable).",
      priority:"Alta",
      confidence:"Media"
    });

    if (m !== null && m >= 2){
      sug.push({
        domain:"Carga/Impacto",
        title:`Tolerancia a penetración limitada (Marinoff ${m}) – priorizar estrategia gradual antes de progresión invasiva.`,
        evidence:autoEvidence(st, ["m8.marinoff","m8.dolor_relaciones_0_10"]),
        toConfirm:["Tolerancia actual","Barreras y seguridad percibida","Qué mejora/empeora"],
        interventions:"Plan gradual con objetivos semanales + registro de tolerancia (editable).",
        priority:"Alta",
        confidence:"Media"
      });
    }
  }

  // Dolor pélvico/vulvar crónico
  if (pelvicPain){
    sug.push({
      domain:"Factores moduladores",
      title:"Dolor pélvico/vulvar persistente: explorar irritabilidad, sensibilidad y factores moduladores (estrés, sueño, miedo-evitación).",
      evidence:autoEvidence(st, ["m8.dolor_pelvico_0_10","m8.dolor_pelvico_detalles","medicion.sintoma_0_10","motivo.historia"]),
      toConfirm:["Irritabilidad (qué lo gatilla)","Sueño/estrés","Evitar actividades","Respuesta a relajación"],
      interventions:"Educación + relajación del piso pélvico + progresión gradual por tolerancia (editable).",
      priority:"Media",
      confidence:"Baja"
    });
  }

  // Postparto
  if (ppw > 0){
    sug.push({
      domain:"Tejidos",
      title:"Postparto: recuperación tisular y neuromuscular en curso; progresión por tolerancia.",
      evidence:autoEvidence(st, ["ciclo.postparto_semanas","go.desgarros_epi","m8.bulto_peso_0_10","m8.urinario_esfuerzo_0_10"]),
      toConfirm:["Síntomas durante/24h post carga","Pesadez/escape/dolor mod-severo"],
      interventions:"Respiración + coordinación + fuerza funcional gradual (editable).",
      priority:"Alta",
      confidence:"Alta"
    });

    if (ppw < 6){
      sug.push({
        domain:"Carga/Impacto",
        title:"Postparto <6 semanas: limitar impacto alto; priorizar control y carga baja.",
        evidence:autoEvidence(st, ["ciclo.postparto_semanas"]),
        toConfirm:["Tolerancia a caminata/actividades diarias","Señales de stop"],
        interventions:"Bajo impacto + coordinación (editable).",
        priority:"Alta",
        confidence:"Alta"
      });
    }
  }

  // GSM
  if (gs){
    sug.push({
      domain:"Tejidos",
      title:"Síntomas compatibles con GSM: considerar cuidado de tejidos + coordinación del piso pélvico + coordinación con profesional médico si corresponde.",
      evidence:autoEvidence(st, ["ciclo.gsm","ciclo.gsm_detalles","m8.dolor_relaciones_0_10","m8.dolor_relaciones_detalles"]),
      toConfirm:["Sequedad/ardor/disuria","Respuesta a lubricante","Barreras de actividad"],
      interventions:"Educación + cuidado de tejidos + progresión según tolerancia (editable).",
      priority:"Alta",
      confidence:"Media"
    });
  }

  // Músculo-esquelético (si ON)
  const extras = window.__extras || ExtrasDefault();
  if (extras.settings.musculoEsqOn){
    const pres = st?.me?.presion;
    const cadera = st?.me?.cadera;
    const dra = st?.me?.pared_abdominal;
    const impact = st?.me?.tol_impacto;

    if (pres === "Sospecha disfunción"){
      sug.push({
        domain:"Hábitos/Comportamiento",
        title:"Estrategia de presión/respiración puede contribuir a síntomas pélvicos con esfuerzo.",
        evidence:autoEvidence(st, ["me.presion","me.presion_detalles","m8.urinario_esfuerzo_detalles","m8.bulto_peso_detalles"]),
        toConfirm:["Apnea/empuje en esfuerzos","Cambios al enseñar exhalación"],
        interventions:"Exhalación en esfuerzo + coordinación del piso pélvico (editable).",
        priority:"Media",
        confidence:"Media"
      });
    }
    if (cadera && cadera !== "OK" && cadera !== "—"){
      sug.push({
        domain:"Carga/Impacto",
        title:"Control de cadera y carga lumbopélvica pueden influir en tolerancia a carga/impacto.",
        evidence:autoEvidence(st, ["me.cadera","me.cadera_detalles","me.test1","me.test1_estado","me.test1_detalles"]),
        toConfirm:["Patrones alterados","Síntomas con sentadilla/bisagra/step-down"],
        interventions:"Fuerza de cadera + reeducación de patrón con exhalación (editable).",
        priority:"Media",
        confidence:"Baja"
      });
    }
    if (dra && (dra==="Sospecha" || dra==="Confirmada")){
      sug.push({
        domain:"Músculo",
        title:"Pared abdominal: su capacidad puede condicionar progresión de carga/impacto (postparto).",
        evidence:autoEvidence(st, ["me.pared_abdominal","me.pared_detalles","ciclo.postparto_semanas"]),
        toConfirm:["Estrategia de presión","Síntomas con carga"],
        interventions:"Core progresivo + fuerza funcional gradual (editable).",
        priority:"Media",
        confidence:"Media"
      });
    }
    if (impact === "Baja"){
      sug.push({
        domain:"Carga/Impacto",
        title:"Tolerancia a impacto baja: progresión por criterio; diferir impacto si hay síntomas pélvicos.",
        evidence:autoEvidence(st, ["me.tol_impacto","me.tol_detalles","m8.bulto_peso_0_10","m8.urinario_esfuerzo_0_10"]),
        toConfirm:["Señales durante/24h","Qué gatilla"],
        interventions:"Bajo impacto + fuerza + criterios de progresión (editable).",
        priority:"Media",
        confidence:"Media"
      });
    }
  }

  return sug;
}

function addHypothesisFromSuggestion(s){
  const extras = window.__extras;
  const limit = MODE==="full" ? 5 : 2;
  const activeCount = extras.hypotheses.filter(h=>h.active).length;
  if (activeCount >= limit){
    toast(`Límite de hipótesis activas por modo: ${limit}`);
    return;
  }

  extras.hypotheses.push({
    id: uid("hyp"),
    domain: s.domain,
    title: s.title,
    evidence: s.evidence || "",
    toConfirm: (s.toConfirm || []).map(x=>"• "+x).join("\n"),
    interventions: s.interventions || "",
    priority: s.priority || "Media",
    confidence: s.confidence || "Baja",
    notes: "",
    active: true,
    createdFrom: "auto"
  });

  // tareas por hipótesis (predeterminadas, editables)
  seedTasksFromHypothesisTitle(s.title);

  // próxima sesión: escalas asociadas
  seedNextFromHypothesisTitle(s.title);

  saveExtras(extras);
  renderMotorSections();
}

function seedTasksFromHypothesisTitle(title){
  const extras = window.__extras;
  const t = String(title || "").toLowerCase();

  if (t.includes("urinario") || t.includes("urgencia") || t.includes("pérdidas")){
    ensureTask(extras.tasks.usuaria, "Registro 2–3 días: frecuencia, urgencia, escapes y gatillantes", "Media");
    ensureTask(extras.tasks.kine, "Revisar patrones urinarios e identificar gatillantes", "Alta");
  }
  if (t.includes("dolor en relaciones") || t.includes("dispareunia") || t.includes("marinoff")){
    ensureTask(extras.tasks.usuaria, "Practicar relajación del piso pélvico según plan", "Media");
    ensureTask(extras.tasks.usuaria, "Registrar contexto del dolor en relaciones (qué, cuándo, qué ayudó)", "Alta");
    ensureTask(extras.tasks.kine, "Revisar tolerancia y ajustar exposición gradual si corresponde", "Alta");
  }
  if (t.includes("dolor pélvico") || t.includes("vulvar")){
    ensureTask(extras.tasks.usuaria, "Registrar patrón del dolor (gatillantes, alivios, 24h)", "Media");
    ensureTask(extras.tasks.kine, "Revisar irritabilidad y ajustar progresión", "Media");
  }
  if (t.includes("postparto")){
    ensureTask(extras.tasks.usuaria, "Monitorear señales durante ejercicio (pesadez, escapes, dolor que persiste)", "Alta");
    ensureTask(extras.tasks.kine, "Definir criterio de progresión según semanas postparto", "Alta");
  }
  if (t.includes("gsm")){
    ensureTask(extras.tasks.usuaria, "Aplicar estrategias de cuidado de tejidos (lubricación/ritmo) y registrar respuesta", "Media");
    ensureTask(extras.tasks.kine, "Considerar coordinación/derivación médica si corresponde", "Media");
  }
}

function seedNextFromHypothesisTitle(title){
  const t = String(title || "").toLowerCase();
  if (t.includes("iciq")){
    ensureNext("Reevaluar puntaje ICIQ-UI SF (0–21) y su interpretación", "Alta");
  }
  if (t.includes("marinoff") || t.includes("relaciones") || t.includes("dispareunia")){
    ensureNext("Reevaluar dolor en relaciones (0–10) + Marinoff (0–3)", "Alta");
  }
  if (t.includes("dolor pélvico") || t.includes("vulvar")){
    ensureNext("Reevaluar dolor pélvico/vulvar (0–10) + tolerancia a actividades", "Alta");
  }
  if (t.includes("impacto") || t.includes("carga")){
    ensureNext("Reevaluar tolerancia a carga/impacto (durante y 24h) + síntomas pélvicos", "Media");
  }
}

function addBlankHypothesis(domain){
  const extras = window.__extras;
  extras.hypotheses.push({
    id: uid("hyp"),
    domain,
    title: "",
    evidence: "",
    toConfirm: "",
    interventions: "",
    priority: "Media",
    confidence: "Baja",
    notes: "",
    active: true,
    createdFrom: "manual"
  });
  saveExtras(extras);
  renderMotorSections();
}

function removeHypothesis(id){
  const extras = window.__extras;
  extras.hypotheses = extras.hypotheses.filter(h=>h.id !== id);
  saveExtras(extras);
  renderMotorSections();
}

function updateHypothesis(id, patch){
  const extras = window.__extras;
  const h = extras.hypotheses.find(x=>x.id===id);
  if (!h) return;
  Object.assign(h, patch);
  saveExtras(extras);
  renderMotorSections();
}

function select(opts, value, onChange){
  const s = el("select",{onchange:(e)=>onChange(e.target.value)},[]);
  opts.forEach(o=>{
    const op = el("option",{value:o},[o]);
    if (o===value) op.selected = true;
    s.appendChild(op);
  });
  return s;
}

function renderHypotheses(card){
  card.appendChild(el("div",{class:"tabs", id:"hypTabs"},[
    tabBtn("Músculo"),
    tabBtn("Tejidos"),
    tabBtn("Carga/Impacto"),
    tabBtn("Hábitos/Comportamiento"),
    tabBtn("Factores moduladores"),
  ]));

  card.appendChild(el("div",{class:"cardRow", id:"hypBody"},[]));
  renderHypothesesBody();
}

function tabBtn(name){
  const extras = window.__extras;
  const active = extras.settings.activeHypTab === name;
  return el("button",{class:`tab ${active?"active":""}`, type:"button", onclick:()=>{
    extras.settings.activeHypTab = name;
    saveExtras(extras);
    renderHypothesesBody();
  }},[name]);
}

function renderHypothesesBody(){
  const extras = window.__extras;
  const st = getMergedState();
  const activeTab = extras.settings.activeHypTab;

  $$("#hypTabs .tab").forEach(t=>{
    t.classList.toggle("active", t.textContent === activeTab);
  });

  const body = $("#hypBody");
  if (!body) return;
  body.innerHTML = "";

  const left = el("div",{class:"hCard"},[]);
  left.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Sugerencias (activar)"]),
      el("div",{class:"itemSub"},[
        MODE==="full" ? "Modo completo: hasta 5 hipótesis activas." : "Modo 10 min: hasta 2 hipótesis activas."
      ])
    ]),
    el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>addBlankHypothesis(activeTab)},["+ Añadir manual"])
    ])
  ]));

  const suggestions = getHypothesisSuggestions(st).filter(s=>s.domain===activeTab);
  if (!suggestions.length){
    left.appendChild(el("div",{class:"itemSub", style:"margin-top:10px;"},[
      "No hay sugerencias automáticas para este dominio con lo llenado hoy."
    ]));
  } else {
    suggestions.forEach(s=>{
      left.appendChild(el("div",{class:"item"},[
        el("div",{class:"itemHead"},[
          el("div",{},[
            el("div",{class:"itemTitle"},[s.title]),
            el("div",{class:"itemSub"},["Evidencia auto: " + (s.evidence ? "sí" : "—")])
          ]),
          el("button",{class:"smallBtn primary", type:"button", onclick:()=>addHypothesisFromSuggestion(s)},["Activar"])
        ]),
        el("div",{style:"margin-top:10px;"},[
          el("div",{class:"itemSub"},["Qué buscar (checklist):"]),
          el("div",{style:"white-space:pre-wrap; font-weight:600; font-size:12px; border:1px solid rgba(16,32,36,.14); background:rgba(217,203,179,.25); padding:10px; border-radius:14px;"},[
            (s.toConfirm||[]).map(x=>"• "+x).join("\n")
          ])
        ])
      ]));
    });
  }

  const right = el("div",{class:"hCard"},[]);
  right.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Hipótesis activas (editables)"]),
      el("div",{class:"itemSub"},["Edita título, evidencia, qué buscar, intervención, prioridad y confianza."])
    ]),
  ]));

  const list = extras.hypotheses.filter(h=>h.domain===activeTab);
  if (!list.length){
    right.appendChild(el("div",{class:"itemSub", style:"margin-top:10px;"},[
      "Aún no hay hipótesis activas en este dominio."
    ]));
  } else {
    list.forEach(h=> right.appendChild(renderHypothesisCard(h)));
  }

  body.appendChild(left);
  body.appendChild(right);
}

function renderHypothesisCard(h){
  return el("div",{class:"item"},[
    el("div",{class:"itemHead"},[
      el("div",{},[
        el("div",{class:"itemTitle"},[h.title || "(sin título)"]),
        el("div",{class:"itemSub"},[`Dominio: ${h.domain} · ${h.createdFrom}`])
      ]),
      el("button",{class:"smallBtn danger", type:"button", onclick:()=>removeHypothesis(h.id)},["Eliminar"])
    ]),
    el("div",{class:"itemRow"},[
      el("div",{class:"field"},[
        el("label",{},["Título"]),
        el("input",{value:h.title || "", oninput:(e)=>updateHypothesis(h.id,{title:e.target.value})})
      ]),
      el("div",{style:"display:grid; gap:10px;"},[
        el("div",{class:"field"},[
          el("label",{},["Prioridad"]),
          select(["Alta","Media","Baja"], h.priority, (v)=>updateHypothesis(h.id,{priority:v}))
        ]),
        el("div",{class:"field"},[
          el("label",{},["Confianza"]),
          select(["Alta","Media","Baja"], h.confidence, (v)=>updateHypothesis(h.id,{confidence:v}))
        ]),
      ])
    ]),
    el("div",{class:"itemRow"},[
      el("div",{class:"field"},[
        el("label",{},["Evidencia/observación (auto + editable)"]),
        el("textarea",{rows:"4", oninput:(e)=>updateHypothesis(h.id,{evidence:e.target.value})},[h.evidence||""])
      ]),
      el("div",{class:"field"},[
        el("label",{},["Qué buscar para confirmarla"]),
        el("textarea",{rows:"4", oninput:(e)=>updateHypothesis(h.id,{toConfirm:e.target.value})},[h.toConfirm||""])
      ]),
    ]),
    el("div",{class:"itemRow"},[
      el("div",{class:"field"},[
        el("label",{},["Intervención sugerida (editable)"]),
        el("textarea",{rows:"3", oninput:(e)=>updateHypothesis(h.id,{interventions:e.target.value})},[h.interventions||""])
      ]),
      el("div",{class:"field"},[
        el("label",{},["Notas (barreras, acuerdos, tolerancia)"]),
        el("textarea",{rows:"3", oninput:(e)=>updateHypothesis(h.id,{notes:e.target.value})},[h.notes||""])
      ]),
    ])
  ]);
}

/* =======================
   Motor: ejercicios + autoplan (respetando modo)
======================= */

function stageFromState(st){
  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const gw  = Number(st?.ciclo?.embarazo_semanas || 0);
  if (gw > 0) return "embarazo";
  if (ppw > 0){
    if (ppw < 2) return "postparto_0_2";
    if (ppw < 4) return "postparto_2_4";
    if (ppw < 6) return "postparto_4_6";
    if (ppw < 8) return "postparto_6_8";
    if (ppw < 12) return "postparto_8_12";
    return "postparto_12plus";
  }
  if (!!st?.ciclo?.gsm) return "menopausia";
  return "general";
}

function renderExercises(card){
  const st = getMergedState();

  const top = el("div",{style:"display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;"},[
    el("div",{class:"itemSub"},[
      `Etapa detectada: ${stageFromState(st)} · Modo: ${MODE==="full"?"Completo":"10 min"}`
    ]),
    el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>autoplan()},["Autoplan"]),
      el("button",{class:"smallBtn", type:"button", onclick:()=>clearPlan()},["Vaciar plan"])
    ])
  ]);
  card.appendChild(top);

  card.appendChild(el("div",{class:"cardRow", id:"exBody"},[]));
  renderExercisesBody();
}

function renderExercisesBody(){
  const extras = window.__extras;
  const st = getMergedState();
  const body = $("#exBody");
  if (!body) return;
  body.innerHTML = "";

  // estado UI: mostrar más
  extras.settings.showAllExercises = !!extras.settings.showAllExercises;

  const stage = stageFromState(st);
  const poolAll = EXERCISES.filter(ex => ex.stage.includes(stage) || ex.stage.includes("general"));

  // en modo 10 min, por defecto mostramos poco (más “boutique”)
  const pool = (MODE==="10" && !extras.settings.showAllExercises) ? poolAll.slice(0, 6) : poolAll;

  const left = el("div",{class:"hCard"},[]);
  left.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Biblioteca (liviana)"]),
      el("div",{class:"itemSub"},["Verás el detalle solo si lo abres."])
    ]),
    el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
      MODE==="10"
        ? el("button",{class:"chipBtn", type:"button", onclick:()=>{
            extras.settings.showAllExercises = !extras.settings.showAllExercises;
            saveExtras(extras);
            renderMotorSections();
          }},[extras.settings.showAllExercises ? "Mostrar menos" : "Mostrar más ejercicios"])
        : null
    ].filter(Boolean))
  ]));

  pool.forEach(ex=>{
    const row = el("div",{class:"eRow"},[]);
    const head = el("div",{class:"eHead"},[
      el("div",{},[
        el("div",{class:"eName"},[ex.name]),
        el("div",{class:"eOneLine"},[`Objetivo: ${ex.goal[0] || "—"} · Tolerancia: ${ex.tol}`])
      ]),
      el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
        el("button",{class:"smallBtn primary", type:"button", onclick:()=>addExercise(ex.id)},["Añadir"]),
        el("button",{class:"smallBtn", type:"button", onclick:()=>{ row.classList.toggle("open"); }},["Ver más"])
      ])
    ]);
    row.appendChild(head);

    const more = el("div",{class:"eMore"},[
      el("div",{style:"white-space:pre-wrap; font-size:12px; font-weight:600; border:1px solid rgba(16,32,36,.14); background:rgba(217,203,179,.20); padding:10px; border-radius:14px;"},[
        `Dosificación: ${ex.dose}\n\nCues:\n${ex.cues.map(c=>"• "+c).join("\n")}\n\nErrores:\n${ex.errors.map(c=>"• "+c).join("\n")}\n\nProgresión: ${ex.prog}`
      ])
    ]);
    row.appendChild(more);

    left.appendChild(row);
  });

  const right = el("div",{class:"hCard"},[]);
  right.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Plan de ejercicios (editable)"]),
      el("div",{class:"itemSub"},[ MODE==="full" ? "Sugerido: 5–7 ítems." : "Modo 10 min: máximo 3." ])
    ]),
  ]));

  const selected = extras.exercisePlan.selectedIds.map(id=> EXERCISES.find(e=>e.id===id)).filter(Boolean);
  if (!selected.length){
    right.appendChild(el("div",{class:"itemSub", style:"margin-top:10px;"},["Aún no hay ejercicios seleccionados."]));
  } else {
    selected.forEach(ex=> right.appendChild(renderSelectedExercise(ex)));
  }

  right.appendChild(el("div",{class:"field"},[
    el("label",{},["Notas del plan (kinesióloga)"]),
    el("textarea",{rows:"2", oninput:(e)=>{ extras.exercisePlan.notes = e.target.value; saveExtras(extras); }},[extras.exercisePlan.notes || ""])
  ]));

  body.appendChild(left);
  body.appendChild(right);
}


function addExercise(exId){
  const extras = window.__extras;
  const limit = MODE==="full" ? 7 : 3;
  if (extras.exercisePlan.selectedIds.includes(exId)) return;
  if (extras.exercisePlan.selectedIds.length >= limit){
    toast(`Límite de ejercicios por modo: ${limit}`);
    return;
  }
  extras.exercisePlan.selectedIds.push(exId);

  // tareas automáticas por ejercicio
  const ex = EXERCISES.find(e=>e.id===exId);
  ensureTask(extras.tasks.usuaria, `Realizar plan en casa: ${ex ? ex.name : exId}`, "Media");
  ensureTask(extras.tasks.usuaria, "Registrar síntomas (durante y 24h) al hacer el plan", "Alta");

  saveExtras(extras);
  renderMotorSections();
}

function removeExercise(exId){
  const extras = window.__extras;
  extras.exercisePlan.selectedIds = extras.exercisePlan.selectedIds.filter(id=>id!==exId);
  saveExtras(extras);
  renderMotorSections();
}

function renderSelectedExercise(ex){
  return el("div",{class:"item"},[
    el("div",{class:"itemHead"},[
      el("div",{},[
        el("div",{class:"itemTitle"},[ex.name]),
        el("div",{class:"itemSub"},[ex.goal.join(" · ")])
      ]),
      el("button",{class:"smallBtn danger", type:"button", onclick:()=>removeExercise(ex.id)},["Quitar"])
    ]),
    el("div",{class:"itemRow"},[
      el("div",{class:"field"},[
        el("label",{},["Dosificación (editable)"]),
        el("textarea",{rows:"2", oninput:(e)=>{ ex._dose = e.target.value; }},[ex._dose || ex.dose])
      ]),
      el("div",{class:"field"},[
        el("label",{},["Cues (editable)"]),
        el("textarea",{rows:"2", oninput:(e)=>{ ex._cues = e.target.value; }},[(ex._cues || ex.cues.map(x=>"• "+x).join("\n"))])
      ]),
    ])
  ]);
}

function clearPlan(){
  const extras = window.__extras;
  extras.exercisePlan.selectedIds = [];
  extras.exercisePlan.notes = "";
  saveExtras(extras);
  renderMotorSections();
}

function autoplan(){
  const extras = window.__extras;
  const st = getMergedState();
  const stage = stageFromState(st);

  const limit = MODE==="full" ? 7 : 3;
  const maxDefault = MODE==="full" ? 6 : 3;

  const dysp = !!st?.m8?.dolor_relaciones;
  const urg  = !!st?.m8?.urinario_urgencia || !!st?.m9?.urgencia;
  const effort = !!st?.m8?.urinario_esfuerzo;
  const wantsImpact = ((st?.motivo?.meta || "").toLowerCase().includes("correr") || (st?.motivo?.meta || "").toLowerCase().includes("impacto"));

  const picks = [];
  picks.push("resp_coord");
  if (dysp) picks.push("relajacion_pp");
  else picks.push("pp_short");

  if (urg || effort) picks.push("exhalar_esfuerzo");
  else picks.push("caminar_suave");

  if (MODE==="full"){
    if (stage.startsWith("postparto_")) picks.push("caminar_suave");
    if (!dysp) picks.push("cadera_dec_lat");
    if (dysp) picks.push("exposicion_gradual");
    if (!!st?.ciclo?.gsm) picks.push("cuidado_tejidos");
    if (wantsImpact && stage==="postparto_12plus") picks.push("exhalar_esfuerzo");
  }

  const unique = [];
  picks.forEach(id=>{
    if (!unique.includes(id) && EXERCISES.find(e=>e.id===id)) unique.push(id);
  });

  const final = unique.slice(0, maxDefault);

  extras.exercisePlan.selectedIds = final.slice(0, limit);
  ensureTask(extras.tasks.usuaria, "Plan en casa: realizar X días/semana (editar)", "Alta");
  ensureTask(extras.tasks.kine, "Revisar tolerancia a ejercicios y ajustar progresión", "Alta");

  saveExtras(extras);
  renderMotorSections();
  toast(`Autoplan listo (${extras.exercisePlan.selectedIds.length} ejercicios)`);
}

/* =======================
   Motor: tareas (3 columnas)
======================= */

function ensureTask(list, title, priority="Media"){
  if (list.some(t=>t.title===title)) return;
  list.push({ id: uid("task"), title, priority, due:"", done:false, details:"" });
}

function renderTasks(card){
  card.appendChild(el("div",{class:"cardRow", id:"tasksBody"},[]));
  renderTasksBody();
}

function renderTasksBody(){
  const extras = window.__extras;
  const st = getMergedState();
  const body = $("#tasksBody");
  if (!body) return;
  body.innerHTML = "";

  // gatillos generales (sin duplicar)
  if (st?.m8?.urinario_esfuerzo || st?.m8?.urinario_urgencia || st?.m8?.urinario_sin_causa || st?.m9?.urgencia || st?.m9?.incontinencia){
    ensureTask(extras.tasks.usuaria, "Registro 2–3 días: frecuencia, urgencia, escapes y gatillantes", "Media");
    ensureTask(extras.tasks.kine, "Revisar síntomas urinarios y ajustar plan", "Alta");
  }
  if (st?.m8?.dolor_relaciones){
    ensureTask(extras.tasks.usuaria, "Registrar contexto del dolor en relaciones (qué, cuándo, qué ayudó)", "Alta");
    ensureTask(extras.tasks.kine, "Revisar escala de Marinoff y ajustar enfoque", "Alta");
  }
  if (Number(st?.ciclo?.postparto_semanas || 0) > 0){
    ensureTask(extras.tasks.usuaria, "Monitorear señales durante ejercicio (pesadez, escapes, dolor que persiste)", "Alta");
    ensureTask(extras.tasks.kine, "Definir criterio de progresión según semanas postparto", "Alta");
  }
  if (extras.settings.musculoEsqOn){
    ensureTask(extras.tasks.usuaria, "Registrar qué movimientos gatillan (sentadilla, escaleras, levantar/cargar)", "Media");
    ensureTask(extras.tasks.kine, "Revisar test músculo-esquelético elegido y ajustar progresión", "Media");
  }

  saveExtras(extras);

  body.appendChild(tasksColumn("Tareas para la usuaria", extras.tasks.usuaria, "usuaria"));
  body.appendChild(tasksColumn("Tareas para la kine", extras.tasks.kine, "kine"));
  body.appendChild(tasksColumn("Tareas compartidas", extras.tasks.compartidas, "compartidas"));
}

function tasksColumn(title, list, kind){
  const col = el("div",{class:"hCard"},[
    el("div",{class:"hTop"},[
      el("div",{},[
        el("div",{class:"hTitle"},[title]),
        el("div",{class:"itemSub"},["Tarjetas editables con prioridad, plazo y detalles."])
      ]),
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>addTask(kind)},["+ Añadir"])
    ])
  ]);

  if (!list.length){
    col.appendChild(el("div",{class:"itemSub", style:"margin-top:10px;"},["Sin tareas todavía."]));
    return col;
  }

  list.forEach(t=>{
    col.appendChild(renderTaskCard(t, kind));
  });

  return col;
}

function addTask(kind){
  const extras = window.__extras;
  extras.tasks[kind].push({ id:uid("task"), title:"", priority:"Media", due:"", done:false, details:"" });
  saveExtras(extras);
  renderMotorSections();
}

function updateTask(kind, id, patch){
  const extras = window.__extras;
  const t = extras.tasks[kind].find(x=>x.id===id);
  if (!t) return;
  Object.assign(t, patch);
  saveExtras(extras);
  renderMotorSections();
}

function removeTask(kind, id){
  const extras = window.__extras;
  extras.tasks[kind] = extras.tasks[kind].filter(t=>t.id!==id);
  saveExtras(extras);
  renderMotorSections();
}

function renderTaskCard(t, kind){
  return el("div",{class:"item"},[
    el("div",{class:"itemHead"},[
      el("div",{},[
        el("div",{class:"itemTitle"},[t.title || "(sin título)"]),
        el("div",{class:"itemSub"},[`Prioridad: ${t.priority} · ${t.done ? "Hecho" : "Pendiente"}`])
      ]),
      el("button",{class:"smallBtn danger", type:"button", onclick:()=>removeTask(kind, t.id)},["Eliminar"])
    ]),
    el("div",{class:"itemRow"},[
      el("div",{class:"field"},[
        el("label",{},["Título"]),
        el("input",{value:t.title || "", oninput:(e)=>updateTask(kind, t.id, {title:e.target.value})})
      ]),
      el("div",{style:"display:grid; gap:10px;"},[
        el("div",{class:"field"},[
          el("label",{},["Prioridad"]),
          select(["Alta","Media","Baja"], t.priority, (v)=>updateTask(kind, t.id, {priority:v}))
        ]),
        el("div",{class:"field"},[
          el("label",{},["Plazo (opcional)"]),
          el("input",{type:"text", value:t.due || "", oninput:(e)=>updateTask(kind, t.id, {due:e.target.value})})
        ]),
      ])
    ]),
    el("div",{class:"itemRow"},[
      el("div",{class:"field"},[
        el("label",{},["Hecho"]),
        el("select",{onchange:(e)=>updateTask(kind, t.id, {done:(e.target.value==="Sí")})},[
          el("option",{value:"No", selected: !t.done},["No"]),
          el("option",{value:"Sí", selected: !!t.done},["Sí"]),
        ])
      ]),
      el("div",{class:"field"},[
        el("label",{},["Detalles / acuerdos / barreras"]),
        el("textarea",{rows:"2", oninput:(e)=>updateTask(kind, t.id, {details:e.target.value})},[t.details || ""])
      ]),
    ])
  ]);
}

/* =======================
   Motor: próxima sesión
======================= */

function ensureNext(text, priority="Media"){
  const extras = window.__extras;
  if (extras.nextSession.some(x=>x.text===text)) return;
  extras.nextSession.push({ id:uid("next"), text, priority, done:false, notes:"" });
}

function renderNextSession(card){
  const top = el("div",{style:"display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;"},[
    el("div",{class:"itemSub"},["Auto-items según positivos y plan."]),
    el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>autoNextSession()},["Autollenar"]),
      el("button",{class:"smallBtn", type:"button", onclick:()=>addNextItem()},["+ Añadir"])
    ])
  ]);
  card.appendChild(top);
  card.appendChild(el("div",{id:"nextList"},[]));
  renderNextSessionBody();
}

function autoNextSession(){
  const extras = window.__extras;
  const st = getMergedState();

  extras.nextSession = [];

  if (st?.m8?.dolor_relaciones){
    ensureNext("Reevaluar dolor en relaciones (0–10) + Marinoff (0–3)", "Alta");
  }
  if (st?.m8?.urinario_esfuerzo || st?.m8?.urinario_urgencia || st?.m8?.urinario_sin_causa || st?.m9?.urgencia || st?.m9?.incontinencia){
    ensureNext("Reevaluar síntomas urinarios (0–10) + escapes/urgencia", "Alta");
    if (st?.m9?.iciq_aplicar) ensureNext("Reevaluar puntaje ICIQ-UI SF (0–21) y su interpretación", "Alta");
  }
  if (st?.m8?.dolor_pelvico){
    ensureNext("Reevaluar dolor pélvico/vulvar (0–10) + tolerancia a actividades", "Alta");
  }
  if (Number(st?.ciclo?.postparto_semanas || 0) > 0){
    ensureNext("Reevaluar tolerancia a carga/impacto (durante y 24h) + síntomas pélvicos", "Alta");
  }
  if ((window.__extras.exercisePlan.selectedIds || []).length){
    ensureNext("Revisar adherencia al plan en casa + respuesta de síntomas (durante y 24h)", "Alta");
  }
  if (extras.settings.musculoEsqOn){
    ensureNext("Reevaluar dolor músculo-esquelético (0–10) + 1 test elegido", "Media");
  }

  // recorta por modo
  const limit = MODE==="full" ? 7 : 3;
  extras.nextSession = extras.nextSession.slice(0, limit);

  saveExtras(extras);
  renderMotorSections();
  toast("Próxima sesión autollenada");
}

function addNextItem(){
  const extras = window.__extras;
  extras.nextSession.push({ id:uid("next"), text:"", priority:"Media", done:false, notes:"" });
  saveExtras(extras);
  renderMotorSections();
}

function updateNext(id, patch){
  const extras = window.__extras;
  const it = extras.nextSession.find(x=>x.id===id);
  if (!it) return;
  Object.assign(it, patch);
  saveExtras(extras);
  renderMotorSections();
}

function removeNext(id){
  const extras = window.__extras;
  extras.nextSession = extras.nextSession.filter(x=>x.id!==id);
  saveExtras(extras);
  renderMotorSections();
}

function renderNextSessionBody(){
  const extras = window.__extras;
  const list = $("#nextList");
  if (!list) return;
  list.innerHTML = "";

  if (!extras.nextSession.length){
    list.appendChild(el("div",{class:"itemSub", style:"margin-top:10px;"},[
      "Sin ítems todavía. Usa Autollenar o añade manual."
    ]));
    return;
  }

  extras.nextSession.forEach(it=>{
    list.appendChild(el("div",{class:"item"},[
      el("div",{class:"itemHead"},[
        el("div",{},[
          el("div",{class:"itemTitle"},[it.text || "(sin texto)"]),
          el("div",{class:"itemSub"},[`Prioridad: ${it.priority}`])
        ]),
        el("button",{class:"smallBtn danger", type:"button", onclick:()=>removeNext(it.id)},["Eliminar"])
      ]),
      el("div",{class:"itemRow"},[
        el("div",{class:"field"},[
          el("label",{},["Ítem"]),
          el("input",{value:it.text||"", oninput:(e)=>updateNext(it.id,{text:e.target.value})})
        ]),
        el("div",{style:"display:grid; gap:10px;"},[
          el("div",{class:"field"},[
            el("label",{},["Prioridad"]),
            select(["Alta","Media","Baja"], it.priority, (v)=>updateNext(it.id,{priority:v}))
          ]),
          el("div",{class:"field"},[
            el("label",{},["Hecho"]),
            el("select",{onchange:(e)=>updateNext(it.id,{done:(e.target.value==="Sí")})},[
              el("option",{value:"No", selected: !it.done},["No"]),
              el("option",{value:"Sí", selected: !!it.done},["Sí"]),
            ])
          ]),
        ])
      ]),
      el("div",{class:"field"},[
        el("label",{},["Notas / qué buscar"]),
        el("textarea",{rows:"2", oninput:(e)=>updateNext(it.id,{notes:e.target.value})},[it.notes||""])
      ])
    ]));
  });
}

/* =======================
   Convertir examen → hipótesis (sin siglas)
======================= */

function convertExamToHypotheses(){
  const st = getMergedState();
  const yes = String(st?.cons?.interno || "").includes("Sí");
  if (!yes){
    toast("Examen intracavitario no está marcado como Sí");
    return;
  }

  const tone = st?.int?.tono_simple || "";
  const pain = Number(st?.int?.dolor_0_10 || 0);
  const coord = st?.int?.coord_simple || "";

  const suggestions = [];
  if (pain >= 4){
    suggestions.push({
      domain:"Tejidos",
      title:`Dolor a palpación (dolor ${pain}/10): explorar irritabilidad de tejidos y tolerancia.`,
      evidence: autoEvidence(st, ["int.dolor_0_10","int.dolor_donde","cons.detalles","int.tono_detalles","int.coord_detalles"]),
      toConfirm:["Mapa de dolor","Respuesta a relajación","Irritabilidad post examen"],
      interventions:"Relajación del piso pélvico + educación + estrategias de tolerancia (editable).",
      priority:"Alta",
      confidence:"Media"
    });
  }
  if (tone === "alto"){
    suggestions.push({
      domain:"Músculo",
      title:"Tono basal alto: posible hiperactividad del piso pélvico; priorizar relajación y coordinación.",
      evidence: autoEvidence(st, ["int.tono_simple","int.tono_detalles","cons.detalles"]),
      toConfirm:["Relajación voluntaria","Apnea/empuje","Dolor asociado"],
      interventions:"Relajación del piso pélvico + coordinación suave (editable).",
      priority:"Alta",
      confidence:"Media"
    });
  }
  if (coord === "limitada"){
    suggestions.push({
      domain:"Músculo",
      title:"Coordinación contracción-relajación limitada: foco en calidad y relajación completa.",
      evidence: autoEvidence(st, ["int.coord_simple","int.coord_detalles","int.fuerza_simple"]),
      toConfirm:["Qué falla (inicio/sostén/relajación)","Compensaciones"],
      interventions:"Respiración + coordinación guiada (editable).",
      priority:"Media",
      confidence:"Media"
    });
  }

  if (!suggestions.length){
    toast("No hay hallazgos suficientes para convertir en hipótesis");
    return;
  }

  suggestions.forEach(s=> addHypothesisFromSuggestion(s));
  toast("Hipótesis creadas desde examen");
}

/* =======================
   Motor: refresco parcial
======================= */

function renderMotorSections(){
  if ($("#hypBody")) renderHypothesesBody();
  if ($("#exBody")) renderExercisesBody();
  if ($("#tasksBody")) renderTasksBody();
  if ($("#nextList")) renderNextSessionBody();
}

/* =======================
   Autocompletar (modo)
   - Propone hipótesis (máx según modo)
   - Autoplan ejercicios (máx según modo)
   - Genera tareas y próxima sesión
   - No pisa texto si ya escribiste en plan final
======================= */

function setFieldIfEmpty(key, value){
  const input = document.querySelector(`[data-key="${key}"]`);
  if (!input) return;
  const cur = (input.type === "checkbox") ? input.checked : (input.value ?? "");
  const empty = (input.type === "checkbox") ? (cur === false) : (String(cur).trim() === "");
  if (!empty) return;

  if (input.type === "checkbox") input.checked = !!value;
  else input.value = String(value || "");
}

function autofillHypotheses(){
  const st = getMergedState();
  const extras = window.__extras;

  const limit = MODE === "full" ? 5 : 2;
  while (extras.hypotheses.filter(h=>h.active).length < limit){
    const suggestions = getHypothesisSuggestions(st);
    let added = false;
    for (const s of suggestions){
      const exists = extras.hypotheses.some(h => (h.title||"") === (s.title||""));
      if (!exists){
        addHypothesisFromSuggestion(s);
        added = true;
        break;
      }
    }
    if (!added) break;
  }
}

function autofillPlanTextFromMotor(){
  const extras = window.__extras;

  const topHyps = extras.hypotheses
    .filter(h=>h.active)
    .slice(0,3)
    .map(h=>`- ${translateHypothesisForUsuaria(h.title)}`)
    .join("\n");

  const topTasks = (extras.tasks?.usuaria || [])
    .slice(0,4)
    .map(t=>`- ${t.title}`)
    .join("\n");

  if (topHyps) setFieldIfEmpty("plan.hipotesis", topHyps);
  if (topTasks) setFieldIfEmpty("plan.tareas", topTasks);
}

function autocompletar(){
  autofillHypotheses();
  autoplan();
  renderTasksBody();
  autoNextSession();
  autofillPlanTextFromMotor();
  saveAndRefresh(window.__extras);
  toast("Autocompletar listo (todo editable)");
}

/* =======================
   Traducción de hipótesis a lenguaje simple (para PDF usuaria)
======================= */

function translateHypothesisForUsuaria(title){
  const t = String(title || "");
  const low = t.toLowerCase();

  if (low.includes("urinario") || low.includes("pérdidas") || low.includes("urgencia")){
    return "Síntomas urinarios: trabajaremos control, hábitos y estrategias para reducir escapes/urgencia.";
  }
  if (low.includes("dolor en relaciones") || low.includes("dispareunia") || low.includes("marinoff")){
    return "Dolor en relaciones: trabajaremos relajación del piso pélvico y tolerancia gradual, con cuidado de tejidos.";
  }
  if (low.includes("dolor pélvico") || low.includes("vulvar")){
    return "Dolor pélvico/vulvar: trabajaremos control, relajación y progresión gradual por tolerancia.";
  }
  if (low.includes("postparto")){
    return "Postparto: trabajaremos recuperación y progresión segura según tolerancia.";
  }
  if (low.includes("gsm")){
    return "Cuidado de tejidos (sequedad/ardor): estrategias para mejorar comodidad y tolerancia.";
  }
  if (low.includes("cadera") || low.includes("músculo-esquelético") || low.includes("lumbopélvico")){
    return "Componente músculo-esquelético: mejoraremos control y tolerancia a carga.";
  }
  return t; // fallback
}

/* =======================
   Exportación: JSON, PDF clínico, PDF usuaria, Excel
   - PDF con paleta: fondo crema, títulos ink, líneas sandstone, acento terracota mínimo
   - Montserrat (fallback helvetica, pero tamaños/jerarquía como pediste)
   - Secciones claras + sin campos vacíos
   - Barras pequeñas para escalas
======================= */

function exportJSON(){
  const st = getBaseState(true);
  st.__extras = window.__extras;
  const blob = new Blob([JSON.stringify(st,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileBaseName(st) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function syncModeUI(){
  const btn10 = $("#btnMode10");
  const btnFull = $("#btnModeFull");
  if (!btn10 || !btnFull) return;

  btn10.classList.toggle("active", MODE==="10");
  btnFull.classList.toggle("active", MODE==="full");

  btn10.setAttribute("aria-pressed", MODE==="10" ? "true" : "false");
  btnFull.setAttribute("aria-pressed", MODE==="full" ? "true" : "false");

  const pill = $("#pillMode");
  if (pill) pill.textContent = `Modo actual: ${MODE==="full" ? "Completo" : "10 min"}`;
}

function syncMusculoEsqUI(){
  const btn = $("#btnMsk");
  if (!btn) return;
  const on = !!(window.__extras?.settings?.musculoEsqOn);
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.textContent = on ? "Músculo-esquelético: ON" : "Músculo-esquelético: OFF";
}

function importBackupObject(obj){
  if (!obj || typeof obj !== "object") throw new Error("JSON inválido");

  // Base
  const base = JSON.parse(JSON.stringify(obj));
  const extras = base.__extras ? base.__extras : null;
  delete base.__extras;

  // Guardar
  saveBaseState(base);
  if (extras){
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
  }

  // Aplicar en runtime
  window.__extras = loadExtras();
  MODE = (base?._meta?.mode === "full") ? "full" : "10";
  syncModeUI();
  syncMusculoEsqUI();

  renderForm(window.__extras);
  toast("Respaldo cargado");
}

async function importBackupFromFile(file){
  const text = await file.text();
  const obj = JSON.parse(text);
  importBackupObject(obj);
}


function nonEmptyRows(rows){
  return (rows || []).filter(([a,b])=>{
    const aa = String(a ?? "").trim();
    const bb = String(b ?? "").trim();
    return aa !== "" && bb !== "" && bb !== "false" && bb !== "False";
  });
}

function pdfSetPalette(doc){
  // Cream Bone #F5EFE5
  doc.setFillColor(245,239,229);
  // Ink Blue #102024
  // Sandstone #D9CBB3
  // Terracota #C26A5A
}

function pdfHeader(doc, title, subtitle){
  // fondo crema suave
  doc.setFillColor(245,239,229);
  doc.rect(0,0,595,90,"F");

  // línea sandstone
  doc.setDrawColor(217,203,179);
  doc.setLineWidth(1);
  doc.line(0,90,595,90);

  // título ink
  doc.setTextColor(16,32,36);
  doc.setFont("helvetica","bold"); // Montserrat real requiere embedding; mantenemos jerarquía.
  doc.setFontSize(18);
  doc.text(title, 44, 40);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(subtitle, 44, 64);
}

function pdfSectionTitle(doc, y, text){
  doc.setTextColor(16,32,36);
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(text, 44, y);

  // acento terracota pequeño (línea corta)
  doc.setDrawColor(194,106,90);
  doc.setLineWidth(2);
  doc.line(44, y+6, 110, y+6);

  // separador sandstone fino
  doc.setDrawColor(217,203,179);
  doc.setLineWidth(1);
  doc.line(44, y+14, 551, y+14);
}

function pdfBar(doc, x, y, w, h, value010){
  const v = Math.max(0, Math.min(10, Number(value010||0)));
  const frac = v/10;

  // fondo sandstone muy suave
  doc.setFillColor(217,203,179);
  doc.rect(x,y,w,h,"F");

  // relleno terracota mínimo
  doc.setFillColor(194,106,90);
  doc.rect(x,y,w*frac,h,"F");

  // borde ink muy fino
  doc.setDrawColor(16,32,36);
  doc.setLineWidth(0.5);
  doc.rect(x,y,w,h);
}

const PROVIDER = {
  nombre: "Fernanda Rojas Cruz",
  cargo: "Kinesióloga especialista en piso pélvico y salud integral femenina",
  rut: "19.670.038-2",
  registro: "727918",
  correo: "Klga.fernandarojascruz@gmail.com",
  instagram: "@Kinefer"
};

function pdfColors(){
  return {
    cream:[245,239,229],
    ink:[16,32,36],
    sand:[217,203,179],
    terra:[194,106,90]
  };
}

// ===== Assets para PDF (logo + foto) =====
const PDF_ASSET_FILES = {
  fer: "fer.jpg",
  logo: "logo.png"
};

function dataUrlFmt(dataUrl){
  return (dataUrl || "").startsWith("data:image/png") ? "PNG" : "JPEG";
}

async function fetchAsDataURL(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar " + url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function loadImg(dataUrl){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function circleCropDataURL(dataUrl, size=256){
  const img = await loadImg(dataUrl);
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");

  ctx.clearRect(0,0,size,size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
  ctx.closePath();
  ctx.clip();

  // cover
  const scale = Math.max(size/img.width, size/img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size-w)/2, (size-h)/2, w, h);

  ctx.restore();
  return c.toDataURL("image/png");
}


async function ensurePdfAssets(){
  if (window.__pdfAssets) return window.__pdfAssets;
  const out = {};
  try { out.logo = await fetchAsDataURL(PDF_ASSET_FILES.logo); } catch {}

  try {
    out.fer = await fetchAsDataURL(PDF_ASSET_FILES.fer);
    out.ferRound = await circleCropDataURL(out.fer, 256); // <- NUEVO
  } catch {}

  window.__pdfAssets = out;
  return out;
}


// icono de alerta (evita el emoji ⚠ que se vuelve "&")
function pdfAlertIcon(doc, x, y){
  const C = pdfColors();
  doc.setFillColor(...C.terra);
  doc.circle(x, y, 8, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.text("!", x-2.2, y+4.2);
  doc.setTextColor(...C.ink);
}

// línea corta para PDF (sin el párrafo largo “Oculto en 10 min…”)
function modeLinePdf(){
  return MODE === "full" ? "Modo: Completo" : "Modo: 10 min (vista abreviada)";
}

// mini-barras para el Resumen rápido (más nítido que meter el canvas)
function pdfMiniProfile(doc, x, y, scores){
  const C = pdfColors();
  let yy = y;

  doc.setFont("helvetica","normal");
  doc.setFontSize(11);
  doc.setTextColor(...C.ink);

  scores.forEach(s=>{
    const v = Math.max(0, Math.min(10, Number(s.v||0)));
    doc.text(`${s.name}: ${v}/10`, x, yy);

    // barra fondo
    doc.setFillColor(...C.sand);
    doc.roundedRect(x+130, yy-8, 260, 8, 4, 4, "F");

    // barra relleno
    doc.setFillColor(...C.terra);
    doc.roundedRect(x+130, yy-8, 260*(v/10), 8, 4, 4, "F");

    yy += 18;
  });

  return yy;
}


function pdfNewPage(doc, title, subtitle){
  const C = pdfColors();

  // fondo suave (no saturar tinta)
  doc.setFillColor(...C.cream);
  doc.rect(0,0,595,842,"F");

  // header blanco (más “boutique”)
  doc.setFillColor(255,255,255);
  doc.roundedRect(34,24,527,86,16,16,"F");

  // línea sandstone
  doc.setDrawColor(...C.sand);
  doc.setLineWidth(1);
  doc.line(44, 108, 551, 108);

  // título
  doc.setTextColor(...C.ink);
  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text(title, 44, 58);

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(subtitle, 44, 84);

  // logo + foto (si existen)
const A = window.__pdfAssets || {};
try{
  if (A.logo){
    // aro suave
    doc.setDrawColor(...C.sand);
    doc.setLineWidth(1);
    doc.circle(519, 62, 26, "S");
    doc.addImage(A.logo, dataUrlFmt(A.logo), 495, 38, 48, 48);
  }
} catch {}

try{
  if (A.ferRound){
    doc.setDrawColor(...C.sand);
    doc.setLineWidth(1);
    doc.circle(464, 62, 26, "S");
    doc.addImage(A.ferRound, dataUrlFmt(A.ferRound), 440, 38, 48, 48);
  } else if (A.fer){
    doc.setDrawColor(...C.sand);
    doc.setLineWidth(1);
    doc.circle(464, 62, 26, "S");
    doc.addImage(A.fer, dataUrlFmt(A.fer), 440, 38, 48, 48);
  }
} catch {}
}

function pdfSection(doc, y, title){
  const C = pdfColors();
  doc.setTextColor(...C.ink);
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(title, 44, y);

  // acento terracota corto
  doc.setDrawColor(...C.terra);
  doc.setLineWidth(2);
  doc.line(44, y+6, 120, y+6);

  // separador sandstone
  doc.setDrawColor(...C.sand);
  doc.setLineWidth(1);
  doc.line(44, y+14, 551, y+14);

  return y + 28;
}

function pdfBox(doc, x, y, w, h){
  const C = pdfColors();
  doc.setFillColor(255,255,255);
  doc.setDrawColor(...C.sand);
  doc.setLineWidth(1);
  doc.roundedRect(x,y,w,h,14,14,"FD");
}

function pdfEnsure(doc, y, need, title, subtitle){
  if (y + need < 820) return y;
  doc.addPage();
  return pdfNewPage(doc, title, subtitle);
}

function pdfBullets(doc, x, y, lines, maxW){
  const C = pdfColors();
  doc.setTextColor(...C.ink);
  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  const cleaned = (lines||[]).filter(s=>String(s||"").trim()!=="");
  let yy = y;

  cleaned.forEach(line=>{
    const parts = doc.splitTextToSize(String(line), maxW);
    // bullet
    doc.setTextColor(...C.terra);
    doc.text("-", x, yy);
    doc.setTextColor(...C.ink);
    doc.text(parts, x+10, yy);
    yy += parts.length * 16;
  });

  return yy;
}

function pdfScaleBar(doc, x, y, label, value, extraText){
  const C = pdfColors();
  const v = Math.max(0, Math.min(10, Number(value||0)));

  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.ink);
  doc.text(`${label}: ${v}/10 (${levelFrom010(v)})`, x, y);

  // barra sandstone
  doc.setFillColor(...C.sand);
  doc.roundedRect(x, y+8, 260, 8, 4, 4, "F");

  // relleno terracota mínimo
  doc.setFillColor(...C.terra);
  doc.roundedRect(x, y+8, 260*(v/10), 8, 4, 4, "F");

  if (extraText){
    doc.setFont("helvetica","normal");
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(extraText, x, y+28);
    return y + 44;
  }
  return y + 34;
}

function pdfCheckbox(doc, x, y){
  const C = pdfColors();
  doc.setDrawColor(...C.ink);
  doc.setLineWidth(1);
  doc.rect(x, y-10, 10, 10);
}

function pdfSignature(doc, y){
  const C = pdfColors();
  y = pdfEnsure(doc, y, 140, "Resumen", ""); // por si queda corto

  // separador
  doc.setDrawColor(...C.sand);
  doc.setLineWidth(1);
  doc.line(44, y, 551, y);

  y += 18;
  pdfBox(doc, 44, y, 507, 100);

  doc.setTextColor(...C.ink);
  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.text("Profesional", 60, y+26);

  doc.setFont("helvetica","normal");
  doc.setFontSize(11);
  doc.text(`${PROVIDER.nombre} — ${PROVIDER.cargo}`, 60, y+46);
  doc.text(`RUT ${PROVIDER.rut} · Registro ${PROVIDER.registro}`, 60, y+64);
  doc.text(`${PROVIDER.correo} · ${PROVIDER.instagram}`, 60, y+82);

  doc.setFont("helvetica","bold");
  doc.text("Firma:", 60, y+102);
  doc.setFont("helvetica","normal");
  doc.text("______________________________", 110, y+102);

  return y + 120;
}

async function exportPdfClin(){
  const st = getMergedState();
  const extras = window.__extras || ExtrasDefault();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
   await ensurePdfAssets();

  const name = st?.id?.nombre || "—";
  const rut  = st?.id?.rut || "—";
  const date = st?.id?.fecha || "—";

  const title = "Resumen clínico · Piso pélvico";
  const sub = `Usuaria: ${name} · Rut: ${rut} · Fecha: ${date} · Modo: ${MODE==="full"?"Completo":"10 min"}`;

  let y = pdfNewPage(doc, title, sub);

  // Panel exportable: clasificación + qué se ocultó + gráfico (canvas)
  y = pdfSection(doc, y, "Resumen rápido");
  y = pdfEnsure(doc, y, 190, title, sub);

    pdfBox(doc, 44, y, 507, 190);
   
   doc.setFont("helvetica","bold");
   doc.setFontSize(12);
   doc.setTextColor(16,32,36);
   doc.text(`Clasificación sugerida: ${(st?.plan?.clasificacion || "").trim() || suggestedClassification(st)}`, 60, y+28);
   
   doc.setFont("helvetica","normal");
   doc.setFontSize(11);
   doc.text(modeLinePdf(), 60, yy+40, {maxWidth:470});
   
   const scoresMini = domainScores(st);
   pdfMiniProfile(doc, 60, y+78, scoresMini);
   
   y += 210;


  // Datos de la usuaria
  y = pdfSection(doc, y, "Datos de la usuaria");
  y = pdfEnsure(doc, y, 150, title, sub);

  pdfBox(doc, 44, y, 507, 110);

  const line1 = `Nombre: ${name} · Edad: ${st?.id?.edad || "—"} · Rut: ${rut}`;
  const line2 = `Embarazo (semanas): ${st?.ciclo?.embarazo_semanas || "—"} · Postparto (semanas): ${st?.ciclo?.postparto_semanas || "—"}`;
  const line3 = `GSM: ${st?.ciclo?.gsm ? "Sí" : "No"}${st?.ciclo?.gsm_detalles ? " · "+st.ciclo.gsm_detalles : ""}`;

  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(line1, 60, y+34);
  doc.text(line2, 60, y+54);
  doc.text(line3, 60, y+74, {maxWidth:470});

  y += 130;

  // Síntomas y escalas
  y = pdfSection(doc, y, "Síntomas y escalas");
  y = pdfEnsure(doc, y, 220, title, sub);

  const scores = domainScores(st);
  scores.forEach(s=>{
    y = pdfScaleBar(doc, 44, y, s.name, s.v);
  });

  // ICIQ / Marinoff
  const iciqOn = !!st?.out?.iciq_aplicar;
  if (iciqOn){
    const score = Number(st?.out?.iciq_score);
    doc.setFont("helvetica","bold");
    doc.setFontSize(12);
    doc.text(`Puntaje ICIQ-UI SF: ${Number.isFinite(score)?score:"—"}/21 (${iciqInterpret(score)})`, 44, y+10);
    y += 28;
  }
  const mar = st?.m8?.marinoff;
  if (mar!==undefined && String(mar).trim()!==""){
    doc.setFont("helvetica","bold");
    doc.setFontSize(12);
    doc.text(`Escala de dispareunia de Marinoff: ${mar} (${marinoffExplain(Number(mar))})`, 44, y+10);
    y += 28;
  }

  y += 6;

  // Hipótesis generadas
  y = pdfEnsure(doc, y, 220, title, sub);
  y = pdfSection(doc, y, "Hipótesis generadas");

  const hyps = (extras.hypotheses||[]).filter(h=>h.active);
  pdfBox(doc, 44, y, 507, Math.max(110, 26 + hyps.length*18));

  let yy = y + 26;
  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  if (!hyps.length){
    doc.text("Sin hipótesis activas.", 60, yy);
    yy += 18;
  } else {
    hyps.forEach(h=>{
      doc.setFont("helvetica","bold");
      doc.text(`${h.domain} · Prioridad ${h.priority} · Confianza ${h.confidence}`, 60, yy);
      yy += 16;
      doc.setFont("helvetica","normal");
      const lines = doc.splitTextToSize(h.title, 470);
      doc.text(lines, 60, yy);
      yy += lines.length*16 + 6;
    });
  }

  y = y + Math.max(130, 34 + hyps.length*38);

  // Plan de ejercicios
  y = pdfEnsure(doc, y, 220, title, sub);
  y = pdfSection(doc, y, "Plan de ejercicios");

  const exSel = (extras.exercisePlan?.selectedIds||[]).map(id=>EXERCISES.find(e=>e.id===id)).filter(Boolean);
  pdfBox(doc, 44, y, 507, Math.max(120, 26 + exSel.length*22));

  yy = y + 26;
  if (!exSel.length){
    doc.text("Sin ejercicios seleccionados.", 60, yy);
    yy += 18;
  } else {
    exSel.forEach(e=>{
      const dose = (e._dose || e.dose || "").trim();
      doc.setFont("helvetica","bold");
      doc.text(`• ${e.name}`, 60, yy);
      yy += 16;
      doc.setFont("helvetica","normal");
      doc.text(dose ? `Dosificación: ${dose}` : "Dosificación: —", 78, yy);
      yy += 18;
    });
  }
  y = y + Math.max(140, 34 + exSel.length*34);

  // Tareas para casa + tareas para la kinesióloga
  y = pdfEnsure(doc, y, 260, title, sub);
  y = pdfSection(doc, y, "Tareas para casa");

  const tU = (extras.tasks?.usuaria||[]);
  const tK = (extras.tasks?.kine||[]);

  pdfBox(doc, 44, y, 507, Math.max(120, 26 + Math.min(10,tU.length)*22));
  yy = y + 26;

  if (!tU.length){
    doc.text("Sin tareas para casa.", 60, yy);
    yy += 18;
  } else {
    tU.slice(0,10).forEach(t=>{
      pdfCheckbox(doc, 60, yy);
      doc.setFont("helvetica","normal");
      doc.text(t.title, 78, yy, {maxWidth:450});
      yy += 20;
    });
  }
  y = y + Math.max(140, 34 + Math.min(10,tU.length)*22);

  y = pdfEnsure(doc, y, 220, title, sub);
  y = pdfSection(doc, y, "Tareas para la kinesióloga");

  pdfBox(doc, 44, y, 507, Math.max(110, 26 + Math.min(8,tK.length)*22));
  yy = y + 26;

  if (!tK.length){
    doc.text("Sin tareas para la kinesióloga.", 60, yy);
    yy += 18;
  } else {
    tK.slice(0,8).forEach(t=>{
      doc.text(`• ${t.title} (Prioridad: ${t.priority})`, 60, yy, {maxWidth:470});
      yy += 18;
    });
  }
  y = y + Math.max(130, 34 + Math.min(8,tK.length)*22);

  // Próxima sesión
  y = pdfEnsure(doc, y, 220, title, sub);
  y = pdfSection(doc, y, "Próxima sesión");

  const ns = extras.nextSession || [];
  pdfBox(doc, 44, y, 507, Math.max(110, 26 + Math.min(8,ns.length)*22));
  yy = y + 26;

  if (!ns.length){
    doc.text("Sin ítems definidos.", 60, yy);
    yy += 18;
  } else {
    ns.slice(0,8).forEach(n=>{
      doc.text(`- ${n.text} (Prioridad: ${n.priority})`, 60, yy, {maxWidth:470});
      yy += 18;
    });
  }
  y = y + Math.max(130, 34 + Math.min(8,ns.length)*22);

  // Señales para avisar (caja destacada)
  y = pdfEnsure(doc, y, 190, title, sub);
  y = pdfSection(doc, y, "Señales para avisar");

  pdfBox(doc, 44, y, 507, 110);
  doc.setTextColor(...pdfColors().terra);
  doc.setFont("helvetica","bold");
  pdfAlertIcon(doc, 66, y+30);
  doc.setTextColor(...pdfColors().ink);
  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(
    "Avisar/consultar si aparece: fiebre + dolor pélvico o urinario, hematuria visible, retención urinaria, sangrado anormal importante, dolor agudo severo nuevo o síntomas neurológicos nuevos.",
    78, y+30, {maxWidth:455}
  );
  y += 130;

  // Firma
  pdfSignature(doc, y);

  doc.save(fileBaseName(st) + "_clinico.pdf");
}

async function exportPdfUsuaria(){
  const st = getMergedState();
  const extras = window.__extras || ExtrasDefault();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
   await ensurePdfAssets();

  const name = st?.id?.nombre || "—";
  const date = st?.id?.fecha || "—";

  const title = "Resumen para la usuaria";
  const sub = `Nombre: ${name} · Fecha: ${date}`;

  let y = pdfNewPage(doc, title, sub);

  y = pdfSection(doc, y, "Qué trabajamos hoy");
  y = pdfEnsure(doc, y, 130, title, sub);

  pdfBox(doc, 44, y, 507, 96);
  doc.setFont("helvetica","normal");
  doc.setFontSize(12);

  const hyps = (extras.hypotheses||[]).filter(h=>h.active).slice(0,3).map(h=>translateHypothesisForUsuaria(h.title));
  const line = hyps.length ? hyps.join(" ") : (st?.plan?.clasificacion || "").trim() || "Hoy trabajamos en comprender tus síntomas y definir un plan seguro y progresivo.";
  doc.text(line, 60, y+34, {maxWidth:470});
  y += 120;

  y = pdfSection(doc, y, "Tu plan en casa");
  y = pdfEnsure(doc, y, 220, title, sub);

  const exSel = (extras.exercisePlan?.selectedIds||[]).map(id=>EXERCISES.find(e=>e.id===id)).filter(Boolean).slice(0,7);

  pdfBox(doc, 44, y, 507, Math.max(120, 26 + exSel.length*30));
  let yy = y + 26;

  if (!exSel.length){
    doc.text("No hay ejercicios seleccionados aún. La kinesióloga los agregará según tu evaluación.", 60, yy, {maxWidth:470});
    yy += 18;
  } else {
    exSel.forEach(e=>{
      pdfCheckbox(doc, 60, yy);
      doc.text(`${e.name}`, 78, yy, {maxWidth:450});
      yy += 16;
      doc.setFont("helvetica","normal");
      doc.setFontSize(11);
      const dose = (e._dose || e.dose || "").trim();
      doc.text(dose ? `Dosificación: ${dose}` : "Dosificación: —", 78, yy, {maxWidth:450});
      doc.setFontSize(12);
      yy += 18;
    });
  }
  y = y + Math.max(140, 34 + exSel.length*32);

  y = pdfEnsure(doc, y, 220, title, sub);
  y = pdfSection(doc, y, "Tareas");

  const tU = (extras.tasks?.usuaria||[]).slice(0,10);
  pdfBox(doc, 44, y, 507, Math.max(110, 26 + tU.length*22));
  yy = y + 26;

  if (!tU.length){
    doc.text("Sin tareas definidas por ahora.", 60, yy);
    yy += 18;
  } else {
    tU.forEach(t=>{
      pdfCheckbox(doc, 60, yy);
      doc.text(t.title, 78, yy, {maxWidth:450});
      yy += 20;
    });
  }
  y = y + Math.max(130, 34 + tU.length*22);

  y = pdfEnsure(doc, y, 190, title, sub);
  y = pdfSection(doc, y, "Qué revisaremos la próxima sesión");

  const ns = (extras.nextSession||[]).slice(0,6);
  pdfBox(doc, 44, y, 507, Math.max(110, 26 + ns.length*22));
  yy = y + 26;

  if (!ns.length){
    doc.text("La próxima sesión revisaremos tu progreso y ajustaremos el plan.", 60, yy, {maxWidth:470});
    yy += 18;
  } else {
    ns.forEach(n=>{
      doc.text(`• ${n.text}`, 60, yy, {maxWidth:470});
      yy += 18;
    });
  }
  y = y + Math.max(130, 34 + ns.length*22);

  y = pdfEnsure(doc, y, 190, title, sub);
  y = pdfSection(doc, y, "Señales para avisar");

  pdfBox(doc, 44, y, 507, 110);
  doc.setTextColor(...pdfColors().terra);
  doc.setFont("helvetica","bold");
  pdfAlertIcon(doc, 66, y+30);
  doc.setTextColor(...pdfColors().ink);
  doc.setFont("helvetica","normal");
  doc.setFontSize(12);
  doc.text(
    "Avisar/consultar si aparece: fiebre + dolor pélvico o urinario, hematuria visible, retención urinaria, sangrado anormal importante, dolor agudo severo nuevo o síntomas neurológicos nuevos.",
    78, y+30, {maxWidth:455}
  );
  y += 130;

  pdfSignature(doc, y);
  doc.save(fileBaseName(st) + "_usuaria.pdf");
}


function flatten(obj){
  const out = [];
  function walk(x, pref=""){
    if (x === null || x === undefined) return;
    if (typeof x !== "object"){
      out.push([pref, String(x)]);
      return;
    }
    Object.keys(x).forEach(k=>{
      if (k === "_meta") return;
      const np = pref ? `${pref}.${k}` : k;
      walk(x[k], np);
    });
  }
  walk(obj,"");
  return out;
}

function exportXlsx(){
  const st = getMergedState();
  const extras = window.__extras || ExtrasDefault();
  const wb = XLSX.utils.book_new();

  const wsDatos = XLSX.utils.aoa_to_sheet([
    ["Datos de la usuaria"],
    ["Nombre", st?.id?.nombre || ""],
    ["Edad", st?.id?.edad || ""],
    ["Rut", st?.id?.rut || ""],
    ["Fecha", st?.id?.fecha || ""],
    ["Contacto emergencia", st?.id?.contacto_emergencia || ""],
    ["Embarazo semanas", st?.ciclo?.embarazo_semanas || ""],
    ["Postparto semanas", st?.ciclo?.postparto_semanas || ""],
    ["GSM", st?.ciclo?.gsm ? "Sí" : ""],
    ["GSM detalle", st?.ciclo?.gsm_detalles || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsDatos, "Datos_usuaria");

  const wsSint = XLSX.utils.aoa_to_sheet([
    ["Síntomas y escalas"],
    ["Urinario (0–10)", st?.perfil?.urinario_0_10 || ""],
    ["Intestinal (0–10)", st?.perfil?.intestinal_0_10 || ""],
    ["Dolor pélvico (0–10)", st?.perfil?.dolor_pelvico_0_10 || ""],
    ["Dolor en relaciones (0–10)", st?.perfil?.dolor_relaciones_0_10 || ""],
    ["Bulto/peso (0–10)", st?.perfil?.prolapso_0_10 || ""],
    [],
    ["ICIQ-UI SF", st?.m9?.iciq_aplicar ? (st?.m9?.iciq_score || "") : ""],
    ["Interpretación ICIQ", st?.m9?.iciq_aplicar ? iciqInterpret(st?.m9?.iciq_score) : ""],
    ["Marinoff (0–3)", st?.m8?.marinoff || ""],
    ["Interpretación Marinoff", st?.m8?.marinoff!=="" ? marinoffExplain(Number(st?.m8?.marinoff)) : ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsSint, "Sintomas_escalas");

  const hypRows = (extras.hypotheses||[]).map(h => ({
    Dominio: h.domain,
    Hipotesis: h.title,
    Prioridad: h.priority,
    Confianza: h.confidence,
    Evidencia: h.evidence,
    Que_buscar: h.toConfirm,
    Intervencion: h.interventions,
    Notas: h.notes
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hypRows), "Hipotesis");

  const exRows = (extras.exercisePlan?.selectedIds||[]).map(id=>{
    const e = EXERCISES.find(x=>x.id===id);
    if (!e) return null;
    return {
      Ejercicio: e.name,
      Dosificacion: (e._dose || e.dose || ""),
      Cues: (e._cues || (e.cues||[]).map(c=>"• "+c).join("\n")),
      Objetivo: (e.goal||[]).join(", "),
      Tolerancia: e.tol || ""
    };
  }).filter(Boolean);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exRows), "Plan_ejercicios");

  const allTasks = []
    .concat((extras.tasks?.usuaria||[]).map(t=>({...t, tipo:"Usuaria"})))
    .concat((extras.tasks?.kine||[]).map(t=>({...t, tipo:"Kine"})))
    .concat((extras.tasks?.compartidas||[]).map(t=>({...t, tipo:"Compartidas"})));

  const taskRows = allTasks.map(t=>({
    Tipo: t.tipo,
    Tarea: t.title,
    Prioridad: t.priority,
    Plazo: t.due,
    Hecho: t.done ? "Sí" : "No",
    Detalles: t.details
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), "Tareas");

  const nextRows = (extras.nextSession||[]).map(n=>({
    Item: n.text,
    Prioridad: n.priority,
    Hecho: n.done ? "Sí" : "No",
    Notas: n.notes
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nextRows), "Proxima_sesion");

  // auditoría completa (incluye motor)
  const audit = flatten(st).map(([k,v])=>({Campo:k, Valor:v}));
  const extrasFlat = flatten({extras}).map(([k,v])=>({Campo:k, Valor:v}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(audit.concat(extrasFlat)), "Auditoria");

  XLSX.writeFile(wb, fileBaseName(st) + ".xlsx");
}

/* =======================
   Init + binds
======================= */

function init(){
  window.__extras = loadExtras();

  $("#btnMode10").addEventListener("click", ()=> setMode("10"));
  $("#btnModeFull").addEventListener("click", ()=> setMode("full"));

  const btnME = $("#btnMsk");
  btnME.addEventListener("click", toggleMusculoEsq);
  btnME.setAttribute("aria-pressed", window.__extras.settings.musculoEsqOn ? "true" : "false");
  btnME.textContent = window.__extras.settings.musculoEsqOn ? "Músculo-esquelético: ON" : "Músculo-esquelético: OFF";

  $("#btnAuto").addEventListener("click", autocompletar);

  $("#btnPdfClin").addEventListener("click", exportPdfClin);
  $("#btnPdfUsuaria").addEventListener("click", exportPdfUsuaria);
  $("#btnXlsx").addEventListener("click", exportXlsx);
  $("#btnJson").addEventListener("click", exportJSON);

   // Cargar respaldo (JSON)
const btnLoad = $("#btnJsonLoad");
const jsonFile = $("#jsonFile");
if (btnLoad && jsonFile){
  btnLoad.addEventListener("click", ()=> jsonFile.click());
  jsonFile.addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try{
      await importBackupFromFile(file);
    } catch(err){
      console.error(err);
      toast("No se pudo cargar el JSON (formato inválido)");
    } finally {
      jsonFile.value = ""; // permite cargar el mismo archivo de nuevo
    }
  });
}


  $("#btnClear").addEventListener("click", ()=>{
    if (confirm("¿Borrar toda la ficha? (incluye motor)")) clearAll();
  });

  renderForm(window.__extras);

  // refrescos iniciales módulos 8/9 (por si hay estado)
  setTimeout(()=>{
    updateModule8Visibility();
    updateModule9Visibility();
  }, 0);
}

init();
