/* v3 – Boutique PF intake
   - replica secciones de tu Excel (Ficha Evaluacion + anexos)
   - modo 10 min vs completa realmente distintos
   - sliders (0–10) para que el gráfico tenga sentido
   - gráfico “perfil de síntomas” + anillo de completitud (se exportan al PDF)
   - export: PDF clínico bonito + PDF paciente útil + Excel en pestañas
   - guardado local (localStorage)
*/

const STORAGE_KEY = "pf_ficha_v3";
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

function shouldShow(mode){
  if (MODE === "full") return true;
  return mode !== "full";
}

/* =======================
   Secciones (replica Excel)
   ======================= */

const ANEXO_CUESTIONARIOS = [
  { cat:"Calidad de vida / salud mental / dolor", items:["PHQ-2 (depresión/ansiedad)","TAMPA (TSK)","PCS","FABQ","Örebro","SF-36","OSWESTRY","WOMAC","LEFS","DN4","Starbacktool","SANE (Single assessment numerical evaluation)"]},
  { cat:"Urinario", items:["ICIQ-SF (ICIQ-UI SF)","KING’S Q","Severidad de Sandvik","Urogenital Distress Inventory (UDI)","Cuestionarios de síntomas vesicales y urinarios en general","Cartilla miccional"]},
  { cat:"Prolapso", items:["P-QOL","PFDI (Pelvic Floor Disability/Distress)","Síntomas de Prolapso"]},
  { cat:"Intestinal", items:["Incontinencia de Wexner / Vaizey","FIQoL (Incontinencia anal)","Síntomas Intestinales","Cuestionarios de síntomas intestinales y urinarios"]},
  { cat:"Sexualidad / relación", items:["Índice de la Función Sexual Femenina (FSFI)","Female Sexual Function Index (FSFI)","Changes in Sexual Functioning Questionnaire (CSFQ)","PISQ-12","Sexual Desire Inventory (SDI)","Golombok Rust Inventory of Sexual Satisfaction (GRISS)","Derogatis Sexual Function Inventory (DSFI)","Marital Attitude Survey (MAS)","Inventory of Specific Relationship Standards (ISRS)"]},
  { cat:"Notas de tu hoja", items:[
    "“Le voy a pedir que identifique 3 actividades importantes que actualmente le cuesta por su problema…”",
    "“En una escala de 0 a 100% (siendo 100% lo normal o lo mejor posible) ¿cómo está tu … hoy?”",
    "Hojas de trabajo/Registros escritos de cogniciones, emociones y conductas (si aplica).",
    "Test de Homans (NO recomendado como cribado TVP; usar criterio clínico/derivar)."
  ]},
];

const ANEXO_TESTS = [
  { cat:"Columna lumbar", items:["Prueba elevación pierna recta (SLR)/Lasègue","Prueba de inestabilidad en decúbito prono (segmental)","→ cluster Rehorst (estabilidad segmentaria)"]},
  { cat:"Articulación sacro ilíaca", items:["Cluster van der Wurff","Cluster de Laslett (+): Distracción, Empuje del muslo, Compresión, FABER","ASLR (si lo usas)","FABER (Patrick)","→ Conjunto Laslett"]},
  { cat:"Cadera", items:["FADDIR (patología intraarticular)","FADER (GTPS/tendinopatía glútea)","Trendelenburg (OA de cadera)"]},
  { cat:"Rodilla", items:["Lachman (LCA)","Cajón anterior","McMurray (menisco)","Clarke (femoropatelar)","Hoffa (almohadilla grasa)"]},
  { cat:"Balance / rendimiento", items:["SEBT / Y Balance","TUG","Balance unipodal (10 s)","SPPB","Sit to stand"]},
];

const SECTIONS = [
  {
    id: "identificacion",
    title: "1) Identificación completa",
    badge: "Obligatorio",
    badgeKind: "req",
    mode: "min",
    fields: [
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

  {
    id: "motivo",
    title: "2) Motivo de consulta",
    badge: "Obligatorio",
    badgeKind: "req",
    hint: "Parte con pregunta abierta. Después aterriza lo mínimo (0–10 + actividad) para comparar en re-test.",
    mode: "min",
    fields: [
      { type:"textarea", key:"motivo.motivo", label:"Motivo de consulta:", rows:3, mode:"min" },
      { type:"textarea", key:"motivo.meta", label:"Meta (en palabras de la paciente)", rows:2, mode:"min" },
      { type:"textarea", key:"motivo.historia", label:"Historia breve / contexto", rows:2, mode:"min" },
      { type:"range", key:"medicion.sintoma_0_10", label:"Escala 0–10 del síntoma principal", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"text", key:"medicion.actividad_1", label:"ACTIVIDAD 1: (actividad importante + 0–10)", mode:"min", placeholder:"Ej: correr 2/10" },
      { type:"text", key:"medicion.actividad_2", label:"ACTIVIDAD 2 :", mode:"full" },
      { type:"text", key:"medicion.actividad_3", label:"ACTIVIDAD 3 :", mode:"full" },
    ]
  },

  {
    id: "seguridad",
    title: "3) Seguridad / derivación",
    badge: "P0",
    badgeKind: "p0",
    hint: "Si marcas algo relevante: detener, coordinar, derivar según criterio clínico.",
    mode: "min",
    fields: [
      { type:"check", key:"seg.fiebre", label:"Fiebre/escalofríos + dolor pélvico o urinario", mode:"min"},
      { type:"check", key:"seg.hematuria", label:"Hematuria visible", mode:"min"},
      { type:"check", key:"seg.retencion", label:"Retención / incapacidad para orinar / dolor suprapúbico severo", mode:"min"},
      { type:"check", key:"seg.sangrado", label:"Sangrado genital anormal importante / postmenopáusico", mode:"min"},
      { type:"check", key:"seg.dolor_agudo", label:"Dolor pélvico agudo severo “nuevo”", mode:"min"},
      { type:"check", key:"seg.neuro", label:"Síntomas neurológicos nuevos (anestesia silla de montar / debilidad progresiva / cambios esfínteres no explicados)", mode:"min"},
      { type:"check", key:"seg.tvp", label:"Sospecha TVP/TEP (no usar Homans; derivación según clínica)", mode:"min"},
      { type:"check", key:"seg.emb_alerta", label:"Embarazo: sangrado/pérdida de líquido/dolor severo (derivar)", mode:"full"},
      { type:"textarea", key:"seg.accion", label:"Notas / acción tomada (si aplica)", rows:2, mode:"full" }
    ]
  },

  {
    id: "antecedentes_medicos",
    title: "4) Antecedentes medicos",
    badge: "Completa",
    badgeKind: "req",
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
    title: "5) Antecedentes gineco-obstétricos (embarazo y postparto)",
    badge: "Obligatorio",
    badgeKind: "req",
    hint: "Como ves embarazadas en cualquier trimestre: esta sección no se “acorta”, se ordena.",
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
    hint:"Marca lo que aplica. Si quieres que el gráfico sirva, usa los deslizadores (0–10) abajo.",
    mode:"min",
    fields:[
      { type:"text", key:"pfd.pregunta_abierta", label:"¿Has experimentado alguna de las siguientes situaciones? (si quieres escribirlo)", mode:"full", placeholder:"Opcional" },

      { type:"check", key:"pfd.perdida_esfuerzo", label:"Pérdida de orina al toser, estornudar, reír o hacer ejercicio", mode:"min"},
      { type:"check", key:"pfd.urgencia_bano", label:"Necesidad urgente de orinar y dificultad para llegar al baño a tiempo", mode:"min"},
      { type:"check", key:"pfd.perdida_sin_causa", label:"Pérdida de orina sin causa aparente", mode:"min"},
      { type:"check", key:"pfd.perdida_gases_heces", label:"Pérdida involuntaria de gases o heces", mode:"min"},
      { type:"check", key:"pfd.dolor_relaciones", label:"Dolor durante las relaciones sexuales (dispareunia).", mode:"min"},
      { type:"check", key:"pfd.dolor_pelvico", label:"Dolor en la zona pélvica, vulvar o abdominal baja (dolor pélvico crónico).", mode:"min"},
      { type:"check", key:"pfd.estrenimiento", label:"Estreñimiento", mode:"min"},

      { type:"div", mode:"min" },

      /* Sliders (para gráfico) */
      { type:"range", key:"perfil.urinario_0_10", label:"Molestia urinaria (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.intestinal_0_10", label:"Molestia intestinal (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.dolor_pelvico_0_10", label:"Dolor pélvico/vulvar (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.dolor_relaciones_0_10", label:"Dolor en relaciones (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
      { type:"range", key:"perfil.prolapso_0_10", label:"Molestia por bulto/peso (0–10)", mode:"min", min:0, max:10, step:1, showValue:true },
    ]
  },

  {
    id:"urinario",
    title:"9) Tracto urinario inferior",
    badge:"10 min / Completa",
    badgeKind:"req",
    mode:"min",
    fields:[
      { type:"text", key:"uri.frecuencia", label:"Frecuencia: ¿Cuántas veces al día orinas?", mode:"min"},
      { type:"text", key:"uri.nicturia", label:"Nicturia: ¿Cuántas veces te levantas en la noche para orinar?", mode:"min"},
      { type:"check", key:"uri.urgencia", label:"Urgencia: ¿Sientes un deseo repentino e incontrolable de orinar?", mode:"min"},
      { type:"text", key:"uri.incontinencia", label:"Incontinencia: ¿Pierdes orina involuntariamente? ¿En qué situaciones?", mode:"min"},

      { type:"div", mode:"full" },
      { type:"text", key:"uri.sintomas_llenado", label:"Síntomas de llenado:", mode:"full"},
      { type:"check", key:"uri.retardo", label:"Retardo miccional: ¿Tienes dificultad para iniciar la micción?", mode:"full"},
      { type:"check", key:"uri.chorro_debil", label:"Chorro débil/intermitente: ¿El chorro de orina es débil o se interrumpe?", mode:"full"},
      { type:"check", key:"uri.pujo_orinar", label:"Esfuerzo miccional: ¿Necesitas pujar para orinar?", mode:"full"},
      { type:"check", key:"uri.disuria", label:"Disuria: ¿Sientes dolor o ardor al orinar?", mode:"full"},
      { type:"check", key:"uri.retencion", label:"Retención urinaria: ¿Sientes que no vacías completamente la vejiga?", mode:"full"},

      { type:"div", mode:"full" },
      { type:"text", key:"uri.sintomas_post", label:"Síntomas postmiccionales:", mode:"full"},
      { type:"check", key:"uri.post_incompleto", label:"¿Sientes que no has vaciado completamente la vejiga después de orinar?", mode:"full"},
      { type:"check", key:"uri.goteo", label:"¿Tienes goteo de orina después de orinar?", mode:"full"},

      { type:"div", mode:"full" },
      { type:"text", key:"uri.sintomas_sensitivos", label:"Síntomas sensitivos:", mode:"full"},
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
    title:"11) Función sexual",
    badge:"Completa",
    badgeKind:"req",
    mode:"full",
    fields:[
      { type:"text", key:"sex.frecuencia", label:"¿Con qué frecuencia tienes relaciones sexuales actualmente?", mode:"full"},
      { type:"check", key:"sex.vaginismo", label:"Vaginismo: ¿Experimentas contracciones involuntarias de los músculos vaginales que dificultan o impiden la penetración?", mode:"full"},
      { type:"check", key:"sex.dispareunia", label:"Dispareunia: ¿Sientes dolor durante las relaciones sexuales? ¿Dónde se localiza el dolor? ¿Es superficial o profundo?", mode:"full"},
      { type:"check", key:"sex.libido", label:"Libido: ¿Has notado cambios en tu deseo sexual? ¿Ha aumentado o disminuido?", mode:"full"},
      { type:"check", key:"sex.anorgasmia", label:"Anorgasmia: ¿Tienes dificultades para llegar al orgasmo? ¿Siempre ha sido así o es algo reciente?", mode:"full"},
      { type:"select", key:"sex.marinoff", label:"Escala de Marinoff (si aplica)", mode:"full",
        options:["—","Grado I: disconfort que no impide el coito","Grado II: frecuentemente impide el coito","Grado III: siempre impide el coito"]
      },
      { type:"textarea", key:"sex.notas", label:"Notas", rows:2, mode:"full" },
    ]
  },

  {
    id:"examen",
    title:"12) Examen físico/ Examen físico ginecologico",
    badge:"10 min / Completa",
    badgeKind:"req",
    hint:"En 10 min: Observación + patrón respiratorio + decisión de examen interno + 1 hallazgo clave.",
    mode:"min",
    fields:[
      { type:"textarea", key:"ex.obs", label:"Observación", rows:2, mode:"min" },
      { type:"text", key:"ex.marcha", label:"Marcha", mode:"full" },
      { type:"text", key:"ex.postura", label:"Postura en todos los planos", mode:"full" },
      { type:"text", key:"ex.respiracion", label:"Patrón respiratorio", mode:"min" },

      { type:"div", mode:"full" },
      { type:"text", key:"ex.examen_mov", label:"Examen de movimiento", mode:"full" },
      { type:"text", key:"ex.arts", label:"Examen Fisico  (ARTS)", mode:"full" },
      { type:"text", key:"ex.arom", label:"AROM", mode:"full" },
      { type:"text", key:"ex.asimetrias", label:"Asimetrías", mode:"full" },
      { type:"text", key:"ex.prom", label:"PROM", mode:"full" },
      { type:"text", key:"ex.restriccion_mov", label:"Restricción de movimiento", mode:"full" },
      { type:"text", key:"ex.mov_acc", label:"Movimientos accesorios", mode:"full" },
      { type:"text", key:"ex.funcionales", label:"Funcionales", mode:"full" },
      { type:"text", key:"ex.fuerza", label:"Fuerza", mode:"full" },

      { type:"div", mode:"min" },
      { type:"check", key:"cons.explico", label:"Expliqué objetivo, alternativas, derecho a parar", mode:"min"},
      { type:"check", key:"cons.chaperon_ofrecido", label:"Ofrecí chaperón", mode:"min"},
      { type:"select", key:"cons.interno", label:"Examen intracavitario hoy (si está indicado)", mode:"min",
        options:["—","No","Sí (vaginal)","Sí (rectal)"]
      },
      { type:"text", key:"cons.contra", label:"Contraindicaciones / por qué no (si aplica)", mode:"full" },

      /* Inspección suelo pélvico (tu hoja) */
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

      { type:"check", key:"sp.qtip", label:"Q-tip test (si aplica)", mode:"full" },
      { type:"text", key:"sp.qtip_hallazgo", label:"Q-tip: hallazgo (si lo hiciste)", mode:"full" },

      /* PERFECT */
      { type:"div", mode:"full" },
      { type:"text", key:"int.elevador", label:"● elevador del ano:", mode:"full", placeholder:"Opcional" },
      { type:"text", key:"int.fuerza_contractil", label:"Fuerza contráctil:", mode:"full" },
      { type:"text", key:"int.power", label:"Power : fuerza ( oxford modificada)", mode:"full" },
      { type:"text", key:"int.endurance", label:"Endurance: Resistencia (segundos/10)", mode:"full" },
      { type:"text", key:"int.repetition", label:"Repetition : repeticiones (descanso ≥4s)", mode:"full" },
      { type:"text", key:"int.timing", label:"Timing de activación:", mode:"full" },
      { type:"select", key:"int.tono", label:"● Tono: normo -hipo -hiper", mode:"full", options:["—","normo","hipo","hiper"] },
      { type:"text", key:"int.puntos_gatillo", label:"Puntos dolorosos / puntos gatillo", mode:"full" },
      { type:"text", key:"int.score_hipertonia", label:"Score de hipertonía (0–4) (si lo usas)", mode:"full" },

      /* POP */
      { type:"div", mode:"full" },
      { type:"select", key:"pop.estadio", label:"Examen estática pélvica (POP) - estadio (si aplica)", mode:"full",
        options:["—","Estadio 0 (ausente)","Estadio I (>1 cm sobre himen)","Estadio II (1 cm sobre o bajo himen)","Estadio III (> 1 cm)"]
      },
      { type:"text", key:"pop.notas", label:"Notas POP (valsalva / síntomas)", mode:"full" },

      /* Anorrectal */
      { type:"div", mode:"full" },
      { type:"text", key:"rect.sincronismo_abd", label:"Sincronismo abdominales pelviano al empuje : Descenso normal piso pélvico con apertura del ano", mode:"full" },
      { type:"text", key:"rect.angulo_puborectal", label:"Ángulo puborectal : Reposo 90º -100 º", mode:"full" },
      { type:"text", key:"rect.movilidad_puborrectal", label:"Movilidad puborrectal:", mode:"full" },
      { type:"text", key:"rect.tonicidad_puborrectal", label:"Tonicidad puborrectal:", mode:"full" },
      { type:"text", key:"rect.relajacion_puborrectal", label:"Relajación puborrectal : Escala de rissing", mode:"full" },
      { type:"text", key:"rect.sincronismo_puborrectal", label:"Sincronismo puborrectal al pujo: Relaja canal anal/empuja dedo/abertura angulo anorrectal", mode:"full" },

      /* Manometría */
      { type:"div", mode:"full" },
      { type:"text", key:"manom.balon_simple", label:"-Balon simple : Sensibilidad rectal, Capacidad y acomodación rectal, Sincronismo defecatorio", mode:"full" },
      { type:"text", key:"manom.balon_doble", label:"-Balón doble: RRAE / presión canal anal / longitud canal anal / RRAI", mode:"full" },
    ]
  },

  {
    id:"plan",
    title:"13) Clasificación, hipótesis y plan",
    badge:"Obligatorio",
    badgeKind:"req",
    hint:"Escribe tu juicio en español simple (sin siglas) + plan claro 2–4 semanas + tareas.",
    mode:"min",
    fields:[
      { type:"text", key:"plan.clasificacion_manual", label:"Clasificación final (tu juicio)", mode:"min",
        placeholder:"Ej: pérdida de orina con esfuerzo + control de presión / dolor pélvico miofascial…"
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

  {
    id:"anexos",
    title:"14) Anexos (cuestionarios y tests)",
    badge:"Completa",
    badgeKind:"req",
    hint:"Esto no es para llenarlo completo en sesión: es tu biblioteca. Marca lo que usaste.",
    mode:"full",
    fields:[
      { type:"textarea", key:"anexos.cuestionarios_usados", label:"Cuestionarios usados hoy (lista corta)", rows:2, mode:"full", placeholder:"Ej: ICIQ-UI SF + PFDI-20" },
      { type:"textarea", key:"anexos.tests_usados", label:"Tests ortopédicos/rendimiento usados hoy (lista corta)", rows:2, mode:"full" },
      { type:"textarea", key:"anexos.notas", label:"Notas", rows:2, mode:"full" },
    ],
    customRender: (card, st) => {
      // render biblioteca con checkboxes (sin guardar cada item como key individual, para no explotar el JSON)
      const lib = el("div",{class:"div"},[]);
      card.appendChild(lib);

      const block = el("div",{class:"grid2"},[]);
      block.appendChild(renderLibrary("Biblioteca de cuestionarios (referencia)", ANEXO_CUESTIONARIOS));
      block.appendChild(renderLibrary("Biblioteca de tests (referencia)", ANEXO_TESTS));
      card.appendChild(block);
    }
  },

  {
    id:"evidencia",
    title:"15) Notas rápidas basadas en evidencia (para tu respaldo)",
    badge:"Referencia",
    badgeKind:"req",
    mode:"full",
    fields:[
      { type:"textarea", key:"evidencia.notas", label:"Notas (si quieres dejar algo escrito para auditoría)", rows:2, mode:"full",
        placeholder:"Ej: PFMT supervisado ≥3 meses primera línea en pérdidas de orina al esfuerzo/mixta; guía NICE."
      }
    ],
    customRender: (card) => {
      const p = el("div",{class:"hint"},[
        "Sugerencias (no sustituyen tu criterio):",
        "\n• Pérdida de orina al esfuerzo/mixta: entrenamiento supervisado de musculatura del piso pélvico como primera línea (NICE).",
        "\n• PFD: evaluación y manejo por síntomas (urinario, intestinal, prolapso, dolor) según guías NICE.",
        "\n• Medición: ICIQ-UI SF (urinario), PFDI-20 (síntomas PF globales), PGQ (dolor cintura pélvica), Wexner/Vaizey (incontinencia fecal), FSFI (sexualidad si es foco)."
      ]);
      p.style.whiteSpace = "pre-wrap";
      p.style.marginTop = "8px";
      card.appendChild(p);

      const links = el("div", {style:"margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;"}, [
        anchor("NICE NG210 (PFD)", "https://www.nice.org.uk/guidance/ng210"),
        anchor("NICE QS77 (PFMT 1ª línea)", "https://www.nice.org.uk/guidance/qs77/chapter/quality-statement-4-supervised-pelvic-floor-muscle-training"),
        anchor("ICIQ-UI SF", "https://iciq.net/iciq-ui-sf"),
      ]);
      card.appendChild(links);
    }
  }
];

function anchor(label, href){
  const a = el("a",{href, target:"_blank", rel:"noopener noreferrer", style:"font-weight:900; color:#7a3b2a; text-decoration:underline;"},[label]);
  return a;
}

function renderLibrary(title, groups){
  const box = el("div",{class:"field"},[
    el("label",{},[title]),
  ]);
  const wrap = el("div",{style:"display:grid; gap:10px; margin-top:8px;"},[]);
  groups.forEach(g=>{
    const head = el("div",{style:"font-weight:900; color:#5f6777; font-size:12px;"},[g.cat]);
    wrap.appendChild(head);
    g.items.forEach(item=>{
      wrap.appendChild(el("div",{style:"font-weight:800; font-size:12px; background:rgba(243,231,207,.35); border:1px solid rgba(30,35,45,.08); padding:8px 10px; border-radius:14px;"},[item]));
    });
  });
  box.appendChild(wrap);
  return box;
}

/* =======================
   Render + state
   ======================= */

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

    const grid = el("div", { class:"grid2" }, []);
    let hasGrid = false;

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

      if (f.type === "range"){
        const field = el("div",{class:"field"},[]);
        const lbl = el("label",{},[
          el("span",{},[f.label]),
          f.showValue ? el("span",{class:"small", "data-range-for": f.key},["0"]) : null
        ]);
        field.appendChild(lbl);

        const wrap = el("div",{class:"range-wrap"},[]);
        const input = el("input",{
          type:"range",
          "data-key": f.key,
          min: String(f.min ?? 0),
          max: String(f.max ?? 10),
          step: String(f.step ?? 1),
          value: "0"
        },[]);
        wrap.appendChild(input);
        field.appendChild(wrap);

        grid.appendChild(field);
        hasGrid = true;
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
      hasGrid = true;
    });

    if (hasGrid) card.appendChild(grid);

    if (typeof sec.customRender === "function"){
      sec.customRender(card, getState(false));
    }

    root.appendChild(card);
  });

  bindInputs();
  applyLoadedState();
  saveAndRefresh();
}

function getState(includeMeta=true){
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

function applyState(st){
  if (!st) return;
  $$("[data-key]").forEach(node=>{
    const k = node.getAttribute("data-key");
    const v = deepGet(st, k);
    if (v === undefined) return;
    if (node.type === "checkbox") node.checked = !!v;
    else node.value = v;
  });

  // update range labels
  $$("[data-range-for]").forEach(b=>{
    const key = b.getAttribute("data-range-for");
    const v = deepGet(st, key);
    b.textContent = (v === undefined || v === null || v === "") ? "0" : String(v);
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

/* =======================
   Automático (sin siglas)
   ======================= */

function safetyFlag(st){
  const s = st?.seg || {};
  const keys = ["fiebre","hematuria","retencion","sangrado","dolor_agudo","neuro","tvp","emb_alerta"];
  return keys.some(k=> !!s[k]);
}

function etapaStr(st){
  const parts = [];
  if (st?.go?.fecha_probable_parto) parts.push(`FPP: ${st.go.fecha_probable_parto}`);
  if (st?.go?.peso_rn) parts.push(`RN: ${st.go.peso_rn}`);
  const pc = [st?.go?.partos, st?.go?.cesareas].filter(Boolean).join("/");
  if (pc) parts.push(`Partos/Cesáreas: ${pc}`);
  return parts.length ? parts.join(" · ") : "—";
}

function suggestedClassification(st){
  if (safetyFlag(st)) return "Prioridad: seguridad/derivación";

  const effort = !!st?.pfd?.perdida_esfuerzo;
  const urgency = !!st?.pfd?.urgencia_bano || !!st?.uri?.urgencia;
  const fi = !!st?.pfd?.perdida_gases_heces;
  const constip = !!st?.pfd?.estrenimiento;
  const dysp = !!st?.pfd?.dolor_relaciones;
  const pelvicPain = !!st?.pfd?.dolor_pelvico;
  const pop = !!st?.pop?.estadio;

  // 1–2 etiquetas máximo
  const tags = [];
  if (effort && urgency) tags.push("Pérdidas de orina: esfuerzo + urgencia (mixta probable)");
  else if (effort) tags.push("Pérdidas de orina con esfuerzo (probable)");
  else if (urgency) tags.push("Urgencia para orinar / vejiga hiperactiva (probable)");

  if (fi) tags.push("Pérdida de gases/heces (evaluar severidad)");
  if (pop) tags.push("Síntomas de prolapso (según molestia)");

  if (dysp) tags.push("Dolor en relaciones (dispareunia)");
  if (pelvicPain) tags.push("Dolor pélvico/vulvar");

  if (constip) tags.push("Estreñimiento / disfunción defecatoria");

  if (!tags.length) return "—";
  return tags.slice(0,2).join(" + ") + (tags.length>2 ? " (y otros)" : "");
}

function suggestedQuestionnaire(st){
  if (safetyFlag(st)) return "— (resolver seguridad primero)";
  const effort = !!st?.pfd?.perdida_esfuerzo;
  const urgency = !!st?.pfd?.urgencia_bano || !!st?.uri?.urgencia;
  const fi = !!st?.pfd?.perdida_gases_heces;
  const pop = !!st?.pop?.estadio;

  const dysp = !!st?.pfd?.dolor_relaciones;
  const pelvicPain = !!st?.pfd?.dolor_pelvico;

  if (effort || urgency) return "ICIQ-UI SF";
  if (fi) return "Wexner/Vaizey";
  if (pop) return "PFDI-20";
  if (dysp && MODE === "full") return "FSFI (si sexualidad es foco)";
  if (pelvicPain) return "PFDI-20 (si PF global) o escala dolor 0–10";
  return "—";
}

function checklistText(st){
  const items = [];
  if (safetyFlag(st)) items.push("1) Resolver seguridad/derivación");
  items.push("2) Baseline: 0–10 + actividad");
  if (MODE === "full") items.push("3) Elegir cuestionario baseline");
  items.push("4) Plan 2–4 semanas + tareas");
  return items.join(" · ");
}

/* =======================
   Completitud + gráficos
   ======================= */

const REQUIRED_KEYS_10 = [
  "id.nombre","id.rut","id.fecha",
  "motivo.motivo",
  "medicion.sintoma_0_10",
  "medicion.actividad_1",
  "go.gestaciones","go.partos","go.cesareas",
  "plan.plan_2_4","plan.tareas"
];

const REQUIRED_KEYS_FULL_EXTRA = [
  "plan.cuestionario","plan.retest"
];

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
  // si no rellenan sliders, queda 0 (no inventa)
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

  // base ring
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(30,35,45,.10)";
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.stroke();

  // progress
  const start = -Math.PI/2;
  const end = start + (Math.PI*2)*(pct/100);
  const grad = ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  grad.addColorStop(0, "rgba(243,199,197,.95)"); // blush
  grad.addColorStop(1, "rgba(127,176,155,.95)"); // sage
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx,cy,r,start,end);
  ctx.stroke();

  // text
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

    // bar bg
    const x0 = pad + labelW;
    ctx.fillStyle = "rgba(30,35,45,.08)";
    roundRect(ctx, x0, y-7, barW, 14, 7, true, false);

    // bar fg
    const frac = s.v/10;
    const fw = Math.max(0, Math.round(barW*frac));
    const grad = ctx.createLinearGradient(x0,0,x0+barW,0);
    grad.addColorStop(0, "rgba(243,199,197,.95)");
    grad.addColorStop(1, "rgba(200,118,90,.85)");
    ctx.fillStyle = grad;
    roundRect(ctx, x0, y-7, fw, 14, 7, true, false);

    // value
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
   Hero + export
   ======================= */

function refreshHero(st){
  const name = st?.id?.nombre || "—";
  const rut = st?.id?.rut ? ` · ${st.id.rut}` : "";
  $("#chipPaciente").textContent = `Paciente: ${name}${rut}`;

  $("#chipEtapa").textContent = `Embarazo/postparto: ${etapaStr(st)}`;

  const safe = safetyFlag(st);
  $("#chipSeguridad").textContent = safe ? "Seguridad: OJO (marcado)" : "Seguridad: sin alertas";
  $("#chipSeguridad").style.borderColor = safe ? "rgba(243,199,197,.95)" : "rgba(30,35,45,.10)";

  const clas = st?.plan?.clasificacion_manual?.trim() ? st.plan.clasificacion_manual.trim() : suggestedClassification(st);
  $("#heroClasif").textContent = `Clasificación sugerida: ${clas || "—"}`;

  const q = st?.plan?.cuestionario?.trim() ? st.plan.cuestionario.trim() : suggestedQuestionnaire(st);
  $("#heroSug").textContent = `Cuestionario recomendado: ${q}`;

  $("#miniMotivo").textContent = (st?.motivo?.motivo || "—").toString().slice(0,120) || "—";
  $("#miniPlan").textContent = (st?.plan?.plan_2_4 || "—").toString().slice(0,120) || "—";
  $("#miniChecklist").textContent = checklistText(st);

  // completion + charts
  const c = completion(st);
  drawDonut($("#cvProgress"), c.pct);
  $("#progressText").textContent = `${c.filled}/${c.total} campos clave`;
  drawBars($("#cvProfile"), domainScores(st));
}

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

function blocksForPDF(st){
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
    ["Escala 0–10 síntoma principal", st?.medicion?.sintoma_0_10],
    ["Actividad 1", st?.medicion?.actividad_1],
    ["Actividad 2", st?.medicion?.actividad_2],
    ["Actividad 3", st?.medicion?.actividad_3],
  ]]);

  blocks.push(["Seguridad / derivación", [
    ["Fiebre + dolor pélvico/urinario", st?.seg?.fiebre ? "Sí" : ""],
    ["Hematuria visible", st?.seg?.hematuria ? "Sí" : ""],
    ["Retención urinaria", st?.seg?.retencion ? "Sí" : ""],
    ["Sangrado anormal", st?.seg?.sangrado ? "Sí" : ""],
    ["Dolor agudo severo", st?.seg?.dolor_agudo ? "Sí" : ""],
    ["Síntomas neurológicos", st?.seg?.neuro ? "Sí" : ""],
    ["Sospecha TVP/TEP", st?.seg?.tvp ? "Sí" : ""],
    ["Embarazo alerta", st?.seg?.emb_alerta ? "Sí" : ""],
    ["Acción tomada", st?.seg?.accion],
  ]]);

  blocks.push(["Embarazo / postparto", [
    ["Gestaciones", st?.go?.gestaciones],
    ["Abortos", st?.go?.abortos],
    ["Partos", st?.go?.partos],
    ["Cesáreas", st?.go?.cesareas],
    ["Fecha probable parto", st?.go?.fecha_probable_parto],
    ["Peso RN", st?.go?.peso_rn],
    ["Suplementos", st?.go?.suplementos],
    ["Peso ganado", st?.go?.peso_ganado],
    ["Desgarros/Episiotomías", st?.go?.desgarros_epi],
  ]]);

  blocks.push(["Screen piso pélvico + perfil", [
    ["Pérdida orina con esfuerzo", st?.pfd?.perdida_esfuerzo ? "Sí" : ""],
    ["Urgencia", st?.pfd?.urgencia_bano ? "Sí" : ""],
    ["Pérdida sin causa", st?.pfd?.perdida_sin_causa ? "Sí" : ""],
    ["Pérdida gases/heces", st?.pfd?.perdida_gases_heces ? "Sí" : ""],
    ["Dolor relaciones", st?.pfd?.dolor_relaciones ? "Sí" : ""],
    ["Dolor pélvico/vulvar", st?.pfd?.dolor_pelvico ? "Sí" : ""],
    ["Estreñimiento", st?.pfd?.estrenimiento ? "Sí" : ""],
    ["Molestia urinaria (0–10)", st?.perfil?.urinario_0_10],
    ["Molestia intestinal (0–10)", st?.perfil?.intestinal_0_10],
    ["Dolor pélvico (0–10)", st?.perfil?.dolor_pelvico_0_10],
    ["Dolor relaciones (0–10)", st?.perfil?.dolor_relaciones_0_10],
    ["Bulto/peso (0–10)", st?.perfil?.prolapso_0_10],
  ]]);

  blocks.push(["Urinario / defecatorio / sexual (según llenado)", [
    ["Frecuencia orinar", st?.uri?.frecuencia],
    ["Nicturia", st?.uri?.nicturia],
    ["Urgencia (urinario)", st?.uri?.urgencia ? "Sí" : ""],
    ["Incontinencia (situaciones)", st?.uri?.incontinencia],

    ["Deposiciones (frecuencia)", st?.def?.frecuencia],
    ["Consistencia", st?.def?.consistencia],
    ["Puja/maniobras", st?.def?.pujo_maniobras ? "Sí" : ""],

    ["Relaciones sexuales (frecuencia)", st?.sex?.frecuencia],
    ["Vaginismo", st?.sex?.vaginismo ? "Sí" : ""],
    ["Dispareunia", st?.sex?.dispareunia ? "Sí" : ""],
    ["Marinoff", st?.sex?.marinoff],
  ]]);

  const clas = st?.plan?.clasificacion_manual?.trim() ? st.plan.clasificacion_manual.trim() : suggestedClassification(st);
  const q = st?.plan?.cuestionario?.trim() ? st.plan.cuestionario.trim() : suggestedQuestionnaire(st);

  blocks.push(["Plan", [
    ["Clasificación (hoy)", clas],
    ["Hipótesis", st?.plan?.hipotesis],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4],
    ["Tareas", st?.plan?.tareas],
    ["Re-test", st?.plan?.retest],
    ["Cuestionario baseline", q],
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

  // Header boutique
  doc.setFillColor(243,231,207); // beige
  doc.rect(0,0,595,92,"F");
  doc.setFillColor(243,199,197); // blush line
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

  // Inserta gráfico perfil
  const profile = $("#cvProfile");
  try{
    const img = profile.toDataURL("image/png", 1.0);
    doc.addImage(img, "PNG", margin, 150, 507, 120);
  }catch(e){}

  let y = 286;

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

function exportPdfPaciente(){
  const st = getState();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const margin = 44;

  doc.setFillColor(243,199,197); // blush
  doc.rect(0,0,595,78,"F");
  doc.setFillColor(127,176,155); // sage strip
  doc.rect(0,78,595,4,"F");

  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text("Resumen para la paciente", margin, 44);

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`Nombre: ${st?.id?.nombre || "—"} · Fecha: ${st?.id?.fecha || "—"}`, margin, 66);

  const clas = st?.plan?.clasificacion_manual?.trim() ? st.plan.clasificacion_manual.trim() : suggestedClassification(st);

  // mini perfil (gráfico)
  const profile = $("#cvProfile");
  try{
    const img = profile.toDataURL("image/png", 1.0);
    doc.addImage(img, "PNG", margin, 96, 507, 110);
  }catch(e){}

  const motivo = st?.motivo?.motivo || "";
  const meta = st?.motivo?.meta || "";
  const plan = st?.plan?.plan_2_4 || "";
  const tareas = st?.plan?.tareas || "";
  const retest = st?.plan?.retest || (MODE==="full" ? "Re-evaluación en 2–4 semanas o 4–6 sesiones." : "Re-evaluación en 2–4 semanas.");
  const q = st?.plan?.cuestionario?.trim() ? st.plan.cuestionario.trim() : suggestedQuestionnaire(st);

  const alertas = "Consulta/deriva si aparece: fiebre + dolor pélvico/urinario, hematuria visible, retención urinaria, sangrado anormal importante, dolor agudo severo nuevo, síntomas neurológicos nuevos.";

  const rows = [
    ["Lo que estamos trabajando (hoy)", clas || ""],
    ["Motivo (en tus palabras)", motivo],
    ["Meta", meta],
    ["Plan 2–4 semanas", plan],
    ["Tareas para la casa", tareas],
    ["Cuestionario de seguimiento", q],
    ["Cuándo re-evaluamos", retest],
    ["Señales de alerta", alertas],
  ].filter(([,v])=> String(v||"").trim() !== "");

  doc.autoTable({
    startY: 220,
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

  doc.save(fileBaseName(st) + "_paciente.pdf");
}

function exportXlsx(){
  const st = getState();
  const wb = XLSX.utils.book_new();

  const wsId = XLSX.utils.aoa_to_sheet([
    ["Identificación"],
    ["Nombre", st?.id?.nombre || ""],
    ["Edad", st?.id?.edad || ""],
    ["Rut", st?.id?.rut || ""],
    ["Fecha", st?.id?.fecha || ""],
    ["Médico tratante", st?.id?.medico_tratante || ""],
    ["Matrona", st?.id?.matrona || ""],
    ["Contacto médico", st?.id?.contacto_medico || ""],
    ["Contacto emergencia", st?.id?.contacto_emergencia || ""],
    ["Nivel educacional", st?.id?.nivel_educacional || ""],
    ["Ocupación", st?.id?.ocupacion || ""],
    ["Deportes", st?.id?.deportes || ""],
    ["Previsión", st?.id?.prevision || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsId, "Identificación");

  const wsMot = XLSX.utils.aoa_to_sheet([
    ["Motivo"],
    ["Motivo de consulta", st?.motivo?.motivo || ""],
    ["Meta", st?.motivo?.meta || ""],
    ["Historia breve", st?.motivo?.historia || ""],
    ["Escala 0–10 síntoma principal", st?.medicion?.sintoma_0_10 || ""],
    ["Actividad 1", st?.medicion?.actividad_1 || ""],
    ["Actividad 2", st?.medicion?.actividad_2 || ""],
    ["Actividad 3", st?.medicion?.actividad_3 || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsMot, "Motivo");

  const wsGO = XLSX.utils.aoa_to_sheet([
    ["Embarazo/Postparto"],
    ["Gestaciones", st?.go?.gestaciones || ""],
    ["Abortos", st?.go?.abortos || ""],
    ["Partos", st?.go?.partos || ""],
    ["Cesáreas", st?.go?.cesareas || ""],
    ["Uso forceps", st?.go?.uso_forceps || ""],
    ["Fecha probable parto", st?.go?.fecha_probable_parto || ""],
    ["Peso RN", st?.go?.peso_rn || ""],
    ["Suplementos", st?.go?.suplementos || ""],
    ["Peso ganado", st?.go?.peso_ganado || ""],
    ["Desgarros/Episiotomías", st?.go?.desgarros_epi || ""],
    ["Métodos anticonceptivos", st?.go?.anticonceptivos || ""],
    ["Otras observaciones", st?.go?.otras_obs || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsGO, "Embarazo_Postparto");

  const wsSint = XLSX.utils.aoa_to_sheet([
    ["Síntomas"],
    ["Pérdida orina con esfuerzo", st?.pfd?.perdida_esfuerzo ? "Sí" : ""],
    ["Urgencia para orinar", st?.pfd?.urgencia_bano ? "Sí" : ""],
    ["Pérdida orina sin causa", st?.pfd?.perdida_sin_causa ? "Sí" : ""],
    ["Pérdida gases/heces", st?.pfd?.perdida_gases_heces ? "Sí" : ""],
    ["Dolor en relaciones", st?.pfd?.dolor_relaciones ? "Sí" : ""],
    ["Dolor pélvico/vulvar", st?.pfd?.dolor_pelvico ? "Sí" : ""],
    ["Estreñimiento", st?.pfd?.estrenimiento ? "Sí" : ""],
    [],
    ["Perfil (0–10)"],
    ["Urinario", st?.perfil?.urinario_0_10 || ""],
    ["Intestinal", st?.perfil?.intestinal_0_10 || ""],
    ["Dolor pélvico", st?.perfil?.dolor_pelvico_0_10 || ""],
    ["Relaciones", st?.perfil?.dolor_relaciones_0_10 || ""],
    ["Bulto/peso", st?.perfil?.prolapso_0_10 || ""],
    [],
    ["Urinario (mínimo)"],
    ["Frecuencia", st?.uri?.frecuencia || ""],
    ["Nicturia", st?.uri?.nicturia || ""],
    ["Urgencia", st?.uri?.urgencia ? "Sí" : ""],
    ["Incontinencia (situaciones)", st?.uri?.incontinencia || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsSint, "Síntomas");

  const clas = st?.plan?.clasificacion_manual?.trim() ? st.plan.clasificacion_manual.trim() : suggestedClassification(st);
  const q = st?.plan?.cuestionario?.trim() ? st.plan.cuestionario.trim() : suggestedQuestionnaire(st);

  const wsPlan = XLSX.utils.aoa_to_sheet([
    ["Plan"],
    ["Clasificación", clas || ""],
    ["Hipótesis", st?.plan?.hipotesis || ""],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4 || ""],
    ["Tareas", st?.plan?.tareas || ""],
    ["Re-test", st?.plan?.retest || ""],
    ["Cuestionario baseline", q || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, wsPlan, "Plan");

  // Auditoría key/value
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

/* =======================
   Bind / init
   ======================= */

function bindInputs(){
  $$("[data-key]").forEach(node=>{
    node.addEventListener("input", () => {
      // update range badge
      if (node.type === "range"){
        const key = node.getAttribute("data-key");
        const badge = document.querySelector(`[data-range-for="${key}"]`);
        if (badge) badge.textContent = String(node.value);
      }
      saveAndRefresh();
    });
    node.addEventListener("change", saveAndRefresh);
  });
}

function applyLoadedState(){
  const st = loadState();
  if (!st) {
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

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveState(st){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
}

init();
