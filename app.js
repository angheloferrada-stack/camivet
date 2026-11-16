// Fichas Vet — pantallas y lógica.
// Regla de oro: nada se borra de verdad. "Eliminar" marca deletedAt y el elemento pasa a la Papelera.
import { createStore } from './store.js';
import { SCHEMA, parseItem, baseKey, itemKey } from './ficha.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const COLS = ['clinics', 'patients', 'exams', 'files', 'settings'];
const S = { store: null, clinics: [], patients: [], exams: [], files: [], settings: [], tab: 'fichas', eye: 'od', exam: null, dirty: false, imp: null };

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const nowISO = () => new Date().toISOString();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = (s) => { try { return new Date(s + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return s || ''; } };
const fmtTs = (s) => { try { return new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const coll = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const live = (a) => a.filter((x) => !x.deletedAt);
// Membrete de la ficha (nombre, RUT, WhatsApp, logo). Vive solo en los datos privados de la usuaria, no en el código.
const profile = () => S.settings.find((x) => x.id === 'profile') || { id: 'profile', name: '', title: '', spec: '', rut: '', phone: '', logo: '' };
const clinicOf = (id) => S.clinics.find((c) => c.id === id);
const patientOf = (id) => S.patients.find((p) => p.id === id);
const go = (h) => { location.hash = h; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ICON = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  building: '<path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M3 21h18M8 8h3M8 12h3M8 16h3"/>',
  house: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/>',
  doc: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

/* ---------- datos ---------- */
async function loadAll() {
  const r = await Promise.all(COLS.map((c) => S.store.all(c)));
  [S.clinics, S.patients, S.exams, S.files, S.settings] = r;
}

function setStatus(kind) {
  const d = $('#dot'), t = $('#sav'); if (!d) return;
  d.className = 'dot' + (kind === 'busy' ? ' busy' : kind === 'err' ? ' err' : '');
  t.textContent = kind === 'busy' ? 'Guardando…' : kind === 'err' ? 'Error al guardar' : 'Guardado';
}

async function save(name, obj) {
  obj.updatedAt = nowISO();
  const arr = S[name]; const i = arr.findIndex((x) => x.id === obj.id);
  if (i < 0) arr.push(obj); else arr[i] = obj;
  setStatus('busy');
  try {
    // Sin internet la nube deja el cambio en cola y lo sube sola al volver: no esperamos más de 5 s.
    await Promise.race([S.store.put(name, JSON.parse(JSON.stringify(obj))), sleep(5000)]);
    setStatus('ok');
  } catch (e) {
    console.error(e); setStatus('err'); toast('No se pudo guardar. Revisa tu conexión.'); throw e;
  }
}

const base = () => ({ id: uid(), createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null });
const newClinic = (name, extra = {}) => ({ ...base(), name, address: '', phone: '', notes: '', kind: 'clinica', ...extra });
const newPatient = (clinicId, name, extra = {}) => ({ ...base(), clinicId, name, species: '', breed: '', age: '', sex: '', owner: '', ownerRut: '', phone: '', address: '', notes: '', ...extra });

async function seed() {
  if (!S.clinics.length) await save('clinics', newClinic('Domicilio', { id: 'domicilio', kind: 'domicilio', notes: 'Pacientes atendidos en su domicilio' }));
}

/* ---------- plantillas comunes ---------- */
const navBar = (backHash, backLabel, right = '') =>
  `<div class="nav"><button class="back" data-go="${backHash}">${ic('back')}<span>${esc(backLabel)}</span></button><div class="right">${right}</div></div>`;
const kv = (k, v) => (v ? `<div><div class="k">${esc(k)}</div><div>${esc(v)}</div></div>` : '');

function patientRows(list, { showClinic = false } = {}) {
  if (!list.length) return '';
  const sorted = [...list].sort((a, b) => coll.compare(a.name, b.name));
  const groups = new Map();
  for (const p of sorted) {
    const l = (norm(p.name)[0] || '#').toUpperCase();
    const k = /[A-Z]/.test(l) ? l : '#';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  return [...groups].map(([l, ps]) => `<div class="letter">${l}</div><div class="list">${ps.map((p) => {
    const sub = [p.species, p.breed, showClinic ? clinicOf(p.clinicId)?.name : p.owner].filter(Boolean).join(' · ');
    return `<div class="row" data-go="#/p/${p.id}"><div class="ic">${esc(p.name.trim()[0]?.toUpperCase() || '?')}</div><div class="grow"><div class="t">${esc(p.name)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>${ic('chev').replace('class="i"', 'class="i chev"')}</div>`;
  }).join('')}</div>`).join('');
}

/* ---------- inicio: clínicas ---------- */
function clinicsHTML() {
  const cs = live(S.clinics).sort((a, b) => (a.kind === 'domicilio' ? -1 : b.kind === 'domicilio' ? 1 : coll.compare(a.name, b.name)));
  if (!cs.length) return `<div class="empty"><h2>Aún no hay clínicas</h2><button class="btn primary" data-act="newClinic">Agregar clínica</button></div>`;
  const n = (id) => live(S.patients).filter((p) => p.clinicId === id).length;
  return `<div class="list">${cs.map((c) => `<div class="row" data-go="#/c/${c.id}"><div class="ic">${ic(c.kind === 'domicilio' ? 'house' : 'building')}</div><div class="grow"><div class="t">${esc(c.name)}</div>${c.address ? `<div class="s">${esc(c.address)}</div>` : ''}</div><div class="count">${n(c.id)}</div>${ic('chev').replace('class="i"', 'class="i chev"')}</div>`).join('')}</div>`;
}

function searchHTML(q) {
  const nq = norm(q);
  const res = live(S.patients).filter((p) => [p.name, p.owner, p.breed].some((x) => norm(x).includes(nq))).slice(0, 80);
  return res.length ? patientRows(res, { showClinic: true }) : `<div class="empty"><h2>Sin resultados</h2><div class="muted">Prueba con otro nombre.</div></div>`;
}

function viewHome() {
  app.innerHTML = `<div class="page"><div class="top"><h1 class="big">Fichas</h1><div class="acts">
    <button class="icon-btn plain" data-go="#/settings" aria-label="Ajustes">${ic('sliders')}</button>
    <button class="icon-btn" data-act="newClinic" aria-label="Nueva clínica">${ic('plus')}</button></div></div>
    <div class="search">${ic('search')}<input id="q" type="search" placeholder="Buscar paciente en todas las clínicas" autocomplete="off"></div>
    <div id="res">${clinicsHTML()}</div></div>`;
  $('#q').addEventListener('input', (e) => { $('#res').innerHTML = e.target.value.trim() ? searchHTML(e.target.value) : clinicsHTML(); });
}

/* ---------- clínica ---------- */
function viewClinic(id) {
  const c = clinicOf(id); if (!c || c.deletedAt) return go('#/');
  const list = () => live(S.patients).filter((p) => p.clinicId === id);
  app.innerHTML = `<div class="page">${navBar('#/', 'Fichas', `<button class="link" data-act="editClinic" data-id="${id}">Editar</button>`)}
    <h1 class="big">${esc(c.name)}</h1>
    ${c.address || c.phone ? `<div class="note" style="padding-top:0">${esc([c.address, c.phone].filter(Boolean).join(' · '))}</div>` : ''}
    <div class="search">${ic('search')}<input id="cq" type="search" placeholder="Buscar en ${esc(c.name)}" autocomplete="off"></div>
    <div id="plist"></div>
    <div class="stack"><button class="btn primary block" data-act="newPatient" data-clinic="${id}">${ic('plus')} Nuevo paciente</button></div></div>`;
  const draw = (q = '') => {
    const nq = norm(q); const ps = list().filter((p) => !nq || [p.name, p.owner].some((x) => norm(x).includes(nq)));
    $('#plist').innerHTML = ps.length ? patientRows(ps) : `<div class="empty"><h2>${list().length ? 'Sin resultados' : 'Aún no hay pacientes'}</h2><div class="muted">${list().length ? 'Prueba con otro nombre.' : 'Agrega el primero con el botón de abajo.'}</div></div>`;
  };
  draw(); $('#cq').addEventListener('input', (e) => draw(e.target.value));
}

/* ---------- paciente ---------- */
function viewPatient(id) {
  const p = patientOf(id); if (!p || p.deletedAt) return go('#/');
  const c = clinicOf(p.clinicId);
  const exams = live(S.exams).filter((e) => e.patientId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const files = live(S.files).filter((f) => f.patientId === id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const dom = c?.kind === 'domicilio';
  const info = [kv('Especie', p.species), kv('Raza', p.breed), kv('Edad', p.age), kv('Sexo', p.sex), kv('Propietario', p.owner), kv('RUT propietario', p.ownerRut), kv('Teléfono', p.phone), kv(dom ? 'Domicilio' : 'Dirección', p.address), kv('Clínica', c?.name)].join('');
  const fichas = exams.length
    ? `<div class="list">${exams.map((e) => `<div class="row" data-go="#/e/${e.id}"><div class="ic">${ic('doc')}</div><div class="grow"><div class="t">${fmtDate(e.date)}</div><div class="s">${esc(e.data?.['diagnostico_y_tratamiento.x.diagnostico'] || 'Examen oftálmico')}</div></div>${ic('chev').replace('class="i"', 'class="i chev"')}</div>`).join('')}</div>`
    : `<div class="empty"><h2>Sin fichas todavía</h2><div class="muted">Crea la ficha de examen oftálmico.</div></div>`;
  const archivos = files.length
    ? `<div class="grid">${files.map((f) => `<button class="tile" data-act="openFile" data-id="${f.id}"><div class="th ${f.mime === 'application/pdf' ? 'pdf' : ''}" data-thumb="${f.id}">${f.mime === 'application/pdf' ? ic('doc') : ic('photo')}</div><div class="nm">${esc(f.name)}</div></button>`).join('')}</div>`
    : `<div class="empty"><h2>Sin archivos</h2><div class="muted">Agrega fotos o PDFs de este paciente.</div></div>`;
  app.innerHTML = `<div class="page">${navBar(`#/c/${p.clinicId}`, c?.name || 'Atrás', `<button class="link" data-act="editPatient" data-id="${id}">Editar</button>`)}
    <h1 class="big">${esc(p.name)}</h1>
    <div class="info"><div class="info-grid">${info || '<span class="muted">Sin datos. Toca Editar para completarlos.</span>'}</div>${p.notes ? `<div class="note" style="padding:8px 0 0">${esc(p.notes)}</div>` : ''}</div>
    <div class="seg-wrap" style="position:static"><div class="seg on">
      <button data-act="tab" data-tab="fichas" aria-selected="${S.tab === 'fichas'}">Fichas (${exams.length})</button>
      <button data-act="tab" data-tab="archivos" aria-selected="${S.tab === 'archivos'}">Archivos (${files.length})</button></div></div>
    <div id="tabbody">${S.tab === 'fichas' ? fichas : archivos}</div>
    <div class="stack">${S.tab === 'fichas'
      ? `<button class="btn primary block" data-act="newExam" data-id="${id}">${ic('plus')} Nueva ficha</button>`
      : `<button class="btn primary block" data-act="addFiles" data-id="${id}">${ic('plus')} Agregar fotos o PDFs</button>`}</div></div>`;
  if (S.tab === 'archivos') {
    files.filter((f) => f.mime && f.mime.startsWith('image/')).forEach(async (f) => {
      try { const u = await fileURL(f); const el = $(`[data-thumb="${f.id}"]`); if (el) el.innerHTML = `<img alt="" src="${u}">`; } catch (e) { /* sin miniatura */ }
    });
  }
}

const urlCache = new Map();
async function fileURL(f) {
  if (!urlCache.has(f.id)) urlCache.set(f.id, S.store.fileURL(f));
  return urlCache.get(f.id);
}

/* ---------- ficha oftálmica ---------- */
function rowHTML(sec, row, side) {
  const [lab, spec] = row; const d = S.exam.data; const pre = side ? side + '/' : '';
  const inner = spec.split('|').map(parseItem).map((it) => {
    if (it.kind === 'check') { const k = pre + itemKey(sec, lab, it); return `<button type="button" class="chip" data-chip="${esc(k)}" aria-pressed="${!!d[k]}">${esc(it.label)}</button>`; }
    if (it.kind === 'radio') { const k = pre + baseKey(sec, lab); return `<button type="button" class="chip" data-radio="${esc(k)}" data-val="${esc(it.label)}" aria-pressed="${d[k] === it.label}">${esc(it.label)}</button>`; }
    const k = pre + itemKey(sec, lab, it);
    return `<label class="tf${it.kind === 'area' ? ' area' : ''}"><span>${esc(it.label)}</span>${it.kind === 'area'
      ? `<textarea rows="2" data-field="${esc(k)}">${esc(d[k] || '')}</textarea>`
      : `<input data-field="${esc(k)}" value="${esc(d[k] || '')}" autocomplete="off">`}</label>`;
  }).join('');
  return `<div class="rowf">${lab ? `<div class="lab">${esc(lab)}</div>` : ''}<div class="opts">${inner}</div></div>`;
}

function formHTML() {
  return SCHEMA.map((sec) => {
    if (!sec.eye) return `<div class="sec"><h3>${esc(sec.t)}</h3><div class="eye-col">${sec.rows.map((r) => rowHTML(sec, r, '')).join('')}</div></div>`;
    const col = (side, name) => `<div class="eye-col" data-side="${side}"><div class="eye-h">${name}</div>${sec.rows.map((r) => rowHTML(sec, r, side)).join('')}</div>`;
    return `<div class="sec"><h3>${esc(sec.t)}</h3><div class="eyes">${col('od', 'Ojo derecho')}${col('oi', 'Ojo izquierdo')}</div></div>`;
  }).join('');
}

function viewExam(id) {
  const ex = S.exams.find((e) => e.id === id); if (!ex || ex.deletedAt) return go('#/');
  const p = patientOf(ex.patientId); if (!p) return go('#/');
  ex.data = ex.data || {}; S.exam = ex; S.dirty = false;
  app.innerHTML = `<div class="page wide">${navBar(`#/p/${p.id}`, p.name, `<div class="savebar"><span class="dot" id="dot"></span><span id="sav">Guardado</span></div><button class="link" data-act="print">PDF</button>`)}
    <h1 class="big">Examen oftálmico</h1>
    ${(() => { const pr = profile(); return pr.name
      ? `<div class="info"><div class="membrete">${pr.logo ? `<img src="${pr.logo}" alt="">` : ''}<div><div class="t">${esc(pr.name)}</div><div class="s">${esc([pr.title, pr.spec].filter(Boolean).join(' · '))}</div><div class="s">${esc([pr.rut && 'R.U.T. ' + pr.rut, pr.phone].filter(Boolean).join(' · '))}</div></div></div></div>`
      : `<div class="info"><div class="note" style="padding:0">Aún no hay datos del veterinario en el encabezado. <button class="link" data-go="#/settings">Completar en Ajustes</button></div></div>`; })()}
    <div class="info" style="margin-top:12px"><div class="info-grid">${kv('Mascota', p.name)}${kv('Especie', p.species)}${kv('Raza', p.breed)}${kv('Propietario', p.owner)}${kv('RUT', p.ownerRut)}</div></div>
    <div class="form" style="margin-top:12px">
      <div class="field"><label>Fecha</label><input type="date" data-meta="date" value="${esc(ex.date || today())}"></div></div>
    <div class="seg-wrap"><div class="seg"><button data-act="eye" data-side="od" aria-selected="${S.eye === 'od'}">Ojo derecho</button><button data-act="eye" data-side="oi" aria-selected="${S.eye === 'oi'}">Ojo izquierdo</button></div>
      <div class="copy"><button class="link" data-act="copy" data-from="od" data-to="oi">Copiar derecho → izquierdo</button></div></div>
    <div id="fbody" class="show-${S.eye}">${formHTML()}</div>
    <div class="stack"><button class="btn block" data-act="print">Guardar como PDF o imprimir</button>
      <button class="btn danger block" data-act="delExam" data-id="${id}">Mover ficha a la papelera</button></div></div>`;
}

function printHTML(ex, p, c) {
  const d = ex.data || {};
  const val = (sec, row, side) => {
    const [lab, spec] = row; const pre = side ? side + '/' : '';
    const parts = spec.split('|').map(parseItem).map((it) => {
      if (it.kind === 'check') return `${d[pre + itemKey(sec, lab, it)] ? '☒' : '☐'} ${esc(it.label)}`;
      if (it.kind === 'radio') return `${d[pre + baseKey(sec, lab)] === it.label ? '☒' : '☐'} ${esc(it.label)}`;
      const v = d[pre + itemKey(sec, lab, it)];
      return `${esc(it.label)}: <u>${v ? esc(v) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</u>`;
    });
    return `<div>${lab ? `<b>${esc(lab)}:</b> ` : ''}${parts.join(' &nbsp; ')}</div>`;
  };
  const eyeSecs = SCHEMA.filter((s) => s.eye);
  const cut = eyeSecs.findIndex((s) => s.t.startsWith('Córnea'));
  const eyeTable = (arr, cls) => `<table class="${cls}"><tr><th></th><th>Ojo derecho</th><th>Ojo izquierdo</th></tr>${arr.map((s) =>
    `<tr><th class="sh">${esc(s.t)}</th><td>${s.rows.map((r) => val(s, r, 'od')).join('')}</td><td>${s.rows.map((r) => val(s, r, 'oi')).join('')}</td></tr>`).join('')}</table>`;
  const plain = `<table>${SCHEMA.filter((s) => !s.eye).map((s) => `<tr><th class="sh">${esc(s.t)}</th><td>${s.rows.map((r) => val(s, r, '')).join('')}</td></tr>`).join('')}</table>`;
  const pr = profile(); const [yy, mm, dd] = (ex.date || '').split('-');
  return `<div class="mh"><div>${pr.name ? `<b>${esc(pr.name)}</b>` : ''}${[pr.title, pr.spec].filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join('')}${pr.rut ? `<div>R.U.T.: ${esc(pr.rut)}</div>` : ''}${pr.phone ? `<div>WhatsApp ${esc(pr.phone)}</div>` : ''}</div>${pr.logo ? `<img class="mhlogo" src="${pr.logo}" alt="">` : ''}</div>
    <div class="ph">Informe de Examen Oftálmico</div>
    <div class="pdate"><div><small>Día</small>${dd ? +dd : ''}</div><div><small>Mes</small>${mm ? +mm : ''}</div><div><small>Año</small>${yy || ''}</div></div>
    <div class="pm"><div><b>Mascota:</b> ${esc(p.name)}</div><div><b>Especie:</b> ${esc(p.species)}</div>
      <div><b>Raza:</b> ${esc(p.breed)}</div><div><b>Propietario:</b> ${esc(p.owner)}</div>
      <div><b>RUT:</b> ${esc(p.ownerRut)}</div></div>
    ${eyeTable(eyeSecs.slice(0, cut), '')}${eyeTable(eyeSecs.slice(cut), 'pb')}${plain}`;
}

/* ---------- ajustes, papelera, importar ---------- */
async function viewSettings() {
  const u = await S.store.user();
  app.innerHTML = `<div class="page">${navBar('#/', 'Fichas')}<h1 class="big">Ajustes</h1>
    ${S.store.mode === 'local' ? `<div class="info"><span class="pill warn">Modo prueba</span><div class="note" style="padding:6px 0 0">Los datos quedan solo en este dispositivo. Para guardarlos en la nube conecta Firebase (ver README).</div></div>` : `<div class="info"><span class="pill ok">Guardado en la nube</span><div class="note" style="padding:6px 0 0">${esc(u?.email || '')}</div></div>`}
    ${(() => { const mb = S.files.reduce((a, f) => a + (f.size || 0), 0) / 1048576; const pct = Math.min(100, mb / 1024 * 100);
      return `<div class="group-title">Espacio</div><div class="info"><div><b>${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB</b> de 1 GB gratis · ${S.files.length} archivos${pct > 80 ? ' <span class="pill warn">Casi lleno</span>' : ''}</div><div class="progress" style="margin-top:8px"><i style="width:${pct}%"></i></div></div>`; })()}
    <div class="group-title">Datos</div>
    <div class="list">
      <div class="row" data-act="editProfile"><div class="grow"><div class="t">Mis datos (encabezado de la ficha)</div><div class="s">${profile().name ? esc(profile().name) : 'Nombre, RUT, WhatsApp y logo que salen en la ficha'}</div></div>${ic('chev').replace('class="i"', 'class="i chev"')}</div>
      <div class="row" data-go="#/import"><div class="grow"><div class="t">Importar PDFs que ya tengo</div><div class="s">Sube muchos de una vez a una clínica</div></div>${ic('chev').replace('class="i"', 'class="i chev"')}</div>
      <div class="row" data-go="#/trash"><div class="grow"><div class="t">Papelera</div><div class="s">Recupera lo que eliminaste. Nada se borra para siempre.</div></div>${ic('chev').replace('class="i"', 'class="i chev"')}</div>
      <div class="row" data-act="backup"><div class="grow"><div class="t">Descargar respaldo</div><div class="s">Archivo con todas las clínicas, pacientes y fichas</div></div></div></div>
    ${S.store.mode === 'local' ? `<div class="group-title">Prueba</div><div class="list"><div class="row" data-act="demo"><div class="grow"><div class="t">Cargar datos de ejemplo</div><div class="s">Para ver cómo se ve con pacientes</div></div></div></div>` : `<div class="stack"><button class="btn block" data-act="logout">Cerrar sesión</button></div>`}</div>`;
}

function viewTrash() {
  const items = [];
  S.clinics.filter((c) => c.deletedAt).forEach((c) => items.push({ col: 'clinics', o: c, t: c.name, s: 'Clínica' }));
  S.patients.filter((p) => p.deletedAt).forEach((p) => items.push({ col: 'patients', o: p, t: p.name, s: 'Paciente · ' + (clinicOf(p.clinicId)?.name || '') }));
  S.exams.filter((e) => e.deletedAt && patientOf(e.patientId) && !patientOf(e.patientId).deletedAt).forEach((e) => items.push({ col: 'exams', o: e, t: 'Ficha del ' + fmtDate(e.date), s: patientOf(e.patientId).name }));
  S.files.filter((f) => f.deletedAt && patientOf(f.patientId) && !patientOf(f.patientId).deletedAt).forEach((f) => items.push({ col: 'files', o: f, t: f.name, s: 'Archivo · ' + patientOf(f.patientId).name }));
  items.sort((a, b) => (b.o.deletedAt || '').localeCompare(a.o.deletedAt || ''));
  app.innerHTML = `<div class="page">${navBar('#/settings', 'Ajustes')}<h1 class="big">Papelera</h1>
    ${items.length ? `<div class="list">${items.map((i) => `<div class="row"><div class="grow"><div class="t">${esc(i.t)}</div><div class="s">${esc(i.s)} · eliminado ${fmtTs(i.o.deletedAt)}</div></div><button class="link" data-act="restore" data-col="${i.col}" data-id="${i.o.id}">Restaurar</button></div>`).join('')}</div>`
      : `<div class="empty"><h2>La papelera está vacía</h2><div class="muted">Lo que elimines aparecerá aquí y podrás recuperarlo.</div></div>`}</div>`;
}

const GENERIC = /^(nuevo|new|sin nombre|documento|scan|img|image|whatsapp|copia)/i;
function cleanName(fn) {
  let n = fn.replace(/\.[^.]+$/, '').replace(/(\s*\(\d+\))+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return n ? n[0].toUpperCase() + n.slice(1) : 'Sin nombre';
}

function viewImport() {
  const cs = live(S.clinics).sort((a, b) => coll.compare(a.name, b.name));
  S.imp = { rows: [] };
  app.innerHTML = `<div class="page">${navBar('#/settings', 'Ajustes')}<h1 class="big">Importar PDFs</h1>
    <div class="note" style="padding-top:0">Elige la clínica y luego los PDFs (o fotos). Cada archivo se agrega a un paciente con el nombre del archivo; si ya existe, se suma a su carpeta.</div>
    <div class="form"><div class="field"><label>Clínica de destino</label><select id="impc">${cs.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}<option value="__new">+ Nueva clínica…</option></select></div>
      <div class="field" id="impnw" hidden><label>Nombre de la nueva clínica</label><input id="impn" autocomplete="off"></div></div>
    <div class="stack"><button class="btn block" data-act="pickImport">${ic('plus')} Elegir archivos</button>
      <input id="impf" type="file" multiple accept="application/pdf,image/*" hidden></div>
    <div id="impl"></div></div>`;
  $('#impc').addEventListener('change', (e) => { $('#impnw').hidden = e.target.value !== '__new'; });
  $('#impf').addEventListener('change', (e) => {
    S.imp.rows = [...e.target.files].map((f) => ({ file: f, name: cleanName(f.name) }));
    drawImport();
  });
}

function drawImport() {
  const rows = S.imp.rows; const el = $('#impl'); if (!el) return;
  if (!rows.length) { el.innerHTML = ''; return; }
  const generic = rows.filter((r) => GENERIC.test(r.name)).length;
  el.innerHTML = `<div class="group-title">${rows.length} archivos${generic ? ` · ${generic} con nombre genérico` : ''}</div>
    <div class="list">${rows.map((r, i) => `<div class="imp"><input data-imp="${i}" value="${esc(r.name)}" aria-label="Nombre del paciente"><span class="pill ${GENERIC.test(r.name) ? 'warn' : ''}">${GENERIC.test(r.name) ? 'Revisar' : 'OK'}</span><small>${esc(r.file.name)}</small></div>`).join('')}</div>
    <div class="stack"><div class="progress" id="impp" hidden><i></i></div>
      <button class="btn primary block" id="impgo" data-act="runImport">Importar ${rows.length} archivos</button></div>`;
}

async function runImport() {
  const rows = S.imp.rows; if (!rows.length) return;
  let cid = $('#impc').value;
  if (cid === '__new') {
    const nm = $('#impn').value.trim(); if (!nm) return toast('Escribe el nombre de la clínica');
    const c = newClinic(nm); await save('clinics', c); cid = c.id;
  }
  const btn = $('#impgo'); btn.disabled = true; $('#impp').hidden = false;
  const byName = new Map(live(S.patients).filter((p) => p.clinicId === cid).map((p) => [norm(p.name), p]));
  for (const r of rows) {
    const k = norm(r.name) || 'sin nombre';
    if (!byName.has(k)) { const p = newPatient(cid, r.name.trim() || 'Sin nombre'); await save('patients', p); byName.set(k, p); }
    r.patient = byName.get(k);
  }
  let done = 0, fail = 0, i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      try { await addFileTo(r.patient.id, r.file); } catch (e) { fail++; console.error(e); }
      done++; btn.textContent = `Subiendo ${done} de ${rows.length}…`; $('#impp i').style.width = (done / rows.length * 100) + '%';
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  toast(fail ? `Listo. ${fail} archivo(s) no se pudieron subir.` : `Listo: ${rows.length} archivos importados`);
  go(`#/c/${cid}`);
}

const MAX_FILE = 15 * 1024 * 1024; // el espacio gratis de Firestore es 1 GB en total

// Las fotos se reducen (máx. 1800 px, JPEG) para ahorrar espacio. Los PDFs se guardan tal cual.
async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
}

async function addFileTo(patientId, original) {
  const file = await shrinkImage(original);
  if (file.size > MAX_FILE) throw new Error(`${original.name} pesa más de 15 MB`);
  const meta = { ...base(), patientId, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, path: '' };
  await S.store.putFile(meta, file);
  await save('files', meta);
  return meta;
}

/* ---------- hojas (formularios) ---------- */
const fld = (name, label, val = '', o = {}) => `<div class="field"><label>${label}</label>${o.area
  ? `<textarea name="${name}" rows="3">${esc(val)}</textarea>`
  : o.opts ? `<select name="${name}">${o.opts.map((x) => `<option value="${esc(x.v ?? x)}"${(x.v ?? x) === val ? ' selected' : ''}>${esc(x.l ?? x)}</option>`).join('')}</select>`
    : `<input name="${name}" value="${esc(val)}" ${o.type ? `type="${o.type}"` : ''} ${o.list ? `list="${o.list}"` : ''} autocomplete="off">`}</div>`;

function openSheet(title, body, onSubmit, danger) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<form class="sheet" novalidate><h2>${esc(title)}</h2><div class="form">${body}</div>
    <div class="btns"><button type="button" class="btn" data-x>Cancelar</button><button class="btn primary">Guardar</button></div>
    ${danger ? `<button type="button" class="btn danger block" data-del>${esc(danger.label)}</button>` : ''}</form>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) close(); });
  bg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await onSubmit(Object.fromEntries(new FormData(e.target)), bg);
    if (r !== false) close();
  });
  if (danger) $('[data-del]', bg).addEventListener('click', async () => { if (await danger.run()) close(); });
  return bg;
}
const need = (bg, name) => { bg.querySelector(`[name=${name}]`).closest('.field').classList.add('bad'); bg.querySelector(`[name=${name}]`).focus(); return false; };

function clinicSheet(c) {
  const bg = openSheet(c ? 'Editar clínica' : 'Nueva clínica',
    fld('name', 'Nombre', c?.name) + fld('address', 'Dirección', c?.address) + fld('phone', 'Teléfono', c?.phone, { type: 'tel' }) + fld('notes', 'Notas', c?.notes, { area: true }),
    async (f, bg) => {
      if (!f.name.trim()) return need(bg, 'name');
      const o = c || newClinic('');
      Object.assign(o, { name: f.name.trim(), address: f.address.trim(), phone: f.phone.trim(), notes: f.notes.trim() });
      await save('clinics', o);
      if (!c) go(`#/c/${o.id}`); else route();
    },
    c && c.kind !== 'domicilio' ? {
      label: 'Mover clínica a la papelera',
      run: async () => {
        if (live(S.patients).some((p) => p.clinicId === c.id)) { toast('Primero mueve o elimina sus pacientes'); return false; }
        if (!confirm('¿Mover esta clínica a la papelera? Podrás restaurarla.')) return false;
        c.deletedAt = nowISO(); await save('clinics', c); go('#/'); return true;
      },
    } : null);
  return bg;
}

function patientSheet(p, clinicId) {
  const cs = live(S.clinics).sort((a, b) => coll.compare(a.name, b.name)).map((c) => ({ v: c.id, l: c.name }));
  const cur = p?.clinicId || clinicId;
  const bg = openSheet(p ? 'Editar paciente' : 'Nuevo paciente',
    `<datalist id="spl"><option>Perro</option><option>Gato</option><option>Conejo</option><option>Ave</option><option>Exótico</option></datalist>` +
    fld('name', 'Mascota (nombre)', p?.name) + fld('species', 'Especie', p?.species, { list: 'spl' }) + fld('breed', 'Raza', p?.breed) +
    fld('age', 'Edad', p?.age) + fld('sex', 'Sexo', p?.sex || '', { opts: ['', 'Macho', 'Hembra', 'Macho castrado', 'Hembra esterilizada'] }) +
    fld('owner', 'Propietario', p?.owner) + fld('ownerRut', 'RUT del propietario', p?.ownerRut) + fld('phone', 'Teléfono', p?.phone, { type: 'tel' }) +
    fld('address', 'Dirección (domicilio)', p?.address) + fld('clinicId', 'Clínica', cur, { opts: cs }) + fld('notes', 'Notas', p?.notes, { area: true }),
    async (f, bg) => {
      if (!f.name.trim()) return need(bg, 'name');
      const o = p || newPatient(f.clinicId, '');
      Object.assign(o, { name: f.name.trim(), species: f.species.trim(), breed: f.breed.trim(), age: f.age.trim(), sex: f.sex, owner: f.owner.trim(), ownerRut: f.ownerRut.trim(), phone: f.phone.trim(), address: f.address.trim(), clinicId: f.clinicId, notes: f.notes.trim() });
      await save('patients', o);
      go(`#/p/${o.id}`); if (p) route();
    },
    p ? {
      label: 'Mover paciente a la papelera',
      run: async () => {
        if (!confirm('Se moverá a la papelera con todas sus fichas y archivos. Podrás restaurarlo.')) return false;
        p.deletedAt = nowISO(); await save('patients', p); go(`#/c/${p.clinicId}`); return true;
      },
    } : null);
  const sync = () => { const c = clinicOf($('[name=clinicId]', bg).value); $('[name=address]', bg).closest('.field').hidden = !(c && c.kind === 'domicilio') && !$('[name=address]', bg).value; };
  $('[name=clinicId]', bg).addEventListener('change', sync); sync();
  return bg;
}

async function logoData(file) {
  const bmp = await createImageBitmap(file); const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/png');
}

function profileSheet() {
  const p = profile();
  openSheet('Mis datos (encabezado)',
    fld('name', 'Nombre', p.name) + fld('title', 'Título', p.title) + fld('spec', 'Especialidad', p.spec) + fld('rut', 'RUT', p.rut) + fld('phone', 'WhatsApp o teléfono', p.phone, { type: 'tel' }) +
    `<div class="field"><label>Logo (opcional)</label>${p.logo ? `<img src="${p.logo}" alt="Logo actual" style="max-height:64px;max-width:160px;object-fit:contain;margin:4px 0 8px">` : ''}<input type="file" name="logo" accept="image/*">${p.logo ? `<div style="margin-top:8px"><input type="checkbox" name="rmlogo" id="rml"> <label for="rml" style="display:inline">Quitar logo</label></div>` : ''}</div>`,
    async (f) => {
      const o = { ...p, createdAt: p.createdAt || nowISO(), deletedAt: null, name: f.name.trim(), title: f.title.trim(), spec: f.spec.trim(), rut: f.rut.trim(), phone: f.phone.trim() };
      if (f.rmlogo) o.logo = '';
      if (f.logo && f.logo.size) { try { o.logo = await logoData(f.logo); } catch (e) { toast('No se pudo leer el logo'); } }
      await save('settings', o); toast('Guardado'); route();
    });
}

/* ---------- visor de archivos ---------- */
async function openFile(id) {
  const f = S.files.find((x) => x.id === id); if (!f) return;
  const url = await fileURL(f); const isPdf = f.mime === 'application/pdf'; const isImg = (f.mime || '').startsWith('image/');
  const v = document.createElement('div'); v.className = 'viewer';
  const desktop = matchMedia('(pointer:fine)').matches;
  v.innerHTML = `<div class="bar"><button class="link" data-x>Cerrar</button><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:center">${esc(f.name)}</div><button class="link" data-del>Papelera</button></div>
    <div class="body">${isImg ? `<img alt="${esc(f.name)}" src="${url}">`
      : isPdf && desktop ? `<iframe title="${esc(f.name)}" src="${url}"></iframe>`
        : `<div class="stack" style="color:#fff;text-align:center;padding:24px"><div>${esc(f.name)}</div><a class="btn primary" href="${url}" target="_blank" rel="noopener">Abrir archivo</a></div>`}</div>`;
  document.body.appendChild(v);
  v.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) v.remove();
    if (e.target.closest('[data-del]') && confirm('¿Mover este archivo a la papelera? Podrás restaurarlo.')) {
      f.deletedAt = nowISO(); await save('files', f); v.remove(); route();
    }
  });
}

/* ---------- acciones ---------- */
const ACT = {
  newClinic: () => clinicSheet(null),
  editProfile: () => profileSheet(),
  editClinic: (el) => clinicSheet(clinicOf(el.dataset.id)),
  newPatient: (el) => patientSheet(null, el.dataset.clinic),
  editPatient: (el) => patientSheet(patientOf(el.dataset.id)),
  tab: (el) => { S.tab = el.dataset.tab; route(); },
  newExam: async (el) => {
    const ex = { ...base(), patientId: el.dataset.id, date: today(), derivado: '', anamnesis: '', data: {} };
    await save('exams', ex); go(`#/e/${ex.id}`);
  },
  delExam: async (el) => {
    if (!confirm('¿Mover esta ficha a la papelera? Podrás restaurarla.')) return;
    const ex = S.exams.find((e) => e.id === el.dataset.id); await flush();
    ex.deletedAt = nowISO(); await save('exams', ex); go(`#/p/${ex.patientId}`);
  },
  eye: (el) => {
    S.eye = el.dataset.side; $('#fbody').className = 'show-' + S.eye;
    document.querySelectorAll('.seg button[data-act=eye]').forEach((b) => b.setAttribute('aria-selected', b.dataset.side === S.eye));
  },
  copy: (el) => {
    const { from, to } = el.dataset; const d = S.exam.data;
    if (!confirm('Esto reemplaza lo marcado en el ojo izquierdo con lo del derecho. ¿Continuar?')) return;
    Object.keys(d).filter((k) => k.startsWith(to + '/')).forEach((k) => delete d[k]);
    Object.keys(d).filter((k) => k.startsWith(from + '/')).forEach((k) => { d[to + k.slice(from.length)] = d[k]; });
    $('#fbody').innerHTML = formHTML(); touch(); toast('Copiado al ojo izquierdo');
  },
  print: async () => {
    await flush(); const ex = S.exam, p = patientOf(ex.patientId);
    $('#print').innerHTML = printHTML(ex, p, clinicOf(p.clinicId)); setTimeout(() => window.print(), 50);
  },
  addFiles: (el) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = 'image/*,application/pdf';
    inp.onchange = async () => {
      const fs = [...inp.files]; let ok = 0;
      for (const f of fs) { toast(`Subiendo ${ok + 1} de ${fs.length}…`); try { await addFileTo(el.dataset.id, f); ok++; } catch (e) { console.error(e); toast('No se pudo subir ' + f.name); await sleep(1500); } }
      if (ok) toast(ok === 1 ? 'Archivo agregado' : `${ok} archivos agregados`);
      S.tab = 'archivos'; route();
    };
    inp.click();
  },
  openFile: (el) => openFile(el.dataset.id),
  restore: async (el) => {
    const o = S[el.dataset.col].find((x) => x.id === el.dataset.id); o.deletedAt = null;
    const p = o.patientId ? patientOf(o.patientId) : null; // asegura que el padre también esté visible
    if (p && p.deletedAt) { p.deletedAt = null; await save('patients', p); }
    const pid = el.dataset.col === 'patients' ? o.clinicId : p?.clinicId; const c = pid && clinicOf(pid);
    if (c && c.deletedAt) { c.deletedAt = null; await save('clinics', c); }
    await save(el.dataset.col, o); toast('Restaurado'); route();
  },
  pickImport: () => $('#impf').click(),
  runImport,
  backup: () => {
    const data = { app: 'fichas-vet', exportedAt: nowISO(), clinics: S.clinics, patients: S.patients, exams: S.exams, settings: S.settings, files: S.files.map(({ path, ...f }) => ({ ...f, path })) };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `respaldo-fichas-${today()}.json`; a.click(); toast('Respaldo descargado');
  },
  demo: async () => {
    const mk = async (n, ex) => { const c = newClinic(n, ex); await save('clinics', c); return c; };
    const a = await mk('Bon Amie', { address: 'El Bosque 123, Santiago' }), b = await mk('Vetcompany', { address: 'San Francisco 45' });
    const dom = S.clinics.find((c) => c.kind === 'domicilio');
    const pats = [[a, 'Luna', 'Perro', 'Pastor alemán', '6 años', 'Hembra', 'Carla Soto'], [a, 'Kiro', 'Perro', 'Poodle', '3 años', 'Macho', 'Pedro Rojas'], [a, 'Sazura', 'Gato', 'Siamés', '8 años', 'Hembra', 'Ana Díaz'],
      [b, 'Coky', 'Perro', 'Labrador', '10 años', 'Macho castrado', 'Luis Pérez'], [b, 'Pepa', 'Gato', 'Mestizo', '2 años', 'Hembra esterilizada', 'Marta Vera'], [dom, 'Duke', 'Perro', 'Bulldog', '5 años', 'Macho', 'Jorge Mora']];
    for (const [c, name, species, breed, age, sex, owner] of pats) await save('patients', newPatient(c.id, name, { species, breed, age, sex, owner, phone: '+56 9 1234 5678', address: c.kind === 'domicilio' ? 'Av. Las Condes 1000, depto 21' : '' }));
    toast('Ejemplos cargados'); go('#/');
  },
  logout: async () => { await S.store.logout(); location.reload(); },
};

document.addEventListener('click', async (e) => {
  const chip = e.target.closest('[data-chip],[data-radio]');
  if (chip && S.exam) {
    const d = S.exam.data;
    if (chip.dataset.chip) { const k = chip.dataset.chip; if (d[k]) delete d[k]; else d[k] = true; chip.setAttribute('aria-pressed', !!d[k]); }
    else {
      const k = chip.dataset.radio; if (d[k] === chip.dataset.val) delete d[k]; else d[k] = chip.dataset.val;
      chip.parentElement.querySelectorAll('[data-radio]').forEach((b) => b.setAttribute('aria-pressed', d[k] === b.dataset.val));
    }
    return touch();
  }
  const el = e.target.closest('[data-go],[data-act]'); if (!el) return;
  if (el.dataset.go) return go(el.dataset.go);
  try { await ACT[el.dataset.act]?.(el); } catch (err) { console.error(err); }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.imp !== undefined) { S.imp.rows[+t.dataset.imp].name = t.value; return; }
  if (!S.exam) return;
  if (t.dataset.field) { if (t.value) S.exam.data[t.dataset.field] = t.value; else delete S.exam.data[t.dataset.field]; touch(); }
  else if (t.dataset.meta) { S.exam[t.dataset.meta] = t.value; touch(); }
});

let saveT;
function touch() { S.dirty = true; setStatus('busy'); clearTimeout(saveT); saveT = setTimeout(flush, 600); }
async function flush() {
  clearTimeout(saveT); if (!S.dirty || !S.exam) return;
  S.dirty = false; await save('exams', S.exam);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', flush);

/* ---------- rutas y arranque ---------- */
async function route() {
  await flush(); S.exam = null;
  const [, k, id] = (location.hash || '#/').split('/');
  window.scrollTo(0, 0);
  try {
    if (k === 'c') viewClinic(id); else if (k === 'p') viewPatient(id); else if (k === 'e') viewExam(id);
    else if (k === 'settings') await viewSettings(); else if (k === 'trash') viewTrash(); else if (k === 'import') viewImport();
    else viewHome();
  } catch (err) { console.error(err); app.innerHTML = `<div class="page"><div class="empty"><h2>Algo salió mal</h2><div class="muted">${esc(err.message)}</div><button class="btn" data-go="#/">Volver al inicio</button></div></div>`; }
}

function viewLogin() {
  app.innerHTML = `<div class="page"><div class="top"><h1 class="big">Fichas</h1></div>
    <div class="stack"><button class="btn primary block" id="gl">Entrar con Google</button><div class="note" id="lerr"></div>
      <button class="link" id="showmail" type="button">Usar correo y contraseña</button>
      <form class="form" id="login" hidden><div class="field"><label>Correo</label><input type="email" name="email" required autocomplete="username"></div>
        <div class="field"><label>Contraseña</label><input type="password" name="pass" required autocomplete="current-password"></div>
        <button class="btn block">Entrar</button></form></div></div>`;
  $('#gl').addEventListener('click', async () => {
    try { await S.store.loginGoogle(); await start(); } catch (err) {
      console.error(err);
      $('#lerr').textContent = err.code === 'auth/popup-blocked' ? 'El navegador bloqueó la ventana. Permite las ventanas emergentes e inténtalo de nuevo.'
        : err.code === 'auth/popup-closed-by-user' ? '' : 'No se pudo entrar con Google. Revisa que el dominio esté autorizado en Firebase.';
    }
  });
  $('#showmail').addEventListener('click', () => { $('#login').hidden = false; });
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    try { await S.store.login(f.get('email'), f.get('pass')); await start(); }
    catch (err) { $('#lerr').textContent = 'Correo o contraseña incorrectos.'; }
  });
}

let started = false;
async function start() {
  app.innerHTML = '<div class="page"><div class="top"><h1 class="big">Fichas</h1></div><div class="note">Cargando…</div></div>';
  await loadAll(); await seed();
  if (!started) { started = true; window.addEventListener('hashchange', route); }
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && !S.exam && !$('.sheet-bg') && !$('.viewer')) { try { await loadAll(); route(); } catch (e) { /* sin red */ } }
  });
  route();
}

(async function boot() {
  S.store = await createStore();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const u = await S.store.user();
  if (!u) return viewLogin();
  await start();
})();
