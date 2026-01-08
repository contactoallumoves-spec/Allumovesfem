const STORAGE_KEY = "pf_ficha_v2";
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
    .slice(0,60) || "paciente";
}

function fileBaseName(st){
  const name = sanitizeFilePart(st?.id?.nombre);
  const date = st?.id?.fecha || nowISODate();
  return `Ficha_PisoPelvico_${name}_${date}`;
}

/* ---------- ESQUEMA (replica tu Excel original, pero ordenado) ---------- */
/* Regla: no te cambio el lenguaje: etiquetas = textos de tu ficha */
const SECTIONS = [
  {
    id: "identificacion",
    title: "1) Identificación completa",
    badge: "Obligatorio",
    badgeKind: "req",
    mode: "min",
    fields: [
      { type:"text", key:"id.nombre", label:"Nombre:" , mode:"min"},
      { type:"number", key:"id.edad", label:"Edad:" , mode:"min"},
      { type:"text", key:"id.rut", label:"Rut:" , mode:"min"},
      { type:"date", key:"id.fecha", label:"Fecha de ingreso" , mode:"min"},
      { type:"text", key:"id.prevision", label:"Previsión" , mode:"full"},
      { type:"text", key:"id.nivel_educacional", label:"Nivel educacional:" , mode:"full"},
      { type:"text", key:"id.ocupacion", label:"Ocupación:" , mode:"min"},
      { type:"text", key:"id.habitos_deportes", label:"Deportes" , mode:"full"},
      { type:"text", key:"id.contacto_emergencia", label:"Contacto / Contacto de emergencia:" , mode:"min"},

      { type:"text", key:"id.medico_tratante", label:"Médico tratante:" , mode:"full"},
      { type:"text", key:"id.matrona", label:"Matrona" , mode:"full"},
      { type:"text", key:"id.contacto_medico", label:"Contacto medico tratante" , mode:"full"},
    ]
  },

  {
    id: "motivo",
    title: "2) Motivo de consulta",
    badge: "Obligatorio",
    badgeKind: "req",
    hint: "Mantén tu estilo: parte abierto y después aterriza lo mínimo para seguimiento.",
    mode: "min",
    fields: [
      { type:"textarea", key:"motivo.motivo", label:"Motivo de consulta:", rows:3, mode:"min" },
      { type:"textarea", key:"motivo.meta", label:"Meta (en palabras de la paciente)", rows:2, mode:"min" },
      { type:"textarea", key:"motivo.historia", label:"Historia breve / contexto", rows:2, mode:"min" },

      // sin siglas visibles
      { type:"number", key:"medicion.escala_0_10", label:"Escala 0–10 del síntoma principal", mode:"min", min:0, max:10 },
      { type:"text", key:"medicion.actividad_1", label:"Actividad importante 1 + 0–10 (capacidad)", mode:"min", placeholder:"Ej: correr 2/10" },
      { type:"text", key:"medicion.actividad_2", label:"Actividad importante 2 + 0–10 (capacidad)", mode:"full" },
      { type:"text", key:"medicion.actividad_3", label:"Actividad importante 3 + 0–10 (capacidad)", mode:"full" },
    ]
  },

  {
    id: "seguridad",
    title: "3) Seguridad / derivación",
    badge: "P0",
    badgeKind: "p0",
    hint: "Si marcas algo relevante aquí: detener, coordinar, derivar según criterio clínico.",
    mode: "min",
    fields: [
      { type:"check", key:"seg.fiebre", label:"Fiebre/escalofríos + dolor pélvico o urinario", mode:"min"},
      { type:"check", key:"seg.hematuria", label:"Hematuria visible", mode:"min"},
      { type:"check", key:"seg.retencion", label:"Retención / incapacidad para orinar / dolor suprapúbico severo", mode:"min"},
      { type:"check", key:"seg.sangrado", label:"Sangrado genital anormal importante / postmenopáusico", mode:"min"},
      { type:"check", key:"seg.dolor_agudo", label:"Dolor pélvico agudo severo “nuevo”", mode:"min"},
      { type:"check", key:"seg.neuro", label:"Síntomas neurológicos nuevos (anestesia silla de montar / debilidad progresiva / cambios esfínteres no explicados)", mode:"min"},
      { type:"check", key:"seg.tvp", label:"Sospecha TVP/TEP (no usar Homans; derivación según clínica)", mode:"min"},
      // embarazo extra, pero en tu lenguaje (y opcional en 10min)
      { type:"check", key:"seg.emb_sangrado", label:"Embarazo: sangrado, pérdida de líquido o dolor severo (derivar)", mode:"full"},
      { type:"textarea", key:"seg.accion", label:"Notas / acción tomada (si aplica)", rows:2, mode:"full" }
    ]
  },

  {
    id: "antecedentes_medicos",
    title: "4) Antecedentes médicos y medicamentos",
    badge: "Completa",
    badgeKind: "req",
    hint: "Deja esto como completo cuando quieras profundizar. En 10 min: solo si cambia conducta hoy.",
    mode: "full",
    fields: [
      { type:"check", key:"am.musculoesqueleticos", label:"Musculoesqueleticos", mode:"full"},
      { type:"check", key:"am.neurologicos", label:"Neurologicos", mode:"full"},
      { type:"check", key:"am.endocrinos", label:"Endocrinos", mode:"full"},
      { type:"check", key:"am.cardiopulmonar", label:"Cardio pulmonar", mode:"full"},
      { type:"check", key:"am.otros", label:"Otros", mode:"full"},
      { type:"textarea", key:"am.medicamentos", label:"Medicamentos", rows:2, mode:"full"},
    ]
  },

  {
    id: "gineco_obst",
    title: "5) Antecedentes gineco-obstétricos (embarazo y postparto incluidos)",
    badge: "Obligatorio",
    badgeKind: "req",
    hint: "Las embarazadas las ves en cualquier trimestre: por eso está completo y ordenado.",
    mode: "min",
    fields: [
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
    ]
  },

  {
    id:"habitos",
    title:"6) Hábitos",
    badge:"Completa",
    badgeKind:"req",
    mode:"full",
    fields:[
      { type:"text", key:"hab.act_fisica", label:"Actividad fisica", mode:"full" },
      { type:"text", key:"hab.alimentacion", label:"Alimentación", mode:"full" },
      { type:"text", key:"hab.alcohol", label:"Alcohol", mode:"full" },
      { type:"text", key:"hab.tabaco", label:"Tabaco", mode:"full" },
      { type:"text", key:"hab.horas_sueno", label:"Horas de sueño", mode:"full" },
    ]
  },

  {
    id:"dolor_msk",
    title:"7) Dolor musculoesquelético (si aplica)",
    badge:"Completa",
    badgeKind:"req",
    mode:"full",
    fields:[
      { type:"text", key:"msk.A_cuando_inicia", label:"A (Cuando inicia)", mode:"full" },
      { type:"text", key:"msk.L_donde_localiza", label:"L (Donde se localiza)", mode:"full" },
      { type:"text", key:"msk.I_irradiacion", label:"I (Irradiacion)", mode:"full" },
      { type:"text", key:"msk.C_caracter", label:"C (Punzante , quemante.. )", mode:"full" },
      { type:"text", key:"msk.I_intensidad", label:"I (intensidad EVA)", mode:"full" },
      { type:"text", key:"msk.A_agrav_atenua", label:"A (Atenuantes /agravantes)", mode:"full" },
    ]
  },

  {
    id:"pfd_screen",
    title:"8) Disfunción del piso pélvico (screen)",
    badge:"Obligatorio",
    badgeKind:"req",
    hint:"Marca lo que aplica. En 10 min, con esto ya puedes clasificar y decidir el foco.",
    mode:"min",
    fields:[
      { type:"check", key:"pfd.perdida_esfuerzo", label:"Pérdida de orina al toser, estornudar, reír o hacer ejercicio", mode:"min"},
      { type:"check", key:"pfd.urgencia_bano", label:"Necesidad urgente de orinar y dificultad para llegar al baño a tiempo", mode:"min"},
      { type:"check", key:"pfd.perdida_sin_causa", label:"Pérdida de orina sin causa aparente", mode:"min"},
      { type:"check", key:"pfd.perdida_gases_heces", label:"Pérdida involuntaria de gases o heces", mode:"min"},
      { type:"check", key:"pfd.dolor_relaciones", label:"Dolor durante las relaciones sexuales (dispareunia).", mode:"min"},
      { type:"check", key:"pfd.dolor_pelvico", label:"Dolor en la zona pélvica, vulvar o abdominal baja (dolor pélvico crónico).", mode:"min"},
      { type:"check", key:"pfd.estrenimiento", label:"Estreñimiento", mode:"min"},
    ]
  },

  {
    id:"urinario",
    title:"9) Tracto urinario inferior",
    badge:"10 min / Completa",
    badgeKind:"req",
    mode:"min",
    fields:[
      // llenado
      { type:"text", key:"uri.frecuencia", label:"Frecuencia: ¿Cuántas veces al día orinas?", mode:"min"},
      { type:"text", key:"uri.nicturia", label:"Nicturia: ¿Cuántas veces te levantas en la noche para orinar?", mode:"min"},
      { type:"check", key:"uri.urgencia", label:"Urgencia: ¿Sientes un deseo repentino e incontrolable de orinar?", mode:"min"},
      { type:"text", key:"uri.incontinencia", label:"Incontinencia: ¿Pierdes orina involuntariamente? ¿En qué situaciones?", mode:"min"},

      // vaciado
      { type:"check", key:"uri.retardo", label:"Retardo miccional: ¿Tienes dificultad para iniciar la micción?", mode:"full"},
      { type:"check", key:"uri.chorro_debil", label:"Chorro débil/intermitente: ¿El chorro de orina es débil o se interrumpe?", mode:"full"},
      { type:"check", key:"uri.pujo_orinar", label:"Esfuerzo miccional: ¿Necesitas pujar para orinar?", mode:"full"},
      { type:"check", key:"uri.disuria", label:"Disuria: ¿Sientes dolor o ardor al orinar?", mode:"full"},
      { type:"check", key:"uri.retencion", label:"Retención urinaria: ¿Sientes que no vacías completamente la vejiga?", mode:"full"},

      // postmiccionales + sensitivos
      { type:"check", key:"uri.post_incompleto", label:"¿Sientes que no has vaciado completamente la vejiga después de orinar?", mode:"full"},
      { type:"check", key:"uri.goteo", label:"¿Tienes goteo de orina después de orinar?", mode:"full"},
      { type:"check", key:"uri.sensacion_llenado", label:"¿Has notado algún cambio en la sensación de llenado de tu vejiga?", mode:"full"},
      { type:"check", key:"uri.ganas_antes", label:"Ganas de orinar antes de que la vejiga esté realmente llena?", mode:"full"},
      { type:"check", key:"uri.ganas_llena", label:"Ganas de orinar cuando la vejiga está llena?", mode:"full"},
      { type:"check", key:"uri.no_ganas", label:"No sientes ganas de orinar aunque la vejiga esté llena?", mode:"full"},
    ]
  },

  {
    id:"defecatorio",
    title:"10) Función defecatoria",
    badge:"Completa",
    badgeKind:"req",
    mode:"full",
    fields:[
      { type:"text", key:"def.frecuencia", label:"¿Con qué frecuencia tienes deposiciones?", mode:"full"},
      { type:"text", key:"def.consistencia", label:"¿Qué consistencia tienen ?", mode:"full"},
      { type:"check", key:"def.pujo_maniobras", label:"¿Necesitas pujar o realizar maniobras (como introducir un dedo en el recto) para facilitar la defecación?", mode:"full"},
      { type:"check", key:"def.urgencia_fecal", label:"Urgencia fecal", mode:"full"},
      { type:"check", key:"def.dolor_defecar", label:"¿Sientes dolor al defecar o en la zona anal/rectal?", mode:"full"},
      { type:"check", key:"def.laxantes", label:"¿Utilizas laxantes, supositorios o enemas para ayudarte a defecar?", mode:"full"},
    ]
  },

  {
    id:"sexual",
    title:"11) Función sexual (con opción de posponer)",
    badge:"Completa",
    badgeKind:"req",
    mode:"full",
    fields:[
      { type:"text", key:"sex.frecuencia", label:"¿Con qué frecuencia tienes relaciones sexuales actualmente?", mode:"full"},
      { type:"check", key:"sex.vaginismo", label:"Vaginismo: ¿Experimentas contracciones involuntarias de los músculos vaginales que dificultan o impiden la penetración?", mode:"full"},
      { type:"check", key:"sex.dispareunia", label:"Dispareunia: ¿Sientes dolor durante las relaciones sexuales? ¿Dónde se localiza el dolor? ¿Es superficial o profundo?", mode:"full"},
      { type:"check", key:"sex.libido", label:"Libido: ¿Has notado cambios en tu deseo sexual? ¿Ha aumentado o disminuido?", mode:"full"},
      { type:"check", key:"sex.anorgasmia", label:"Anorgasmia: ¿Tienes dificultades para llegar al orgasmo? ¿Siempre ha sido así o es algo reciente?", mode:"full"},

      // Marinoff (sin sigla, pero mantengo tu texto)
      { type:"select", key:"sex.marinoff", label:"Escala de Marinoff (si aplica)", mode:"full",
        options:["—","Grado I: disconfort que no impide el coito","Grado II: frecuentemente impide el coito","Grado III: siempre impide el coito"]
      },
      { type:"textarea", key:"sex.notas", label:"Notas (en tus palabras)", rows:2, mode:"full" },
    ]
  },

  {
    id:"examen",
    title:"12) Examen físico / ginecológico (tu estructura)",
    badge:"10 min / Completa",
    badgeKind:"req",
    hint:"En 10 min: solo observación + patrón respiratorio + 1 hallazgo clave. Completa: todo lo que uses.",
    mode:"min",
    fields:[
      // observación general
      { type:"textarea", key:"ex.obs", label:"Observación", rows:2, mode:"min" },
      { type:"text", key:"ex.marcha", label:"Marcha", mode:"full" },
      { type:"text", key:"ex.postura", label:"Postura en todos los planos", mode:"full" },
      { type:"text", key:"ex.respiracion", label:"Patrón respiratorio", mode:"min" },

      // movimiento
      { type:"text", key:"ex.arom", label:"AROM", mode:"full" },
      { type:"text", key:"ex.prom", label:"PROM", mode:"full" },
      { type:"text", key:"ex.mov_acc", label:"Movimientos accesorios", mode:"full" },
      { type:"text", key:"ex.funcionales", label:"Funcionales", mode:"full" },
      { type:"text", key:"ex.fuerza", label:"Fuerza", mode:"full" },

      // consentimiento examen intracavitario
      { type:"div", mode:"min" },
      { type:"check", key:"cons.explico", label:"Expliqué objetivo, alternativas, derecho a parar", mode:"min"},
      { type:"check", key:"cons.chaperon_ofrecido", label:"Ofrecí chaperón", mode:"min"},
      { type:"select", key:"cons.interno", label:"Examen intracavitario hoy (si está indicado)", mode:"min",
        options:["—","No","Sí (vaginal)","Sí (rectal)"]
      },
      { type:"text", key:"cons.contra", label:"Contraindicaciones / por qué no (si aplica)", mode:"full" },

      // inspección SP (tu contenido)
      { type:"div", mode:"full" },
      { type:"text", key:"sp.cicatrices", label:"Cicatrices", mode:"full" },
      { type:"text", key:"sp.episiotomias", label:"Episiotomias", mode:"full" },
      { type:"text", key:"sp.desgarros", label:"Desgarros", mode:"full" },
      { type:"text", key:"sp.irregular_anal", label:"Irregularidad canal anal", mode:"full" },

      { type:"text", key:"sp.abertura_vulvar", label:"Abertura vulvar", mode:"full" },
      { type:"text", key:"sp.troficidad", label:"Troficidad : Aspecto mucosa , color , lubricación , flujo", mode:"full" },
      { type:"text", key:"sp.dist_anovulvar", label:"Distancia anovulvar (entre 3 y 3.5 cm)", mode:"full" },

      { type:"text", key:"sp.pujo", label:"Pujo", mode:"full" },
      { type:"text", key:"sp.contraccion_perineal", label:"Contracción perineal", mode:"full" },
      { type:"text", key:"sp.relajacion_perineal", label:"Relajación perineal (Escala de relajación de reissin)", mode:"full" },

      // Q-tip (solo si aplica, no lo fuerzo)
      { type:"check", key:"sp.qtip", label:"Q-tip test (si aplica)", mode:"full" },
      { type:"text", key:"sp.qtip_hallazgo", label:"Q-tip: hallazgo (si lo hiciste)", mode:"full" },

      // palpación intracavitaria (PERFECT + dolor/tono)
      { type:"div", mode:"full" },
      { type:"text", key:"int.perfect", label:"Protocolo PERFECT (si aplica)", mode:"full", placeholder:"Ej: fuerza / resistencia / repeticiones / rápidas / elevación" },
      { type:"select", key:"int.tono", label:"Tono", mode:"full", options:["—","normo","hipo","hiper"] },
      { type:"text", key:"int.puntos_gatillo", label:"Puntos dolorosos / puntos gatillo", mode:"full" },
      { type:"text", key:"int.score_hipertonia", label:"Score de hipertonía (0–4) (si lo usas)", mode:"full" },

      // POP
      { type:"div", mode:"full" },
      { type:"select", key:"pop.estadio", label:"Examen estática pélvica (POP) - estadio (si aplica)", mode:"full",
        options:["—","Estadio 0 (ausente)","Estadio I (>1 cm sobre himen)","Estadio II (1 cm sobre o bajo himen)","Estadio III (> 1 cm)"]
      },
      { type:"text", key:"pop.notas", label:"Notas POP (valsalva / síntomas)", mode:"full" },

      // manometría anorectal (queda como módulo avanzado)
      { type:"div", mode:"full" },
      { type:"check", key:"manom.usada", label:"Evaluación manometría anorectal (solo si la usaste)", mode:"full" },
      { type:"textarea", key:"manom.notas", label:"Notas manometría (balón simple/doble, sincronismo, etc.)", rows:2, mode:"full" },
    ]
  },

  {
    id:"plan",
    title:"13) Clasificación, hipótesis y plan",
    badge:"Obligatorio",
    badgeKind:"req",
    hint:"Sin siglas: deja tu juicio escrito en español simple, pero preciso.",
    mode:"min",
    fields:[
      { type:"text", key:"plan.clasificacion_manual", label:"Clasificación final (tu juicio)", mode:"min",
        placeholder:"Ej: incontinencia de esfuerzo + control de presión / dolor pélvico miofascial…"
      },
      { type:"text", key:"plan.hipotesis", label:"Hipótesis modificables (máx 3)", mode:"min" },
      { type:"textarea", key:"plan.plan_2_4", label:"Plan 2–4 semanas (con tu lenguaje)", rows:3, mode:"min" },
      { type:"textarea", key:"plan.tareas", label:"Tareas para la casa / seguimiento", rows:3, mode:"min" },
      { type:"text", key:"plan.retest", label:"Re-test (cuándo)", mode:"full", placeholder:"Ej: 2–4 semanas o 4–6 sesiones" },
      { type:"select", key:"plan.cuestionario", label:"Cuestionario elegido (baseline)", mode:"full",
        options:["—","ICIQ-UI SF","PFDI-20","PGQ","Wexner/Vaizey","Otro"]
      },
    ]
  }
];

/* ---------- Render ---------- */
function shouldShow(mode){
  if (MODE === "full") return true;
  return mode !== "full";
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

function renderForm(){
  const root = $("#formRoot");
  root.innerHTML = "";

  SECTIONS.forEach(sec=>{
    if (!shouldShow(sec.mode)) return;

    const card = el("section", { class:"card", "data-sec": sec.id }, []);
    const h = el("div", { class:"card-h" }, [
      el("div", {}, [
        el("h2", {}, [sec.title]),
        sec.hint ? el("div",{class:"hint"},[sec.hint]) : null
      ]),
      el("span", { class: `badge ${sec.badgeKind || ""}`}, [sec.badge || ""])
    ]);
    card.appendChild(h);

    // layout simple: 2 columnas cuando es cómodo
    const grid = el("div", { class:"grid2" }, []);

    sec.fields.forEach(f=>{
      if (!shouldShow(f.mode || sec.mode)) return;

      if (f.type === "div"){
        card.appendChild(el("div",{class:"div"},[]));
        return;
      }

      if (f.type === "check"){
        const row = el("label",{class:"check"},[
          el("input",{type:"checkbox","data-key":f.key}),
          el("span",{},[f.label])
        ]);
        card.appendChild(row);
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
      grid.appendChild(field);
    });

    // si hay muchos checks, ya están fuera del grid. Si el grid queda vacío, no lo agregues.
    if (grid.childNodes.length) card.appendChild(grid);
    root.appendChild(card);
  });

  bindInputs();
  applyLoadedState();
  saveAndRefresh();
}

/* ---------- State ---------- */
function getState(){
  const st = { _meta:{mode:MODE, updatedAt:new Date().toISOString()} };
  $$("[data-key]").forEach(node=>{
    const k = node.getAttribute("data-key");
    let v = "";
    if (node.type === "checkbox") v = !!node.checked;
    else v = node.value ?? "";
    deepSet(st, k, v);
  });
  return st;
}

function applyState(st){
  if (!st) return;
  $$("[data-key]").forEach(node=>{
    const k = node.getAttribute("data-key");
    const v = deepGet(st, k);
    if (v === undefined) return;
    if (node.type === "checkbox") node.checked = !!v;
    else node.value = v;
  });
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveState(st){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
}

function clearAll(){
  localStorage.removeItem(STORAGE_KEY);
  renderForm();
}

/* ---------- Automático: seguridad / etapa / clasificación / cuestionario sugerido ---------- */
function safetyFlag(st){
  const s = st?.seg || {};
  const keys = ["fiebre","hematuria","retencion","sangrado","dolor_agudo","neuro","tvp","emb_sangrado"];
  return keys.some(k=> !!s[k]);
}

function etapa(st){
  // usando tu lenguaje del bloque GO + lo mínimo
  const fpp = st?.go?.fecha_probable_parto || "";
  const pp = st?.go?.partos || "";
  const ces = st?.go?.cesareas || "";
  const peso = st?.go?.peso_rn || "";

  const signals = [];
  if (fpp) signals.push(`FPP: ${fpp}`);
  if (peso) signals.push(`RN: ${peso}`);
  if (pp || ces) signals.push(`Partos/Cesáreas: ${[pp,ces].filter(Boolean).join("/")}`);
  return signals.length ? signals.join(" · ") : "—";
}

function suggestedClassification(st){
  // sin siglas, en español
  const tags = [];

  // screen simple
  if (st?.pfd?.perdida_esfuerzo) tags.push("Pérdida de orina con esfuerzo");
  if (st?.pfd?.urgencia_bano || st?.uri?.urgencia) tags.push("Urgencia para orinar");
  if (st?.pfd?.perdida_gases_heces) tags.push("Pérdida de gases/heces");
  if (st?.pfd?.estrenimiento) tags.push("Estreñimiento");
  if (st?.pfd?.dolor_relaciones) tags.push("Dolor en relaciones sexuales");
  if (st?.pfd?.dolor_pelvico) tags.push("Dolor pélvico/vulvar");
  if (st?.pop?.estadio) tags.push("Sospecha de prolapso (si es sintomático)");

  // si no hay tags
  if (!tags.length) return "—";

  // prioriza 1–2
  return tags.slice(0,2).join(" + ") + (tags.length>2 ? " (y otros)" : "");
}

function suggestedQuestionnaire(st){
  // recomendación simple, no invasiva
  // (si quieres cambiar qué recomiendas por defecto, lo ajustamos en 30 segundos)
  if (st?.pfd?.perdida_esfuerzo || st?.pfd?.urgencia_bano || st?.pfd?.perdida_sin_causa) return "ICIQ-UI SF";
  if (st?.pfd?.perdida_gases_heces) return "Wexner/Vaizey";
  if (st?.pop?.estadio) return "PFDI-20";
  // embarazo/postparto con dolor de cintura pélvica: sugerir PGQ solo si lo estás usando
  if ((st?.go?.fecha_probable_parto || st?.go?.peso_rn) && (st?.pfd?.dolor_pelvico)) return "PFDI-20 o PGQ (según foco)";
  return "—";
}

function nextStepHint(st){
  if (safetyFlag(st)) return "Hay red flags marcadas: define acción/derivación antes de avanzar.";
  if (st?.pfd?.dolor_relaciones && st?.sp?.qtip) return "Si hay dolor vestibular: registra Q-tip y plan de exposición/relajación según tolerancia.";
  if (st?.pfd?.perdida_esfuerzo) return "Foco inicial: control de presión + entrenamiento específico (progresión).";
  if (st?.pfd?.urgencia_bano) return "Foco inicial: educación de urgencia + hábitos + control."
  return "—";
}

/* ---------- UI updates ---------- */
function refreshHero(st){
  const name = st?.id?.nombre || "—";
  const rut = st?.id?.rut ? ` · ${st.id.rut}` : "";
  $("#chipPaciente").textContent = `Paciente: ${name}${rut}`;

  const et = etapa(st);
  $("#chipEtapa").textContent = `Embarazo/postparto: ${et}`;

  $("#chipSeguridad").textContent = safetyFlag(st) ? "Seguridad: OJO (marcado)" : "Seguridad: sin alertas";
  $("#chipSeguridad").style.borderColor = safetyFlag(st) ? "rgba(255,183,209,.85)" : "rgba(30,35,45,.10)";

  const clas = st?.plan?.clasificacion_manual?.trim() ? st.plan.clasificacion_manual.trim() : suggestedClassification(st);
  $("#heroClasif").textContent = `Clasificación sugerida: ${clas || "—"}`;

  const q = st?.plan?.cuestionario?.trim() ? st.plan.cuestionario.trim() : suggestedQuestionnaire(st);
  const ns = nextStepHint(st);
  $("#heroSug").textContent = `Cuestionario recomendado: ${q} · Siguiente paso: ${ns}`;

  $("#miniMotivo").textContent = (st?.motivo?.motivo || "—").toString().slice(0,120) || "—";
  $("#miniPlan").textContent = (st?.plan?.plan_2_4 || "—").toString().slice(0,120) || "—";
}

/* ---------- Export PDF/Excel ---------- */
function flatten(st){
  const out = [];
  function walk(obj, pref=""){
    if (obj === null || obj === undefined) return;
    if (typeof obj !== "object"){
      const v = String(obj);
      if (v.trim() !== "" && v !== "false" && v !== "False") out.push([pref, v]);
      return;
    }
    Object.keys(obj).forEach(k=>{
      if (k === "_meta") return;
      const np = pref ? `${pref}.${k}` : k;
      walk(obj[k], np);
    });
  }
  walk(st,"");
  return out;
}

function sectionPairs(st){
  // PDF ordenado por bloques (solo llenado)
  const blocks = [];

  blocks.push(["Identificación", [
    ["Nombre", st?.id?.nombre],
    ["Edad", st?.id?.edad],
    ["Rut", st?.id?.rut],
    ["Fecha", st?.id?.fecha],
    ["Ocupación", st?.id?.ocupacion],
    ["Contacto emergencia", st?.id?.contacto_emergencia],
  ]]);

  blocks.push(["Motivo", [
    ["Motivo de consulta", st?.motivo?.motivo],
    ["Meta", st?.motivo?.meta],
    ["Historia breve", st?.motivo?.historia],
    ["Escala 0–10 síntoma principal", st?.medicion?.escala_0_10],
    ["Actividad 1 + 0–10", st?.medicion?.actividad_1],
    ["Actividad 2 + 0–10", st?.medicion?.actividad_2],
    ["Actividad 3 + 0–10", st?.medicion?.actividad_3],
  ]]);

  blocks.push(["Seguridad / derivación", [
    ["Fiebre + dolor pélvico/urinario", st?.seg?.fiebre ? "Sí" : ""],
    ["Hematuria visible", st?.seg?.hematuria ? "Sí" : ""],
    ["Retención urinaria", st?.seg?.retencion ? "Sí" : ""],
    ["Sangrado anormal", st?.seg?.sangrado ? "Sí" : ""],
    ["Dolor agudo severo", st?.seg?.dolor_agudo ? "Sí" : ""],
    ["Síntomas neurológicos", st?.seg?.neuro ? "Sí" : ""],
    ["Sospecha TVP/TEP", st?.seg?.tvp ? "Sí" : ""],
    ["Embarazo: sangrado/pérdida líquido/dolor severo", st?.seg?.emb_sangrado ? "Sí" : ""],
    ["Acción tomada", st?.seg?.accion],
  ]]);

  blocks.push(["Gineco-obstétricos", [
    ["Gestaciones", st?.go?.gestaciones],
    ["Abortos", st?.go?.abortos],
    ["Partos", st?.go?.partos],
    ["Cesáreas", st?.go?.cesareas],
    ["Fecha probable parto", st?.go?.fecha_probable_parto],
    ["Peso RN", st?.go?.peso_rn],
    ["Peso ganado", st?.go?.peso_ganado],
    ["Suplementos", st?.go?.suplementos],
    ["Desgarros/Episiotomías", st?.go?.desgarros_epi],
  ]]);

  blocks.push(["Screen piso pélvico", [
    ["Pérdida orina con esfuerzo", st?.pfd?.perdida_esfuerzo ? "Sí" : ""],
    ["Urgencia para orinar", st?.pfd?.urgencia_bano ? "Sí" : ""],
    ["Pérdida orina sin causa", st?.pfd?.perdida_sin_causa ? "Sí" : ""],
    ["Pérdida gases/heces", st?.pfd?.perdida_gases_heces ? "Sí" : ""],
    ["Dolor en relaciones", st?.pfd?.dolor_relaciones ? "Sí" : ""],
    ["Dolor pélvico", st?.pfd?.dolor_pelvico ? "Sí" : ""],
    ["Estreñimiento", st?.pfd?.estrenimiento ? "Sí" : ""],
  ]]);

  blocks.push(["Urinario / defecatorio / sexual (según lo que llenaste)", [
    ["Frecuencia orinar", st?.uri?.frecuencia],
    ["Nicturia", st?.uri?.nicturia],
    ["Urgencia (urinario)", st?.uri?.urgencia ? "Sí" : ""],
    ["Incontinencia (situaciones)", st?.uri?.incontinencia],

    ["Deposiciones (frecuencia)", st?.def?.frecuencia],
    ["Consistencia", st?.def?.consistencia],

    ["Relaciones sexuales (frecuencia)", st?.sex?.frecuencia],
    ["Vaginismo", st?.sex?.vaginismo ? "Sí" : ""],
    ["Dispareunia (detalle)", st?.sex?.dispareunia ? "Sí" : ""],
    ["Marinoff", st?.sex?.marinoff],
  ]]);

  blocks.push(["Examen y plan", [
    ["Observación", st?.ex?.obs],
    ["Patrón respiratorio", st?.ex?.respiracion],
    ["Consentimiento explicado", st?.cons?.explico ? "Sí" : ""],
    ["Chaperón ofrecido", st?.cons?.chaperon_ofrecido ? "Sí" : ""],
    ["Examen intracavitario hoy", st?.cons?.interno],
    ["PERFECT (si aplica)", st?.int?.perfect],
    ["Tono", st?.int?.tono],
    ["Clasificación final (tu juicio)", st?.plan?.clasificacion_manual || suggestedClassification(st)],
    ["Hipótesis", st?.plan?.hipotesis],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4],
    ["Tareas", st?.plan?.tareas],
    ["Re-test", st?.plan?.retest],
    ["Cuestionario baseline", st?.plan?.cuestionario || suggestedQuestionnaire(st)],
  ]]);

  // filtra vacíos
  return blocks.map(([title, rows]) => {
    const filtered = rows.filter(([,v]) => v !== undefined && v !== null && String(v).trim() !== "");
    return [title, filtered];
  }).filter(([,rows]) => rows.length);
}

function exportPdfClin(){
  const st = getState();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const margin = 44;

  // header pastel
  doc.setFillColor(243,231,207); // sand
  doc.rect(0,0,595,92,"F");
  doc.setFillColor(184,166,255); // lav accent strip
  doc.rect(0,92,595,4,"F");

  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text("Ficha clínica · Piso pélvico", margin, 44);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  const line = `Paciente: ${st?.id?.nombre || "—"}  |  Rut: ${st?.id?.rut || "—"}  |  Fecha: ${st?.id?.fecha || "—"}  |  Modo: ${MODE==="full"?"Completa":"10 min"}`;
  doc.text(line, margin, 66);

  const clas = st?.plan?.clasificacion_manual?.trim() ? st.plan.clasificacion_manual.trim() : suggestedClassification(st);
  const q = st?.plan?.cuestionario?.trim() ? st.plan.cuestionario.trim() : suggestedQuestionnaire(st);

  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text(`Clasificación: ${clas || "—"}`, margin, 116);
  doc.setFont("helvetica","normal");
  doc.text(`Cuestionario recomendado: ${q}`, margin, 134);

  let y = 156;

  const blocks = sectionPairs(st);
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
      headStyles: { fillColor: [184,166,255] },
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

function exportPdfPaciente(){
  const st = getState();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const margin = 44;

  doc.setFillColor(255,183,209); // rose
  doc.rect(0,0,595,78,"F");
  doc.setFillColor(168,230,208); // mint strip
  doc.rect(0,78,595,4,"F");

  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text("Resumen para la paciente", margin, 44);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`Nombre: ${st?.id?.nombre || "—"} · Fecha: ${st?.id?.fecha || "—"}`, margin, 66);

  const motivo = st?.motivo?.motivo || "";
  const meta = st?.motivo?.meta || "";
  const plan = st?.plan?.plan_2_4 || "";
  const tareas = st?.plan?.tareas || "";
  const alertas = "Consulta/deriva si aparece: fiebre + dolor pélvico/urinario, hematuria visible, retención urinaria, sangrado anormal importante, dolor agudo severo nuevo, síntomas neurológicos nuevos.";

  const rows = [
    ["Motivo (en tus palabras)", motivo],
    ["Meta", meta],
    ["Plan 2–4 semanas", plan],
    ["Tareas", tareas],
    ["Señales de alerta", alertas],
  ].filter(([,v])=> String(v||"").trim() !== "");

  doc.autoTable({
    startY: 110,
    head: [["", ""]],
    body: rows,
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [255,255,255], textColor: [255,255,255] },
    theme: "grid",
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 170, fontStyle:"bold" },
      1: { cellWidth: 595 - margin*2 - 170 }
    }
  });

  doc.save(fileBaseName(st) + "_paciente.pdf");
}

function exportXlsx(){
  const st = getState();

  const wb = XLSX.utils.book_new();

  const sheet1 = [
    ["Identificación"],
    ["Nombre", st?.id?.nombre || ""],
    ["Edad", st?.id?.edad || ""],
    ["Rut", st?.id?.rut || ""],
    ["Fecha", st?.id?.fecha || ""],
    ["Ocupación", st?.id?.ocupacion || ""],
    ["Contacto emergencia", st?.id?.contacto_emergencia || ""],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  XLSX.utils.book_append_sheet(wb, ws1, "Identificación");

  const sheet2 = [
    ["Motivo"],
    ["Motivo de consulta", st?.motivo?.motivo || ""],
    ["Meta", st?.motivo?.meta || ""],
    ["Historia breve", st?.motivo?.historia || ""],
    ["Escala 0–10 síntoma principal", st?.medicion?.escala_0_10 || ""],
    ["Actividad 1 + 0–10", st?.medicion?.actividad_1 || ""],
    ["Actividad 2 + 0–10", st?.medicion?.actividad_2 || ""],
    ["Actividad 3 + 0–10", st?.medicion?.actividad_3 || ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), "Motivo");

  const sheet3 = [
    ["Gineco-obstétricos"],
    ["Gestaciones", st?.go?.gestaciones || ""],
    ["Abortos", st?.go?.abortos || ""],
    ["Partos", st?.go?.partos || ""],
    ["Cesáreas", st?.go?.cesareas || ""],
    ["Fecha probable parto", st?.go?.fecha_probable_parto || ""],
    ["Peso RN", st?.go?.peso_rn || ""],
    ["Suplementos", st?.go?.suplementos || ""],
    ["Peso ganado", st?.go?.peso_ganado || ""],
    ["Desgarros/Episiotomías", st?.go?.desgarros_epi || ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet3), "Embarazo_Postparto");

  const sheet4 = [
    ["Síntomas (screen)"],
    ["Pérdida orina con esfuerzo", st?.pfd?.perdida_esfuerzo ? "Sí" : ""],
    ["Urgencia para orinar", st?.pfd?.urgencia_bano ? "Sí" : ""],
    ["Pérdida orina sin causa", st?.pfd?.perdida_sin_causa ? "Sí" : ""],
    ["Pérdida gases/heces", st?.pfd?.perdida_gases_heces ? "Sí" : ""],
    ["Dolor en relaciones", st?.pfd?.dolor_relaciones ? "Sí" : ""],
    ["Dolor pélvico", st?.pfd?.dolor_pelvico ? "Sí" : ""],
    ["Estreñimiento", st?.pfd?.estrenimiento ? "Sí" : ""],
    [],
    ["Urinario"],
    ["Frecuencia orinar", st?.uri?.frecuencia || ""],
    ["Nicturia", st?.uri?.nicturia || ""],
    ["Urgencia (urinario)", st?.uri?.urgencia ? "Sí" : ""],
    ["Incontinencia (situaciones)", st?.uri?.incontinencia || ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet4), "Síntomas");

  const clas = st?.plan?.clasificacion_manual || suggestedClassification(st);
  const q = st?.plan?.cuestionario || suggestedQuestionnaire(st);

  const sheet5 = [
    ["Plan"],
    ["Clasificación", clas || ""],
    ["Hipótesis", st?.plan?.hipotesis || ""],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4 || ""],
    ["Tareas", st?.plan?.tareas || ""],
    ["Re-test", st?.plan?.retest || ""],
    ["Cuestionario baseline", q || ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet5), "Plan");

  // pestaña “Completa” (key/value) por si quieres auditoría
  const pairs = flatten(st).map(([k,v])=>({Campo:k, Valor:v}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pairs), "Completa_keyvalue");

  XLSX.writeFile(wb, fileBaseName(st) + ".xlsx");
}

function exportJSON(){
  const st = getState();
  const blob = new Blob([JSON.stringify(st,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileBaseName(st) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- bind / mode ---------- */
function bindInputs(){
  $$("[data-key]").forEach(node=>{
    node.addEventListener("input", saveAndRefresh);
    node.addEventListener("change", saveAndRefresh);
  });
}

function applyLoadedState(){
  const st = loadState();
  if (!st) {
    // defaults
    const dateInput = $$("[data-key='id.fecha']")[0];
    if (dateInput && !dateInput.value) dateInput.value = nowISODate();
    return;
  }
  MODE = st?._meta?.mode || MODE;
  applyState(st);
  setMode(MODE, false);
}

function saveAndRefresh(){
  const st = getState();
  saveState(st);
  refreshHero(st);
}

function setMode(mode, rerender=true){
  MODE = mode;
  $("#btnMode10").classList.toggle("active", MODE==="10");
  $("#btnModeFull").classList.toggle("active", MODE==="full");
  if (rerender) renderForm();
  else saveAndRefresh();
}

/* ---------- init ---------- */
function init(){
  $("#btnMode10").addEventListener("click", ()=>setMode("10"));
  $("#btnModeFull").addEventListener("click", ()=>setMode("full"));

  $("#btnPdfClin").addEventListener("click", exportPdfClin);
  $("#btnPdfPac").addEventListener("click", exportPdfPaciente);
  $("#btnXlsx").addEventListener("click", exportXlsx);
  $("#btnJson").addEventListener("click", exportJSON);

  $("#btnClear").addEventListener("click", ()=>{
    if (confirm("¿Borrar toda la ficha?")) clearAll();
  });

  renderForm();
}

init();
