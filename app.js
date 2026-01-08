/* Pelvic floor intake – GitHub Pages friendly
   - autosave localStorage
   - mode 10 min / full
   - classification suggestion
   - export PDF (simple) + Excel (simple)
*/

const STORAGE_KEY = "pf_ficha_v1";
let MODE = "10"; // "10" or "full"

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function deepSet(obj, path, value){
  const parts = path.split(".");
  let cur = obj;
  for (let i=0; i<parts.length-1; i++){
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length-1]] = value;
}

function deepGet(obj, path){
  return path.split(".").reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : undefined), obj);
}

function nowISODate(){
  const d = new Date();
  const tzOff = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOff).toISOString().slice(0,10);
}

function getStateFromForm(){
  const state = {};
  $$("[data-field]").forEach(el => {
    const key = el.getAttribute("data-field");
    let val;
    if (el.type === "checkbox") val = !!el.checked;
    else val = el.value ?? "";
    deepSet(state, key, val);
  });
  state._meta = { mode: MODE, updatedAt: new Date().toISOString() };
  return state;
}

function applyStateToForm(state){
  $$("[data-field]").forEach(el => {
    const key = el.getAttribute("data-field");
    const val = deepGet(state, key);
    if (val === undefined) return;

    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  });
}

function save(){
  const st = getStateFromForm();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  renderSidePanel(st);
}

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function clearAll(){
  localStorage.removeItem(STORAGE_KEY);
  $$("[data-field]").forEach(el => {
    if (el.type === "checkbox") el.checked = false;
    else el.value = "";
  });
  // default date
  const dateEl = document.querySelector('[data-field="id.fecha"]');
  if (dateEl) dateEl.value = nowISODate();
  save();
}

function setMode(mode){
  MODE = mode;
  const body = document.body;
  const pillMode = $("#pillMode");
  const btn10 = $("#btnMode10");
  const btnFull = $("#btnModeFull");

  if (mode === "full"){
    body.classList.add("mode-full");
    pillMode.textContent = "Completa";
    btnFull.classList.add("active");
    btn10.classList.remove("active");
  } else {
    body.classList.remove("mode-full");
    pillMode.textContent = "10 min";
    btn10.classList.add("active");
    btnFull.classList.remove("active");
  }
  save();
}

function safetyFlag(state){
  const s = state?.seguridad || {};
  const keys = ["fiebre","hematuria","retencion","sangrado_anormal","dolor_agudo_severo","neuro","sospecha_dvt"];
  return keys.some(k => !!s[k]);
}

function computeSuggestedClassification(state){
  const u = state?.dom?.urinario || {};
  const i = state?.dom?.intestinal || {};
  const pop = state?.dom?.pop || {};
  const d = state?.dom?.dolor || {};
  const sx = state?.dom?.sexual || {};
  const msk = state?.msk || {};
  const sf = state?.sf || {};

  const tags = [];

  // Urinario
  const sui = !!u.sui;
  const urg = !!u.urgencia;
  if (sui && urg) tags.push("UI mixta");
  else if (sui) tags.push("SUI (esfuerzo)");
  else if (urg) tags.push("OAB/urgencia");

  // Prolapso
  if (!!pop.bulto) tags.push("POP sintomático");

  // Intestinal
  if (!!i.fi) tags.push("FI (gases/heces)");
  if (!!i.estrenimiento) tags.push("Estreñimiento / disfunción defecatoria");

  // Dolor
  if (!!d.pelvico || !!d.vulvar || !!d.coxis) tags.push("Dolor pélvico / componente miofascial");

  // Sexual
  if (!!sx.superficial || !!sx.profunda) tags.push("Dispareunia");

  // PGP embarazo/postparto
  const preg = (sf.embarazo === "si");
  const pp = (sf.postparto === "si");
  if ((preg || pp) && msk.zona === "pgp") tags.push("PGP (embarazo/postparto)");

  if (!tags.length) return { label: "—", hint: "Marca síntomas para sugerencia automática." };

  // Si hay muchas, prioriza por orden clínico “motivo”
  const label = tags.slice(0,2).join(" + ");
  const hint = tags.length > 2 ? `También: ${tags.slice(2).join(", ")}` : "Sugerencia automática (confirma con tu juicio).";
  return { label, hint };
}

function renderSidePanel(state){
  const nombre = state?.id?.nombre || "";
  const rut = state?.id?.rut || "";
  $("#pvPaciente").textContent = (nombre || rut) ? `${nombre || "—"}${rut ? " · " + rut : ""}` : "—";

  const motivo = state?.motivo?.principal || "";
  $("#pvMotivo").textContent = motivo ? truncate(motivo, 80) : "—";

  const manual = state?.plan?.clasificacion_manual || "";
  const sug = computeSuggestedClassification(state);
  $("#pvClasif").textContent = manual ? manual : sug.label;
  $("#pvClasifHint").textContent = manual ? "Clasificación manual (tu juicio)." : sug.hint;

  const bad = safetyFlag(state);
  const badge = $("#badgeSafety");
  if (bad){
    badge.classList.remove("ok");
    badge.classList.add("bad");
    badge.textContent = "Atención: red flags marcadas";
  } else {
    badge.classList.remove("bad");
    badge.classList.add("ok");
    badge.textContent = "Sin red flags marcadas";
  }
}

function truncate(str, n){
  const s = String(str);
  return s.length > n ? s.slice(0,n-1) + "…" : s;
}

function flattenToPairs(state){
  const pairs = [];
  function walk(obj, prefix=""){
    if (obj === null || obj === undefined) return;
    if (typeof obj !== "object"){
      pairs.push([prefix, String(obj)]);
      return;
    }
    if (Array.isArray(obj)){
      pairs.push([prefix, obj.join(", ")]);
      return;
    }
    Object.keys(obj).forEach(k => {
      if (k === "_meta") return;
      const next = prefix ? `${prefix}.${k}` : k;
      walk(obj[k], next);
    });
  }
  walk(state, "");
  return pairs;
}

function exportJSON(){
  const st = getStateFromForm();
  const blob = new Blob([JSON.stringify(st, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileBaseName(st) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function fileBaseName(state){
  const name = (state?.id?.nombre || "paciente").trim().replace(/\s+/g,"_");
  const date = (state?.id?.fecha || nowISODate());
  return `Ficha_PF_${name}_${date}`;
}

function exportXLSX(){
  const st = getStateFromForm();

  const pairs = flattenToPairs(st).map(([k,v]) => ({ Campo: k, Valor: v }));
  const ws1 = XLSX.utils.json_to_sheet(pairs);

  const resumen = makeResumenPaciente(st);
  const ws2 = XLSX.utils.json_to_sheet(resumen.map(r => ({ Campo: r[0], Valor: r[1] })));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Ficha");
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

  XLSX.writeFile(wb, fileBaseName(st) + ".xlsx");
}

function makeResumenPaciente(st){
  const sug = computeSuggestedClassification(st);
  const clasif = st?.plan?.clasificacion_manual || sug.label;

  const items = [
    ["Nombre", st?.id?.nombre || ""],
    ["Fecha", st?.id?.fecha || ""],
    ["Motivo principal", st?.motivo?.principal || ""],
    ["Meta", st?.motivo?.meta || ""],
    ["Clasificación", clasif || ""],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4 || ""],
    ["Tareas hogar", st?.plan?.tareas || ""],
    ["Señales de alerta (si aparecen, consultar)", "Fiebre + dolor pélvico, hematuria visible, retención urinaria, sangrado anormal importante, dolor agudo severo nuevo, síntomas neurológicos."],
    ["Re-test sugerido", st?.plan?.retest || (MODE === "full" ? "2–4 semanas o 4–6 sesiones" : "En 2–4 semanas")]
  ];
  return items;
}

function exportPDF(){
  const st = getStateFromForm();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  const margin = 40;
  let y = margin;

  doc.setFont("helvetica","bold");
  doc.setFontSize(16);
  doc.text("Ficha Clínica – Piso Pélvico", margin, y);
  y += 18;

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.text(`Paciente: ${st?.id?.nombre || "—"}  |  RUT/ID: ${st?.id?.rut || "—"}  |  Fecha: ${st?.id?.fecha || "—"}`, margin, y);
  y += 16;

  const sug = computeSuggestedClassification(st);
  const clasif = st?.plan?.clasificacion_manual || sug.label;
  const safety = safetyFlag(st) ? "ATENCIÓN: red flags marcadas (ver sección Seguridad)" : "Sin red flags marcadas";

  doc.setFont("helvetica","bold");
  doc.text(`Clasificación: ${clasif}`, margin, y);
  y += 14;

  doc.setFont("helvetica","normal");
  doc.text(`Seguridad: ${safety}`, margin, y);
  y += 18;

  const resumen = [
    ["Motivo principal", st?.motivo?.principal || ""],
    ["Meta", st?.motivo?.meta || ""],
    ["NRS síntoma principal", st?.medicion?.nrs_principal || ""],
    ["PSFS", [st?.medicion?.psfs1, st?.medicion?.psfs2, st?.medicion?.psfs3].filter(Boolean).join(" | ")],
    ["Embarazo", `${st?.sf?.embarazo || "—"} ${st?.sf?.semanas ? "(" + st.sf.semanas + ")" : ""}`],
    ["Postparto", `${st?.sf?.postparto || "—"} ${st?.sf?.semanas_pp ? "(" + st.sf.semanas_pp + ")" : ""}`],
    ["Plan 2–4 semanas", st?.plan?.plan_2_4 || ""],
    ["Tareas", st?.plan?.tareas || ""]
  ];

  doc.autoTable({
    startY: y,
    head: [["Campo", "Valor"]],
    body: resumen.map(r => [r[0], String(r[1] ?? "")]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [20, 24, 32] }, // solo para tabla; si no quieres color, bórralo
    margin: { left: margin, right: margin }
  });

  y = doc.lastAutoTable.finalY + 14;

  // Adjunta “pares” simples (opcional, solo si full)
  if (MODE === "full"){
    const pairs = flattenToPairs(st)
      .filter(([k,v]) => v !== "" && v !== "false" && v !== "False")
      .slice(0, 80); // evita PDF infinito

    doc.setFont("helvetica","bold");
    doc.text("Registro (resumen técnico)", margin, y);
    y += 8;

    doc.autoTable({
      startY: y,
      head: [["Campo", "Valor"]],
      body: pairs.map(([k,v]) => [k, v]),
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [20, 24, 32] },
      margin: { left: margin, right: margin }
    });
  }

  doc.save(fileBaseName(st) + ".pdf");
}

function bind(){
  // default date
  const dateEl = document.querySelector('[data-field="id.fecha"]');
  if (dateEl && !dateEl.value) dateEl.value = nowISODate();

  $$("[data-field]").forEach(el => {
    el.addEventListener("input", save);
    el.addEventListener("change", save);
  });

  $("#btnMode10").addEventListener("click", () => setMode("10"));
  $("#btnModeFull").addEventListener("click", () => setMode("full"));

  $("#btnExportPdf").addEventListener("click", exportPDF);
  $("#btnExportXlsx").addEventListener("click", exportXLSX);

  $("#btnClear").addEventListener("click", () => {
    if (confirm("¿Borrar toda la ficha? Esto limpia también el guardado local.")) clearAll();
  });

  $("#btnSaveJson").addEventListener("click", exportJSON);
  $("#btnPrint").addEventListener("click", () => window.print());
}

// init
(function init(){
  bind();
  const st = load();
  if (st){
    MODE = st?._meta?.mode || "10";
    applyStateToForm(st);
    setMode(MODE);
    renderSidePanel(getStateFromForm());
  } else {
    setMode("10");
    save();
  }
})();
