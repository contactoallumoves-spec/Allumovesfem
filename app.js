/* AllU Moves PF – v3.1
   Motor semi-automático:
   - hipótesis (sugeridas + editables) por dominios
   - biblioteca de ejercicios + autoplan por modo/etapa
   - tareas (usuaria/kine/compartidas) autogeneradas
   - próxima sesión (auto + editable)
   - MSK toggle (screen 10min vs full)
   - selector + detalles siempre visibles (en puntos clave)
   - gráficos (perfil + completitud) exportables al PDF
*/

const STORAGE_KEY = "pf_ficha_v31";
const EXTRAS_KEY = "pf_ficha_v31_extras";

let MODE = "10"; // "10" | "full"

const $ = (s) => document.querySelector(s);
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
    mskOn: false,
    activeHypTab: "Músculo", // tabs
  },
  hypotheses: [], // list of cards
  exercisePlan: {
    selectedIds: [],
    notes: "",
  },
  tasks: {
    usuaria: [],
    kine: [],
    compartidas: [],
  },
  nextSession: [], // list of items
});

/* hypothesis card schema:
{
  id, domain,
  title, evidence, toConfirm, interventions,
  priority: "Alta|Media|Baja",
  confidence: "Alta|Media|Baja",
  notes,
  active: true,
  createdFrom: "auto|manual|convert_exam"
}
*/
function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function loadExtras(){
  const raw = localStorage.getItem(EXTRAS_KEY);
  if (!raw) return ExtrasDefault();
  try {
    const e = JSON.parse(raw);
    return { ...ExtrasDefault(), ...e };
  } catch {
    return ExtrasDefault();
  }
}
function saveExtras(extras){
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
}

/* =======================
   Base form (tu ficha)
   ======================= */

function shouldShow(mode){
  if (MODE === "full") return true;
  return mode !== "full";
}
function requiresMSK(sec, extras){
  if (!sec.requiresMSK) return true;
  return !!extras.settings.mskOn;
}

/* Mapa “selector importante -> detalles” (patrón UX) */
const DETAIL_MAP = {
  "pfd.perdida_esfuerzo": { detailsKey:"pfd.detalles_perdida_esfuerzo", yesPlaceholder:"Describe situaciones, frecuencia, tolerancia, modificaciones." },
  "pfd.urgencia_bano": { detailsKey:"pfd.detalles_urgencia", yesPlaceholder:"Describe gatillantes, urgencia, control, horarios, líquidos, estreñimiento." },
  "pfd.perdida_sin_causa": { detailsKey:"pfd.detalles_perdida_sin_causa", yesPlaceholder:"Describe cuándo ocurre, si se asocia a urgencia o no." },
  "pfd.perdida_gases_heces": { detailsKey:"pfd.detalles_fi", yesPlaceholder:"Describe frecuencia, consistencia, urgencia, situaciones, barreras." },
  "pfd.dolor_relaciones": { detailsKey:"pfd.detalles_dispareunia", yesPlaceholder:"Describe localización, momento (entrada/fricción/post), posiciones, lubricación, ansiedad, etc." },
  "pfd.dolor_pelvico": { detailsKey:"pfd.detalles_dolor_pelvico", yesPlaceholder:"Describe dónde, cómo cambia, qué lo alivia/agrava, irritabilidad." },
  "pfd.estrenimiento": { detailsKey:"pfd.detalles_estrenimiento", yesPlaceholder:"Describe frecuencia, Bristol si aplica, pujo, maniobras, dolor." },

  "uri.urgencia": { detailsKey:"uri.detalles_urgencia", yesPlaceholder:"Describe urgencia: gatillantes, control, frecuencia, hábitos." },

  "seg.tvp": { detailsKey:"seg.detalles_tvp", yesPlaceholder:"Describe por qué sospechas (signos, factores) y acción tomada." },
  "seg.emb_alerta": { detailsKey:"seg.detalles_emb_alerta", yesPlaceholder:"Describe síntoma de alerta y acción/derivación." },
};

const SLIDER_INTERP = {
  "medicion.sintoma_0_10": (v)=> v>=7 ? "Alto" : v>=4 ? "Moderado" : v>=1 ? "Bajo" : "0",
  "perfil.urinario_0_10": (v)=> v>=7 ? "Alto" : v>=4 ? "Moderado" : v>=1 ? "Bajo" : "0",
  "perfil.intestinal_0_10": (v)=> v>=7 ? "Alto" : v>=4 ? "Moderado" : v>=1 ? "Bajo" : "0",
  "perfil.dolor_pelvico_0_10": (v)=> v>=7 ? "Alto" : v>=4 ? "Moderado" : v>=1 ? "Bajo" : "0",
  "perfil.dolor_relaciones_0_10": (v)=> v>=7 ? "Alto" : v>=4 ? "Moderado" : v>=1 ? "Bajo" : "0",
  "perfil.prolapso_0_10": (v)=> v>=7 ? "Alto" : v>=4 ? "Moderado" : v>=1 ? "Bajo" : "0",
};

/* Biblioteca ejercicios (base; tú la vas expandiendo) */
const EXERCISES = [
  // Respiración / coordinación (base)
  { id:"breath_coord", name:"Respiración diafragmática + coordinación PFM (inhala relaja / exhala activa suave)", goal:["relajación","coordinación"], stage:["general","postparto_0_2","postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","postparto_12plus","menopausia"], tol:"baja",
    dose:"2–3 min diarios o 5–8 respiraciones x 2–3 veces/día",
    cues:["Inhala: suelta abdomen y piso pélvico","Exhala: activa suave (sin apnea)","Prioriza relajación completa al final"],
    errors:["Apnea/pujo","Activación fuerte que aumenta dolor/pesadez"],
    prog:"Sumar exhalación en esfuerzo (levantarse/cargar) sin síntomas",
    reg:"Más lento, más corto, solo relajación si duele"
  },
  { id:"pfm_short", name:"PFM contract/relax – sostén corto + relajación completa", goal:["fuerza","coordinación"], stage:["general","postparto_0_2","postparto_2_4","postparto_4_6","menopausia"], tol:"baja",
    dose:"6–10 repeticiones de 3–5s + 6–10s relajación (según tolerancia)",
    cues:["Calidad > cantidad","Relaja completamente entre repeticiones","Sin apnea"],
    errors:["Apretar glúteos/abdomen en exceso","No relajar entre repeticiones"],
    prog:"Aumentar sostén o añadir rápidas si corresponde",
    reg:"Menos repeticiones, énfasis en relajar"
  },
  // Core suave postparto
  { id:"pelvic_tilt", name:"Core básico suave: pelvic tilt / bent knee fallout", goal:["core","pared_abdominal"], stage:["postparto_0_2","postparto_2_4","postparto_4_6","postparto_6_8"], tol:"baja",
    dose:"2–3 series de 6–10 repeticiones",
    cues:["Exhala en el esfuerzo","Sin doming/pujo","Mantén control suave"],
    errors:["Apnea","Aumenta dolor/pesadez"],
    prog:"Progresar a fuerza funcional leve",
    reg:"Reducir rango/rep"
  },
  // Caminata / cardio bajo impacto
  { id:"walk_easy", name:"Caminata suave (bajo impacto) según tolerancia", goal:["cardio_bajo_impacto"], stage:["postparto_0_2","postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","menopausia","general"], tol:"baja",
    dose:"5–20 min según tolerancia, progresión gradual",
    cues:["Sin gatillar pesadez/escape/dolor moderado-severo","Pausa si hay síntomas persistentes"],
    errors:["Subir volumen rápido","Ignorar señales"],
    prog:"Aumentar tiempo o ritmo (power walking)",
    reg:"Menos tiempo y más descansos"
  },
  // Fuerza funcional postparto 2–6
  { id:"bridge_clams", name:"Puente / clamshell / abducción lateral (si tolera)", goal:["cadera","fuerza_funcional"], stage:["postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12"], tol:"media",
    dose:"2–3 series de 8–12 repeticiones",
    cues:["Exhala al esfuerzo","Control cadera","Sin síntomas pélvicos relevantes"],
    errors:["Compensar lumbar","Aumenta pesadez/escape"],
    prog:"Progresar carga o unipodal",
    reg:"Rango menor o menos series"
  },
  // Dispareunia / dolor penetración
  { id:"downtrain", name:"Down-training PFM: respiración + relajación guiada + escaneo corporal", goal:["relajación","dolor","sexualidad"], stage:["general","menopausia","postparto_6_8","postparto_8_12","postparto_12plus"], tol:"baja",
    dose:"5–8 min, 4–6 días/semana",
    cues:["Escaneo sin juicio","Relajación en exhalación","Progresión solo si no aumenta dolor"],
    errors:["Forzar","Apnea","Apretar para ‘proteger’"],
    prog:"Sumar coordinación contract/relax sin dolor",
    reg:"Más corto, solo respiración"
  },
  { id:"exp_gradual", name:"Exposición gradual no dolorosa (educación + estrategias; dilatadores = módulo opcional)", goal:["exposición","sexualidad"], stage:["general","menopausia"], tol:"baja",
    dose:"Muy gradual, según tolerancia; registrar contexto",
    cues:["Cero dolor fuerte: objetivo = tolerancia","Lubricación/posición/ritmo","Parar si dolor sube y no baja"],
    errors:["“Aguantar” dolor","No registrar gatillantes"],
    prog:"Aumentar tolerancia y control",
    reg:"Volver a relajación/educación"
  },
  // Menopausia / GSM enfoque tejido
  { id:"tissue_care", name:"Cuidado de tejidos: lubricación, ritmo, fricción y educación (si aplica)", goal:["tejidos","sexualidad","educación"], stage:["menopausia","general"], tol:"baja",
    dose:"Educación + aplicar estrategias en actividad; registrar respuesta",
    cues:["Prioriza fricción baja","Explorar lubricantes","Coordinar con profesional médico si corresponde"],
    errors:["Irritantes","Ignorar disuria/ardor persistente"],
    prog:"Mejorar tolerancia/actividad",
    reg:"Reducir exposición"
  },
  // MSK básicos
  { id:"exhale_effort", name:"Exhalación en esfuerzo (levantar/sentarse) + coordinación PFM", goal:["presion","core"], stage:["general","postparto_2_4","postparto_4_6","postparto_6_8","postparto_8_12","postparto_12plus"], tol:"baja",
    dose:"2–3 min práctica + aplicar en ADL",
    cues:["Exhala antes y durante esfuerzo","Evita empuje/pujo","Suave y consistente"],
    errors:["Apnea","Empuje fuerte"],
    prog:"Aplicar en fuerza funcional",
    reg:"Volver a respiración simple"
  }
];

/* =======================
   Secciones (incluye motor + MSK)
   ======================= */

const SECTIONS = [
  // --- Tu ficha (base) ---
  { id:"identificacion", title:"1) Identificación completa", badge:"Obligatorio", badgeKind:"req", mode:"min",
    fields:[
      { type:"text", key:"id.nombre", label:"Nombre:", mode:"min"},
      { type:"number", key:"id.edad", label:"Edad:", mode:"min"},
      { type:"text", key:"id.rut", label:"Rut :", mode:"min"},
      { type:"date", key:"id.fecha", label:"Fecha de ingreso", mode:"min"},
      { type:"text", key:"id.medico_tratante", label:"Médico tratante:", mode:"full"},
      { type:"text", key:"id.matrona", label:"Matrona", mode:"full"},
      { type:"text", key:"id.contacto_medico", label:"Contacto medico tratante", mode:"full"},
      { type:"text", key:"id.contacto_emergencia", label:"Contacto / Contacto de emergencia:", mode:"min"},
      { type:"text", key:"id.nivel_educacional", label:"Nivel educacional:", mode:"full"},
      { type:"text", key:"id.ocupacion", label:"Ocupación:", mode:"min"},
      { type:"text", key:"id.deportes", label:"Deportes", mode:"full"},
      { type:"text", key:"id.prevision", label:"Previsión", mode:"full"},
    ]
  },

  { id:"motivo", title:"2) Motivo de consulta", badge:"Obligatorio", badgeKind:"req", mode:"min",
    hint:"Pregunta abierta + mínimo comparable (0–10 + actividad) para re-test.",
    fields:[
      { type:"textarea", key:"motivo.motivo", label:"Motivo de consulta:", rows:3, mode:"min" },
      { type:"textarea", key:"motivo.meta", label:"Meta (en palabras de la usuaria)", rows:2, mode:"min" },
      { type:"textarea", key:"motivo.historia", label:"Historia breve / contexto", rows:2, mode:"min" },
      { type:"range", key:"medicion.sintoma_0_10", label:"Escala 0–10 del síntoma principal", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"text", key:"medicion.actividad_1", label:"ACTIVIDAD 1: (actividad importante + 0–10)", mode:"min", placeholder:"Ej: correr 2/10" },
      { type:"text", key:"medicion.actividad_2", label:"ACTIVIDAD 2 :", mode:"full" },
      { type:"text", key:"medicion.actividad_3", label:"ACTIVIDAD 3 :", mode:"full" },
    ]
  },

  { id:"seguridad", title:"3) Seguridad / derivación", badge:"P0", badgeKind:"p0", mode:"min",
    hint:"Si marcas algo relevante: detener, coordinar, derivar según criterio clínico.",
    fields:[
      { type:"check", key:"seg.fiebre", label:"Fiebre/escalofríos + dolor pélvico o urinario", mode:"min"},
      { type:"check", key:"seg.hematuria", label:"Hematuria visible", mode:"min"},
      { type:"check", key:"seg.retencion", label:"Retención / incapacidad para orinar / dolor suprapúbico severo", mode:"min"},
      { type:"check", key:"seg.sangrado", label:"Sangrado genital anormal importante / postmenopáusico", mode:"min"},
      { type:"check", key:"seg.dolor_agudo", label:"Dolor pélvico agudo severo “nuevo”", mode:"min"},
      { type:"check", key:"seg.neuro", label:"Síntomas neurológicos nuevos (anestesia silla de montar / debilidad progresiva / cambios esfínteres no explicados)", mode:"min"},
      { type:"check", key:"seg.tvp", label:"Sospecha TVP/TEP (no usar Homans; derivación según clínica)", mode:"min"},
      { type:"check", key:"seg.emb_alerta", label:"Embarazo: sangrado/pérdida de líquido/dolor severo (derivar)", mode:"full"},
      { type:"textarea", key:"seg.accion", label:"Notas / acción tomada (si aplica)", rows:2, mode:"full" }
    ],
    customRender: (card) => renderDetailsPairs(card, [
      "seg.tvp","seg.emb_alerta"
    ])
  },

  { id:"antecedentes_medicos", title:"4) Antecedentes medicos", badge:"Completa", badgeKind:"req", mode:"full",
    fields:[
      { type:"check", key:"am.musculoesqueleticos", label:"Musculoesqueleticos", mode:"full"},
      { type:"check", key:"am.neurologicos", label:"Neurologicos", mode:"full"},
      { type:"check", key:"am.endocrinos", label:"Endocrinos", mode:"full"},
      { type:"check", key:"am.cardiopulmonar", label:"Cardio pulmonar", mode:"full"},
      { type:"check", key:"am.otros", label:"Otros", mode:"full"},
      { type:"textarea", key:"am.medicamentos", label:"Medicamentos", rows:2, mode:"full"},
    ]
  },

  { id:"gineco_obst", title:"5) Antecedentes gineco-obstétricos (embarazo y postparto)", badge:"Obligatorio", badgeKind:"req", mode:"min",
    hint:"Embarazadas en cualquier trimestre: acá ordenas, no recortas.",
    fields:[
      { type:"text", key:"go.menarquia", label:"Menarquia (edad de la primera menstruación)", mode:"full" },
      { type:"text", key:"go.inicio_relaciones", label:"A qué edad iniciaste tus relaciones sexuales?", mode:"full" },
      { type:"text", key:"go.ultima_regla", label:"Ultima Regla", mode:"full" },
      { type:"text", key:"go.menopausia", label:"Menpausia (edad y síntomas)", mode:"full" },

      { type:"text", key:"go.gestaciones", label:"Gestaciones", mode:"min" },
      { type:"text", key:"go.abortos", label:"Abortos", mode:"min" },
      { type:"text", key:"go.partos", label:"Partos", mode:"min" },
      { type:"text", key:"go.uso_forceps", label:"Uso forceps", mode:"full" },
      { type:"text", key:"go.cesareas", label:"Cesareas", mode:"min" },

      { type:"text", key:"go.fecha_probable_parto", label:"Fecha probable parto", mode:"min" },
      { type:"text", key:"go.peso_rn", label:"Peso RN", mode:"min" },
      { type:"text", key:"go.suplementos", label:"Suplementos", mode:"min" },
      { type:"text", key:"go.peso_ganado", label:"Peso Ganado", mode:"min" },
      { type:"text", key:"go.desgarros_epi", label:"Desgarros /Episiotomías", mode:"min" },
      { type:"text", key:"go.anticonceptivos", label:"Metodos anticonceptivos", mode:"full" },
      { type:"text", key:"go.otras_obs", label:"Otras observaciones:", mode:"full" },

      // motor: semanas postparto (clave)
      { type:"div", mode:"min" },
      { type:"number", key:"ciclo.postparto_semanas", label:"Postparto: semanas desde el parto (si aplica)", mode:"min", min:0, max:520 },
      { type:"number", key:"ciclo.embarazo_semanas", label:"Embarazo: semanas de gestación (si aplica)", mode:"min", min:0, max:45 },
      { type:"check", key:"ciclo.gsm", label:"Menopausia/perimenopausia con síntomas GSM (sequedad/ardor/disuria/dispareunia)", mode:"full"},
      { type:"textarea", key:"ciclo.gsm_detalles", label:"GSM: detalles (si aplica)", rows:2, mode:"full"},
    ]
  },

  { id:"habitos", title:"6) Hábitos", badge:"Completa", badgeKind:"req", mode:"full",
    fields:[
      { type:"text", key:"hab.act_fisica", label:"Actividad fisica", mode:"full" },
      { type:"text", key:"hab.alimentacion", label:"Alimentación", mode:"full" },
      { type:"text", key:"hab.alcohol", label:"Alcohol", mode:"full" },
      { type:"text", key:"hab.tabaco", label:"Tabaco", mode:"full" },
      { type:"text", key:"hab.horas_sueno", label:"Horas de sueño", mode:"full" },
    ]
  },

  { id:"dolor_msk", title:"7) Dolor musculoesquelético (si aplica)", badge:"Completa", badgeKind:"req", mode:"full",
    fields:[
      { type:"text", key:"msk.A_cuando_inicia", label:"A (Cuando inicia)", mode:"full" },
      { type:"text", key:"msk.L_donde_localiza", label:"L (Donde se localiza)", mode:"full" },
      { type:"text", key:"msk.I_irradiacion", label:"I (Irradiacion)", mode:"full" },
      { type:"text", key:"msk.C_caracter", label:"C (Punzante , quemante.. )", mode:"full" },
      { type:"text", key:"msk.I_intensidad", label:"I (intensidad EVA)", mode:"full" },
      { type:"text", key:"msk.A_agrav_atenua", label:"A (Atenuantes /agravantes)", mode:"full" },
    ]
  },

  { id:"pfd_screen", title:"8) Disfunción del piso pélvico (screen)", badge:"Obligatorio", badgeKind:"req", mode:"min",
    hint:"Marca lo que aplica + detalla al lado. Usa deslizadores para el gráfico (se exporta).",
    fields:[
      { type:"check", key:"pfd.perdida_esfuerzo", label:"Pérdida de orina al toser, estornudar, reír o hacer ejercicio", mode:"min"},
      { type:"check", key:"pfd.urgencia_bano", label:"Necesidad urgente de orinar y dificultad para llegar al baño a tiempo", mode:"min"},
      { type:"check", key:"pfd.perdida_sin_causa", label:"Pérdida de orina sin causa aparente", mode:"min"},
      { type:"check", key:"pfd.perdida_gases_heces", label:"Pérdida involuntaria de gases o heces", mode:"min"},
      { type:"check", key:"pfd.dolor_relaciones", label:"Dolor durante las relaciones sexuales (dispareunia).", mode:"min"},
      { type:"check", key:"pfd.dolor_pelvico", label:"Dolor en la zona pélvica, vulvar o abdominal baja (dolor pélvico crónico).", mode:"min"},
      { type:"check", key:"pfd.estrenimiento", label:"Estreñimiento", mode:"min"},

      { type:"div", mode:"min" },

      { type:"range", key:"perfil.urinario_0_10", label:"Molestia urinaria (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.intestinal_0_10", label:"Molestia intestinal (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.dolor_pelvico_0_10", label:"Dolor pélvico/vulvar (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.dolor_relaciones_0_10", label:"Dolor en relaciones (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.prolapso_0_10", label:"Molestia por bulto/peso (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
    ],
    customRender: (card) => renderDetailsPairs(card, [
      "pfd.perdida_esfuerzo","pfd.urgencia_bano","pfd.perdida_sin_causa","pfd.perdida_gases_heces","pfd.dolor_relaciones","pfd.dolor_pelvico","pfd.estrenimiento"
    ])
  },

  { id:"urinario", title:"9) Tracto urinario inferior", badge:"10 min / Completa", badgeKind:"req", mode:"min",
    fields:[
      { type:"text", key:"uri.frecuencia", label:"Frecuencia: ¿Cuántas veces al día orinas?", mode:"min"},
      { type:"text", key:"uri.nicturia", label:"Nicturia: ¿Cuántas veces te levantas en la noche para orinar?", mode:"min"},
      { type:"check", key:"uri.urgencia", label:"Urgencia: ¿Sientes un deseo repentino e incontrolable de orinar?", mode:"min"},
      { type:"text", key:"uri.incontinencia", label:"Incontinencia: ¿Pierdes orina involuntariamente? ¿En qué situaciones?", mode:"min"},

      { type:"div", mode:"min" },
      // outcome rápido (se activa cuando hay síntomas urinarios)
      { type:"number", key:"out.iciq_score", label:"ICIQ-UI SF (0–21) (si aplica)", mode:"min", min:0, max:21 },
      { type:"textarea", key:"out.iciq_contexto", label:"Situaciones de escape/urgencia (detalles)", rows:2, mode:"min" },

      { type:"div", mode:"full" },
      { type:"text", key:"uri.sintomas_llenado", label:"Síntomas de llenado:", mode:"full"},
      { type:"check", key:"uri.retardo", label:"Retardo miccional: ¿Tienes dificultad para iniciar la micción?", mode:"full"},
      { type:"check", key:"uri.chorro_debil", label:"Chorro débil/intermitente: ¿El chorro de orina es débil o se interrumpe?", mode:"full"},
      { type:"check", key:"uri.pujo_orinar", label:"Esfuerzo miccional: ¿Necesitas pujar para orinar?", mode:"full"},
      { type:"check", key:"uri.disuria", label:"Disuria: ¿Sientes dolor o ardor al orinar?", mode:"full"},
      { type:"check", key:"uri.retencion", label:"Retención urinaria: ¿Sientes que no vacías completamente la vejiga?", mode:"full"},
    ],
    customRender: (card) => renderDetailsPairs(card, ["uri.urgencia"])
  },

  { id:"defecatorio", title:"10) Función defecatoria", badge:"Completa", badgeKind:"req", mode:"full",
    fields:[
      { type:"text", key:"def.frecuencia", label:"¿Con qué frecuencia tienes deposiciones?", mode:"full"},
      { type:"text", key:"def.consistencia", label:"¿Qué consistencia tienen ?", mode:"full"},
      { type:"check", key:"def.pujo_maniobras", label:"¿Necesitas pujar o realizar maniobras (como introducir un dedo en el recto) para facilitar la defecación?", mode:"full"},
      { type:"check", key:"def.urgencia_fecal", label:"Urgencia fecal", mode:"full"},
      { type:"check", key:"def.dolor_defecar", label:"¿Sientes dolor al defecar o en la zona anal/rectal?", mode:"full"},
      { type:"check", key:"def.laxantes", label:"¿Utilizas laxantes, supositorios o enemas para ayudarte a defecar?", mode:"full"},
    ]
  },

  { id:"sexual", title:"11) Función sexual (si aplica)", badge:"Completa", badgeKind:"req", mode:"full",
    fields:[
      { type:"text", key:"sex.frecuencia", label:"¿Con qué frecuencia tienes relaciones sexuales actualmente?", mode:"full"},
      { type:"check", key:"sex.vaginismo", label:"Vaginismo: ¿Experimentas contracciones involuntarias…?", mode:"full"},
      { type:"check", key:"sex.dispareunia", label:"Dispareunia: ¿Sientes dolor…? ¿superficial o profundo?", mode:"full"},
      { type:"check", key:"sex.libido", label:"Libido: ¿cambios en deseo sexual?", mode:"full"},
      { type:"check", key:"sex.anorgasmia", label:"Anorgasmia: ¿dificultad para orgasmo?", mode:"full"},
      { type:"select", key:"sex.marinoff", label:"Escala de Marinoff (si aplica)", mode:"full",
        options:["—","0 (sin dolor)","1 (disconfort no impide)","2 (frecuentemente impide)","3 (siempre impide)"]
      },
      { type:"textarea", key:"sex.contexto_dolor", label:"Contexto del dolor (si aplica)", rows:2, mode:"full" },
    ]
  },

  { id:"examen", title:"12) Examen físico / ginecológico", badge:"10 min / Completa", badgeKind:"req", mode:"min",
    hint:"En 10 min: observación + respiración + decisión examen interno + 1 hallazgo clave.",
    fields:[
      { type:"textarea", key:"ex.obs", label:"Observación", rows:2, mode:"min" },
      { type:"text", key:"ex.respiracion", label:"Patrón respiratorio", mode:"min" },

      { type:"div", mode:"min" },
      { type:"check", key:"cons.explico", label:"Expliqué objetivo, alternativas, derecho a parar", mode:"min"},
      { type:"check", key:"cons.chaperon_ofrecido", label:"Ofrecí chaperón", mode:"min"},
      { type:"select", key:"cons.interno", label:"¿Se realizará examen intracavitario hoy?", mode:"min",
        options:["—","No","Sí (vaginal)","Sí (rectal)","No aplica hoy"]
      },
      { type:"textarea", key:"cons.detalles", label:"Hallazgos / tolerancia / consentimiento / razones para NO hacerlo", rows:2, mode:"min" },

      { type:"div", mode:"min" },
      // sub-hallazgos si Sí
      { type:"range", key:"int.dolor_0_10", label:"Dolor a palpación (0–10) (si aplica)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"text", key:"int.dolor_donde", label:"Dolor: ¿dónde?", mode:"min" },
      { type:"select", key:"int.tono_simple", label:"Tono basal (si aplica)", mode:"min", options:["—","bajo","normal","alto"] },
      { type:"select", key:"int.coord_simple", label:"Coordinación contract/relax (si aplica)", mode:"min", options:["—","adecuada","limitada"] },
      { type:"text", key:"int.fuerza_simple", label:"Fuerza/endurance (escala que usas) + observaciones", mode:"min" },
    ],
    customRender: (card) => {
      const btn = el("button",{class:"smallBtn primary", type:"button", onclick:()=>convertExamToHypotheses()},["Convertir hallazgos en hipótesis"]);
      card.appendChild(el("div",{style:"margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;"},[btn]));
    }
  },

  // ===== Módulo MSK (solo si toggle ON) =====
  { id:"msk_module", title:"MSK (integral) – enfoque músculo-esquelético", badge:"Toggle", badgeKind:"req", mode:"min",
    requiresMSK:true,
    hint:"OFF por defecto. En 10 min: screening. En completo: dominios + 1–2 tests.",
    fields:[
      { type:"select", key:"msk2.dolor_principal", label:"Dolor MSK principal hoy:", mode:"min",
        options:["—","Ninguno","LBP","Cadera","Pubalgia","Sacroilíaco","Abdomen-pared","Otro"]
      },
      { type:"range", key:"msk2.dolor_0_10", label:"Dolor MSK (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"select", key:"msk2.neuro", label:"Irradiación/neurológico:", mode:"min", options:["—","No","Sí"] },
      { type:"select", key:"msk2.carga_impacto", label:"Relación con carga/impacto:", mode:"min",
        options:["—","Mejora con reposo","Empeora con impacto","No claro"]
      },
      { type:"select", key:"msk2.irritabilidad", label:"Sensibilidad/irritabilidad:", mode:"min", options:["—","Baja","Media","Alta"] },
      { type:"textarea", key:"msk2.detalles", label:"Detalles / mapa rápido (dónde, cuándo, qué gatilla)", rows:2, mode:"min" },

      { type:"div", mode:"full" },
      { type:"select", key:"msk2.respiracion_presion", label:"Respiración/“core canister”:", mode:"full", options:["—","OK","Disfuncional sospechada"] },
      { type:"textarea", key:"msk2.respiracion_detalles", label:"Detalles (apnea, empuje, hiperpresión, etc.)", rows:2, mode:"full" },

      { type:"select", key:"msk2.dra", label:"Pared abdominal / DRA (postparto):", mode:"full", options:["—","No aplica","Sospecha","Confirmada"] },
      { type:"textarea", key:"msk2.dra_detalles", label:"Detalles DRA (si tiene medición, anotar)", rows:2, mode:"full" },

      { type:"select", key:"msk2.cadera", label:"Cadera:", mode:"full", options:["—","OK","Limitación ROM","Dolor con carga","Debilidad sospechada"] },
      { type:"textarea", key:"msk2.cadera_detalles", label:"Detalles", rows:2, mode:"full" },

      { type:"select", key:"msk2.lumbopelvico", label:"Lumbopélvico:", mode:"full", options:["—","OK","Dolor mecánico","Rigidez","Inestabilidad percibida"] },
      { type:"textarea", key:"msk2.lumbo_detalles", label:"Detalles", rows:2, mode:"full" },

      { type:"select", key:"msk2.tol_impacto", label:"Tolerancia a impacto:", mode:"full", options:["—","No aplica","Baja","Media","Alta"] },
      { type:"textarea", key:"msk2.tol_detalles", label:"Detalles", rows:2, mode:"full" },

      { type:"div", mode:"full" },
      { type:"select", key:"msk2.test1", label:"Test 1 (elige 1–2):", mode:"full",
        options:["—","Sentadilla","Bisagra/hip hinge","Step-down","Puente unilateral","Marcha/carrera (si aplica)"]
      },
      { type:"select", key:"msk2.test1_estado", label:"Test 1 estado:", mode:"full", options:["—","Normal","Alterado","No evaluado"] },
      { type:"textarea", key:"msk2.test1_detalles", label:"Test 1: qué se vio", rows:2, mode:"full" },

      { type:"select", key:"msk2.test2", label:"Test 2 (opcional):", mode:"full",
        options:["—","Sentadilla","Bisagra/hip hinge","Step-down","Puente unilateral","Marcha/carrera (si aplica)"]
      },
      { type:"select", key:"msk2.test2_estado", label:"Test 2 estado:", mode:"full", options:["—","Normal","Alterado","No evaluado"] },
      { type:"textarea", key:"msk2.test2_detalles", label:"Test 2: qué se vio", rows:2, mode:"full" },
    ]
  },

  // ===== MOTOR =====
  { id:"motor_hyp", title:"HIPÓTESIS (motor semi-automático)", badge:"Motor", badgeKind:"rel", mode:"min",
    hint:"Sugerencias activables (checkbox). Todo editable. Máx por modo: 10min=2 activas, completo=5 activas.",
    fields:[],
    customRender:(card)=> renderHypotheses(card)
  },

  { id:"motor_ex", title:"EJERCICIOS (biblioteca + autoplan)", badge:"Motor", badgeKind:"rel", mode:"min",
    hint:"Autoplan por etapa y modo. Todo editable. En 10min: 3 ejercicios máx. En completo: 5–7.",
    fields:[],
    customRender:(card)=> renderExercises(card)
  },

  { id:"motor_tasks", title:"TAREAS (auto + editable)", badge:"Motor", badgeKind:"rel", mode:"min",
    hint:"3 columnas: usuaria / kine / compartidas. Se crean desde síntomas y ejercicios. Todo editable.",
    fields:[],
    customRender:(card)=> renderTasks(card)
  },

  { id:"motor_next", title:"PRÓXIMA SESIÓN: qué ver / reevaluar", badge:"Motor", badgeKind:"rel", mode:"min",
    hint:"Se auto-llena según positivos y lo trabajado hoy. Edita en 1 click.",
    fields:[],
    customRender:(card)=> renderNextSession(card)
  },

  { id:"plan", title:"13) Clasificación, hipótesis y plan (tu texto)", badge:"Obligatorio", badgeKind:"req", mode:"min",
    hint:"Tu juicio final + plan 2–4 semanas + tareas. (El motor te ayuda, no te reemplaza.)",
    fields:[
      { type:"text", key:"plan.clasificacion_manual", label:"Clasificación final (tu juicio)", mode:"min",
        placeholder:"Ej: pérdidas con esfuerzo + estrategia de presión; dispareunia con componente tisular…"
      },
      { type:"text", key:"plan.hipotesis", label:"Hipótesis modificables (máx 3)", mode:"min" },
      { type:"textarea", key:"plan.plan_2_4", label:"Plan 2–4 semanas (con tu lenguaje)", rows:3, mode:"min" },
      { type:"textarea", key:"plan.tareas", label:"Tareas para la casa / seguimiento", rows:3, mode:"min" },
      { type:"text", key:"plan.retest", label:"Re-test (cuándo)", mode:"full", placeholder:"Ej: 2–4 semanas o 4–6 sesiones" },
      { type:"select", key:"plan.cuestionario", label:"Cuestionario elegido (baseline)", mode:"full",
        options:["—","ICIQ-UI SF","PFDI-20","PGQ","Wexner/Vaizey","FSFI (si sexualidad es foco)","Otro"]
      },
    ]
  },
];

/* =======================
   Render helpers
   ======================= */

function renderDetailsPairs(card, selectorKeys){
  const st = getMergedState(); // incluye extras
  selectorKeys.forEach(selKey=>{
    const map = DETAIL_MAP[selKey];
    if (!map) return;

    const checked = !!deepGet(st, selKey);
    const pair = el("div",{class:`pair ${checked ? "relevant" : ""}`, "data-pair-for": selKey},[]);

    const left = el("div",{class:"pairLeft"},[]);
    const head = el("div",{class:"pairHead"},[
      el("div",{class:"pairTitle"},["Detalles / Observaciones"]),
      el("span",{class:"badge rel pairBadge"},["Relevante"])
    ]);
    left.appendChild(head);

    const hint = el("div",{style:"margin-top:6px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
      checked ? "Marcado como relevante. Describe." : "Disponible siempre. Se resalta si el selector es positivo."
    ]);
    left.appendChild(hint);

    const right = el("div",{class:"field"},[]);
    const ta = el("textarea",{
      "data-key": map.detailsKey,
      rows:"2",
      placeholder: checked ? map.yesPlaceholder : "Detalles (opcional)"
    },[]);
    right.appendChild(ta);

    pair.appendChild(left);
    pair.appendChild(right);
    card.appendChild(pair);
  });
}

function renderForm(extras){
  const root = $("#formRoot");
  root.innerHTML = "";

  SECTIONS.forEach(sec=>{
    if (!shouldShow(sec.mode)) return;
    if (!requiresMSK(sec, extras)) return;

    const card = el("section", { class:"card", "data-sec": sec.id }, []);
    const h = el("div", { class:"card-h" }, [
      el("div", {}, [
        el("h2", {}, [sec.title]),
        sec.hint ? el("div",{class:"hint"},[sec.hint]) : null
      ]),
      el("span", { class: `badge ${sec.badgeKind || ""}`}, [sec.badge || ""])
    ]);
    card.appendChild(h);

    // Fields render
    const grid = el("div", { class:"grid2" }, []);
    let hasGrid = false;

    (sec.fields || []).forEach(f=>{
      if (!shouldShow(f.mode || sec.mode)) return;

      if (f.type === "div"){
        card.appendChild(el("div",{class:"div"},[]));
        return;
      }

      if (f.type === "check"){
        // Si es selector importante, lo dejamos normal y el bloque “Detalles” se agrega abajo vía customRender
        const row = el("label",{class:"check"},[
          el("input",{type:"checkbox","data-key":f.key}),
          el("span",{},[f.label])
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

        // interpretación + detalles al lado (patrón)
        const interp = el("div",{style:"margin-top:6px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;"},[
          el("span",{class:"badge req", "data-interp-for": f.key},["Interpretación: —"]),
        ]);
        field.appendChild(interp);

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

  // update range badges + interp badges
  $$("[data-range-for]").forEach(b=>{
    const key = b.getAttribute("data-range-for");
    const v = deepGet(st, key);
    b.textContent = (v === undefined || v === null || v === "") ? "0" : String(v);
  });
  $$("[data-interp-for]").forEach(b=>{
    const key = b.getAttribute("data-interp-for");
    const v = Number(deepGet(st, key) || 0);
    const fn = SLIDER_INTERP[key];
    b.textContent = `Interpretación: ${fn ? fn(v) : "—"}`;
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
   Automático (clasificación / cuestionarios / etapa / modo)
   ======================= */

function safetyFlag(st){
  const s = st?.seg || {};
  const keys = ["fiebre","hematuria","retencion","sangrado","dolor_agudo","neuro","tvp","emb_alerta"];
  return keys.some(k=> !!s[k]);
}

function etapaStr(st){
  const parts = [];
  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const gw = Number(st?.ciclo?.embarazo_semanas || 0);

  if (gw > 0) parts.push(`Embarazo: ${gw} sem`);
  if (ppw > 0) parts.push(`Postparto: ${ppw} sem`);

  if (st?.go?.fecha_probable_parto) parts.push(`FPP: ${st.go.fecha_probable_parto}`);
  if (st?.go?.peso_rn) parts.push(`RN: ${st.go.peso_rn}`);

  return parts.length ? parts.join(" · ") : "—";
}

function modeHiddenLine(){
  if (MODE === "full") return "Nada oculto: secciones avanzadas visibles.";
  return "En modo 10 min se omiten secciones avanzadas (hábitos, sexual completa, defecatorio, etc.).";
}

function suggestedClassification(st){
  if (safetyFlag(st)) return "Prioridad: seguridad/derivación";

  const effort = !!st?.pfd?.perdida_esfuerzo;
  const urgency = !!st?.pfd?.urgencia_bano || !!st?.uri?.urgencia;
  const fi = !!st?.pfd?.perdida_gases_heces;
  const constip = !!st?.pfd?.estrenimiento;
  const dysp = !!st?.pfd?.dolor_relaciones;
  const pelvicPain = !!st?.pfd?.dolor_pelvico;

  const tags = [];
  if (effort && urgency) tags.push("Pérdidas de orina: esfuerzo + urgencia (mixta probable)");
  else if (effort) tags.push("Pérdidas de orina con esfuerzo (probable)");
  else if (urgency) tags.push("Urgencia para orinar / vejiga hiperactiva (probable)");

  if (fi) tags.push("Pérdida de gases/heces (evaluar severidad)");
  if (constip) tags.push("Estreñimiento / disfunción defecatoria");
  if (dysp) tags.push("Dolor en relaciones (dispareunia)");
  if (pelvicPain) tags.push("Dolor pélvico/vulvar");

  if (!tags.length) return "—";
  return tags.slice(0,2).join(" + ") + (tags.length>2 ? " (y otros)" : "");
}

function suggestedQuestionnaire(st){
  if (safetyFlag(st)) return "— (resolver seguridad primero)";

  const effort = !!st?.pfd?.perdida_esfuerzo;
  const urgency = !!st?.pfd?.urgencia_bano || !!st?.uri?.urgencia;
  const fi = !!st?.pfd?.perdida_gases_heces;
  const dysp = !!st?.pfd?.dolor_relaciones;
  const pelvicPain = !!st?.pfd?.dolor_pelvico;

  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const pregnancy = Number(st?.ciclo?.embarazo_semanas || 0) > 0;

  if (effort || urgency) return "ICIQ-UI SF";
  if (fi) return "Wexner/Vaizey";
  if (dysp && MODE === "full") return "FSFI (si sexualidad es foco)";
  if (pelvicPain) return "PFDI-20 (si PF global) o escala dolor 0–10";
  if (pregnancy || ppw>0) return "PGQ (si el foco es dolor cintura pélvica) o PFDI-20 según síntomas";
  return "—";
}

/* =======================
   Completitud + gráficos
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

function domainScores(st){
  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
  };
  return [
    { name:"Urinario", v: toNum(st?.perfil?.urinario_0_10) },
    { name:"Intestinal", v: toNum(st?.perfil?.intestinal_0_10) },
    { name:"Dolor pélvico", v: toNum(st?.perfil?.dolor_pelvico_0_10) },
    { name:"Relaciones", v: toNum(st?.perfil?.dolor_relaciones_0_10) },
    { name:"Bulto/peso", v: toNum(st?.perfil?.prolapso_0_10) },
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
  ctx.strokeStyle = "rgba(30,35,45,.10)";
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.stroke();

  const start = -Math.PI/2;
  const end = start + (Math.PI*2)*(pct/100);
  const grad = ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  grad.addColorStop(0, "rgba(243,199,197,.95)");
  grad.addColorStop(1, "rgba(127,176,155,.95)");
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx,cy,r,start,end);
  ctx.stroke();

  ctx.fillStyle = "#2a2f3d";
  ctx.font = "900 26px Manrope, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${pct}%`, cx, cy);

  ctx.fillStyle = "rgba(95,103,119,.95)";
  ctx.font = "800 12px Manrope, Arial";
  ctx.fillText("completo", cx, cy + 26);
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

  ctx.font = "800 12px Manrope, Arial";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(95,103,119,.95)";

  scores.forEach((s, i)=>{
    const y = top + i*rowH + 8;
    ctx.fillText(s.name, pad, y);

    const x0 = pad + labelW;
    ctx.fillStyle = "rgba(30,35,45,.08)";
    roundRect(ctx, x0, y-7, barW, 14, 7, true, false);

    const frac = s.v/10;
    const fw = Math.max(0, Math.round(barW*frac));
    const grad = ctx.createLinearGradient(x0,0,x0+barW,0);
    grad.addColorStop(0, "rgba(243,199,197,.95)");
    grad.addColorStop(1, "rgba(200,118,90,.85)");
    ctx.fillStyle = grad;
    roundRect(ctx, x0, y-7, fw, 14, 7, true, false);

    ctx.fillStyle = "#2a2f3d";
    ctx.font = "900 12px Manrope, Arial";
    ctx.fillText(String(s.v), x0 + barW + 16, y);
    ctx.font = "800 12px Manrope, Arial";
    ctx.fillStyle = "rgba(95,103,119,.95)";
  });
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
/* =======================
   Motor: hipótesis
   ======================= */

function getHypothesisSuggestions(st){
  const sug = [];
  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const iciq = Number(st?.out?.iciq_score || 0);
  const marinoff = parseInt(String(st?.sex?.marinoff || "").replace(/\D/g,""), 10);
  const hasDysp = !!st?.pfd?.dolor_relaciones;
  const hasUr = !!st?.pfd?.perdida_esfuerzo || !!st?.pfd?.urgencia_bano || !!st?.pfd?.perdida_sin_causa || !!st?.uri?.urgencia;

  // 1) Dispareunia
  if (hasDysp){
    const m = Number.isFinite(marinoff) ? marinoff : null;

    sug.push({
      domain:"Tejidos",
      title:`Dolor con penetración con impacto funcional${m!==null ? ` (Marinoff ${m})` : ""} – evaluar contribución de hiperactividad/guarding y/o sensibilidad de tejidos.`,
      evidence: autoEvidence(st, ["pfd.dolor_relaciones","sex.marinoff","sex.contexto_dolor","pfd.detalles_dispareunia","perfil.dolor_relaciones_0_10"]),
      toConfirm:[
        "Localización (introito vs profundo)",
        "Momento (entrada / fricción / post)",
        "Factores: sequedad, ansiedad, posiciones, ritmo",
        "Respuesta a lubricante/descanso"
      ],
      interventions:"Down-training/relajación + coordinación contract/relax sin apnea + educación + exposición gradual no dolorosa (editable).",
      priority:"Alta",
      confidence:"Media"
    });

    if (m !== null && m >= 2){
      sug.push({
        domain:"Carga/Impacto",
        title:`Tolerancia a penetración limitada (Marinoff ${m}) – priorizar estrategia gradual antes de progresión invasiva o carga intensa.`,
        evidence: autoEvidence(st, ["sex.marinoff","perfil.dolor_relaciones_0_10"]),
        toConfirm:["Tolerancia actual","Qué empeora/mejora","Barreras y seguridad percibida"],
        interventions:"Plan gradual + objetivos semanales + registro de tolerancia.",
        priority:"Alta",
        confidence:"Media"
      });
    }
  }

  // 2) Urinario
  if (hasUr){
    sug.push({
      domain:"Músculo",
      title:`Síntomas urinarios con impacto${iciq ? ` (ICIQ ${iciq})` : ""} – componente de control/strength-endurance PFM + estrategias conductuales.`,
      evidence: autoEvidence(st, ["out.iciq_score","out.iciq_contexto","uri.incontinencia","pfd.detalles_perdida_esfuerzo","pfd.detalles_urgencia","perfil.urinario_0_10"]),
      toConfirm:["Gatillantes (esfuerzo vs urgencia)","Patrón líquidos/horarios","Estreñimiento como cofactor"],
      interventions:"PFM (calidad) + control de urgencia + hábitos/registro breve 2–3 días (editable).",
      priority:"Alta",
      confidence:"Media"
    });

    if (!!st?.pfd?.urgencia_bano || !!st?.uri?.urgencia){
      sug.push({
        domain:"Hábitos/Comportamiento",
        title:"Componente de urgencia/hipersensibilidad vesical – foco en control de urgencia, respiración, hábitos, registro y gatillantes.",
        evidence: autoEvidence(st, ["pfd.urgencia_bano","uri.urgencia","pfd.detalles_urgencia","out.iciq_contexto"]),
        toConfirm:["Irritantes","Volumen","Gatillantes","Estrategias actuales"],
        interventions:"Estrategias de urgencia + respiración + ajustes de hábitos (editable).",
        priority:"Alta",
        confidence:"Media"
      });
    }
  }

  // 3) Postparto por semanas
  if (ppw > 0){
    sug.push({
      domain:"Tejidos",
      title:"Recuperación tisular y neuromuscular aún en curso; objetivo = coordinación + tolerancia progresiva según semanas postparto.",
      evidence: autoEvidence(st, ["ciclo.postparto_semanas","go.desgarros_epi","go.cesareas","perfil.urinario_0_10","perfil.prolapso_0_10"]),
      toConfirm:["Síntomas durante/24h post esfuerzo","Pesadez/arrastre","Dolor mod-severo"],
      interventions:"Progresión por tolerancia + señales de stop (editable).",
      priority:"Alta",
      confidence:"Alta"
    });

    if (ppw < 6){
      sug.push({
        domain:"Carga/Impacto",
        title:"Postparto <6 semanas – limitar impacto alto; priorizar respiración/coord y fuerza funcional baja.",
        evidence: autoEvidence(st, ["ciclo.postparto_semanas"]),
        toConfirm:["Tolerancia actual a caminata/ADL","Síntomas de disfunción con carga"],
        interventions:"Autoplan bajo impacto + coordinación (editable).",
        priority:"Alta",
        confidence:"Alta"
      });
    } else if (ppw >= 6 && ppw <= 12){
      sug.push({
        domain:"Carga/Impacto",
        title:"Postparto 6–12 semanas – progresión gradual de fuerza/capacidad sin gatillar pesadez/incontinencia/dolor mod-severo.",
        evidence: autoEvidence(st, ["ciclo.postparto_semanas","perfil.urinario_0_10","perfil.prolapso_0_10","medicion.sintoma_0_10"]),
        toConfirm:["Respuesta a fuerza funcional","Señales durante/24h"],
        interventions:"Fuerza funcional + cardio bajo impacto + técnica presión (editable).",
        priority:"Media",
        confidence:"Media"
      });
    } else if (ppw > 12){
      if ((st?.motivo?.meta || "").toLowerCase().includes("correr") || (st?.motivo?.meta || "").toLowerCase().includes("impacto")){
        sug.push({
          domain:"Carga/Impacto",
          title:"Retorno a correr/impacto – requiere criterio + progresión por tolerancia; diferir si hay síntomas de disfunción PFM.",
          evidence: autoEvidence(st, ["ciclo.postparto_semanas","motivo.meta","perfil.urinario_0_10","perfil.prolapso_0_10","medicion.sintoma_0_10"]),
          toConfirm:["Tolerancia a saltos/baja carga","Síntomas pélvicos durante/24h","Control presión"],
          interventions:"Intervalos cortos + progresión por tolerancia (editable).",
          priority:"Media",
          confidence:"Media"
        });
      }
    }
  }

  // 4) GSM (menopausia/perimenopausia)
  if (!!st?.ciclo?.gsm){
    sug.push({
      domain:"Tejidos",
      title:"Síntomas compatibles con GSM – considerar manejo combinado: educación, cuidado de tejidos, coordinación PFM y coordinación/derivación médica si corresponde.",
      evidence: autoEvidence(st, ["ciclo.gsm","ciclo.gsm_detalles","pfd.dolor_relaciones","sex.contexto_dolor"]),
      toConfirm:["Sequedad/ardor/disuria","Respuesta a lubricantes","Barreras de actividad"],
      interventions:"Educación + cuidado de tejidos + coordinación PFM (editable).",
      priority:"Alta",
      confidence:"Media"
    });
  }

  // 5) MSK ↔ pélvico (si MSK ON)
  const extras = window.__extras || ExtrasDefault();
  if (extras.settings.mskOn){
    const resp = st?.msk2?.respiracion_presion;
    const cadera = st?.msk2?.cadera;
    const dra = st?.msk2?.dra;
    const impact = st?.msk2?.tol_impacto;

    if (resp === "Disfuncional sospechada"){
      sug.push({
        domain:"Hábitos/Comportamiento",
        title:"Estrategia de presión/respiración contribuye a síntomas pélvicos (urgencia/escape/pesadez/dolor).",
        evidence: autoEvidence(st, ["msk2.respiracion_presion","msk2.respiracion_detalles","pfd.detalles_perdida_esfuerzo","pfd.detalles_urgencia"]),
        toConfirm:["Apnea/pujo en esfuerzo","Cambios al enseñar exhalación"],
        interventions:"Respiración + exhalación en esfuerzo + coordinación (editable).",
        priority:"Media",
        confidence:"Media"
      });
    }

    if (cadera && cadera !== "OK" && cadera !== "—"){
      sug.push({
        domain:"Carga/Impacto",
        title:"Control de cadera y carga lumbopélvica contribuyen a dolor/tolerancia a impacto.",
        evidence: autoEvidence(st, ["msk2.cadera","msk2.cadera_detalles","msk2.test1","msk2.test1_estado"]),
        toConfirm:["Patrones alterados","Síntomas con sentadilla/bisagra/step-down"],
        interventions:"Cadera (glúteo/rotadores) + patrón bisagra/sentadilla con exhalación (editable).",
        priority:"Media",
        confidence:"Baja"
      });
    }

    if (dra && (dra === "Sospecha" || dra === "Confirmada")){
      sug.push({
        domain:"Músculo",
        title:"Capacidad de pared abdominal y control de tronco condicionan progresión de carga/impacto (postparto).",
        evidence: autoEvidence(st, ["msk2.dra","msk2.dra_detalles","ciclo.postparto_semanas"]),
        toConfirm:["Doming/estrategia presión","Síntomas con carga"],
        interventions:"Core básico progresivo + fuerza funcional gradual (editable).",
        priority:"Media",
        confidence:"Media"
      });
    }

    if (impact && impact === "Baja"){
      sug.push({
        domain:"Carga/Impacto",
        title:"Tolerancia a impacto baja – requiere progresión por criterio; diferir impacto si hay síntomas pélvicos.",
        evidence: autoEvidence(st, ["msk2.tol_impacto","msk2.tol_detalles","perfil.prolapso_0_10","perfil.urinario_0_10"]),
        toConfirm:["Señales durante/24h","Qué gatilla"],
        interventions:"Bajo impacto + fuerza + criterios de progresión (editable).",
        priority:"Media",
        confidence:"Media"
      });
    }
  }

  return sug;
}

function autoEvidence(st, keys){
  // auto-resumen desde campos (sin inventar)
  const lines = [];
  keys.forEach(k=>{
    const v = deepGet(st, k);
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    if (s === "false" || s === "False") return;
    lines.push(`${k}: ${s}`);
  });
  return lines.slice(0,8).join("\n");
}

function addHypothesisFromSuggestion(s){
  const extras = window.__extras;
  const limit = MODE === "full" ? 5 : 2;
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
    toConfirm: (s.toConfirm || []).join("\n"),
    interventions: s.interventions || "",
    priority: s.priority || "Media",
    confidence: s.confidence || "Baja",
    notes: "",
    active: true,
    createdFrom: "auto"
  });
  saveExtras(extras);
  saveAndRefresh(extras);
  renderMotorSections(); // refresca cards motor sin re-render base
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
  // no re-render total; pero para simpleza, sí:
  renderMotorSections();
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
  const b = el("button",{class:`tab ${active?"active":""}`, type:"button", onclick:()=>{
    extras.settings.activeHypTab = name;
    saveExtras(extras);
    renderHypothesesBody();
  }},[name]);
  return b;
}

function renderHypothesesBody(){
  const extras = window.__extras;
  const st = getMergedState();
  const activeTab = extras.settings.activeHypTab;

  // update tab active styles
  $$("#hypTabs .tab").forEach(t=>{
    t.classList.toggle("active", t.textContent === activeTab);
  });

  const body = $("#hypBody");
  if (!body) return;
  body.innerHTML = "";

  // left: sugeridas
  const left = el("div",{class:"hCard"},[]);
  left.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Sugerencias (activar)"]),
      el("div",{style:"margin-top:4px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
        MODE==="full" ? "Completo: hasta 5 hipótesis activas." : "10 min: hasta 2 hipótesis activas."
      ])
    ]),
    el("div",{class:"hActions"},[
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>addBlankHypothesis(activeTab)},["+ Añadir manual"])
    ])
  ]));

  const suggestions = getHypothesisSuggestions(st).filter(s=>s.domain===activeTab);
  if (!suggestions.length){
    left.appendChild(el("div",{style:"margin-top:10px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
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
          el("div",{style:"font-weight:900; font-size:12px; color:rgba(95,103,119,.95);"},["Qué buscar (checklist):"]),
          el("div",{style:"margin-top:6px; white-space:pre-wrap; font-weight:800; font-size:12px; background:rgba(243,231,207,.35); border:1px solid rgba(30,35,45,.08); padding:10px; border-radius:14px;"},[
            (s.toConfirm||[]).map(x=>"• "+x).join("\n")
          ])
        ])
      ]));
    });
  }

  // right: activas
  const right = el("div",{class:"hCard"},[]);
  right.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Hipótesis activas (editables)"]),
      el("div",{style:"margin-top:4px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
        "Cada tarjeta guarda: evidencia, qué buscar, intervención, prioridad/confianza."
      ])
    ]),
  ]));

  const activeList = extras.hypotheses.filter(h=>h.domain===activeTab);
  if (!activeList.length){
    right.appendChild(el("div",{style:"margin-top:10px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
      "Aún no hay hipótesis activas en este dominio."
    ]));
  } else {
    activeList.forEach(h=>{
      right.appendChild(renderHypothesisCard(h));
    });
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
      el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
        el("button",{class:"smallBtn danger", type:"button", onclick:()=>removeHypothesis(h.id)},["Eliminar"])
      ])
    ]),
    el("div",{class:"itemRow"},[
      // título
      el("div",{class:"field"},[
        el("label",{},["Título"]),
        el("input",{value:h.title || "", oninput:(e)=>updateHypothesis(h.id,{title:e.target.value})})
      ]),
      // prioridad/confianza
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
        el("label",{},["Evidencia/observación que la soporta (auto + editable)"]),
        el("textarea",{rows:"4", oninput:(e)=>updateHypothesis(h.id,{evidence:e.target.value})},[h.evidence||""])
      ]),
      el("div",{class:"field"},[
        el("label",{},["Qué buscar para confirmarla (checklist)"]),
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

function select(opts, value, onChange){
  const s = el("select",{onchange:(e)=>onChange(e.target.value)},[]);
  opts.forEach(o=>{
    const op = el("option",{value:o},[o]);
    if (o===value) op.selected = true;
    s.appendChild(op);
  });
  return s;
}

/* =======================
   Motor: ejercicios + autoplan
   ======================= */

function stageFromState(st){
  const ppw = Number(st?.ciclo?.postparto_semanas || 0);
  const gw = Number(st?.ciclo?.embarazo_semanas || 0);
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
  const extras = window.__extras;
  const st = getMergedState();

  const top = el("div",{style:"display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;"},[
    el("div",{},[
      el("div",{style:"font-weight:900; font-size:12px; color:rgba(95,103,119,.95);"},[
        `Etapa detectada: ${stageFromState(st)} · Modo: ${MODE==="full"?"Completo":"10 min"}`
      ]),
    ]),
    el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>autoplan()},["Autoplan"]),
      el("button",{class:"smallBtn", type:"button", onclick:()=>clearPlan()},["Vaciar plan"])
    ])
  ]);
  card.appendChild(top);

  const row = el("div",{class:"cardRow", id:"exBody"},[]);
  card.appendChild(row);
  renderExercisesBody();
}

function renderExercisesBody(){
  const extras = window.__extras;
  const st = getMergedState();
  const body = $("#exBody");
  if (!body) return;
  body.innerHTML = "";

  // Left: biblioteca (filtrada por etapa)
  const left = el("div",{class:"hCard"},[]);
  left.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Biblioteca (añadir)"]),
      el("div",{style:"margin-top:4px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
        "Ejercicios con tags por objetivo/etapa/tolerancia."
      ])
    ])
  ]));

  const stage = stageFromState(st);
  const pool = EXERCISES.filter(ex => ex.stage.includes(stage) || ex.stage.includes("general"));

  pool.forEach(ex=>{
    left.appendChild(el("div",{class:"item"},[
      el("div",{class:"itemHead"},[
        el("div",{},[
          el("div",{class:"itemTitle"},[ex.name]),
          el("div",{class:"itemSub"},[`${ex.goal.join(" · ")} · tolerancia ${ex.tol}`])
        ]),
        el("button",{class:"smallBtn primary", type:"button", onclick:()=>addExercise(ex.id)},["Añadir"])
      ]),
      el("div",{style:"margin-top:10px; display:grid; gap:6px;"},[
        pill("Dosificación sugerida", ex.dose),
        pill("Cues", ex.cues.map(c=>"• "+c).join("\n")),
        pill("Errores comunes", ex.errors.map(c=>"• "+c).join("\n")),
        pill("Progresión", ex.prog),
      ])
    ]));
  });

  // Right: plan seleccionado
  const right = el("div",{class:"hCard"},[]);
  right.appendChild(el("div",{class:"hTop"},[
    el("div",{},[
      el("div",{class:"hTitle"},["Plan de ejercicios (editable)"]),
      el("div",{style:"margin-top:4px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
        MODE==="full" ? "Completo: 5–7 ítems (sugerido)." : "10 min: 3 ítems máximo."
      ])
    ]),
  ]));

  const selected = extras.exercisePlan.selectedIds.map(id=> EXERCISES.find(e=>e.id===id)).filter(Boolean);
  if (!selected.length){
    right.appendChild(el("div",{style:"margin-top:10px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
      "Aún no hay ejercicios seleccionados."
    ]));
  } else {
    selected.forEach(ex=>{
      right.appendChild(renderSelectedExercise(ex));
    });
  }

  right.appendChild(el("div",{class:"field"},[
    el("label",{},["Notas del plan (kine)"]),
    el("textarea",{rows:"2", oninput:(e)=>{ extras.exercisePlan.notes = e.target.value; saveExtras(extras); }},[extras.exercisePlan.notes || ""])
  ]));

  body.appendChild(left);
  body.appendChild(right);
}

function pill(title, text){
  return el("div",{style:"white-space:pre-wrap; font-weight:800; font-size:12px; background:rgba(243,231,207,.28); border:1px solid rgba(30,35,45,.08); padding:10px; border-radius:14px;"},[
    `${title}:\n${text || "—"}`
  ]);
}

function addExercise(exId){
  const extras = window.__extras;
  const limit = MODE === "full" ? 7 : 3;
  if (extras.exercisePlan.selectedIds.includes(exId)) return;
  if (extras.exercisePlan.selectedIds.length >= limit){
    toast(`Límite de ejercicios por modo: ${limit}`);
    return;
  }
  extras.exercisePlan.selectedIds.push(exId);

  // autogenera tareas por ejercicio
  ensureTask(extras.tasks.usuaria, `Realizar HEP: ${EXERCISES.find(e=>e.id===exId)?.name || exId}`, "Media");
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

  const limit = MODE === "full" ? 7 : 3;
  const max = MODE === "full" ? 6 : 3; // tu regla: full 5–7; acá seteo 6 por defecto

  const pool = EXERCISES.filter(ex => ex.stage.includes(stage) || ex.stage.includes("general"));

  // Prioridad simple por condiciones
  const wantsRunning = ((st?.motivo?.meta || "").toLowerCase().includes("correr") || (st?.motivo?.meta || "").toLowerCase().includes("impacto"));
  const dysp = !!st?.pfd?.dolor_relaciones;
  const urgency = !!st?.pfd?.urgencia_bano || !!st?.uri?.urgencia;
  const effort = !!st?.pfd?.perdida_esfuerzo;

  const picks = [];
  // regla 10min: respiración/coord + PFM + fuerza funcional o caminata
  picks.push("breath_coord");
  if (dysp) picks.push("downtrain");
  else picks.push("pfm_short");

  if (urgency || effort) picks.push("exhale_effort");
  else picks.push("walk_easy");

  // modo completo: agrega 2–3 más si hay espacio
  if (MODE === "full"){
    if (stage.startsWith("postparto_")) picks.push("walk_easy");
    if (!dysp) picks.push("bridge_clams");
    if (dysp) picks.push("exp_gradual");
    if (!!st?.ciclo?.gsm) picks.push("tissue_care");
    if (wantsRunning && stage === "postparto_12plus") picks.push("exhale_effort");
  }

  const unique = [];
  picks.forEach(id=>{
    if (!unique.includes(id) && EXERCISES.find(e=>e.id===id)) unique.push(id);
  });

  const final = unique.slice(0, max);

  extras.exercisePlan.selectedIds = final.slice(0, limit);
  saveExtras(extras);

  // tareas base por autoplan
  ensureTask(extras.tasks.usuaria, "HEP: hacer el plan X días/semana (editar)", "Alta");
  ensureTask(extras.tasks.kine, "Revisar tolerancia a ejercicios + ajustar progresión", "Alta");

  renderMotorSections();
  toast(`Autoplan listo (${extras.exercisePlan.selectedIds.length} ejercicios)`);
}

/* =======================
   Motor: tareas
   ======================= */

function ensureTask(list, title, priority="Media"){
  if (list.some(t=>t.title===title)) return;
  list.push({
    id: uid("task"),
    title,
    priority,
    due: "",
    done: false,
    details: ""
  });
}

function renderTasks(card){
  const row = el("div",{class:"cardRow", id:"tasksBody"},[]);
  card.appendChild(row);
  renderTasksBody();
}

function renderTasksBody(){
  const extras = window.__extras;
  const st = getMergedState();
  const body = $("#tasksBody");
  if (!body) return;
  body.innerHTML = "";

  // autogeneración por gatillos (solo crea si no existe)
  if (!!st?.pfd?.perdida_esfuerzo || !!st?.pfd?.urgencia_bano || !!st?.pfd?.perdida_sin_causa || !!st?.uri?.urgencia){
    ensureTask(extras.tasks.usuaria, "Registro breve 2–3 días: frecuencia, urgencia, escapes, gatillantes", "Media");
    ensureTask(extras.tasks.kine, "Revisar ICIQ + gatillantes; ajustar plan", "Alta");
  }
  if (!!st?.pfd?.dolor_relaciones){
    ensureTask(extras.tasks.usuaria, "Registrar contexto de dolor (qué, cuándo, qué ayudó)", "Alta");
    ensureTask(extras.tasks.kine, "Revisar Marinoff + tolerancia; decidir cambios/derivación si corresponde", "Alta");
  }
  if (Number(st?.ciclo?.postparto_semanas || 0) > 0){
    ensureTask(extras.tasks.usuaria, "Monitorear señales durante ejercicio (pesadez, escapes, dolor que persiste)", "Alta");
    ensureTask(extras.tasks.kine, "Definir fase postparto y criterio de progresión", "Alta");
  }
  if (extras.settings.mskOn){
    ensureTask(extras.tasks.usuaria, "Registrar qué movimientos gatillan (sentadilla/escala/levantarse/carga)", "Media");
    ensureTask(extras.tasks.kine, "Revisar test MSK elegido + ajustar progresión", "Media");
  }

  saveExtras(extras);

  body.appendChild(tasksColumn("Tareas para usuaria", extras.tasks.usuaria, "usuaria"));
  body.appendChild(tasksColumn("Tareas para kine", extras.tasks.kine, "kine"));
  body.appendChild(tasksColumn("Tareas compartidas", extras.tasks.compartidas, "compartidas"));
}

function tasksColumn(title, list, kind){
  const col = el("div",{class:"hCard"},[
    el("div",{class:"hTop"},[
      el("div",{},[
        el("div",{class:"hTitle"},[title]),
        el("div",{style:"margin-top:4px; color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
          "Tarjetas editables con prioridad, plazo y detalles."
        ])
      ]),
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>addTask(kind)},["+ Añadir"])
    ])
  ]);

  const wrap = el("div",{class:"list"},[]);
  if (!list.length){
    wrap.appendChild(el("div",{style:"color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
      "Sin tareas todavía."
    ]));
  } else {
    list.forEach(t=>{
      wrap.appendChild(renderTaskCard(t, kind));
    });
  }

  col.appendChild(wrap);
  return col;
}

function addTask(kind){
  const extras = window.__extras;
  const list = extras.tasks[kind];
  list.push({ id:uid("task"), title:"", priority:"Media", due:"", done:false, details:"" });
  saveExtras(extras);
  renderMotorSections();
}

function updateTask(kind, id, patch){
  const extras = window.__extras;
  const list = extras.tasks[kind];
  const t = list.find(x=>x.id===id);
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

function renderNextSession(card){
  const top = el("div",{style:"display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;"},[
    el("div",{style:"font-weight:900; color:rgba(95,103,119,.95); font-size:12px;"},[
      "Auto-items según positivos y plan."
    ]),
    el("div",{style:"display:flex; gap:8px; flex-wrap:wrap;"},[
      el("button",{class:"smallBtn primary", type:"button", onclick:()=>autoNextSession()},["Autollenar"]),
      el("button",{class:"smallBtn", type:"button", onclick:()=>addNextItem()},["+ Añadir"])
    ])
  ]);
  card.appendChild(top);

  card.appendChild(el("div",{class:"list", id:"nextList"},[]));
  renderNextSessionBody();
}

function autoNextSession(){
  const extras = window.__extras;
  const st = getMergedState();

  const items = [];
  // por síntomas positivos
  if (!!st?.pfd?.dolor_relaciones){
    items.push(mkNext("Reevaluar dolor en relaciones: Marinoff + 0–10 + ¿interfirió?", "Alta"));
  }
  if (!!st?.pfd?.perdida_esfuerzo || !!st?.pfd?.urgencia_bano || !!st?.pfd?.perdida_sin_causa || !!st?.uri?.urgencia){
    items.push(mkNext("Reevaluar urinario: ICIQ + situaciones de escape/urgencia", "Alta"));
  }
  if (Number(st?.ciclo?.postparto_semanas || 0) > 0){
    items.push(mkNext("Reevaluar tolerancia a carga/impacto: pesadez/arrastre/escape/dolor (durante y 24h)", "Alta"));
  }

  // por ejercicios
  if (extras.exercisePlan.selectedIds.length){
    items.push(mkNext("Revisar adherencia a HEP + síntomas durante/24h", "Alta"));
  }

  // por MSK
  if (extras.settings.mskOn){
    items.push(mkNext("Reevaluar dolor MSK (0–10) + 1 test elegido", "Media"));
  }

  // recorta por modo
  const limit = MODE === "full" ? 7 : 3;
  extras.nextSession = items.slice(0, limit);
  saveExtras(extras);
  renderMotorSections();
  toast("Próxima sesión autollenada");
}

function mkNext(text, priority){
  return { id:uid("next"), text, priority, done:false, notes:"" };
}

function addNextItem(){
  const extras = window.__extras;
  extras.nextSession.push(mkNext("", "Media"));
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
    list.appendChild(el("div",{style:"color:rgba(95,103,119,.95); font-weight:800; font-size:12px;"},[
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
   Convert examen -> hipótesis (botón)
   ======================= */

function convertExamToHypotheses(){
  const st = getMergedState();
  const extras = window.__extras;

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
      title:`Irritabilidad/dolor a palpación (dolor ${pain}/10) – evaluar contribución tisular y tolerancia.`,
      evidence: autoEvidence(st, ["int.dolor_0_10","int.dolor_donde","cons.detalles"]),
      toConfirm:["Mapa de dolor","Respuesta a relajación/lubricación","Irritabilidad post examen"],
      interventions:"Relajación/educación + estrategias de tolerancia (editable).",
      priority:"Alta",
      confidence:"Media"
    });
  }
  if (tone === "alto"){
    suggestions.push({
      domain:"Músculo",
      title:"Tono basal alto – posible hiperactividad/guarding; priorizar down-training/relajación y coordinación.",
      evidence: autoEvidence(st, ["int.tono_simple","int.coord_simple","cons.detalles"]),
      toConfirm:["Relajación voluntaria","Apnea/pujo","Dolor asociado"],
      interventions:"Down-training + coordinación contract/relax sin apnea (editable).",
      priority:"Alta",
      confidence:"Media"
    });
  }
  if (coord === "limitada"){
    suggestions.push({
      domain:"Músculo",
      title:"Coordinación contract/relax limitada – foco en calidad, timing y relajación completa.",
      evidence: autoEvidence(st, ["int.coord_simple","int.fuerza_simple"]),
      toConfirm:["Qué falla (inicio, sostén, relajación)","Compensaciones"],
      interventions:"Coordinación guiada + respiración (editable).",
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
   Motor: render refresh
   ======================= */

function renderMotorSections(){
  // vuelve a dibujar solo los cuerpos de motor (no la ficha completa)
  // hipótesis
  if ($("#hypBody")) renderHypothesesBody();
  // ejercicios
  if ($("#exBody")) renderExercisesBody();
  // tareas
  if ($("#tasksBody")) renderTasksBody();
  // next
  if ($("#nextList")) renderNextSessionBody();
}

/* =======================
   Export (PDF/Excel/JSON)
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

function blocksForPDF(st){
  const extras = window.__extras || ExtrasDefault();

  const blocks = [];

  // 0) Modo / transparencia
  blocks.push(["Modo y transparencia", [
    ["MODO", MODE === "full" ? "COMPLETO" : "10 MIN"],
    ["Qué se ocultó por modo", modeHiddenLine()],
    ["MSK", extras.settings.mskOn ? "ON" : "OFF"],
  ]]);

  // 1) Identificación (resumen)
  blocks.push(["Identificación", [
    ["Nombre", st?.id?.nombre],
    ["Edad", st?.id?.edad],
    ["Rut", st?.id?.rut],
    ["Fecha", st?.id?.fecha],
    ["Ocupación", st?.id?.ocupacion],
    ["Contacto emergencia", st?.id?.contacto_emergencia],
  ]]);

  // 2) Motivo / baseline
  blocks.push(["Motivo y baseline", [
    ["Motivo de consulta", st?.motivo?.motivo],
    ["Meta (usuaria)", st?.motivo?.meta],
    ["Historia breve", st?.motivo?.historia],
    ["Escala 0–10 síntoma principal", st?.medicion?.sintoma_0_10],
    ["Actividad 1 (0–10)", st?.medicion?.actividad_1],
    ["Actividad 2", st?.medicion?.actividad_2],
    ["Actividad 3", st?.medicion?.actividad_3],
  ]]);

  // 3) Seguridad + acciones
  blocks.push(["Seguridad / derivación", [
    ["Fiebre + dolor pélvico/urinario", st?.seg?.fiebre ? "Sí" : ""],
    ["Hematuria visible", st?.seg?.hematuria ? "Sí" : ""],
    ["Retención / incapacidad orinar", st?.seg?.retencion ? "Sí" : ""],
    ["Sangrado anormal importante", st?.seg?.sangrado ? "Sí" : ""],
    ["Dolor pélvico agudo severo nuevo", st?.seg?.dolor_agudo ? "Sí" : ""],
    ["Síntomas neurológicos nuevos", st?.seg?.neuro ? "Sí" : ""],
    ["Sospecha TVP/TEP", st?.seg?.tvp ? "Sí" : ""],
    ["Embarazo: alerta", st?.seg?.emb_alerta ? "Sí" : ""],
    ["Detalles TVP/TEP", st?.seg?.detalles_tvp],
    ["Detalles embarazo alerta", st?.seg?.detalles_emb_alerta],
    ["Acción tomada", st?.seg?.accion],
  ]]);

  // 4) Embarazo/postparto + GSM
  blocks.push(["Embarazo / postparto / ciclo", [
    ["Gestaciones", st?.go?.gestaciones],
    ["Abortos", st?.go?.abortos],
    ["Partos", st?.go?.partos],
    ["Cesáreas", st?.go?.cesareas],
    ["Desgarros/Episiotomías", st?.go?.desgarros_epi],
    ["Fecha probable parto", st?.go?.fecha_probable_parto],
    ["Peso RN", st?.go?.peso_rn],
    ["Suplementos", st?.go?.suplementos],
    ["Peso ganado", st?.go?.peso_ganado],
    ["Postparto (semanas)", st?.ciclo?.postparto_semanas],
    ["Embarazo (semanas)", st?.ciclo?.embarazo_semanas],
    ["GSM", st?.ciclo?.gsm ? "Sí" : ""],
    ["GSM detalles", st?.ciclo?.gsm_detalles],
  ]]);

  // 5) Screen PF + detalles + perfil (0–10)
  blocks.push(["Screen piso pélvico + perfil (0–10)", [
    ["Pérdida orina con esfuerzo", st?.pfd?.perdida_esfuerzo ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_perdida_esfuerzo],
    ["Urgencia para orinar", st?.pfd?.urgencia_bano ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_urgencia],
    ["Pérdida sin causa aparente", st?.pfd?.perdida_sin_causa ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_perdida_sin_causa],
    ["Pérdida gases/heces", st?.pfd?.perdida_gases_heces ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_fi],
    ["Dolor relaciones (dispareunia)", st?.pfd?.dolor_relaciones ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_dispareunia],
    ["Dolor pélvico/vulvar", st?.pfd?.dolor_pelvico ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_dolor_pelvico],
    ["Estreñimiento", st?.pfd?.estrenimiento ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_estrenimiento],

    ["Molestia urinaria (0–10)", st?.perfil?.urinario_0_10],
    ["Molestia intestinal (0–10)", st?.perfil?.intestinal_0_10],
    ["Dolor pélvico/vulvar (0–10)", st?.perfil?.dolor_pelvico_0_10],
    ["Dolor relaciones (0–10)", st?.perfil?.dolor_relaciones_0_10],
    ["Bulto/peso (0–10)", st?.perfil?.prolapso_0_10],
  ]]);

  // 6) Urinario mínimo + outcome si aplica
  blocks.push(["Urinario (mínimo) + outcome si aplica", [
    ["Frecuencia (día)", st?.uri?.frecuencia],
    ["Nicturia", st?.uri?.nicturia],
    ["Urgencia (urinario)", st?.uri?.urgencia ? "Sí" : ""],
    ["Detalles urgencia (urinario)", st?.uri?.detalles_urgencia],
    ["Incontinencia (situaciones)", st?.uri?.incontinencia],
    ["ICIQ-UI SF (0–21)", st?.out?.iciq_score],
    ["Contexto ICIQ / situaciones", st?.out?.iciq_contexto],
  ]]);

  // 7) Sexual (si hay datos)
  blocks.push(["Sexual (si aplica)", [
    ["Frecuencia relaciones", st?.sex?.frecuencia],
    ["Vaginismo", st?.sex?.vaginismo ? "Sí" : ""],
    ["Dispareunia (detalle)", st?.sex?.dispareunia ? "Sí" : ""],
    ["Marinoff", st?.sex?.marinoff],
    ["Contexto dolor", st?.sex?.contexto_dolor],
  ]]);

  // 8) Examen + consentimiento
  blocks.push(["Examen (resumen) + consentimiento", [
    ["Observación", st?.ex?.obs],
    ["Patrón respiratorio", st?.ex?.respiracion],
    ["Expliqué objetivo/alternativas/derecho a parar", st?.cons?.explico ? "Sí" : ""],
    ["Chaperón ofrecido", st?.cons?.chaperon_ofrecido ? "Sí" : ""],
    ["Examen intracavitario hoy", st?.cons?.interno],
    ["Detalles consentimiento/tolerancia/razón NO", st?.cons?.detalles],
    ["Dolor palpación (0–10)", st?.int?.dolor_0_10],
    ["Dolor dónde", st?.int?.dolor_donde],
    ["Tono basal", st?.int?.tono_simple],
    ["Coordinación contract/relax", st?.int?.coord_simple],
    ["Fuerza/endurance (nota)", st?.int?.fuerza_simple],
  ]]);

  // 9) MSK (si ON o hay datos)
  if (extras.settings.mskOn){
    blocks.push(["MSK (screen + dominios)", [
      ["Dolor MSK principal", st?.msk2?.dolor_principal],
      ["Dolor MSK (0–10)", st?.msk2?.dolor_0_10],
      ["Irradiación/neurológico", st?.msk2?.neuro],
      ["Carga/impacto", st?.msk2?.carga_impacto],
      ["Irritabilidad", st?.msk2?.irritabilidad],
      ["Detalles / mapa", st?.msk2?.detalles],

      ["Respiración/presión", st?.msk2?.respiracion_presion],
      ["Respiración detalles", st?.msk2?.respiracion_detalles],
      ["DRA", st?.msk2?.dra],
      ["DRA detalles", st?.msk2?.dra_detalles],
      ["Cadera", st?.msk2?.cadera],
      ["Cadera detalles", st?.msk2?.cadera_detalles],
      ["Lumbopélvico", st?.msk2?.lumbopelvico],
      ["Lumbo detalles", st?.msk2?.lumbo_detalles],
      ["Tol impacto", st?.msk2?.tol_impacto],
      ["Tol impacto detalles", st?.msk2?.tol_detalles],

      ["Test 1", st?.msk2?.test1],
      ["Estado test 1", st?.msk2?.test1_estado],
      ["Test 1 detalles", st?.msk2?.test1_detalles],
      ["Test 2", st?.msk2?.test2],
      ["Estado test 2", st?.msk2?.test2_estado],
      ["Test 2 detalles", st?.msk2?.test2_detalles],
    ]]);
  }

  // 10) Motor: hipótesis activas
  const hyps = (extras.hypotheses || []).filter(h => h.active);
  blocks.push(["Motor · Hipótesis activas", hyps.map(h => [
    `${h.domain} · Prioridad ${h.priority} · Confianza ${h.confidence}`,
    h.title || ""
  ])]);

  // 11) Motor: plan ejercicios
  const exSel = (extras.exercisePlan?.selectedIds || [])
    .map(id => EXERCISES.find(e => e.id === id))
    .filter(Boolean);

  blocks.push(["Motor · Plan de ejercicios", exSel.map(e => [
    e.name,
    (e._dose || e.dose || "")
  ])]);

  // 12) Motor: tareas
  const tU = extras.tasks?.usuaria || [];
  const tK = extras.tasks?.kine || [];
  const tC = extras.tasks?.compartidas || [];
  blocks.push(["Motor · Tareas usuaria", tU.map(t => [`${t.priority} · ${t.done ? "Hecho" : "Pendiente"}`, t.title])]);
  blocks.push(["Motor · Tareas kine", tK.map(t => [`${t.priority} · ${t.done ? "Hecho" : "Pendiente"}`, t.title])]);
  blocks.push(["Motor · Tareas compartidas", tC.map(t => [`${t.priority} · ${t.done ? "Hecho" : "Pendiente"}`, t.title])]);

  // 13) Motor: próxima sesión
  const ns = extras.nextSession || [];
  blocks.push(["Motor · Próxima sesión (qué ver / reevaluar)", ns.map(it => [
    `${it.priority} · ${it.done ? "Hecho" : "Pendiente"}`,
    it.text
  ])]);

  // 14) Plan final (tu texto)
  blocks.push(["Plan final (tu texto)", [
    ["Clasificación final (tu juicio)", st?.plan?.clasificacion_manual || ""],
    ["Hipótesis modificables (tu texto)", st?.plan?.hipotesis || ""],
    ["Plan 2–4 semanas (tu texto)", st?.plan?.plan_2_4 || ""],
    ["Tareas (tu texto)", st?.plan?.tareas || ""],
    ["Re-test", st?.plan?.retest || ""],
    ["Cuestionario baseline", st?.plan?.cuestionario || ""],
  ]]);

  // filtra filas vacías
  const clean = blocks.map(([title, rows]) => {
    const r = (rows || []).filter(([a,b]) => {
      const aa = String(a ?? "").trim();
      const bb = String(b ?? "").trim();
      return aa !== "" && bb !== "" && bb !== "false" && bb !== "False";
    });
    return [title, r];
  }).filter(([,r]) => r.length);

  return clean;
}

function exportPdfClin(){
  const st = getMergedState(); // base + extras adjunto
  const extras = window.__extras || ExtrasDefault();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const margin = 44;

  // Header boutique (beige + blush line)
  doc.setFillColor(243,231,207); // beige
  doc.rect(0,0,595,92,"F");
  doc.setFillColor(243,199,197); // blush
  doc.rect(0,92,595,4,"F");

  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text("Ficha clínica · Piso pélvico", margin, 44);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(
    `Usuaria: ${st?.id?.nombre || "—"}  |  Rut: ${st?.id?.rut || "—"}  |  Fecha: ${st?.id?.fecha || "—"}`,
    margin, 66
  );

  // Modo pill en PDF
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text(`MODO: ${MODE==="full"?"COMPLETO":"10 MIN"}  ·  MSK: ${extras.settings.mskOn?"ON":"OFF"}`, margin, 116);

  // Inserta gráficos (perfil + completitud)
  try{
    const imgProf = $("#cvProfile")?.toDataURL("image/png", 1.0);
    if (imgProf) doc.addImage(imgProf, "PNG", margin, 132, 507, 120);
  } catch {}

  try{
    const imgDonut = $("#cvProgress")?.toDataURL("image/png", 1.0);
    if (imgDonut) doc.addImage(imgDonut, "PNG", 595 - margin - 120, 20, 110, 110);
  } catch {}

  let y = 270;

  const blocks = blocksForPDF(st);
  blocks.forEach(([title, rows])=>{
    doc.setFont("helvetica","bold");
    doc.setFontSize(11);
    doc.text(title, margin, y);
    y += 8;

    doc.autoTable({
      startY: y,
      head: [["Campo", "Valor"]],
      body: rows.map(([a,b])=>[String(a), String(b)]),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [243,231,207], textColor:[42,47,61] },
      alternateRowStyles: { fillColor: [255,255,255] },
      margin: { left: margin, right: margin }
    });

    y = doc.lastAutoTable.finalY + 16;
    if (y > 740){
      doc.addPage();
      y = margin;
    }
  });

  doc.save(fileBaseName(st) + "_clinico.pdf");
}

function exportPdfUsuaria(){
  const st = getMergedState();
  const extras = window.__extras || ExtrasDefault();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const margin = 44;

  // Header (blush + sage line)
  doc.setFillColor(243,199,197);
  doc.rect(0,0,595,78,"F");
  doc.setFillColor(127,176,155);
  doc.rect(0,78,595,4,"F");

  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text("Resumen para la usuaria", margin, 44);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`Nombre: ${st?.id?.nombre || "—"} · Fecha: ${st?.id?.fecha || "—"}`, margin, 66);

  // Gráfico perfil (para que “diga algo”)
  try{
    const img = $("#cvProfile")?.toDataURL("image/png", 1.0);
    if (img) doc.addImage(img, "PNG", margin, 92, 507, 110);
  } catch {}

  const clas = (st?.plan?.clasificacion_manual || "").trim() || suggestedClassification(st);
  const plan = st?.plan?.plan_2_4 || "";
  const tareasTxt = (st?.plan?.tareas || "");

  const exSel = (extras.exercisePlan?.selectedIds || [])
    .map(id => EXERCISES.find(e => e.id === id))
    .filter(Boolean);

  const ejercicios = exSel.map(e => `• ${e.name} — ${(e._dose || e.dose || "").trim()}`).join("\n");
  const tareasUsuaria = (extras.tasks?.usuaria || []).slice(0,8).map(t => `• ${t.title}`).join("\n");

  const proxima = (extras.nextSession || []).slice(0,6).map(it => `• ${it.text}`).join("\n");

  const alertas = "Avísanos/consulta si aparece: fiebre + dolor pélvico/urinario, hematuria visible, retención urinaria, sangrado anormal importante, dolor agudo severo nuevo, síntomas neurológicos nuevos.";

  const rows = [
    ["Qué trabajamos hoy", clas || "—"],
    ["Tu objetivo", st?.motivo?.meta || ""],
    ["Tu plan (2–4 semanas)", plan],
    ["Ejercicios (en casa)", ejercicios || ""],
    ["Tareas", (tareasTxt || tareasUsuaria || "")],
    ["La próxima vez revisaremos", proxima || ""],
    ["Señales para avisar", alertas],
  ].filter(([,v]) => String(v||"").trim() !== "");

  doc.autoTable({
    startY: 214,
    head: [["", ""]],
    body: rows,
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [255,255,255], textColor: [255,255,255] },
    theme: "grid",
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 190, fontStyle:"bold" },
      1: { cellWidth: 595 - margin*2 - 190 }
    }
  });

  doc.save(fileBaseName(st) + "_usuaria.pdf");
}

function exportXlsx(){
  const st = getMergedState();
  const extras = window.__extras || ExtrasDefault();
  const wb = XLSX.utils.book_new();

  const wsId = XLSX.utils.aoa_to_sheet([
    ["Identificación"],
    ["Nombre", st?.id?.nombre || ""],
    ["Edad", st?.id?.edad || ""],
    ["Rut", st?.id?.rut || ""],
    ["Fecha", st?.id?.fecha || ""],
    ["Ocupación", st?.id?.ocupacion || ""],
    ["Contacto emergencia", st?.id?.contacto_emergencia || ""],
    ["Médico tratante", st?.id?.medico_tratante || ""],
    ["Matrona", st?.id?.matrona || ""],
    ["Contacto médico", st?.id?.contacto_medico || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsId, "Identificación");

  const wsMot = XLSX.utils.aoa_to_sheet([
    ["Motivo"],
    ["Motivo de consulta", st?.motivo?.motivo || ""],
    ["Meta", st?.motivo?.meta || ""],
    ["Historia breve", st?.motivo?.historia || ""],
    ["Escala 0–10", st?.medicion?.sintoma_0_10 || ""],
    ["Actividad 1", st?.medicion?.actividad_1 || ""],
    ["Actividad 2", st?.medicion?.actividad_2 || ""],
    ["Actividad 3", st?.medicion?.actividad_3 || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsMot, "Motivo");

  const wsGO = XLSX.utils.aoa_to_sheet([
    ["Embarazo/Postparto/Ciclo"],
    ["Gestaciones", st?.go?.gestaciones || ""],
    ["Abortos", st?.go?.abortos || ""],
    ["Partos", st?.go?.partos || ""],
    ["Cesáreas", st?.go?.cesareas || ""],
    ["Desgarros/Episiotomías", st?.go?.desgarros_epi || ""],
    ["Fecha probable parto", st?.go?.fecha_probable_parto || ""],
    ["Peso RN", st?.go?.peso_rn || ""],
    ["Peso ganado", st?.go?.peso_ganado || ""],
    ["Suplementos", st?.go?.suplementos || ""],
    ["Postparto semanas", st?.ciclo?.postparto_semanas || ""],
    ["Embarazo semanas", st?.ciclo?.embarazo_semanas || ""],
    ["GSM", st?.ciclo?.gsm ? "Sí" : ""],
    ["GSM detalles", st?.ciclo?.gsm_detalles || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsGO, "Ciclo");

  const wsScreen = XLSX.utils.aoa_to_sheet([
    ["Screen PF + detalles"],
    ["Pérdida esfuerzo", st?.pfd?.perdida_esfuerzo ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_perdida_esfuerzo || ""],
    ["Urgencia", st?.pfd?.urgencia_bano ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_urgencia || ""],
    ["Pérdida sin causa", st?.pfd?.perdida_sin_causa ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_perdida_sin_causa || ""],
    ["Pérdida gases/heces", st?.pfd?.perdida_gases_heces ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_fi || ""],
    ["Dolor relaciones", st?.pfd?.dolor_relaciones ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_dispareunia || ""],
    ["Dolor pélvico/vulvar", st?.pfd?.dolor_pelvico ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_dolor_pelvico || ""],
    ["Estreñimiento", st?.pfd?.estrenimiento ? "Sí" : ""],
    ["Detalles", st?.pfd?.detalles_estrenimiento || ""],
    [],
    ["Perfil (0–10)"],
    ["Urinario", st?.perfil?.urinario_0_10 || ""],
    ["Intestinal", st?.perfil?.intestinal_0_10 || ""],
    ["Dolor pélvico", st?.perfil?.dolor_pelvico_0_10 || ""],
    ["Relaciones", st?.perfil?.dolor_relaciones_0_10 || ""],
    ["Bulto/peso", st?.perfil?.prolapso_0_10 || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsScreen, "Screen_Perfil");

  const wsUro = XLSX.utils.aoa_to_sheet([
    ["Urinario"],
    ["Frecuencia", st?.uri?.frecuencia || ""],
    ["Nicturia", st?.uri?.nicturia || ""],
    ["Urgencia", st?.uri?.urgencia ? "Sí" : ""],
    ["Detalles urgencia", st?.uri?.detalles_urgencia || ""],
    ["Incontinencia (situaciones)", st?.uri?.incontinencia || ""],
    ["ICIQ-UI SF (0–21)", st?.out?.iciq_score || ""],
    ["Contexto ICIQ", st?.out?.iciq_contexto || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsUro, "Urinario");

  const wsExam = XLSX.utils.aoa_to_sheet([
    ["Examen + consentimiento"],
    ["Observación", st?.ex?.obs || ""],
    ["Patrón respiratorio", st?.ex?.respiracion || ""],
    ["Consentimiento explicado", st?.cons?.explico ? "Sí" : ""],
    ["Chaperón ofrecido", st?.cons?.chaperon_ofrecido ? "Sí" : ""],
    ["Examen intracavitario", st?.cons?.interno || ""],
    ["Detalles", st?.cons?.detalles || ""],
    ["Dolor palpación (0–10)", st?.int?.dolor_0_10 || ""],
    ["Dolor dónde", st?.int?.dolor_donde || ""],
    ["Tono", st?.int?.tono_simple || ""],
    ["Coordinación", st?.int?.coord_simple || ""],
    ["Fuerza/endurance", st?.int?.fuerza_simple || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsExam, "Examen");

  if (extras.settings.mskOn){
    const wsMsk = XLSX.utils.aoa_to_sheet([
      ["MSK"],
      ["Dolor principal", st?.msk2?.dolor_principal || ""],
      ["Dolor 0–10", st?.msk2?.dolor_0_10 || ""],
      ["Neuro", st?.msk2?.neuro || ""],
      ["Carga/impacto", st?.msk2?.carga_impacto || ""],
      ["Irritabilidad", st?.msk2?.irritabilidad || ""],
      ["Detalles", st?.msk2?.detalles || ""],
      ["Respiración/presión", st?.msk2?.respiracion_presion || ""],
      ["Respiración detalles", st?.msk2?.respiracion_detalles || ""],
      ["DRA", st?.msk2?.dra || ""],
      ["DRA detalles", st?.msk2?.dra_detalles || ""],
      ["Cadera", st?.msk2?.cadera || ""],
      ["Cadera detalles", st?.msk2?.cadera_detalles || ""],
      ["Lumbopélvico", st?.msk2?.lumbopelvico || ""],
      ["Lumbo detalles", st?.msk2?.lumbo_detalles || ""],
      ["Tol impacto", st?.msk2?.tol_impacto || ""],
      ["Tol impacto detalles", st?.msk2?.tol_detalles || ""],
      ["Test 1", st?.msk2?.test1 || ""],
      ["Estado 1", st?.msk2?.test1_estado || ""],
      ["Detalles 1", st?.msk2?.test1_detalles || ""],
      ["Test 2", st?.msk2?.test2 || ""],
      ["Estado 2", st?.msk2?.test2_estado || ""],
      ["Detalles 2", st?.msk2?.test2_detalles || ""],
    ]);
    XLSX.utils.book_append_sheet(wb, wsMsk, "MSK");
  }

  const wsPlan = XLSX.utils.aoa_to_sheet([
    ["Plan (tu texto)"],
    ["Clasificación final", st?.plan?.clasificacion_manual || ""],
    ["Hipótesis (tu texto)", st?.plan?.hipotesis || ""],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4 || ""],
    ["Tareas (tu texto)", st?.plan?.tareas || ""],
    ["Re-test", st?.plan?.retest || ""],
    ["Cuestionario baseline", st?.plan?.cuestionario || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsPlan, "Plan");

  // Motor: hipótesis
  const hypRows = (extras.hypotheses || []).map(h => ({
    Dominio: h.domain,
    Titulo: h.title,
    Evidencia: h.evidence,
    Que_buscar: h.toConfirm,
    Intervencion: h.interventions,
    Prioridad: h.priority,
    Confianza: h.confidence,
    Notas: h.notes,
    Activa: h.active ? "Sí" : "No",
    Origen: h.createdFrom
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hypRows), "Motor_Hipotesis");

  // Motor: ejercicios
  const exRows = (extras.exercisePlan?.selectedIds || []).map(id => {
    const e = EXERCISES.find(x => x.id === id);
    if (!e) return null;
    return {
      Ejercicio: e.name,
      Dosificacion: (e._dose || e.dose || ""),
      Cues: (e._cues || (e.cues || []).map(c=>"• "+c).join("\n")),
      Objetivos: (e.goal || []).join(", "),
      Tolerancia: e.tol || ""
    };
  }).filter(Boolean);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exRows), "Motor_Ejercicios");

  // Motor: tareas (3 columnas)
  const allTasks = []
    .concat((extras.tasks?.usuaria||[]).map(t=>({...t, tipo:"usuaria"})))
    .concat((extras.tasks?.kine||[]).map(t=>({...t, tipo:"kine"})))
    .concat((extras.tasks?.compartidas||[]).map(t=>({...t, tipo:"compartidas"})));

  const taskRows = allTasks.map(t=>({
    Tipo: t.tipo,
    Titulo: t.title,
    Prioridad: t.priority,
    Plazo: t.due,
    Hecho: t.done ? "Sí" : "No",
    Detalles: t.details
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), "Motor_Tareas");

  // Motor: próxima sesión
  const nextRows = (extras.nextSession || []).map(n=>({
    Item: n.text,
    Prioridad: n.priority,
    Hecho: n.done ? "Sí" : "No",
    Notas: n.notes
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nextRows), "Motor_ProximaSesion");

  // Auditoría key/value (base + motor)
  const audit = flatten(st).map(([k,v])=>({Campo:k, Valor:v}));
  // extras también
  const extrasFlat = flatten({__extras: extras}).map(([k,v])=>({Campo:k, Valor:v}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(audit.concat(extrasFlat)), "Completa_keyvalue");

  XLSX.writeFile(wb, fileBaseName(st) + ".xlsx");
}

/* =======================
   Refresh UI (hero + pairs + interp)
   ======================= */

function refreshDetailsPairs(st){
  Object.entries(DETAIL_MAP).forEach(([selKey, cfg])=>{
    const pair = document.querySelector(`[data-pair-for="${selKey}"]`);
    if (!pair) return;

    const checked = !!deepGet(st, selKey);
    pair.classList.toggle("relevant", checked);

    const ta = pair.querySelector(`textarea[data-key="${cfg.detailsKey}"]`);
    if (ta){
      ta.placeholder = checked ? cfg.yesPlaceholder : "Detalles (opcional)";
    }
  });
}

function refreshInterpBadges(){
  $$("[data-interp-for]").forEach(b=>{
    const key = b.getAttribute("data-interp-for");
    const input = document.querySelector(`[data-key="${key}"]`);
    const v = Number((input && input.value) || 0);
    const fn = SLIDER_INTERP[key];
    b.textContent = `Interpretación: ${fn ? fn(v) : "—"}`;
  });
}

function refreshHeroUI(st){
  const extras = window.__extras || ExtrasDefault();

  const name = st?.id?.nombre || "—";
  const rut = st?.id?.rut ? ` · ${st.id.rut}` : "";
  $("#chipPaciente").textContent = `Usuaria: ${name}${rut}`;

  $("#chipEtapa").textContent = `Embarazo/postparto: ${etapaStr(st)}`;

  const safe = safetyFlag(st);
  $("#chipSeguridad").textContent = safe ? "Seguridad: OJO (marcado)" : "Seguridad: sin alertas";
  $("#chipSeguridad").style.borderColor = safe ? "rgba(243,199,197,.95)" : "rgba(30,35,45,.10)";

  $("#chipMsk").textContent = extras.settings.mskOn ? "MSK: ON" : "MSK: OFF";

  const clas = (st?.plan?.clasificacion_manual || "").trim() || suggestedClassification(st);
  $("#heroClasif").textContent = `Clasificación sugerida: ${clas || "—"}`;

  const q = (st?.plan?.cuestionario || "").trim() || suggestedQuestionnaire(st);
  $("#heroSug").textContent = `Cuestionario recomendado: ${q}`;

  $("#miniMotivo").textContent = (st?.motivo?.motivo || "—").toString().slice(0,120) || "—";
  $("#miniPlan").textContent = (st?.plan?.plan_2_4 || "—").toString().slice(0,120) || "—";
  $("#miniOculto").textContent = modeHiddenLine();

  // gráficos
  const c = completion(st);
  drawDonut($("#cvProgress"), c.pct);
  $("#progressText").textContent = `${c.filled}/${c.total} campos clave`;

  drawBars($("#cvProfile"), domainScores(st));
}

function saveAndRefresh(extras){
  const st = getBaseState(true);
  saveBaseState(st);

  // refrescos UI
  refreshInterpBadges();
  refreshDetailsPairs(getMergedState());
  refreshHeroUI(getMergedState());

  // refresca motor si existe en DOM
  renderMotorSections();
}

function bindInputs(){
  $$("[data-key]").forEach(node=>{
    node.addEventListener("input", () => {
      // rango: badge valor
      if (node.type === "range"){
        const key = node.getAttribute("data-key");
        const badge = document.querySelector(`[data-range-for="${key}"]`);
        if (badge) badge.textContent = String(node.value);
      }
      saveAndRefresh(window.__extras);
    });
    node.addEventListener("change", () => saveAndRefresh(window.__extras));
  });
}

/* =======================
   Modo / MSK toggle (se nota)
   ======================= */

function ensureMiniTag(btn){
  if (!btn.querySelector(".miniTag")){
    const tag = el("span",{class:"miniTag"},["Activo"]);
    btn.appendChild(tag);
  }
}

function setMode(mode, rerender=true){
  MODE = mode;

  const btn10 = $("#btnMode10");
  const btnFull = $("#btnModeFull");

  btn10.classList.toggle("active", MODE==="10");
  btnFull.classList.toggle("active", MODE==="full");

  btn10.setAttribute("aria-pressed", MODE==="10" ? "true" : "false");
  btnFull.setAttribute("aria-pressed", MODE==="full" ? "true" : "false");

  if (MODE==="10"){
    ensureMiniTag(btn10);
  } else {
    ensureMiniTag(btnFull);
  }

  const pill = $("#pillMode");
  if (pill) pill.textContent = `Modo actual: ${MODE==="full" ? "Completo" : "10 min"}`;

  // Persistir modo para que applyLoadedState no lo deshaga
  saveBaseState(getBaseState(true));

  if (rerender){
    renderForm(window.__extras);
  } else {
    saveAndRefresh(window.__extras);
  }

  toast(`Modo cambiado a ${MODE==="full" ? "Completo" : "10 min"}`);
}

function toggleMSK(){
  const extras = window.__extras;
  extras.settings.mskOn = !extras.settings.mskOn;
  saveExtras(extras);

  const btn = $("#btnMsk");
  btn.setAttribute("aria-pressed", extras.settings.mskOn ? "true" : "false");
  btn.textContent = extras.settings.mskOn ? "MSK: ON" : "MSK: OFF";

  renderForm(extras);
  toast(`MSK ${extras.settings.mskOn ? "activado" : "desactivado"}`);
}

/* =======================
   Autocompletar (modo)
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
  const activeCount = extras.hypotheses.filter(h=>h.active).length;
  if (activeCount >= limit) return;

  const suggestions = getHypothesisSuggestions(st);

  // prioriza por orden de aparición (ya está ordenado por reglas)
  for (const s of suggestions){
    if (extras.hypotheses.filter(h=>h.active).length >= limit) break;
    const exists = extras.hypotheses.some(h => (h.title||"") === (s.title||""));
    if (!exists) addHypothesisFromSuggestion(s);
  }
}

function autofillPlanTextFromMotor(){
  const st = getMergedState();
  const extras = window.__extras;

  // Solo si están vacíos: no pisa tu lenguaje si ya escribiste
  const topHyps = extras.hypotheses
    .filter(h=>h.active)
    .slice(0,3)
    .map(h=>`- ${h.title}`)
    .join("\n");

  const topTasks = (extras.tasks?.usuaria || [])
    .slice(0,4)
    .map(t=>`- ${t.title}`)
    .join("\n");

  if (topHyps) setFieldIfEmpty("plan.hipotesis", topHyps);
  if (topTasks) setFieldIfEmpty("plan.tareas", topTasks);

  // Cuestionario sugerido si vacío y aplica
  const q = suggestedQuestionnaire(st);
  if (q && q !== "—") setFieldIfEmpty("plan.cuestionario", q);
}

function autocompletar(){
  // 1) Hipótesis sugeridas por modo
  autofillHypotheses();

  // 2) Ejercicios (autoplan respeta límites por modo)
  autoplan();

  // 3) Tareas (se autogeneran por gatillos + ejercicios)
  renderTasksBody();

  // 4) Próxima sesión
  autoNextSession();

  // 5) Si campos plan están vacíos, toma lo del motor (sin pisar lo escrito)
  autofillPlanTextFromMotor();

  saveAndRefresh(window.__extras);
  toast("Autocompletar listo (editable)");
}

/* =======================
   Bind botones header + init
   ======================= */

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

function init(){
  window.__extras = loadExtras();

  // Botones header
  $("#btnMode10").addEventListener("click", ()=> setMode("10"));
  $("#btnModeFull").addEventListener("click", ()=> setMode("full"));

  const btnMsk = $("#btnMsk");
  btnMsk.addEventListener("click", toggleMSK);
  btnMsk.setAttribute("aria-pressed", window.__extras.settings.mskOn ? "true" : "false");
  btnMsk.textContent = window.__extras.settings.mskOn ? "MSK: ON" : "MSK: OFF";

  $("#btnAuto").addEventListener("click", autocompletar);

  $("#btnPdfClin").addEventListener("click", exportPdfClin);
  $("#btnPdfPac").addEventListener("click", exportPdfUsuaria);
  $("#btnXlsx").addEventListener("click", exportXlsx);
  $("#btnJson").addEventListener("click", exportJSON);

  $("#btnClear").addEventListener("click", ()=>{
    if (confirm("¿Borrar toda la ficha? (incluye motor)")) clearAll();
  });

  // Render principal
  renderForm(window.__extras);
}

init();
