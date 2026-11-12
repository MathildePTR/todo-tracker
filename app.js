const KEY = 'habit-tracker-v1';
// Statuts et types de projet (sprint 6) : 3 projets actifs au maximum
const STATUSES = [['finished', 'Finished'], ['break', 'Break']]; // un projet est soit terminé, soit en pause
const TYPES = [['internal', 'Internal project'], ['training', 'Training'], ['pro', 'Work project'], ['ideas', 'Ideas']];
const MAX_ACTIVE = 3;
// Matrice d'Eisenhower : une case par tâche, ou aucune tant qu'elle n'est pas triée
// SMART : les cinq questions auxquelles chaque tâche doit répondre
const SMART_FIELDS = [['sp', 'Specific: who, what, where?'], ['me', 'Measurable: which number proves it?'], ['ac', 'Achievable: with which resources?'], ['re', 'Realistic: does it fit my week?'], ['ti', 'Time-bound: by when?']];
// MoSCoW : priorité du projet (détails du projet)
const MOSCOW = [['', 'MoSCoW…'], ['must', 'Must'], ['should', 'Should'], ['could', 'Could'], ['wont', 'Won\'t']];
const QUADS = [['', 'Unsorted'], ['do', 'Urgent and important'], ['plan', 'Important, not urgent'], ['frame', 'Urgent, not important'], ['drop', 'Neither important nor urgent']];
const QUAD_TITLES = { do: 'Do now', plan: 'Plan', frame: 'Delegate or frame', drop: 'Drop' };
const MAX_PRIORITIES = 5; // tâches « à traiter maintenant » au-delà desquelles on alerte
// Journée 1-3-5 : 1 grande tâche, 3 moyennes, 5 petites
const SIZES = [['', 'Size'], ['L', 'Big'], ['M', 'Medium'], ['S', 'Small']];
const SLOTS = { L: 1, M: 3, S: 5 };

const SLOT_FULL = { L: 'its big task', M: 'its 3 medium tasks', S: 'its 5 small tasks' };
const DURATIONS = [['', 'Duration'],['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h']];
// Time blocking : affiché dans l'onglet Calendar
const TIME_BLOCKING = { name: 'Time blocking', what: 'Reserve a slot in your calendar for each type of work.', steps: ['List the types of work in the project', 'Block a slot for each one', 'Treat the slot like an appointment'] };
// Contexte ou énergie d'une tâche, pour choisir selon l'état du moment
const CONTEXTS = [['', 'Context'], ['5min', '5 minutes'], ['deep', 'Focus work'], ['phone', 'Phone'], ['low', 'Low energy']];
// Contextes et catégories de projet : personnalisables (state.contexts, state.types). Les listes ci-dessus sont les défauts.
const ctxOptions = () => [['', 'Contexte'], ...state.contexts.map(c => [c.id, c.name])];
const filterOptions = () => [['', 'All contexts'],...state.contexts.map(c => [c.id, c.name])];
const ctxName = id => state.contexts.find(c => c.id === id)?.name || '';
// Saisie d'un nom à côté d'une liste : remplace prompt(), que le navigateur peut bloquer
function askName(anchor, label, onName, verb = 'Create') {
  const submit = () => {
    const v = input.value.trim();
    if (!v) return;
    box.remove();
    onName(v);
  };
  const input = h('input', { type: 'text', maxlength: 60, placeholder: `${label} *`, 'aria-label': label, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } } });
  const box = h('div', { class: 'row inline-new' }, input,
    h('button', { class: 'ghost', type: 'button', onclick: submit }, verb),
    h('button', { class: 'ghost', type: 'button', onclick: () => box.remove() }, 'Cancel'));
  anchor.after(box);
  input.focus();
}
// Ajoute un contexte, sans doublon
function addContext(v) {
  const same = state.contexts.find(c => c.name.toLowerCase() === v.toLowerCase());
  if (same) return same;
  const c = { id: uid(), name: v };
  state.contexts.push(c);
  persist();
  return c;
}
// Menu des contextes avec une option « + Nouveau contexte… » qui crée le contexte sur place
function ctxPicker(name, picked, label) {
  const sel = picker(name, [...ctxOptions(), ['__new', '+ New context…']], picked, label);
  sel.addEventListener('change', () => {
    if (sel.value !== '__new') return;
    sel.value = picked || '';
    askName(sel, 'Context name', v => {
      const c = addContext(v);
      if (!sel.querySelector(`option[value="${c.id}"]`)) sel.insertBefore(h('option', { value: c.id }, c.name), sel.querySelector('option[value="__new"]'));
      sel.value = c.id;
    });
  });
  return sel;
}
let ctxFilter = '', weekOffset = 0;
// Minuteurs (sprint 6) : focus de 60 à 90 min, plage d'urgence de 30 à 45 min ; « + 15 min » prolonge jusqu'au plafond
const TIMER = { focus: { label: 'Timer', start: 60, max: 90 }, urgent: { label: 'Urgent block', start: 30, max: 45 } };
// Déclencheurs : quand ils reviennent, et ce qu'ils créent
const FREQS = [['weekly', 'Every week'], ['daily', 'Every day'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month']];
// Deux façons de répéter, avec une phrase d'explication affichée sous le choix
const MODES = [['section', 'New section each time'], ['tasks', 'Same tasks, in a Routines section']];
const MODE_HELP = {
  section: 'Each time, a new section is created with the tasks below, labelled with the week or month (e.g. "Comment on LinkedIn · W46").',
  tasks: 'Each time, the tasks below are added to a "Routines" section of the project. The section stays the same.',
};
const DAY_LETTERS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
// Revue du vendredi (sprint 6)
const QUESTIONS = ['What is finished?', 'What is moving forward?', 'What is waiting on someone?', 'Which proof of reliability do I add?', 'What are my 3 priorities for next week?'];
const INBOX = { inbox: true, name: 'Inbox' }; // faux projet qui porte la boîte de réception

let state = { projects: [] };
try { state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
let pickedSection = '', pickedProject = ''; // derniers choix des listes déroulantes
let editing = null; // élément en cours de modification : 't:' | 's:' | 'p:' + id

const persist = () => {
  tidy();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} // stockage indisponible : l'app reste utilisable
};
const save = () => { persist(); render(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d, o) => d.toLocaleDateString('en-GB', o);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const WEEKDAYS = [[1, 'lundis'], [2, 'mardis'], [3, 'mercredis'], [4, 'jeudis'], [5, 'vendredis'], [6, 'samedis'], [0, 'dimanches']];
function isoWeek(d) { // numéro de semaine ISO (la semaine commence le lundi)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

// Blocs dépliés (sections, formulaire de déclencheur) : à retenir entre deux rendus
const openIds = new Set();
const foldable = (id, attrs = {}) => ({
  ...attrs, open: openIds.has(id),
  ontoggle: e => { e.target.open ? openIds.add(id) : openIds.delete(id); },
});

// Met des données (stockage ou fichier importé) au format actuel, sans rien perdre
function normalize(st) {
  st.projects = Array.isArray(st.projects) ? st.projects : [];
  if (!Array.isArray(st.inbox?.tasks)) st.inbox = { id: 'inbox', name: INBOX.name, tasks: [] };
  if (!st.days || typeof st.days !== 'object') st.days = {}; // rituels, jour par jour
  if (!Array.isArray(st.reviews)) st.reviews = []; // revues du vendredi
  if (!Array.isArray(st.log)) st.log = []; // temps mesuré par les minuteurs
  st.customTools = []; // outils personnels supprimés
  if (!Array.isArray(st.contexts) || !st.contexts.length) st.contexts = CONTEXTS.slice(1).map(([id, name]) => ({ id, name }));
  // Catégories : seulement celles créées par l'utilisateur. Les anciennes valeurs par défaut sont retirées, sauf si un projet les utilise encore
  const usedTypes = new Set((st.projects || []).map(p => p.type));
  st.types = (Array.isArray(st.types) ? st.types : []).filter(c => !TYPES.some(([id, name]) => id === c.id && name === c.name) || usedTypes.has(c.id));
  if (!st.toolCats || typeof st.toolCats !== 'object') st.toolCats = {}; // catégories choisies pour les outils
  if (!st.timer?.start) st.timer = null; // minuteur en cours
  st.projects.forEach(p => {
    p.triggers ||= [];
    // Anciennes données : les méthodes et le cadre SMART deviennent des outils attachés au projet
    p.tools ||= p.methods || [];
    p.answers ||= {};
    if (p.smart && !p.answers.smart) p.answers.smart = ['s', 'm', 'a', 'r', 't'].map(k => p.smart[k] || '');
    p.triggers.forEach(tr => { // anciens déclencheurs : un seul jour, chaque semaine, une section
      tr.freq ||= 'weekly'; tr.mode ||= 'section'; tr.days ||= [tr.day ?? 4]; tr.dom ||= 1;
      tr.tasks ||= []; tr.name ||= ''; tr.anchor ||= tr.lastRun;
    });
    if (!p.sections) { // très anciennes données : tâches directement dans le projet
      p.sections = p.tasks?.length ? [{ id: uid(), name: 'General', tasks: p.tasks }] : [];
      delete p.tasks;
    }
    p.status = p.status === 'done' ? 'finished' : 'break'; // anciens statuts
    if (p.type && !st.types.some(c => c.id === p.type)) p.type = '';
  });
  return st;
}
state = normalize(state);

// Un projet contient des sections, une section contient des tâches ; la boîte de réception est à part
const live = p => p.sections.filter(s => !s.archived); // sections non archivées
const sections = () => state.projects.flatMap(p => live(p).map(s => ({ p, s })));
// Une section entièrement cochée part aux archives le lendemain
function tidy() {
  const k = key(today());
  for (const p of state.projects) for (const s of p.sections) {
    if (!s.tasks.length || !s.tasks.every(t => t.done)) { delete s.doneAt; delete s.archived; }
    else if (!s.doneAt) s.doneAt = k;
    else if (s.doneAt < k) s.archived = true;
  }
}
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fact = (label, value) => h('p', { class: 'fact' }, h('b', {}, label + ' : '), value);
// Ce qui a été écrit dans le rituel de fin de journée d'un jour (affiché dans le calendrier et le bilan)
const dayNotes = k => {
  const d = state.days[k] || {};
  return [d.did && fact('Done', d.did), d.left && fact('Left', d.left), d.grateful && fact('Gratitude', d.grateful)].filter(Boolean);
};
// Champ relié à une donnée : ce qu'on tape est gardé sans redessiner la page
function bind(tag, obj, field, attrs) {
  const el = h(tag, { ...attrs, oninput: e => { obj[field] = e.target.value; }, onchange: persist },
    tag === 'textarea' ? (obj[field] || '') : null);
  if (tag === 'input') el.setAttribute('value', obj[field] || '');
  return el;
}
const places = () => [{ p: INBOX, s: state.inbox }, ...sections()];
const placeLabel = ({ p, s }) => p.inbox ? p.name : `${p.name} · ${s.name}`;
const tasks = () => places().flatMap(({ p, s }) => s.tasks.map(t => ({ p, s, t })));
/* test:start:time */
const hm = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;
const shortDate = k => fmt(new Date(k + 'T00:00'), { day: 'numeric', month: 'short' });
const isLate = t => !!t.due && !t.done && t.due < key(today());
const sizeOf = t => t.size || 'S'; // sans taille, une tâche compte comme petite
// Taille suggérée d'après la durée estimée : moins de 30 min = Small, moins de 90 min = Medium, sinon Big
const sizeFromMins = t => !t.mins ? 'no estimate' : t.mins < 30 ? 'Small' : t.mins < 90 ? 'Medium' : 'Big';
const durationText = t => t.mins ? `${hm(t.mins)} estimated` : 'no estimate';
/* test:end:time */
/* test:start */
// Règle des deux minutes : une tâche de moins de 2 minutes passe en haut de sa liste (ordre gardé sinon)
const isQuick = x => { const t = x.t || x; return !!t.mins && t.mins < 2; };
// Ordre des listes : moins de 2 min, puis les 20 % clés (Pareto), puis le quadrant d'Eisenhower (à faire maintenant en premier)
const QUAD_RANK = { do: 0, plan: 1, frame: 2, drop: 3 };
const priorityOf = x => { const t = x.t || x; return (isQuick(x) ? 0 : 10) + (t.key ? 0 : 5) + (QUAD_RANK[t.quad] ?? 4); };
const ordered = list => list.map((x, i) => [x, i]).sort((a, b) => priorityOf(a[0]) - priorityOf(b[0]) || a[1] - b[1]).map(([x]) => x);
/* test:end */
const byUrgency = (a, b) => (a.t.due || '9999').localeCompare(b.t.due || '9999'); // échéances proches d'abord

let toastTimer;
// Message bref ; avec `undo`, un bouton « Undo » permet de revenir en arrière
// Croix en haut à droite de chaque fenêtre, pour la fermer
function closeX(dlg) {
  return h('button', { class: 'icon', type: 'button', 'aria-label': 'Close', title: 'Close',
    style: 'position: absolute; top: 8px; right: 10px; font-size: 1.5rem; line-height: 1;', onclick: () => dlg.close() }, '×');
}
function toast(msg, undo) {
  const el = document.getElementById('toast');
  el.replaceChildren(msg);
  if (undo) el.append(' ', h('button', { class: 'ghost', type: 'button', onclick: () => { undo(); el.hidden = true; } }, 'Undo'));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

// Place une tâche dans la journée, ou l'en retire ; la règle 1-3-5 refuse le surplus
function toggleToday(t) {
  const k = key(today());
  if (t.today === k) { delete t.today; return save(); }
  const size = sizeOf(t);
  const used = tasks().filter(x => x.t.today === k && sizeOf(x.t) === size).length;
  if (used >= SLOTS[size]) return toast(`1-3-5 rule: today already has ${SLOT_FULL[size]}. Remove one, or change this task's size.`);
  t.today = k;
  save();
}

const shift = (list, item, dir) => { // monte ou descend un élément dans sa liste
  const i = list.indexOf(item), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  save();
};
const doneCount = list => list.filter(t => t.done).length;
const pctOf = list => list.length ? Math.round(doneCount(list) / list.length * 100) : 0;

// Petit helper DOM : h('div', {class:'x', onclick: fn}, enfants...)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
}

function form(onsubmit, ...kids) {
  return h('form', { class: 'row', onsubmit: e => { e.preventDefault(); onsubmit(e.target); } }, ...kids);
}

function picker(name, options, picked, label) {
  return h('select', { name, 'aria-label': label },
    options.map(([v, l]) => h('option', { value: v, selected: v === picked }, l)));
}

function progress(list, empty) {
  const est = list.reduce((n, t) => n + (t.mins || 0), 0); // temps estimé, calculé à partir des tâches
  return h('div', { class: 'row' },
    h('div', { class: 'bar grow' }, h('i', { style: `width:${pctOf(list)}%` })),
    h('span', { class: 'muted' }, list.length
      ? `${doneCount(list)}/${list.length} · ${pctOf(list)} %${est ? ` · ${hm(est)} estimated` : ''}` : empty));
}

// Formulaire de modification en place : Entrée enregistre, Échap annule
function editForm(onsave, ...fields) {
  const cancel = () => { editing = null; render(); };
  return h('form', {
    class: 'row edit',
    onsubmit: e => { e.preventDefault(); onsave(e.target); },
    onkeydown: e => { if (e.key === 'Escape') cancel(); },
  },
    ...fields,
    h('button', { class: 'btn' }, 'Save'),
    h('button', { type: 'button', class: 'ghost', onclick: cancel }, 'Cancel'));
}
const arrows = (list, item) => [
  h('button', { type: 'button', class: 'ghost', 'aria-label': 'Monter', title: 'Monter', onclick: () => shift(list, item, -1) }, '↑'),
  h('button', { type: 'button', class: 'ghost', 'aria-label': 'Descendre', title: 'Descendre', onclick: () => shift(list, item, 1) }, '↓'),
];
const editButton = (id, label) =>
  h('button', { class: 'icon', 'aria-label': label, title: 'Edit', onclick: () => { editing = id; render(); } }, '✎');

// Liste déroulante groupée par catégorie
function toolOptions(list) {
  return [...new Set(list.map(t => t.cat))].map(c =>
    h('optgroup', { label: c }, list.filter(t => t.cat === c).map(t => h('option', { value: t.id }, t.name))));
}
// Crée dans le projet les sections que l'outil propose, sans toucher à celles qui existent déjà
function scaffold(p, t) {
  const have = p.sections.map(s => s.name);
  const missing = t.sections.filter(n => !have.includes(n));
  missing.forEach(n => p.sections.push({ id: uid(), name: n, tasks: [] }));
  save();
  toast(missing.length ? `Sections created: ${missing.join(', ')}.` : 'These sections already exist in this project.');
}
// Mes outils : créer les siens, avec ses étapes et ses questions
// Liste modifiable (renommer, ajouter, supprimer). Une valeur déjà utilisée ne peut pas être supprimée.
function countUse(field, id) {
  if (field === 'tag') return tasks().filter(x => x.t.tag === id).length;
  return state.projects.filter(p => p.type === id).length;
}
function editableList(listKey, title, noun, field) {
  const rows = state[listKey].map(c => h('li', {},
    h('input', { type: 'text', value: c.name, maxlength: 40, 'aria-label': `${noun} name`, onchange: e => {
      const v = e.target.value.trim();
      if (!v) return render();
      c.name = v;
      save();
    } }),
    h('button', { class: 'icon', 'aria-label': `Delete ${noun} ${c.name}`, onclick: () => {
      const used = countUse(field, c.id);
      if (used) return toast(`Used by ${used} item${used > 1 ? 's' : ''}: change it first.`);
      state[listKey] = state[listKey].filter(x => x !== c);
      save();
    } }, '×')));
  const add = form(f => {
    const name = f.elements.name.value.trim();
    if (!name) return;
    state[listKey].push({ id: uid(), name });
    save();
  },
    h('input', { type: 'text', name: 'name', class: 'grow', placeholder: `New ${noun}`, maxlength: 40, 'aria-label': `New ${noun}` }),
    h('button', { class: 'btn' }, 'Add'));
  return h('div', { class: 'cat' }, h('strong', {}, title), h('ul', { class: 'secs' }, rows), add);
}
function triggerFrom(p, origin) {
  const now = today();
  const tr = {
    id: uid(), mode: origin.mode, freq: 'weekly', days: [now.getDay()], dom: 1,
    name: origin.name || '', tasks: origin.tasks, anchor: key(now), lastRun: key(now),
  };
  p.triggers.push(tr);
  save();
  toast(`Recurrence created: ${triggerLabel(tr)}. It appears on its section or task.`);
}
// « Recur. » ouvre une fenêtre pour régler la récurrence : fréquence, jours de la semaine, jour du mois
function recurDialog(p, origin, label) {
  const now = today();
  const draft = { id: uid(), draft: true, mode: origin.mode, freq: 'weekly', days: [now.getDay()], dom: now.getDate(),
    name: origin.name || '', tasks: origin.tasks || [], anchor: key(now), lastRun: key(addDays(now, -1)) };
  let dlg = document.getElementById('recur-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'recur-dialog', class: 'banner-picker', 'aria-label': 'Recurrence' }); document.body.append(dlg); }
  dlg.replaceChildren(closeX(dlg), h('strong', {}, `Recurrence: ${label}`), triggerForm(p, draft));
  if (!dlg.open) dlg.showModal();
}
const recurButton = (p, origin, label) => h('button', {
  class: 'icon day', 'aria-label': `Create a recurrence: ${label}`, title: 'Create a recurrence',
  onclick: () => recurDialog(p, origin, label),
}, 'Repeat');
// Suppression d'une section. S'il y a des tâches, on demande : les réattribuer à une autre section,
// ou les supprimer aussi (il faut alors retaper le nom exact). « Undo » reste disponible après.
function askDeleteSection(p, s) {
  let dlg = document.getElementById('delete-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'delete-dialog', class: 'banner-picker', 'aria-label': 'Delete section' }); document.body.append(dlg); }
  const undoable = (msg, mutate) => {
    const snap = JSON.stringify(state);
    mutate();
    save();
    dlg.close();
    toast(msg, () => { state = JSON.parse(snap); save(); });
  };
  const closeBtn = h('button', { class: 'ghost', type: 'button', onclick: () => dlg.close() }, 'Cancel');

  // 1) Réattribuer les tâches à une autre section (dans n'importe quel projet)
  const targets = () => state.projects.flatMap(x => x.sections.filter(y => y !== s).map(y => ({ p: x, s: y })));
  const projSel = h('select', { 'aria-label': 'Project for the tasks' });
  const secSel = h('select', { 'aria-label': 'Section for the tasks' });
  const fillSec = () => {
    const pid = projSel.value;
    const opts = targets().filter(x => x.p.id === pid);
    secSel.replaceChildren(...opts.map(x => h('option', { value: x.s.id }, x.s.name)));
    moveBtn.disabled = !opts.length;
  };
  const fillProj = () => {
    const ps = [...new Set(targets().map(x => x.p))];
    projSel.replaceChildren(...ps.map(x => h('option', { value: x.id }, x.name)));
    fillSec();
  };
  projSel.addEventListener('change', fillSec);
  const moveBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
    const dest = targets().find(x => x.s.id === secSel.value);
    if (!dest) return;
    undoable(`Section "${s.name}" deleted. Its tasks moved to "${dest.s.name}".`, () => {
      dest.s.tasks.push(...s.tasks);
      s.tasks = [];
      p.sections = p.sections.filter(x => x !== s);
    });
  } }, 'Move tasks, then delete section');
  fillProj();

  // 2) Supprimer aussi les tâches : retaper le nom exact
  const input = h('input', { type: 'text', placeholder: 'Type the exact name of the section', 'aria-label': 'Type the exact name of the section to confirm', autocomplete: 'off' });
  const deleteBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => {
    undoable(`Section "${s.name}" and its tasks deleted.`, () => { p.sections = p.sections.filter(x => x !== s); });
  } }, 'Delete section and tasks');
  input.addEventListener('input', () => { deleteBtn.disabled = input.value.trim() !== s.name.trim(); });

  const n = s.tasks.length;
  dlg.replaceChildren(closeX(dlg),
    h('strong', {}, `Delete the section "${s.name}"`),
    ...(n === 0
      ? [h('p', { class: 'muted' }, 'This section has no tasks. To confirm, type its exact name. You can undo right after.'), input, h('div', { class: 'row' }, deleteBtn, closeBtn)]
      : [
          h('p', { class: 'muted' }, `This section has ${plural(n, 'task')}. What should happen to them?`),
          h('strong', {}, 'Move them to another section'),
          targets().length
            ? h('div', { class: 'row' }, projSel, secSel, moveBtn)
            : h('p', { class: 'muted' }, 'There is no other section yet. Create one first, or delete the tasks below.'),
          h('strong', {}, 'Or delete them too'),
          h('p', { class: 'muted' }, 'To confirm, type the exact name of the section.'),
          input,
          h('div', { class: 'row' }, deleteBtn, closeBtn),
        ]));
  if (!dlg.open) dlg.showModal();
  if (n === 0) input.focus();
}
function deleteSection(p, s) { askDeleteSection(p, s); }
// Suppression d'un projet : même sécurité que pour une section. S'il a des sections, on demande
// de les déplacer vers un autre projet (ou un nouveau), ou de tout supprimer en retapant le nom.
function askDeleteProject(p) {
  let dlg = document.getElementById('delete-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'delete-dialog', class: 'banner-picker', 'aria-label': 'Delete project' }); document.body.append(dlg); }
  const undoable = (msg, mutate) => {
    const snap = JSON.stringify(state); // pour « Undo »
    mutate();
    save();
    dlg.close();
    toast(msg, () => { state = JSON.parse(snap); save(); });
  };
  const closeBtn = h('button', { class: 'ghost', type: 'button', onclick: () => dlg.close() }, 'Cancel');
  const others = state.projects.filter(x => x !== p);
  const taskCount = p.sections.reduce((k, s) => k + s.tasks.length, 0);

  // Tout supprimer : retaper le nom exact
  const input = h('input', { type: 'text', placeholder: 'Type the exact name of the project', 'aria-label': 'Type the exact name of the project to confirm', autocomplete: 'off' });
  const deleteBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => {
    undoable(`Project "${p.name}" deleted.`, () => { state.projects = state.projects.filter(x => x !== p); });
  } }, 'Delete project and everything in it');
  input.addEventListener('input', () => { deleteBtn.disabled = input.value.trim() !== p.name.trim(); });
  const deleteBlock = [h('strong', {}, 'Or delete everything'),
    h('p', { class: 'muted' }, `To confirm, type the exact name of the project. ${p.sections.length ? `Its ${plural(p.sections.length, 'section')} and ${plural(taskCount, 'task')} will be deleted too.` : ''}`),
    input, h('div', { class: 'row' }, deleteBtn, closeBtn)];

  // Sections sans tâches : une simple confirmation suffit
  if (!p.sections.length) {
    dlg.replaceChildren(closeX(dlg), h('strong', {}, `Delete the project "${p.name}"`), ...deleteBlock);
  } else {
    // Déplacer les sections vers un autre projet, ou vers un nouveau
    const sel = h('select', { 'aria-label': 'Move the sections to' },
      others.map(x => h('option', { value: x.id }, x.name)),
      h('option', { value: '__new' }, '+ New project…'));
    const newName = h('input', { type: 'text', placeholder: 'New project name *', maxlength: 80, 'aria-label': 'New project name' });
    newName.hidden = others.length > 0;
    if (!others.length) sel.value = '__new';
    sel.addEventListener('change', () => { newName.hidden = sel.value !== '__new'; });
    const moveBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
      let dest = null;
      if (sel.value === '__new') {
        const v = newName.value.trim();
        if (!v) return toast('Name the new project first.');
        const active = false;
        dest = { id: uid(), name: v, status: active ? 'active' : 'waiting', type: '', due: '', sections: [], triggers: [], tools: [], answers: {} };
      } else dest = others.find(x => x.id === sel.value);
      if (!dest) return;
      undoable(`Project "${p.name}" deleted. Its sections moved to "${dest.name}".`, () => {
        if (sel.value === '__new') state.projects.push(dest);
        dest.sections.push(...p.sections);
        p.sections = [];
        state.projects = state.projects.filter(x => x !== p);
      });
    } }, 'Move sections, then delete project');
    dlg.replaceChildren(closeX(dlg), h('strong', {}, `Delete the project "${p.name}"`),
      h('p', { class: 'muted' }, `It has ${plural(p.sections.length, 'section')}. What should happen to them?`),
      h('strong', {}, 'Move them to another project'),
      h('div', { class: 'row' }, sel, newName, moveBtn),
      ...deleteBlock);
  }
  if (!dlg.open) dlg.showModal();
  if (!p.sections.length) input.focus();
}

// Supprimer une tâche tout de suite, avec « Undo » pendant quelques secondes
function deleteTaskWithUndo(t, s) {
  const snap = JSON.stringify(state);
  s.tasks = s.tasks.filter(x => x !== t);
  save();
  toast(`Task "${t.text}" deleted.`, () => { state = JSON.parse(snap); save(); });
}
// Suppression d'une tâche : avertissement, et il faut retaper le titre exact pour confirmer
function askDeleteTask(t, s) {
  let dlg = document.getElementById('delete-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'delete-dialog', class: 'banner-picker', 'aria-label': 'Delete task' }); document.body.append(dlg); }
  const input = h('input', { type: 'text', placeholder: 'Type the exact title', 'aria-label': 'Type the exact title of the task to confirm', autocomplete: 'off' });
  const confirmBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => {
    const snap = JSON.stringify(state); // pour « Undo »
    s.tasks = s.tasks.filter(x => x !== t);
    save();
    dlg.close();
    toast(`Task "${t.text}" deleted.`, () => { state = JSON.parse(snap); save(); });
  } }, 'Delete task');
  input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== t.text.trim(); });
  dlg.replaceChildren(closeX(dlg),
    h('strong', {}, 'Warning: this deletes the task'),
    h('p', { class: 'muted' }, 'To confirm, type the exact title of the task below. You can undo right after with the message that follows.'),
    h('p', {}, h('b', {}, t.text)),
    input,
    h('div', { class: 'row' }, confirmBtn, h('button', { class: 'ghost', type: 'button', onclick: () => dlg.close() }, 'Cancel')));
  dlg.showModal();
  input.focus();
}
// Édition d'une tâche dans une fenêtre, comme les projets et les sections
function editTaskDialog(t) {
  const hit = findTask(t.id);
  let dlg = document.getElementById('edit-task-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'edit-task-dialog', class: 'banner-picker', 'aria-label': 'Edit task' }); document.body.append(dlg); }
  const text = h('input', { type: 'text', value: t.text, maxlength: 120, 'aria-label': 'Task name', class: 'grow' });
  const mins = h('input', { type: 'number', min: 0, max: 1440, step: 5, value: t.mins || '', placeholder: 'Minutes', 'aria-label': 'Estimated duration in minutes' });
  const quad = h('select', { 'aria-label': 'Priority (Eisenhower)' }, QUADS.map(([v, l]) => h('option', { value: v, selected: (t.quad || '') === v }, l)));
  const tags = h('input', { type: 'text', value: (t.tags || []).join(', '), placeholder: 'Keywords, e.g. call, writing', maxlength: 120, 'aria-label': 'Keywords' });
  const due = h('input', { type: 'date', value: t.due || '', 'aria-label': 'Due date (optional)' });
  const save_ = h('button', { class: 'btn', type: 'button', onclick: () => {
    const v = text.value.trim();
    if (!v) return toast('Write the task name first.');
    t.text = v;
    t.mins = Number(mins.value) || 0;
    t.quad = quad.value;
    t.tags = normTags(tags.value);
    t.due = due.value;
    save();
    dlg.close();
  } }, 'Save');
  dlg.replaceChildren(closeX(dlg), h('strong', {}, 'Edit task'),
    h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Name'), text),
    h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Duration (min)'), mins),
    h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Priority'), quad),
    h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Keywords'), tags),
    h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Due'), due),
    h('div', { class: 'row' }, save_,
      h('button', { class: 'ghost', type: 'button', onclick: () => { dlg.close(); if (hit) deleteTaskWithUndo(t, hit.s); } }, 'Delete task'),
      h('button', { class: 'ghost', type: 'button', onclick: () => dlg.close() }, 'Cancel')));
  if (!dlg.open) dlg.showModal();
  text.focus();
}
// Une tâche dans une colonne de Today : taille et durée en haut, titre au milieu, barre de temps en bas
const SIZE_NAME = { L: 'Big', M: 'Medium', S: 'Small' };
const SIZE_RULE = { L: 'Big · 90 min or more', M: 'Medium · 30 to 90 min', S: 'Small · under 30 min' };
function compactItem(t) {
  const pct = t.mins ? Math.min(100, Math.round(((t.spent || 0) / t.mins) * 100)) : 0;
  return h('li', { class: 'slot-task' + (t.done ? ' is-done' : ''), draggable: 'true', ondragstart: e => e.dataTransfer.setData('text/plain', t.id) },
    h('div', { class: 'slot-top' },
      h('span', { class: 'size' }, `${SIZE_NAME[sizeOf(t)] || ''} · ${t.mins ? hm(t.mins) : 'no time set'}`),
      h('input', { type: 'checkbox', checked: !!t.done, 'aria-label': `Done: ${t.text}`, onchange: () => {
        t.done = !t.done;
        t.done ? t.doneAt = key(today()) : delete t.doneAt;
        save();
      } })),
    h('span', { class: 'slot-title', style: 'cursor: pointer;', title: 'Open the timer', onclick: () => askFocus(t) }, t.text),
    h('div', { class: 'slot-foot' },
      h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width: ${pct}%` })),
      h('span', { class: 'start-link', role: 'link', tabindex: '0', 'aria-label': `Edit ${t.text}`, onclick: () => editTaskDialog(t) }, 'Edit'),
      t.done ? null : h('span', { class: 'start-link', role: 'link', tabindex: '0', 'aria-label': `Start the timer on ${t.text}`, onclick: () => askFocus(t), onkeydown: e => { if (e.key === 'Enter') askFocus(t); } }, 'Start ▸')));
}
function taskItem(s, t, ctx, compact = false) {
  if (editing === 't:' + t.id) return h('li', {}, editForm(f => {
    const text = f.elements.text.value.trim();
    if (!text) return;
    Object.assign(t, {
      text, due: f.elements.due.value, quad: f.elements.quad.value,
      tags: normTags(f.elements.tags.value), mins: Number(f.elements.mins.value) || 0,
    });
    const dest = places().find(x => x.s.id === f.elements.dest.value)?.s;
    if (dest && dest !== s) { s.tasks = s.tasks.filter(x => x !== t); dest.tasks.push(t); }
    editing = null;
    save();
  },
    h('input', { type: 'text', name: 'text', class: 'grow', value: t.text, maxlength: 120, 'aria-label': 'Task text', 'data-edit': true }),
    picker('dest', places().map(x => [x.s.id, placeLabel(x)]), s.id, 'Move the task to'),
    h('input', { type: 'date', name: 'due', value: t.due || '', 'aria-label': 'Due date (optional)', title: 'Due date (optional)' }),
    picker('quad', QUADS, t.quad || '', 'Quadrant d\'Eisenhower'),
    h('input', { type: 'text', name: 'tags', class: 'grow', value: (t.tags || []).join(', '), placeholder: 'Keywords, e.g. call, writing', maxlength: 120, 'aria-label': 'Keywords' }),
    h('input', { type: 'number', name: 'mins', min: 0, max: 1440, step: 5, value: t.mins || '', placeholder: 'min', 'aria-label': 'Estimated duration in minutes', class: 'mins' }),
    arrows(s.tasks, t)));

  if (compact) return compactItem(t);
  const planned = t.today === key(today());
  // Vue compacte (créneaux de Today) : seulement le temps ; cliquer sur le titre ouvre la page de focus
  const meta = compact ? (t.mins ? [hm(t.mins)] : []) : [
    ctx,
    t.due && h('span', { class: isLate(t) ? 'late' : '' }, isLate(t) ? `overdue (${shortDate(t.due)})` : `due ${shortDate(t.due)}`),
    t.spent ? (t.mins ? `${hm(t.spent)} spent of ${hm(t.mins)}` : `${hm(t.spent)} spent`) : t.mins && hm(t.mins),
    (t.tags || []).length && (t.tags || []).map(x => '#' + x).join(' '),
    t.today && `planned ${shortDate(t.today)}`,
    t.blocked && h('span', { class: 'late' }, `blocked: ${t.blocked}`),
  ].filter(Boolean).flatMap((m, i) => i ? [' · ', m] : [m]);

  return h('li', { draggable: 'true', ondragstart: e => e.dataTransfer.setData('text/plain', t.id),
    // Déposer une tâche sur celle-ci : elle prend sa place dans cette section
    ondragover: e => { e.preventDefault(); e.stopPropagation(); },
    ondrop: e => {
      e.preventDefault(); e.stopPropagation();
      const hit = findTask(e.dataTransfer.getData('text/plain'));
      if (!hit || hit.t === t) return;
      hit.s.tasks = hit.s.tasks.filter(x => x !== hit.t);
      const i = s.tasks.indexOf(t);
      s.tasks.splice(i < 0 ? s.tasks.length : i, 0, hit.t);
      save();
    } },
    h('span', { class: 'grip', 'aria-hidden': 'true', title: 'Drag to move' }, '⋮⋮'),
    h('label', {},
      h('input', { type: 'checkbox', checked: t.done, onchange: () => {
        t.done = !t.done;
        t.done ? t.doneAt = key(today()) : delete t.doneAt; // sert à la revue de la semaine
        save();
      } }),
      h('span', { class: (t.done ? 'done' : '') + (compact ? ' compact' : ''), ...(compact ? { onclick: e => { e.preventDefault(); askFocus(t); }, style: 'cursor: pointer;' } : {}) }, t.text, meta.length ? h('small', { class: 'ctx' }, meta) : null)),
    !t.done && !compact && h('button', {
      class: 'icon day', 'aria-label': `Start a timer on: ${t.text}`, title: 'Start: choose 25 min, 50 min or custom',
      onclick: () => askFocus(t),
    }, 'Start'),
    // Rendre la tâche récurrente, à côté de Start (si elle est rangée dans un projet)
    !compact && !t.done && (() => { const hit = findTask(t.id); return hit && !hit.p.inbox ? recurButton(hit.p, { mode: 'tasks', tasks: [t.text] }, t.text) : null; })(),
    // Les autres actions sont rangées dans le menu « ⋯ » : une seule ligne par tâche
    !compact && h('details', { class: 'task-menu' },
      h('summary', { 'aria-label': `More actions for ${t.text}`, title: 'More actions' }, '⋯'),
      h('div', { class: 'task-menu-items' },
        t.done && h('button', { class: 'ghost', type: 'button', 'aria-pressed': String(!!t.inLibrary),
          onclick: () => { t.inLibrary = !t.inLibrary; save(); } }, t.inLibrary ? 'Remove from library' : 'Add to library'),
        // Copier : une tâche identique juste après, sans son état (fait, prévu, mesuré)
        h('button', { class: 'ghost', type: 'button', 'aria-label': `Copy task ${t.text}`,
          onclick: () => {
            const i = s.tasks.indexOf(t);
            s.tasks.splice(i + 1, 0, { ...t, id: uid(), done: false, doneAt: undefined, spent: undefined, today: undefined, inLibrary: undefined, blocked: undefined });
            save();
          } }, 'Copy'),
        // Bloquée : on note ce qui bloque, et la raison s'affiche sur la tâche
        !t.done && (t.blocked
          ? h('button', { class: 'ghost', type: 'button', onclick: () => { delete t.blocked; save(); } }, 'Unblock')
          : h('button', { class: 'ghost', type: 'button', 'aria-label': `Mark ${t.text} as blocked`, onclick: e => {
              askName(e.currentTarget, 'Blocked by (reason)', v => { t.blocked = v; save(); }, 'Mark blocked');
            } }, 'Mark blocked')),
        editButton('t:' + t.id, `Edit task ${t.text}`),
        h('button', { class: 'ghost', type: 'button', 'aria-label': `Delete task ${t.text}`, onclick: () => deleteTaskWithUndo(t, s) }, 'Delete'))),
    recurChips(findTask(t.id)?.p, tr => tr.mode === 'tasks' && (tr.tasks || []).includes(t.text)));
}

/* ---------- Minuteur : plages de focus et d'urgence ----------
   Le minuteur est gardé dans les données : il survit à un rechargement de la page.
   Le temps passé s'ajoute à la tâche et au journal, qui nourrit le bilan de la semaine. */
const BASE_TITLE = document.title;
const ctxOk = () => true; // les contextes ont été retirés de l'app
function findTask(id) {
  for (const p of [INBOX, ...state.projects]) for (const s of (p.inbox ? [state.inbox] : p.sections)) {
    const t = s.tasks.find(x => x.id === id);
    if (t) return { p, s, t };
  }
  return null;
}
const clockMs = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/* ---------- Pomodoro : 25 min de travail, 5 de pause, 15 après quatre cycles ----------
   Gardé dans les données : il survit au rechargement. Chaque bloc de travail fini s'ajoute au temps
   de la tâche et au journal de la semaine. */
const POMO = { work: 25, short: 5, long: 15 };
const phaseMs = m => m * 6e4;
const pomoLeft = tm => tm.running ? tm.left - (Date.now() - tm.runAt) : tm.left;
// Focus : on choisit d'abord la durée (25 min, 50 min ou personnalisée), puis le chrono démarre
let focusPick = null; // { tid, text } : tâche dont on choisit la durée
function askFocus(t) {
  if (state.timer) return toast('A timer is already running: finish or cancel it first.');
  if (taskStatus(t) !== 'doing' && !startKanban(t)) return; // deux tâches en cours au maximum
  // Demande, une fois, l'autorisation de notifier la fin d'un focus
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  focusPick = { tid: t.id, text: t.text };
  render();
}
function renderChooser(el) {
  // Trois choix : l'estimation de la tâche (timeboxing), Pomodoro, ou une durée personnalisée
  const hit = findTask(focusPick.tid);
  const est = hit?.t.mins || 0;
  const custom = h('input', { type: 'number', min: 5, max: 240, value: est || 40, class: 'mins', 'aria-label': 'Custom duration in minutes' });
  const go = m => {
    focusPick = null;
    startPomo(hit ? hit.t : null, m);
  };
  el.replaceChildren(h('div', { class: 'pomo' },
    h('div', { class: 'grow' }, h('b', {}, 'Timer'), ` · ${focusPick.text}`),
    est ? h('button', { class: 'ghost', onclick: () => go(est) }, `My estimate (${est} min)`) : null,
    h('button', { class: 'ghost', onclick: () => go(POMO.work) }, `Pomodoro (${POMO.work} min)`),
    custom,
    h('button', { class: 'ghost', onclick: () => go(Math.max(5, Math.min(240, Number(custom.value) || 25))) }, 'Start custom'),
    h('button', { class: 'ghost', type: 'button', 'aria-label': 'Show or hide music', onclick: () => document.body.classList.toggle('music-open') }, 'Music'),
    h('button', { class: 'ghost', onclick: () => { focusPick = null; render(); } }, 'Cancel')));
}

// Quand on quitte une barre de recherche, son texte et sa liste disparaissent (un clic sur un résultat reste possible)
function clearOnBlur(input, hits) {
  input.addEventListener('blur', () => setTimeout(() => { input.value = ''; hits.replaceChildren(); }, 150));
}
// Recherche dans le tableau des tâches : la liste apparaît dès que la barre est sélectionnée
function taskFinder() {
  const input = h('input', { type: 'search', class: 'grow', placeholder: 'Search a task to plan or do', 'aria-label': 'Search a task' });
  const hits = h('ul', { class: 'hits' });
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const list = tasks().filter(x => !x.t.done && (!q || x.t.text.toLowerCase().includes(q))).sort(byUrgency).slice(0, 10);
    hits.replaceChildren(...list.map(x => h('li', {},
      h('span', {}, x.t.text), h('small', { class: 'ctx' }, ` ${placeLabel(x)} · ${durationText(x.t)} · suggested ${sizeFromMins(x.t)}`),
      h('span', { class: 'row' },
        h('button', { class: 'ghost', type: 'button', onclick: () => toggleToday(x.t) }, x.t.today === key(today()) ? 'Remove from today' : 'Today'),
        h('button', { class: 'ghost', type: 'button', onclick: () => askFocus(x.t) }, 'Timer')))));
  };
  input.addEventListener('input', draw);
  input.addEventListener('focus', draw);
  clearOnBlur(input, hits);
  return h('div', { class: 'card' }, h('strong', {}, 'Task search'), input, hits);
}

// Bibliothèque : les tâches déjà faites, avec le temps moyen. « Charger » en refait une dans la boîte de réception.
function taskLibraryCard() {
  const all = [state.inbox, ...state.projects.flatMap(p => p.sections)].flatMap(s => s.tasks);
  const nameOf = t => (t.from ? t.text.replace(/ · [^·]+$/, '') : t.text).trim(); // une récurrente garde son nom sans le repère de semaine
  const groups = new Map();
  // Seules les tâches rangées dans la bibliothèque (bouton « To library ») y apparaissent
  for (const t of all.filter(x => x.inLibrary)) {
    const k = nameOf(t).toLowerCase();
    const g = groups.get(k) || { name: nameOf(t), done: 0, spent: [], est: [] };
    if (t.done) { g.done++; if (t.spent) g.spent.push(t.spent); }
    if (t.mins) g.est.push(t.mins);
    groups.set(k, g);
  }
  const avg = a => a.length ? Math.round(a.reduce((n, x) => n + x, 0) / a.length) : 0;
  const rows = [...groups.values()].filter(g => g.done > 0).sort((a, b) => b.done - a.done);
  return h('details', foldable('taskLib', { class: 'card library' }),
    h('summary', {}, `Task library (${tagStats().size})`), // le compte suit les mots-clés
    h('p', { class: 'muted' }, 'Keywords: click one to see its tasks and their durations.'),
    ...tagRows(),
    rows.length ? h('ul', { class: 'secs' }, rows.map(g => {
      const mean = avg(g.spent) || avg(g.est);
      return h('li', {},
        h('div', { class: 'grow' }, h('strong', {}, g.name),
          h('div', { class: 'muted' }, `done ${g.done} time${g.done > 1 ? 's' : ''} · average ${mean ? hm(mean) : 'not timed yet'}${g.spent.length ? ` (from ${g.spent.length} timed)` : ''}`)),
        h('button', { class: 'ghost', type: 'button', onclick: () => {
          state.inbox.tasks.push({ id: uid(), text: g.name, done: false, ...(mean ? { mins: mean } : {}) });
          save();
          toast(`"${g.name}" loaded into the inbox${mean ? `, estimated at ${hm(mean)}` : ''}.`);
        } }, 'Load'));
    })) : h('p', { class: 'empty' }, 'No task in the library yet. Finish a task, then choose “Add to library” in its ⋯ menu.'));
}

function startPomo(task, work = POMO.work) {
  if (state.timer) return toast('A timer is already running: finish or cancel it first.');
  const hit = task && findTask(task.id);
  state.timer = {
    kind: 'pomo', work, phase: 'work', cycle: 1, nextLong: false, left: phaseMs(work), running: true, runAt: Date.now(),
    tid: task?.id || null, label: task ? task.text : 'Timer', proj: hit ? hit.p.name : '',
  };
  save();
}
function logPomo(tm, mins) {
  if (mins < 1) return;
  state.log.push({ date: key(today()), kind: 'focus', mins, tid: tm.tid, label: tm.label, proj: tm.proj });
  const hit = tm.tid && findTask(tm.tid);
  if (hit) hit.t.spent = (hit.t.spent || 0) + mins;
}
// Phase suivante. `early` : la phase de travail est sautée avant la fin, on garde le temps déjà fait.
// Petit son (sans fichier) quand une phase se termine
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* pas de son disponible : on garde le message */ }
}
function nextPomo(early) {
  const tm = state.timer;
  if (!early) {
    beep();
    // Notification système, si l'utilisateur l'a autorisée (la page doit rester ouverte)
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Timer finished', { body: 'Time for a break.' });
  }
  if (tm.phase === 'work') {
    const W = tm.work || POMO.work;
    logPomo(tm, early ? Math.round((phaseMs(W) - pomoLeft(tm)) / 6e4) : W);
    tm.nextLong = tm.cycle === 4;
    tm.phase = 'break';
    tm.left = phaseMs(tm.nextLong ? POMO.long : POMO.short);
    toast(tm.nextLong ? 'Four cycles done: 15 min long break.' : 'Break: 5 min.');
  } else {
    tm.cycle = tm.nextLong ? 1 : tm.cycle + 1;
    tm.phase = 'work';
    tm.left = phaseMs(tm.work || POMO.work);
    toast('Back to work.');
  }
  tm.running = true;
  tm.runAt = Date.now();
  save();
}
function tickPomo() {
  const tm = state.timer;
  if (!tm || tm.kind !== 'pomo') return;
  if (pomoLeft(tm) <= 0) return nextPomo(false);
  const out = document.getElementById('timer-left');
  if (out) out.textContent = clockMs(pomoLeft(tm));
  document.title = `${clockMs(pomoLeft(tm))} · ${BASE_TITLE}`;
}
function pausePomo() {
  const tm = state.timer;
  if (tm.running) { tm.left = pomoLeft(tm); tm.running = false; tm.runAt = null; }
  else { tm.running = true; tm.runAt = Date.now(); }
  save();
}
function stopPomo() {
  const tm = state.timer;
  if (tm.phase === 'work') logPomo(tm, Math.round((phaseMs(tm.work || POMO.work) - pomoLeft(tm)) / 6e4));
  state.timer = null;
  document.title = BASE_TITLE;
  save();
}
// Musique : lecteur YouTube officiel (IFrame API). Playlists et radios en direct, avec précédent, lecture/pause et suivant.
const MUSIC_PRESETS = [
  { id: 'lofi', name: 'Lofi Girl (radio en direct)', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
];
let ytPlayer = null, ytPending = [];
function parseYT(url) {
  const list = /[?&]list=([\w-]+)/.exec(url || '');
  if (list) return { list: list[1] };
  const v = /(?:[?&]v=|youtu\.be\/|\/live\/)([\w-]{11})/.exec(url || '');
  return v ? { video: v[1] } : null;
}
function loadYTApi(cb) {
  if (window.YT && YT.Player) return cb();
  ytPending.push(cb);
  if (!document.getElementById('yt-api')) document.head.append(h('script', { id: 'yt-api', src: 'https://www.youtube.com/iframe_api' }));
  window.onYouTubeIframeAPIReady = () => { ytPending.forEach(f => f()); ytPending = []; };
}
function playMusic(src) {
  loadYTApi(() => {
    if (ytPlayer && src.list && ytPlayer.loadPlaylist) return ytPlayer.loadPlaylist({ listType: 'playlist', list: src.list });
    if (ytPlayer && src.video && ytPlayer.loadVideoById) return ytPlayer.loadVideoById(src.video);
    if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
    document.getElementById('music-host').replaceChildren(h('div', { id: 'music-player' }));
    ytPlayer = new YT.Player('music-player', {
      width: '260', height: '146',
      ...(src.list ? { playerVars: { listType: 'playlist', list: src.list, playsinline: 1, rel: 0 } }
        : { videoId: src.video, playerVars: { playsinline: 1, rel: 0 } }),
    });
  });
}
// Le lecteur reste en place pendant un Focus : il n'est pas recréé à chaque mise à jour du bandeau
function buildMusic() {
  if (document.getElementById('music')) return;
  const ctl = (label, fn) => h('button', { class: 'ghost', type: 'button', 'aria-label': label, onclick: fn }, label);
  const radios = h('select', { 'aria-label': 'Radio ou playlist', onchange: e => {
    const p = MUSIC_PRESETS.find(x => x.id === e.target.value);
    if (!p) return;
    state.music = p.url;
    persist();
    playMusic(parseYT(p.url));
  } }, h('option', { value: '' }, 'Radios et playlists…'), MUSIC_PRESETS.map(p => h('option', { value: p.id }, p.name)));
  const urlForm = h('form', { class: 'row', onsubmit: e => {
    e.preventDefault();
    const v = e.target.elements.url.value.trim();
    const src = parseYT(v);
    if (!src) return toast('This link cannot be played: paste a YouTube video, radio or playlist link.');
    state.music = v;
    persist();
    playMusic(src);
  } },
    h('input', { type: 'text', name: 'url', class: 'grow', placeholder: 'YouTube link (video, radio or playlist)', value: state.music || '', 'aria-label': 'YouTube link' }),
    h('button', { class: 'ghost' }, 'Lire'));
  document.body.append(h('div', { id: 'music', hidden: true },
    h('div', { id: 'music-host' }, h('div', { id: 'music-player' })),
    h('div', { class: 'row mctl' },
      ctl('Previous', () => ytPlayer?.previousVideo?.()),
      ctl('Lecture / Pause', () => { if (ytPlayer?.getPlayerState) (ytPlayer.getPlayerState() === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo()); }),
      ctl('Suivant', () => ytPlayer?.nextVideo?.()),
      h('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Music volume', title: 'Volume', oninput: e => ytPlayer?.setVolume?.(Number(e.target.value)) })),
    radios, urlForm));
}
function renderPomo(el, tm) {
  const phase = tm.phase === 'work' ? `Work · cycle ${tm.cycle}/4` : tm.nextLong ? 'Long break' : 'Break';
  el.replaceChildren(
    h('div', { class: 'pomo' },
      h('div', { class: 'grow' }, h('b', {}, tm.phase === 'work' ? 'Timer' : 'Break'), ` · ${phase} · ${tm.label}${tm.proj ? ` · ${tm.proj}` : ''}`),
      h('span', { id: 'timer-left', class: 'big' }, clockMs(pomoLeft(tm))),
      h('button', { class: 'ghost', onclick: pausePomo }, tm.running ? 'Pause timer' : 'Resume'),
      h('button', { class: 'ghost', onclick: () => nextPomo(true) }, tm.phase === 'work' ? 'Skip to break' : 'Skip break'),
      h('button', { class: 'ghost', onclick: stopPomo }, 'Stop'),
      h('button', { class: 'ghost', type: 'button', 'aria-label': 'Show or hide music', onclick: () => document.body.classList.toggle('music-open') }, 'Music')));
}

function startTimer(kind, task) {
  if (state.timer) return toast('A timer is already running: finish or cancel it first.');
  const hit = task && findTask(task.id);
  state.timer = {
    kind, mins: TIMER[kind].start, start: Date.now(), tid: task?.id || null,
    label: task ? task.text : 'Messages and interruptions', proj: hit ? hit.p.name : '',
  };
  save();
}
function endTimer(log) {
  const tm = state.timer;
  if (!tm) return;
  state.timer = null;
  const mins = Math.round(Math.min(Date.now() - tm.start, tm.mins * 6e4) / 6e4); // jamais plus que la durée prévue
  if (log && mins >= 1) {
    state.log.push({ date: key(new Date(tm.start)), kind: tm.kind, mins, tid: tm.tid, label: tm.label, proj: tm.proj });
    const hit = tm.tid && findTask(tm.tid);
    if (hit) hit.t.spent = (hit.t.spent || 0) + mins;
    toast(`${hm(mins)} recorded (${TIMER[tm.kind].label.toLowerCase()}).`);
  } else if (log) toast('Less than a minute: nothing recorded.');
  document.title = BASE_TITLE;
  save();
}
function tickTimer() {
  const tm = state.timer;
  if (!tm) return;
  if (tm.kind === 'pomo') return tickPomo();
  const left = tm.start + tm.mins * 6e4 - Date.now();
  if (left <= 0) { endTimer(true); toast(`Time is up: ${TIMER[tm.kind].label.toLowerCase()} finished, ${hm(tm.mins)} recorded.`); return; }
  const out = document.getElementById('timer-left');
  if (out) out.textContent = clockMs(left);
  document.title = `${clockMs(left)} · ${BASE_TITLE}`;
}
// La musique se range dans le minuteur (sous les boutons) pendant un Focus, et hors de lui sinon
function renderTimer() {
  renderTimerBody();
  const m = document.getElementById('music'), el = document.getElementById('timer');
  if (!m || !el) return;
  if (document.body.classList.contains('focus-mode')) el.append(m);
  else document.body.append(m);
}
function renderTimerBody() {
  const el = document.getElementById('timer'), tm = state.timer;
  // Focus (choix de la durée ou Pomodoro en cours) : page cachée, minuteur en grand, musique disponible
  const focusing = !!focusPick || !!(tm && tm.kind === 'pomo');
  document.body.classList.toggle('focus-mode', focusing);
  if (!focusing) document.body.classList.remove('music-open'); // hors Focus, la musique repart fermée
  const music = document.getElementById('music');
  if (music) music.hidden = !focusing;
  if (!tm && focusPick) { el.hidden = false; return renderChooser(el); }
  el.hidden = !tm;
  if (!tm) return el.replaceChildren();
  if (tm.kind === 'pomo') return renderPomo(el, tm);
  const cfg = TIMER[tm.kind];
  el.replaceChildren(
    h('div', { class: 'grow' }, h('b', {}, cfg.label), ' · ', tm.label),
    h('span', { id: 'timer-left', class: 'big' }, clockMs(tm.start + tm.mins * 6e4 - Date.now())),
    tm.mins < cfg.max ? h('button', { class: 'ghost', onclick: () => { tm.mins = Math.min(cfg.max, tm.mins + 15); save(); } }, '+ 15 min') : null,
    h('button', { class: 'ghost', onclick: () => endTimer(true) }, 'Terminer'),
    h('button', { class: 'ghost', onclick: () => endTimer(false) }, 'Cancel'));
}

/* ---------- Déclencheurs ----------
   À son rythme (chaque jour, certains jours, une semaine sur deux, chaque mois), un déclencheur
   ajoute au projet soit une section « Nom S46 » avec ses tâches, soit de simples tâches
   récurrentes rangées dans une section « Routines ». Tout porte le repère de la période (S46…).
   La page n'agit que lorsqu'elle est ouverte : à l'ouverture, on rattrape les jours manqués. */
/* test:start:recur */
function triggerHits(tr, d) {
  if (tr.freq === 'daily') return true;
  if (tr.freq === 'monthly') return d.getDate() === Math.min(tr.dom, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  if (!tr.days.includes(d.getDay())) return false;
  if (tr.freq === 'biweekly') return Math.round((mondayOf(d) - mondayOf(new Date(tr.anchor + 'T00:00'))) / 6048e5) % 2 === 0;
  return true;
}
/* test:end:recur */
const stamp = (tr, d) => tr.freq === 'daily' ? shortDate(key(d)) : tr.freq === 'monthly' ? fmt(d, { month: 'long' }) : 'S' + isoWeek(d);

function runTriggers() {
  const now = today(), nowKey = key(now);
  let changed = false;
  for (const p of state.projects) for (const tr of p.triggers) {
    if (tr.lastRun === nowKey) continue;
    let d = addDays(new Date(tr.lastRun + 'T00:00'), 1);
    const floor = tr.freq === 'daily' ? now : addDays(now, -56); // rattrapage : 8 semaines, sauf le quotidien
    if (d < floor) d = floor;
    for (; d <= now; d = addDays(d, 1)) {
      if (p.status === 'finished' || !triggerHits(tr, d)) continue;
      const dk = key(d), tag = stamp(tr, d);
      if (tr.mode === 'tasks') {
        if (p.sections.some(s => s.tasks.some(t => t.from === tr.id && t.date === dk))) continue;
        let s = p.sections.find(x => x.routine && !x.archived);
        if (!s) p.sections.unshift(s = { id: uid(), name: 'Routines', routine: true, tasks: [] });
        s.tasks.push(...tr.tasks.map(text => ({ id: uid(), text: `${text} · ${tag}`, done: false, due: dk, from: tr.id, date: dk })));
      } else {
        if (p.sections.some(s => s.from === tr.id && s.date === dk)) continue;
        p.sections.unshift({
          id: uid(), name: `${tr.name} ${tag}`, from: tr.id, date: dk,
          tasks: tr.tasks.map(text => ({ id: uid(), text: `${text} · ${tag}`, done: false })),
        });
      }
    }
    tr.lastRun = nowKey;
    changed = true;
  }
  return changed;
}

function triggerLabel(tr) {
  const days = tr.days.map(n => WEEKDAYS.find(([v]) => v === n)[1]).join(', ');
  const when = tr.freq === 'daily' ? 'Chaque jour'
    : tr.freq === 'monthly' ? `Chaque mois, le ${tr.dom}`
    : tr.freq === 'biweekly' ? `Every other week, on ${days}` : `Every ${days}`;
  const what = tr.mode === 'tasks'
    ? `${plural(tr.tasks.length, 'task')} (${tr.tasks.join(', ')})`
    : `section "${tr.name}" with ${plural(tr.tasks.length, 'task')}`;
  return `${when} : ${what}`;
}

// Formulaire de déclencheur : création, ou modification si `tr` est donné
function triggerForm(p, tr) {
  const v = tr || { mode: 'section', freq: 'weekly', days: [4], dom: 1, name: '', tasks: [] };
  const sync = f => { // n'affiche que les champs utiles au choix en cours
    const freq = f.elements.freq.value;
    f.querySelector('.days').hidden = freq === 'daily' || freq === 'monthly';
    f.elements.dom.hidden = freq !== 'monthly';
    f.elements.name.hidden = f.elements.mode.value !== 'section';
    f.querySelector('.mode-help').textContent = MODE_HELP[f.elements.mode.value];
  };
  const el = form(f => {
    const mode = f.elements.mode.value, freq = f.elements.freq.value, name = f.elements.name.value.trim();
    const tasks = f.elements.tasks.value.split('\n').map(x => x.trim()).filter(Boolean);
    const days = [...f.querySelectorAll('.days input:checked')].map(i => Number(i.value));
    if (mode === 'section' && !name) return f.elements.name.focus();
    if (mode === 'tasks' && !tasks.length) return f.elements.tasks.focus();
    if ((freq === 'weekly' || freq === 'biweekly') && !days.length) return toast('Tick at least one day of the week.');
    const data = { mode, freq, days, dom: Math.min(31, Math.max(1, Number(f.elements.dom.value) || 1)), name, tasks };
    if (tr && tr.draft) { delete tr.draft; Object.assign(tr, data); p.triggers.push(tr); } // brouillon ouvert par « Recur. »
    else if (tr) Object.assign(tr, data);
    else p.triggers.push({ id: uid(), ...data, anchor: key(today()), lastRun: key(addDays(today(), -1)) }); // part dès aujourd'hui si c'est le bon jour
    document.getElementById('recur-dialog')?.close();
    editing = null;
    openIds.delete('trg-' + p.id);
    runTriggers();
    save();
  },
    picker('mode', MODES, v.mode, 'What the recurrence does'),
    h('p', { class: 'muted mode-help' }, MODE_HELP[v.mode]),
    picker('freq', FREQS, v.freq, 'Frequency'),
    h('span', { class: 'days row' }, DAY_LETTERS.map(([n, l]) =>
      h('label', {}, h('input', { type: 'checkbox', value: n, checked: v.days.includes(n) }), ' ' + l))),
    h('input', { type: 'number', name: 'dom', min: 1, max: 31, value: v.dom, 'aria-label': 'Jour du mois', title: 'Jour du mois' }),
    h('input', { type: 'text', name: 'name', class: 'grow', value: v.name, placeholder: 'Section name (e.g. Comment on LinkedIn)', maxlength: 60, 'aria-label': 'Name of the created section' }),
    h('textarea', { name: 'tasks', placeholder: 'One task per line (e.g. one LinkedIn account per line)', 'aria-label': 'Created tasks, one per line' }, v.tasks.join('\n')),
    h('button', { class: 'btn' }, tr && !tr.draft ? 'Save' : 'Create recurrence'),
    tr && h('button', { type: 'button', class: 'ghost', onclick: () => { editing = null; document.getElementById('recur-dialog')?.close(); render(); } }, 'Cancel'));
  el.addEventListener('change', () => sync(el));
  sync(el);
  return el;
}

function triggerBlock(p) {
  return h('div', { class: 'section' },
    h('strong', {}, 'Recurrences'),
    p.triggers.length ? h('ul', { class: 'secs' }, p.triggers.map(tr => editing === 'g:' + tr.id
      ? h('li', {}, triggerForm(p, tr))
      : h('li', {},
        h('span', {}, triggerLabel(tr)),
        editButton('g:' + tr.id, `Edit recurrence ${triggerLabel(tr)}`),
        h('button', {
          class: 'icon', 'aria-label': `Delete recurrence ${triggerLabel(tr)}`,
          onclick: () => { p.triggers = p.triggers.filter(x => x !== tr); save(); },
        }, '×')))) : null,
    h('details', foldable('trg-' + p.id),
      h('summary', {}, 'Add a recurrence'),
      triggerForm(p)));
}

/* ---------- Gamification : un arbre qui pousse ----------
   Les points ne sont pas stockés : ils se calculent à partir de tes données,
   donc rien ne peut se décaler ni se compter deux fois. */
const LEVELS = [[0, 'Starting'], [100, 'Steady'], [300, 'Focused'], [600, 'Committed'], [1000, 'Organised'], [1800, 'Master']];
const BADGES = [
  ['First seed', 'One task done', s => s.doneTasks >= 1],
  ['Day started', '7 day starts', s => s.starts >= 7],
  ['Day closed', '7 day closes', s => s.closes >= 7],
  ['Five in one go', '5 tasks done in one day', s => s.maxDay >= 5],
  ['Concentrated', '10 focus sessions', s => s.focus >= 10],
  ['Looking back', 'One Friday review', s => s.reviews >= 1],
  ['Four seasons', '4 Friday reviews', s => s.reviews >= 4],
  ['Steady week', '7 days in a row with activity', s => s.streak >= 7],
  ['Project wrapped', 'One project done', s => s.projectsDone >= 1],
];
function stats() {
  const all = [state.inbox, ...state.projects.flatMap(p => p.sections)].flatMap(s => s.tasks);
  const doneList = all.filter(t => t.done);
  const perDay = {};
  for (const t of doneList) if (t.doneAt) perDay[t.doneAt] = (perDay[t.doneAt] || 0) + 1;
  const days = Object.values(state.days);
  const s = {
    doneTasks: doneList.length,
    starts: days.filter(d => d.start).length,
    closes: days.filter(d => d.close).length,
    checkins: days.filter(d => d.energy || d.mood).length,
    focus: state.log.filter(e => e.kind === 'focus').length,
    minutes: state.log.reduce((n, e) => n + e.mins, 0),
    reviews: state.reviews.length,
    maxDay: Math.max(0, ...Object.values(perDay)),
    projectsDone: state.projects.filter(p => p.status === 'finished').length,
  };
  s.xp = s.doneTasks * 10 + s.minutes + (s.starts + s.closes) * 15 + s.checkins * 5 + s.reviews * 50;
  // Série : jours d'affilée avec une activité, en comptant aujourd'hui ou hier
  const active = new Set([
    ...Object.keys(state.days).filter(k => { const d = state.days[k]; return d.start || d.close || d.energy || d.mood; }),
    ...Object.keys(perDay), ...state.log.map(e => e.date),
  ]);
  let d = today();
  if (!active.has(key(d))) d = addDays(d, -1);
  s.streak = 0;
  while (active.has(key(d))) { s.streak++; d = addDays(d, -1); }
  return s;
}
// Niveau et XP, affichés à côté du temps prévu
function levelBox() {
  const s = stats();
  const idx = LEVELS.findLastIndex(([min]) => s.xp >= min);
  const [, name] = LEVELS[idx];
  const next = LEVELS[idx + 1];
  return h('div', { class: 'grow' },
    h('strong', {},
      h('button', { class: 'ghost plus', type: 'button', 'aria-label': 'How levels and badges work', onclick: openLevels }, '+'),
      ` Level ${idx + 1} · ${name}`),
    h('div', { class: 'muted' }, `${s.xp} XP${next ? ` · ${next[0] - s.xp} to « ${next[1]} »` : ' · top level'}`));
}
// Explications des niveaux et badges, dans une boîte de dialogue ouverte par le « + »
function openLevels() {
  const s = stats();
  const idx = LEVELS.findLastIndex(([min]) => s.xp >= min);
  const [min, name] = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const pct = next ? Math.round((s.xp - min) / (next[0] - min) * 100) : 100;
  let dlg = document.getElementById('levels-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'levels-dialog', class: 'banner-picker', 'aria-label': 'How levels and badges work' }); document.body.append(dlg); }
  dlg.replaceChildren(
    closeX(dlg),
    h('strong', {}, `Level ${idx + 1} · ${name}`),
    h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
    h('p', { class: 'muted' }, 'Task done 10 XP · focus minute 1 XP · day start or close 15 XP · check-in 5 XP · review 50 XP.'),
    h('ul', { class: 'badges' }, BADGES.map(([title, how, ok]) => h('li', { class: ok(s) ? 'got' : '' },
      h('b', {}, title), h('span', { class: 'muted' }, how)))),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => dlg.close() }, 'Close')));
  dlg.showModal();
}

/* ---------- Today : la journée en 1-3-5 ---------- */
// Premier lancement, sans projet : une courte aide pour commencer
function welcomeCard() {
  if (state.projects.length || state.inbox.tasks.length) return [];
  return [h('div', { class: 'card' },
    h('strong', {}, 'Welcome'),
    h('p', { class: 'muted' }, '1. In Plan › Projects, create a project.  2. Add a section, then a task in it.  3. Pick today’s tasks in the slots below, or press Timer on a task.'))];
}
function renderToday() {
  const k = key(today()), all = tasks();
  const plan = all.filter(x => x.t.today === k);
  // Le temps réel : le temps passé sur les tâches prévues, mesuré pendant leur lancement (minuteur)
  const mins = plan.reduce((n, x) => n + (x.t.spent || 0), 0);
  const noDur = plan.filter(x => !x.t.mins).length;

  // Le temps prévu à gauche, le niveau à droite
  const head = h('div', { class: 'topline' },
    h('div', { class: 'ring', role: 'img', 'aria-label': `Time spent: ${hm(mins)}` }, hm(mins)),
    levelBox());

  // Une place libre se remplit en choisissant une tâche de la bonne taille, dans la liste
  // Une place libre se remplit par recherche dans le tableau des tâches. La tâche prend la taille de la place.
  const slot = (size, label) => {
    const items = plan.filter(x => sizeOf(x.t) === size), free = SLOTS[size] - items.length;
    // Une carte « + » par place libre : on crée une tâche ou on choisit une tâche existante
    const freeCard = () => {
      const placeholder = `Search a task for ${label.toLowerCase()}`;
      const input = h('input', { type: 'search', class: 'grow', placeholder, 'aria-label': placeholder });
      const hits = h('ul', { class: 'hits' });
      const draw = () => {
        const q = input.value.trim().toLowerCase();
        const list = all.filter(x => !x.t.done && x.t.today !== k && ctxOk(x.t) && (!q || x.t.text.toLowerCase().includes(q)))
          .sort((a, b) => (sizeOf(a.t) === size ? 0 : 1) - (sizeOf(b.t) === size ? 0 : 1) || byUrgency(a, b))
          .slice(0, 8);
        hits.replaceChildren(...list.map(x => h('li', {},
          h('button', { class: 'ghost', type: 'button', onclick: () => {
            const used = all.filter(y => y.t.today === k && sizeOf(y.t) === size).length;
            if (used >= SLOTS[size]) return toast(`This ${label.toLowerCase()} slot is full.`);
            x.t.size = size;
            toggleToday(x.t);
          } }, x.t.text),
          h('small', { class: 'ctx' }, ` ${placeLabel(x)} · ${durationText(x.t)} · suggested ${sizeFromMins(x.t)}`))));
      };
      input.addEventListener('input', draw);
      input.addEventListener('focus', draw);
      clearOnBlur(input, hits);
      const newName = h('input', { type: 'text', placeholder: `New task for ${label.toLowerCase()} *`, maxlength: 120, 'aria-label': `New task for ${label}` });
      const create = h('form', { class: 'row', hidden: true, onsubmit: e => {
        e.preventDefault();
        const v = newName.value.trim();
        if (!v) return toast('Write the task name first.');
        if (all.filter(y => y.t.today === k && sizeOf(y.t) === size).length >= SLOTS[size]) return toast(`This ${label.toLowerCase()} slot is full.`);
        state.inbox.tasks.push({ id: uid(), text: v, done: false, today: k, size });
        save();
      } }, newName, h('button', { class: 'btn', type: 'submit' }, 'Create'));
      const searchBox = h('div', { class: 'search', hidden: true }, input, hits);
      const newBtn = h('button', { class: 'ghost', type: 'button', onclick: () => { create.hidden = false; searchBox.hidden = true; newName.focus(); } }, 'New task');
      const pickBtn = h('button', { class: 'ghost', type: 'button', onclick: () => { searchBox.hidden = false; create.hidden = true; input.focus(); } }, 'Existing task');
      const panel = h('div', { class: 'slot-panel', hidden: true }, h('div', { class: 'row' }, newBtn, pickBtn), create, searchBox);
      // La carte entière est cliquable : pointillés, curseur et survol montrent qu'on peut cliquer
      const hint = h('span', { class: 'slot-hint', 'aria-hidden': 'true' }, '+', h('small', {}, SIZE_RULE[size] + ' · click to add'));
      const card = h('div', { class: 'slot-add', role: 'button', tabindex: '0', 'aria-label': `Add a task to ${label}`, 'aria-expanded': 'false', onclick: e => {
        if (e.target.closest('.slot-panel')) return; // un clic dans le panneau ne le ferme pas
        panel.hidden = !panel.hidden;
        card.setAttribute('aria-expanded', String(!panel.hidden));
        hint.hidden = !panel.hidden;
      }, onkeydown: e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.slot-panel')) { e.preventDefault(); card.click(); }
      } }, hint, panel);
      return card;
    };
    // Glisser une tâche ici pour la mettre dans ce créneau (cela règle sa taille)
    return h('div', { class: 'card', 'data-drop': '', ondragover: e => e.preventDefault(), ondrop: e => {
      e.preventDefault();
      const hit = findTask(e.dataTransfer.getData('text/plain'));
      if (hit) { hit.t.size = size; hit.t.today = key(today()); save(); } // un créneau de Today, c'est aujourd'hui
    } },
      h('strong', {}, `${label} (${items.length}/${SLOTS[size]})`),
      h('ul', { class: 'tasks' }, items.map(x => taskItem(x.s, x.t, placeLabel(x), true))),
      ...Array.from({ length: Math.max(free, 0) }, freeCard));
  };

  // Propositions, sans doublon : ce qui était prévu avant, ce qui arrive à échéance, ce qui est prioritaire
  const seen = new Set(plan.map(x => x.t));
  const pick = test => all.filter(x => !x.t.done && !seen.has(x.t) && ctxOk(x.t) && test(x.t) && seen.add(x.t)).sort(byUrgency);
  const carried = pick(t => t.today && t.today < k);
  const due = pick(t => t.due && t.due <= k);
  const urgent = pick(t => t.quad === 'do');
  const offer = (label, items) => items.length ? [h('div', { class: 'card' },
    h('strong', {}, `${label} (${items.length})`),
    h('ul', { class: 'tasks' }, items.map(x => taskItem(x.s, x.t, placeLabel(x)))))] : [];

  // Rituels (sprint 4) : on lance la journée une fois les tâches choisies, on la ferme par écrit
  const day = state.days[k] ||= {};
  // Check-in du matin : énergie et humeur, sur 5. Une énergie basse allège la journée, sans l'interdire.
  const scale = field => h('div', { class: 'row scale' },
    h('span', { class: 'muted' }, field === 'energy' ? 'Energy (1 low, 5 high)' : 'Mood (1 to 5)'),
    [1, 2, 3, 4, 5].map(n => h('button', {
      class: 'ghost', type: 'button', 'aria-pressed': String(day[field] === n),
      'aria-label': `${field === 'energy' ? 'Energy' : 'Mood'} ${n} out of 5`,
      onclick: () => { day[field] = n; save(); },
    }, String(n))));
  const lowEnergy = day.energy && day.energy <= 2
    ? h('p', { class: 'note' }, 'Low energy today: keep one big task and two small ones at most. A calmer day counts too.') : null;
  const start = day.start
    ? h('div', { class: 'card' }, h('p', { class: 'note' }, `Day started at ${day.start}.`), lowEnergy)
    : h('div', { class: 'card stack' },
      h('strong', {}, 'Start-of-day ritual'),
      h('p', { class: 'muted' }, 'Before opening messages: check in with yourself, choose your tasks, then start the day.'),
      scale('energy'), scale('mood'), lowEnergy,
      h('button', { class: 'btn', onclick: () => {
        if (!plan.length) return toast('Pick at least one task for today first.');
        day.start = clock();
        save();
      } }, 'Start my day'));

  const text = (obj, field, label) => bind('input', obj, field, { type: 'text', placeholder: label, 'aria-label': label, maxlength: 200 });
  const close = day.close
    ? h('div', { class: 'card' },
      h('strong', {}, `Day closed at ${day.close}`),
      day.did ? fact('Done', day.did) : null,
      day.left ? fact('Left', day.left) : null,
      day.grateful ? fact('Gratitude', day.grateful) : null,
      h('button', { class: 'ghost', onclick: () => { delete day.close; save(); } }, 'Reopen the day'))
    : h('div', { class: 'card stack' },
      h('strong', {}, 'End-of-day ritual'),
      h('p', { class: 'muted' }, '15 minutes at the end of the day: two lines to stop thinking about it.'),
      // Les trois lignes sont repliées : le bouton de fin de journée reste visible (Hick)
      h('details', foldable('ritual', {}),
        h('summary', {}, 'Write my three lines'),
        text(day, 'did', 'What got done'),
        text(day, 'left', 'What is left'),
        text(day, 'grateful', 'One thing I am grateful for')),
      h('div', { class: 'row' },
        h('button', { class: 'btn', title: 'Save and end the day', onclick: () => { day.close = clock(); save(); toast('Day closed and saved.'); } }, 'Call it a day')));

  // Plages mesurées aujourd'hui, et lancement d'une plage d'urgence
  const tracked = kind => state.log.filter(e => e.date === k && e.kind === kind).reduce((n, e) => n + e.mins, 0);
  const slots = h('div', { class: 'card' },
    h('strong', {}, 'Time blocks today'),
    h('p', { class: 'muted' }, `Timer ${hm(tracked('focus'))} · Urgent ${hm(tracked('urgent'))}`),
    h('p', { class: 'muted' }, 'Timer: one project, one task, notifications off, started with “Timer” on a task. Urgent: a buffer for messages and interruptions.'),
    h('button', { class: 'btn', onclick: () => startTimer('urgent') }, `Start an urgent block (${TIMER.urgent.start} min)`));

  const friday = today().getDay() === 5 && !state.reviews.some(r => r.week === key(mondayOf(today())))
    ? [h('div', { class: 'card' },
      h('strong', {}, "It's Friday"),
      h('p', { class: 'muted' }, '20 minutes for your weekly review, in 5 questions.'),
      h('button', { class: 'btn', onclick: () => showTab('bilan', 'review') }, 'Do my review'))] : [];

    // Saisie rapide : une tâche pour aujourd'hui, en une ligne
  const quickInput = h('input', { type: 'text', maxlength: 120, placeholder: 'Quick add a task for today', 'aria-label': 'Quick add a task for today', class: 'grow' });
  const quickAdd = h('form', { class: 'row', onsubmit: e => {
    e.preventDefault();
    const v = quickInput.value.trim();
    if (!v) return;
    state.inbox.tasks.push({ id: uid(), text: v, done: false, today: k });
    save();
  } }, quickInput, h('button', { class: 'btn', type: 'submit' }, 'Add'));
  // La journée en une phrase
  const plannedMins = plan.reduce((n, x) => n + (x.t.mins || 0), 0);
  const dayLine = h('p', { class: 'muted day-line' }, `${plan.length} ${plan.length === 1 ? 'task' : 'tasks'} planned · ${hm(plannedMins)} estimated · ${hm(mins)} done`);
  // Ce qui est en retard : tâches et projets dont la date est passée
  const lateTasks = all.filter(x => !x.t.done && x.t.due && x.t.due < k);
  const lateProjects = state.projects.filter(p => p.status !== 'finished' && p.due && p.due < k);
  const lateCard = (lateTasks.length || lateProjects.length) ? [h('div', { class: 'card' },
    h('strong', {}, `Late (${lateTasks.length + lateProjects.length})`),
    h('ul', { class: 'secs' },
      lateProjects.map(p => h('li', {}, h('span', {}, `Project: ${p.name}`), h('small', { class: 'ctx' }, ` · end date ${shortDate(p.due)}`))),
      lateTasks.map(x => h('li', {}, h('span', {}, x.t.text), h('small', { class: 'ctx' }, ` · due ${shortDate(x.t.due)}`)))))] : [];
  document.getElementById('today').replaceChildren(quickAdd, dayLine, ...lateCard, head, ...welcomeCard(), ...backupBanner(), ...friday,
    ...(plan.length ? [] : [h('p', { class: 'empty' }, 'No tasks chosen for today yet. Search a task in a slot below, or click “Today” on a task in the Tasks tab.')]),
    // Les trois colonnes de même largeur ; sur petit écran, défilement horizontal
    h('div', { class: 'slots slots-3' }, slot('L', 'Big task'), slot('M', 'Medium tasks'), slot('S', 'Small tasks')),
    h('div', { class: 'slots' },
      ...offer('Planned for another day, not done', carried),
      ...offer('Overdue or due today', due),
      ...offer('To do now', urgent)),
    close);
}

/* ---------- Review : la revue du vendredi, et son historique ---------- */
// Revue de la semaine affichée dans Week : on la remplit pour la semaine choisie, et on voit ses réponses
let reviewOpen = null; // semaine dont le formulaire est ouvert
function weeklyReviewCard(mon) {
  const wk = key(mon);
  const saved = state.reviews.find(r => r.week === wk);
  if (!saved && state.reviewDraft?.week !== wk) state.reviewDraft = { week: wk, a: ['', '', '', '', ''] };
  const cur = saved || state.reviewDraft;
  const editing = reviewOpen === wk;
  const head = h('strong', {}, `Weekly review, week ${isoWeek(mon)}`);
  if (!editing) {
    return h('div', { class: 'card stack' }, head,
      saved
        ? [h('p', { class: 'muted' }, `Saved on ${shortDate(saved.date)}`), QUESTIONS.map((q, i) => fact(q, saved.a[i] || 'No answer'))]
        : h('p', { class: 'muted' }, 'No review for this week yet.'),
      h('button', { class: 'btn', type: 'button', onclick: () => { reviewOpen = wk; render(); } }, saved ? 'Edit the 5 questions' : 'Fill the 5 questions'));
  }
  return h('div', { class: 'card stack' }, head,
    QUESTIONS.map((q, i) => h('div', { class: 'q' },
      h('b', {}, `${i + 1}. ${q}`),
      bind('textarea', cur.a, i, { class: 'small', 'aria-label': q }))),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => {
        if (!saved) { cur.week = wk; cur.date = key(today()); state.reviews.unshift(cur); delete state.reviewDraft; }
        reviewOpen = null;
        save();
        toast('Review saved.');
      } }, saved ? 'Update review' : 'Save review'),
      h('button', { class: 'ghost', type: 'button', onclick: () => { reviewOpen = null; render(); } }, 'Cancel')));
}

/* ---------- Nouvelle tâche : tout se choisit ou se crée dans le formulaire ----------
   Nom, catégorie (du projet), projet, section, contexte. Un élément absent se crée sur place
   via son option « + … » : il est ajouté aux projets, aux sections ou aux contextes. */
// Mots-clés : libellés courts (#call, #writing…) pour regrouper les tâches et connaître leur durée moyenne
function normTags(s) {
  return [...new Set(String(s || '').split(/[,\s]+/).map(x => x.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))];
}
const meanOf = a => a.length ? Math.round(a.reduce((n, x) => n + x, 0) / a.length) : 0;
// Par mot-clé : nombre de tâches et durées (réelle si mesurée, sinon estimée)
function tagStats() {
  // Les mots-clés saisis existent même sans tâche créée ; chacun garde la liste de ses tâches
  const m = new Map();
  const entry = tag => { if (!m.has(tag)) m.set(tag, { n: 0, vals: [], tasks: [] }); return m.get(tag); };
  for (const kw of state.keywords || []) entry(kw);
  for (const { t } of tasks()) for (const tag of t.tags || []) {
    const e = entry(tag);
    e.n++;
    const v = t.spent || t.mins;
    if (v) e.vals.push(v);
    e.tasks.push({ text: t.text, mins: t.mins || 0, spent: t.spent || 0, done: !!t.done });
  }
  return m;
}
// Moyenne des durées des tâches qui portent au moins un de ces mots-clés
function avgForTags(tags) {
  const vals = [];
  for (const { t } of tasks()) if ((t.tags || []).some(x => tags.includes(x))) { const v = t.spent || t.mins; if (v) vals.push(v); }
  return { avg: meanOf(vals), n: vals.length };
}
// Ajoute des mots-clés à la liste commune (dès qu'ils sont saisis, même sans tâche créée)
function addKeywords(tags) {
  if (!tags.length) return;
  state.keywords = [...new Set([...(state.keywords || []), ...tags])];
  persist();
  // On rafraîchit seulement la bibliothèque, pour ne pas effacer ce qui est en cours de saisie
  const lib = [...document.querySelectorAll('#tasks details.library')].find(d => d.querySelector('summary')?.textContent.startsWith('Task library'));
  if (lib) { const open = lib.open; const fresh = taskLibraryCard(); fresh.open = open; lib.replaceWith(fresh); }
}
// Bibliothèque : un mot-clé par ligne ; un clic l'ouvre avec ses tâches et leurs durées
// Une fenêtre qui liste toutes les tâches d'un mot-clé, avec leurs durées
function keywordDialog(tag, s) {
  let dlg = document.getElementById('kw-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'kw-dialog', class: 'banner-picker', 'aria-label': 'Tasks with this keyword' }); document.body.append(dlg); }
  dlg.replaceChildren(closeX(dlg), h('strong', {}, `#${tag}`),
    h('p', { class: 'muted' }, `${plural(s.n, 'task')} · average ${meanOf(s.vals) ? hm(meanOf(s.vals)) : 'not timed yet'}`),
    s.tasks.length
      ? h('ul', { class: 'secs' }, s.tasks.map(x => h('li', {},
          h('span', { class: x.done ? 'done' : '' }, x.text),
          h('small', { class: 'ctx' }, ` · ${x.mins ? `${hm(x.mins)} estimated` : 'no estimate'}${x.spent ? ` · ${hm(x.spent)} spent` : ''}`))))
      : h('p', { class: 'empty' }, 'No task with this keyword yet.'));
  if (!dlg.open) dlg.showModal();
}
// Par mot-clé : nom, nombre de tâches et moyenne, et une icône qui ouvre la liste des tâches
function tagRows() {
  const stats = [...tagStats()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  if (!stats.length) return [];
  return [h('strong', {}, 'Keywords'), h('ul', { class: 'secs' }, stats.map(([tag, s]) => {
    const open = h('button', { class: 'icon kw-open', type: 'button', 'aria-label': `Show the tasks with #${tag}`, title: 'Show the tasks', onclick: () => keywordDialog(tag, s) });
    open.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>';
    return h('li', { class: 'kw-row' },
      h('span', {}, `#${tag}`),
      h('small', { class: 'ctx' }, ` ${plural(s.n, 'task')} · average ${meanOf(s.vals) ? hm(meanOf(s.vals)) : 'not timed yet'}`),
      open);
  }))];
}
function newTaskForm() {
  // Champ mots-clés, et conseil : la durée moyenne des tâches qui ont les mêmes mots-clés
  const tagsInput = h('input', { type: 'text', name: 'tags', class: 'grow', placeholder: 'Keywords, e.g. call, writing', maxlength: 120, 'aria-label': 'Keywords', list: 'kw-suggest' });
  const kwSuggest = h('datalist', { id: 'kw-suggest' }, (state.keywords || []).map(x => h('option', { value: x })));
  const tagHint = h('p', { class: 'note tag-hint', hidden: true });
  // Un mot-clé est enregistré dès qu'on quitte le champ, même si la tâche n'est pas créée
  tagsInput.addEventListener('change', () => { addKeywords(normTags(tagsInput.value)); });
  tagsInput.addEventListener('input', () => {
    const { avg, n } = avgForTags(normTags(tagsInput.value));
    tagHint.hidden = !avg;
    tagHint.replaceChildren(...(avg ? [
      `Average for these keywords: ${hm(avg)} (${plural(n, 'task')}). `,
      h('button', { class: 'ghost', type: 'button', onclick: () => { tagsInput.form.elements.mins.value = avg; } }, 'Use this time'),
    ] : []));
  });
  const smartBox = h('div', { class: 'smart-box', hidden: true },
    SMART_FIELDS.map(([n, label]) => h('input', { type: 'text', name: n, class: 'grow', placeholder: label, 'aria-label': label, maxlength: 160 })));
  const projSel = h('select', { name: 'project', 'aria-label': 'Projet' },
    h('option', { value: '', disabled: true, selected: true }, 'Project *'),
    state.projects.map(p => h('option', { value: p.id }, p.name)),
    h('option', { value: '__new' }, '+ New project…'));
  const secSel = h('select', { name: 'section', 'aria-label': 'Section' });
  // Seules les options réellement créées apparaissent ; le texte d'invite n'est pas une option choisissable
  const fillSections = projId => {
    const p = state.projects.find(x => x.id === projId);
    const opts = p
      ? p.sections.map(s => h('option', { value: s.id }, s.name))
      : [];
    secSel.replaceChildren(h('option', { value: '', disabled: true, selected: true }, 'Section *'), ...opts, ...(p ? [h('option', { value: '__new' }, '+ New section…')] : []));
  };
  fillSections('');
  const newOpt = (sel, value, label) => {
    sel.insertBefore(h('option', { value }, label), sel.querySelector('option[value="__new"]'));
    sel.value = value;
  };
  projSel.addEventListener('change', () => {
    if (projSel.value === '__new') {
      projSel.value = 'inbox';
      return askName(projSel, 'New project name', name => {
        const p = { id: uid(), name, status: 'break', 
          due: '', sections: [], triggers: [], tools: [], answers: {} };
        state.projects.push(p);
        persist();
        newOpt(projSel, p.id, p.name);
        fillSections(p.id);
      });
    }
    fillSections(projSel.value);
  });
  secSel.addEventListener('change', () => {
    if (secSel.value !== '__new') return;
    const p = state.projects.find(x => x.id === projSel.value);
    if (!p) return (secSel.value = 'inbox');
    secSel.value = p.sections[0]?.id || '';
    askName(secSel, 'New section name', name => {
      const s = { id: uid(), name, tasks: [] };
      p.sections.push(s);
      persist();
      secSel.querySelector('option[value="none"]')?.remove();
      newOpt(secSel, s.id, s.name);
    });
  });
  return form(f => {
    const text = f.elements.text.value.trim();
    const hit = places().find(x => x.s.id === f.elements.section.value);
    if (!text || !hit) return toast(text ? 'Choose a section first.' : 'Write the task name first.');
    const smart = Object.fromEntries(SMART_FIELDS.map(([n]) => [n, f.elements[n].value.trim()]));
    // La durée estimée (en minutes) sert au timeboxing : elle pré-règle le minuteur de la tâche
    hit.s.tasks.push({ id: uid(), text, done: false, mins: Number(f.elements.mins.value) || 0, quad: f.elements.quad.value, key: f.elements.key.checked, smart, tags: normTags(f.elements.tags.value) });
    save();
    document.querySelector('#tasks input[name=text]').focus();
  },
    h('input', { type: 'text', name: 'text', class: 'grow', placeholder: 'Task name *', maxlength: 120, 'aria-label': 'Task name (required)' }),
    // SMART : chaque tâche doit répondre aux cinq questions ; le bloc se déplie avec le « + »
    h('button', { class: 'ghost', type: 'button', 'aria-expanded': 'false', onclick: e => {
      smartBox.hidden = !smartBox.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!smartBox.hidden));
      e.currentTarget.textContent = smartBox.hidden ? '+ SMART' : '− SMART';
    } }, '+ SMART'),
    smartBox,
    h('input', { type: 'number', name: 'mins', min: 0, max: 1440, step: 5, placeholder: 'Minutes', 'aria-label': 'Estimated duration in minutes', class: 'mins' }),
    picker('quad', QUADS, '', 'Priority (Eisenhower)'),
    h('label', { class: 'row' }, h('input', { type: 'checkbox', name: 'key', 'aria-label': 'Key 20 percent task' }), h('span', { class: 'muted' }, 'Key 20% (Pareto)')),
    tagsInput, kwSuggest, tagHint, projSel, secSel,
    h('button', { class: 'btn' }, 'Add'));
}

/* ---------- Plan > Week : préparer la semaine avec la matrice d'Eisenhower (vendredi) ---------- */
// Bloc « préparer la semaine », affiché dans Bilan > Review
function prepBlocks() {
  const open = tasks().filter(x => !x.t.done);
  const row = x => h('li', { draggable: 'true', ondragstart: e => e.dataTransfer.setData('text/plain', x.t.id) },
    h('span', {}, x.t.text),
    h('span', { class: 'muted' }, ` · ${placeLabel(x)}`),
    h('button', { class: 'ghost', type: 'button', 'aria-pressed': String(!!x.t.key), title: 'Key 20%: the few tasks that give 80% of the result',
      onclick: () => { x.t.key = !x.t.key; save(); } }, '80/20'),
    h('select', { 'aria-label': `Priority of ${x.t.text}`, onchange: e => { x.t.quad = e.target.value; save(); } },
      QUADS.map(([v, l]) => h('option', { value: v, selected: (x.t.quad || '') === v }, l))));
  const box = id => {
    const list = open.filter(x => x.t.quad === id);
    // Glisser une tâche dans une case pour changer sa priorité
    return h('div', { class: 'card', 'data-drop': '', ondragover: e => e.preventDefault(), ondrop: e => {
      e.preventDefault();
      const hit = findTask(e.dataTransfer.getData('text/plain'));
      if (hit) { hit.t.quad = id; save(); }
    } },
      h('strong', {}, `${QUAD_TITLES[id]} (${list.length})`),
      id === 'do' && list.length > MAX_PRIORITIES ? h('p', { class: 'note' }, `More than ${MAX_PRIORITIES} to do now: move some to Plan.`) : null,
      list.length ? h('ul', { class: 'tasks' }, ordered(list).map(row)) : h('p', { class: 'muted' }, 'Nothing here.'));
  };
  const unsorted = open.filter(x => !x.t.quad);
  return [
    h('div', { class: 'card' },
      h('strong', {}, 'Prepare the week'),
      h('p', { class: 'muted' }, 'On Friday: look back at the week, then sort what comes next. Priority is the Eisenhower box. 80/20 marks the few tasks that give most of the result (Pareto).'),
      helpBtn('80/20', 'The 80/20 rule: about 20% of the tasks give about 80% of the results. Mark those few tasks with 80/20 so they come first.'),
      ),
    ...(unsorted.length ? [h('div', { class: 'card' }, h('strong', {}, `To sort (${unsorted.length})`), h('ul', { class: 'tasks' }, ordered(unsorted).map(row)))] : []),
    h('div', { class: 'slots' }, ['do', 'plan', 'frame', 'drop'].map(box))];
}

/* ---------- Tasks : toutes les tâches, à plat ---------- */
// Toutes les récurrences de tes projets, en un seul endroit dans l'onglet Tasks
function recurringCard() {
  const rows = state.projects.flatMap(p => (p.triggers || []).map(tr => ({ p, tr })));
  return h('div', { class: 'card' },
    h('strong', {}, `Recurring (${rows.length})`),
    rows.length
      ? h('ul', { class: 'secs' }, rows.map(({ p, tr }) => h('li', {},
          h('span', {}, triggerLabel(tr)),
          h('small', { class: 'ctx' }, ` · ${p.name}`),
          h('button', { class: 'icon', type: 'button', 'aria-label': `Delete recurrence ${triggerLabel(tr)}`,
            onclick: () => { p.triggers = p.triggers.filter(x => x !== tr); save(); } }, '×'))))
      : h('p', { class: 'empty' }, 'No recurring task yet. Use "Recur." on a task or a section.'));
}

// Filtres de la liste des tâches (projet et priorité), gardés pendant la session
let taskFilter = { project: '', quad: '' };
function filterBar() {
  return h('div', { class: 'card row' },
    h('select', { 'aria-label': 'Filter by project', onchange: e => { taskFilter.project = e.target.value; render(); } },
      h('option', { value: '' }, 'All projects'),
      state.projects.map(p => h('option', { value: p.id, selected: taskFilter.project === p.id }, p.name))),
    h('select', { 'aria-label': 'Filter by priority', onchange: e => { taskFilter.quad = e.target.value; render(); } },
      QUADS.map(([v, l]) => h('option', { value: v, selected: taskFilter.quad === v }, v ? l : 'All priorities'))),
    // Le regroupement de la liste « To do » est rangé ici, avec les filtres
    h('select', { 'aria-label': 'Group tasks', onchange: e => { taskGroup = e.target.value; render(); } },
      [['none', 'No grouping'], ['project', 'Group by project'], ['priority', 'Group by priority']].map(([v, l]) => h('option', { value: v, selected: taskGroup === v }, l))));
}
// Le formulaire de nouvelle tâche ne s'ouvre qu'après un clic sur « Create task »
let taskFormOpen = false;
function addTaskBlock() {
  const box = h('div', { hidden: !taskFormOpen }, newTaskForm());
  const btn = h('button', { class: 'btn', type: 'button', 'aria-expanded': String(taskFormOpen), onclick: e => {
    taskFormOpen = !taskFormOpen;
    box.hidden = !taskFormOpen;
    e.currentTarget.textContent = taskFormOpen ? 'Close' : 'Create task';
    e.currentTarget.setAttribute('aria-expanded', String(taskFormOpen));
    if (taskFormOpen) box.querySelector('input[name=text]')?.focus();
  } }, taskFormOpen ? 'Close' : 'Create task');
  return h('div', {}, btn, box);
}
// Liste « To do » : regroupée par projet ou par priorité si on le choisit
let taskGroup = 'none', showDone = false;
function todoBlock(items) {
  // Les filtres font partie de la liste « To do »
  const head = h('div', {}, h('div', { class: 'row' }, h('strong', {}, `To do (${items.length})`)), filterBar());
  if (taskGroup === 'none') return h('div', { class: 'card' }, head, h('ul', { class: 'tasks' }, ordered(items).map(x => taskItem(x.s, x.t, placeLabel(x)))));
  const keyOf = x => taskGroup === 'project' ? x.p.name : (QUAD_TITLES[x.t.quad] || 'Unsorted');
  const groups = [...new Set(items.map(keyOf))];
  return h('div', { class: 'card' }, head, ...groups.map(g => h('div', {},
    h('p', { class: 'note' }, g),
    h('ul', { class: 'tasks' }, ordered(items.filter(x => keyOf(x) === g)).map(x => taskItem(x.s, x.t, placeLabel(x)))))));
}
// Avancement : le même bloc sur Tasks, Sections et Projects
function avancementCard() {
  const all = tasks(), flat = all.map(x => x.t), done = all.filter(x => x.t.done);
  const estimate = flat.reduce((n, t) => n + (t.mins || 0), 0);
  return h('div', { class: 'card row' },
    h('div', { class: 'ring', role: 'img', 'aria-label': `${pctOf(flat)}% of tasks done` }, `${pctOf(flat)}%`),
    h('div', { class: 'grow' },
      h('strong', {}, 'Avancement'),
      h('div', { class: 'muted' }, all.length ? `${done.length} of ${all.length} done${estimate ? ` · ${hm(estimate)} estimated in total` : ''}` : 'No tasks')));
}
// Une méthode, en lecture : sa définition et ses étapes
function methodCard(m) {
  return h('details', foldable('method-' + m.name, { class: 'card library' }),
    h('summary', {}, m.name),
    h('p', { class: 'muted' }, m.what),
    h('ol', { class: 'steps' }, m.steps.map(s => h('li', {}, s))));
}
// Kanban : trois colonnes (To do, In progress, Done). Deux tâches en cours au maximum.
const MAX_DOING = 2;
const taskStatus = t => t.done ? 'done' : t.status === 'doing' ? 'doing' : 'todo';
const doingTasks = () => tasks().map(x => x.t).filter(t => taskStatus(t) === 'doing');
// Petite fenêtre qui explique une règle
function popupRule(title, text) {
  let dlg = document.getElementById('rule-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'rule-dialog', class: 'banner-picker', 'aria-label': title }); document.body.append(dlg); }
  dlg.replaceChildren(closeX(dlg), h('strong', {}, title), h('p', { class: 'muted' }, text),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'OK')));
  if (!dlg.open) dlg.showModal();
}
// Passe une tâche en cours : refusé si deux sont déjà en cours
function startKanban(t) {
  if (taskStatus(t) === 'doing') return true;
  if (doingTasks().length >= MAX_DOING) {
    popupRule('Two tasks are already in progress', 'Kanban keeps two tasks in progress at most. Finish one of them before you start another.');
    return false;
  }
  t.status = 'doing';
  save();
  return true;
}
// Déplace une tâche d'une colonne à une autre
function moveKanban(t, to) {
  if (taskStatus(t) === to) return;
  if (to === 'doing') { if (t.done) { t.done = false; delete t.doneAt; } startKanban(t); return; }
  if (to === 'done') { t.done = true; t.doneAt = key(today()); delete t.status; }
  else { t.done = false; delete t.doneAt; t.status = 'todo'; }
  save();
}
function kanbanBoard() {
  const all = tasks();
  const col = (to, title, items) => h('div', { class: 'kb-col', 'data-drop': '', ondragover: e => e.preventDefault(), ondrop: e => {
      e.preventDefault();
      const hit = findTask(e.dataTransfer.getData('text/plain'));
      if (hit) moveKanban(hit.t, to);
    } },
    h('strong', {}, `${title} (${items.length})`),
    h('ul', { class: 'kb-list' }, items.map(x => h('li', { draggable: 'true', ondragstart: e => e.dataTransfer.setData('text/plain', x.t.id) },
      h('span', { class: to === 'done' ? 'done' : '' }, x.t.text),
      h('small', { class: 'ctx' }, x.t.mins ? ` ${hm(x.t.mins)}` : ''),
      to === 'done' ? null : h('span', { class: 'start-link', role: 'link', tabindex: '0', onclick: () => { if (to === 'todo') { if (startKanban(x.t)) askFocus(x.t); } else askFocus(x.t); } }, to === 'todo' ? 'Start ▸' : 'Timer ▸')))));
  const todo = all.filter(x => taskStatus(x.t) === 'todo');
  const doing = all.filter(x => taskStatus(x.t) === 'doing');
  const done = all.filter(x => taskStatus(x.t) === 'done').slice(-8);
  return h('div', { class: 'card kanban' },
    h('div', { class: 'row' }, h('strong', {}, 'Kanban'), helpBtn('Kanban', 'Kanban shows your work as three columns: to do, in progress, done. Keep two tasks in progress at most, so each one gets finished.'), h('span', { class: 'muted' }, `${doing.length} of ${MAX_DOING} in progress`)),
    h('div', { class: 'kb-board' }, col('todo', 'To do', todo), col('doing', 'In progress', doing), col('done', 'Done', done)));
}
function renderTasks() {
  const all = tasks();
  const flat = all.map(x => x.t), done = all.filter(x => x.t.done);
  const estimate = flat.reduce((n, t) => n + (t.mins || 0), 0);
  const keep = x => (!taskFilter.project || x.p.id === taskFilter.project) && (!taskFilter.quad || x.t.quad === taskFilter.quad);
  const inbox = all.filter(x => x.p.inbox && !x.t.done && ctxOk(x.t) && keep(x)), open = all.filter(x => !x.p.inbox && !x.t.done && ctxOk(x.t) && keep(x));

  const summary = avancementCard();

  const add = h('div', { class: 'add-bar' }, addTaskBlock());

  const list = (label, items, hint) => h('div', { class: 'card' },
    h('strong', {}, `${label} (${items.length})`),
    hint && h('p', { class: 'note' }, hint),
    h('ul', { class: 'tasks' }, ordered(items).map(x => taskItem(x.s, x.t, hint ? null : placeLabel(x)))));

  // Filtre par contexte : seulement les tâches qui correspondent à ton état du moment

  // Récurrences repliées ; la bibliothèque unique est en tout dernier, avec les mots-clés
  const recurring = h('details', foldable('recurring', { class: 'card library' }), h('summary', {}, 'Recurring tasks'), recurringCard());
  document.getElementById('tasks').replaceChildren(summary, add, kanbanBoard(), ...([
    ...(inbox.length ? [list(INBOX.name, inbox, 'Sort into a section: click the pencil.')] : []),
    ...(open.length ? [todoBlock(open.sort(byUrgency))] : []),
    // Les tâches faites restent cachées tant qu'on ne les demande pas
    ...(done.length ? [showDone
      ? h('div', {}, list('Done', done), h('button', { class: 'ghost', type: 'button', onclick: () => { showDone = false; render(); } }, 'Hide done'))
      : h('button', { class: 'ghost', type: 'button', onclick: () => { showDone = true; render(); } }, `Show done (${done.length})`)] : []),
  ]), recurring, taskLibraryCard());
}

/* ---------- Sections : rangées par projet, avec leurs tâches ---------- */
// Récurrences affichées sur la section ou la tâche à laquelle elles appartiennent
// Prochaine date d'une récurrence (dans les 90 jours)
function nextOccurrence(tr) {
  for (let i = 0; i < 90; i++) {
    const d = addDays(today(), i);
    if (triggerHits(tr, d)) return d;
  }
  return null;
}
function recurChips(p, match) {
  const list = (p?.triggers || []).filter(match);
  return list.length ? h('div', { class: 'row recur-chips' }, list.flatMap(tr => [
    h('span', { class: 'muted' }, `↻ ${triggerLabel(tr)}${nextOccurrence(tr) ? ` · next ${shortDate(key(nextOccurrence(tr)))}` : ''}`),
    h('button', { class: 'icon', type: 'button', 'aria-label': `Delete recurrence ${triggerLabel(tr)}`,
      onclick: () => { p.triggers = p.triggers.filter(x => x !== tr); save(); } }, '×'),
  ])) : null;
}
function sectionCard(p, s) {
  if (editing === 's:' + s.id) return h('div', { class: 'card' }, editForm(f => {
    const name = f.elements.name.value.trim();
    if (!name) return;
    s.name = name;
    const dest = state.projects.find(x => x.id === f.elements.dest.value);
    if (dest && dest !== p) { p.sections = p.sections.filter(x => x !== s); dest.sections.push(s); }
    editing = null;
    save();
  },
    h('input', { type: 'text', name: 'name', class: 'grow', value: s.name, maxlength: 60, 'aria-label': 'Section name', 'data-edit': true }),
    picker('dest', state.projects.map(x => [x.id, x.name]), p.id, 'Move the section to project'),
    arrows(p.sections, s)));

  // Glisser une tâche sur la section pour la ranger dedans
  return h('div', { class: 'card', 'data-drop': '', ondragover: e => e.preventDefault(), ondrop: e => {
    e.preventDefault();
    // Une section déposée ici prend la place de celle-ci dans le projet
    const sid = e.dataTransfer.getData('application/x-section');
    if (sid) {
      const i = p.sections.findIndex(x => x.id === sid);
      if (i < 0 || p.sections[i] === s) return;
      const [moved] = p.sections.splice(i, 1);
      p.sections.splice(p.sections.indexOf(s), 0, moved);
      save();
      return;
    }
    const hit = findTask(e.dataTransfer.getData('text/plain'));
    if (!hit || hit.s === s) return;
    hit.s.tasks = hit.s.tasks.filter(x => x !== hit.t);
    s.tasks.push(hit.t);
    save();
    toast(`Moved to "${s.name}".`);
  } },
    // La section se déplie : son nom est le titre, et ses boutons sont dans le contenu
    h('details', foldable('sec-' + s.id, { class: 'sec-fold' }),
      h('summary', {}, h('span', { class: 'sec-title', draggable: 'true', title: 'Drag to reorder this section', ondragstart: e => e.dataTransfer.setData('application/x-section', s.id) }, s.name), h('span', { class: 'muted' }, ` ${doneCount(s.tasks)}/${s.tasks.length}`)),
    h('div', { class: 'proj-head' },
      // Déplacer vers un autre projet : rangé dans le menu « ⋯ » pour alléger la carte (Hick)
      ...(state.projects.length > 1 ? [h('details', { class: 'task-menu' },
        h('summary', { 'aria-label': `More actions for section ${s.name}`, title: 'More actions' }, '⋯'),
        h('div', { class: 'task-menu-items' }, h('select', { 'aria-label': `Move ${s.name} to another project`, onchange: e => {
          const dest = state.projects.find(x => x.id === e.target.value);
          if (!dest || dest === p) return;
          p.sections = p.sections.filter(x => x !== s);
          dest.sections.push(s);
          save();
        } }, h('option', { value: '' }, 'Move to…'), state.projects.filter(x => x !== p).map(x => h('option', { value: x.id }, x.name))))),
      ] : []),
      recurButton(p, { mode: 'section', name: s.name, tasks: s.tasks.map(t => t.text) }, `section ${s.name}`),
      editButton('s:' + s.id, `Edit section ${s.name}`),
      h('button', {
        class: 'icon', 'aria-label': `Delete section ${s.name}`,
        onclick: () => askDeleteSection(p, s),
      }, '×')),
    bind('input', s, 'dod', { type: 'text', class: 'dod', placeholder: 'Definition of done: what must be true to say it is finished', 'aria-label': `Definition of done for ${s.name}`, maxlength: 160 }),
    h('label', { class: 'row' }, h('span', { class: 'muted' }, 'Deadline'), bind('input', s, 'due', { type: 'date', 'aria-label': `Deadline of section ${s.name}` })),
    recurChips(p, tr => tr.mode === 'section' && tr.name === s.name),
    progress(s.tasks, 'No tasks'),
    h('ul', { class: 'tasks' }, ordered(s.tasks).map(t => taskItem(s, t))),
    form(f => {
      const text = f.elements.task.value.trim();
      if (!text) return;
      s.tasks.push({ id: uid(), text, done: false });
      save();
      document.querySelector(`[data-task-for="${s.id}"]`).focus();
    },
      h('input', { type: 'text', name: 'task', class: 'grow', placeholder: 'Add a task *', maxlength: 120, 'aria-label': `New task in ${s.name}`, 'data-task-for': s.id }),
      h('button', { class: 'btn' }, 'Add'))));
}

function renderSections() {
  // Les KPI (résultats clés) se déplient seulement si on en a besoin ; chacun devient une tâche de la section
  const kpiBox = h('div', { class: 'smart-box', hidden: true },
    ['kr1', 'kr2', 'kr3'].map((n, i) => h('input', { type: 'text', name: n, class: 'grow', placeholder: `KPI ${i + 1} (task, optional)`, maxlength: 120, 'aria-label': `KPI ${i + 1}` })));
  // Créer une section, avec sa première tâche et son projet (ou un nouveau projet, créé ici)
  const projSel = picker('project', [['', 'Project *'], ...state.projects.map(p => [p.id, p.name]), ['__new', '+ New project…']], pickedProject || '', 'Project of the section');
  projSel.addEventListener('change', () => {
    if (projSel.value !== '__new') return;
    projSel.value = '';
    askName(projSel, 'New project name', name => {
      const active = false;
      const p = { id: uid(), name, status: active ? 'active' : 'waiting', type: '', due: '', sections: [], triggers: [], tools: [], answers: {} };
      state.projects.push(p);
      pickedProject = p.id;
      save();
    });
  });
  const add = h('div', { class: 'card' },
    form(f => {
      const name = f.elements.name.value.trim();
      // Objectif = la section ; ses résultats clés (OKR) = ses tâches
      const krs = ['kr1', 'kr2', 'kr3'].map(n => f.elements[n].value.trim()).filter(Boolean);
      pickedProject = f.elements.project.value;
      const p = state.projects.find(x => x.id === pickedProject);
      if (!p) return toast('Pick a project first: a section always belongs to one.');
      if (!name) return toast('Name the section first.');
      p.sections.push({ id: uid(), name, dod: '', tasks: krs.map(text => ({ id: uid(), text, done: false })) });
      save();
      document.querySelector('#sections input[name=name]').focus();
    },
      h('input', { type: 'text', name: 'name', class: 'grow', placeholder: 'Objective (section name) *', maxlength: 60, 'aria-label': 'Objective: section name' }),
      h('button', { class: 'ghost', type: 'button', 'aria-expanded': 'false', onclick: e => {
        kpiBox.hidden = !kpiBox.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!kpiBox.hidden));
        e.currentTarget.textContent = kpiBox.hidden ? '+ KPI' : '− KPI';
      } }, '+ KPI'),
      kpiBox,
      projSel,
      h('button', { class: 'btn' }, 'Add')));

  const groups = state.projects.filter(p => live(p).length).flatMap(p =>
    [h('h2', { class: 'group' }, p.name), ...live(p).map(s => sectionCard(p, s))]);

  // Les déclencheurs ne se créent que depuis une section ou une tâche (bouton « Récur. ») ; on les gère ici
  const recurring = state.projects.filter(p => p.triggers?.length).map(p => h('div', { class: 'card' },
    h('strong', {}, `Recurrences · ${p.name}`),
    h('ul', { class: 'secs' }, p.triggers.map(tr => h('li', {},
      h('span', {}, triggerLabel(tr)),
      h('button', { class: 'icon', 'aria-label': `Delete recurrence ${triggerLabel(tr)}`,
        onclick: () => { p.triggers = p.triggers.filter(x => x !== tr); save(); } }, '×'))))));
  document.getElementById('sections').replaceChildren(avancementCard(), add, ...recurring,
    ...(groups.length || !state.projects.length ? groups : [h('p', { class: 'empty' }, 'No sections yet. Add one to a project.')]));
}

/* ---------- Projects : vue d'ensemble ---------- */
function projectCard(p) {
  const all = live(p).flatMap(s => s.tasks);
  const left = all.length - doneCount(all);
  const archived = p.sections.filter(s => s.archived);
  const late = p.due && p.status !== 'finished' && p.due < key(new Date());

  const meta = [
    p.due && `Due: ${fmt(new Date(p.due + 'T00:00'), { day: 'numeric', month: 'long', year: 'numeric' })}${late ? ' (overdue)' : ''}`,
  ].filter(Boolean).join(' · ');

  // Glisser une tâche sur le projet : elle rejoint sa première section (ou « General » s'il n'en a pas)
  return h('details', { class: 'card proj-fold', 'data-drop': '', ...foldable('proj-' + p.id, {}), ...(editing === 'p:' + p.id ? { open: true } : {}), ondragover: e => e.preventDefault(), ondrop: e => {
    e.preventDefault();
    const hit = findTask(e.dataTransfer.getData('text/plain'));
    if (!hit || hit.p === p) return;
    hit.s.tasks = hit.s.tasks.filter(x => x !== hit.t);
    if (!p.sections.length) p.sections.push({ id: uid(), name: 'General', tasks: [] });
    p.sections[0].tasks.push(hit.t);
    save();
    toast(`Moved to "${p.name}".`);
  } },
    h('summary', {}, h('h3', { class: 'grow' }, p.name), h('span', { class: 'muted' }, ` ${doneCount(all)}/${all.length}`)),
    editing === 'p:' + p.id ? editForm(f => {
      const name = f.elements.name.value.trim();
      if (!name) return;
      if (!f.elements.due.value) return toast('Every project needs an end date.');
      Object.assign(p, {
        name, due: f.elements.due.value, moscow: f.elements.moscow.value,
        deliverable: f.elements.deliverable.value.trim(), next: f.elements.next.value.trim(), waiting: f.elements.waiting.value.trim(),
        where: f.elements.where.value.trim(), block: f.elements.block.value.trim(), skills: f.elements.skills.value.trim(),
      });
      editing = null;
      save();
    },
      h('input', { type: 'text', name: 'name', class: 'grow', value: p.name, maxlength: 80, 'aria-label': 'Project name', 'data-edit': true }),
      h('label', { class: 'dateField' }, h('span', { class: 'muted' }, 'End date *'), h('input', { type: 'date', name: 'due', value: p.due || '', required: true, 'aria-label': 'End date (required)' })),
      picker('moscow', MOSCOW, p.moscow || '', 'MoSCoW'),
      h('input', { type: 'text', name: 'deliverable', class: 'grow', value: p.deliverable || '', placeholder: 'Expected deliverable', maxlength: 120, 'aria-label': 'Expected deliverable' }),
      h('input', { type: 'text', name: 'where', class: 'grow', value: p.where || '', placeholder: 'Where I am', maxlength: 200, 'aria-label': 'Where I am' }),
      h('input', { type: 'text', name: 'block', class: 'grow', value: p.block || '', placeholder: 'What is blocking', maxlength: 200, 'aria-label': 'What is blocking' }),
      h('input', { type: 'text', name: 'next', class: 'grow', value: p.next || '', placeholder: 'Next action (30 min max, starts with a verb)', maxlength: 120, 'aria-label': 'Next action' }),
      h('input', { type: 'text', name: 'waiting', class: 'grow', value: p.waiting || '', placeholder: 'Waiting on what, from whom', maxlength: 120, 'aria-label': 'What I am waiting for, and from whom' }),
      h('input', { type: 'text', name: 'skills', class: 'grow', value: p.skills || '', placeholder: 'Skills to use', maxlength: 160, 'aria-label': 'Skills to use' }))
    : h('div', { class: 'proj-head' },
      h('div', { class: 'grow' }, h('span', { class: 'muted' + (late ? ' late' : '') }, meta)),
      h('select', { 'aria-label': 'Statut', onchange: e => { p.status = e.target.value; save(); } },
        STATUSES.map(([v, l]) => h('option', { value: v, selected: p.status === v }, l))),
      editButton('p:' + p.id, `Edit project ${p.name}`),
      h('button', {
        class: 'icon', 'aria-label': `Delete ${p.name}`,
        onclick: () => askDeleteProject(p),
      }, '×')),
    // Sections et tâches juste sous l'en-tête : on crée tout ici, sans descendre
    // Le formulaire d'ajout de section est replié, pour ne pas multiplier les champs (Hick)
    h('details', foldable('addsec-' + p.id, { class: 'add-sec' }), h('summary', {}, '+ Add a section'), form(f => {
      const name = f.elements.section.value.trim();
      if (!name) return;
      const s = { id: uid(), name, tasks: [] };
      p.sections.push(s);
      openIds.add(s.id); // on ouvre la nouvelle section pour y saisir ses tâches
      save();
      document.querySelector(`[data-ptask="${s.id}"]`).focus();
    },
      h('input', { type: 'text', name: 'section', class: 'grow', placeholder: 'Add a section *', maxlength: 60, 'aria-label': `New section in ${p.name}` }),
      h('button', { class: 'btn' }, 'Add'))),
    live(p).length > 1 ? h('div', { class: 'row' },
      h('button', { class: 'ghost', type: 'button', onclick: () => { live(p).forEach(s => openIds.add(s.id)); render(); } }, 'Expand all sections'),
      h('button', { class: 'ghost', type: 'button', onclick: () => { live(p).forEach(s => openIds.delete(s.id)); render(); } }, 'Collapse all sections')) : null,
    live(p).length
      ? h('ul', { class: 'secs' }, live(p).map(s => h('li', {},
          h('details', foldable(s.id, { class: 'grow' }),
            h('summary', { class: 'row' },
              h('span', { class: 'grow' }, s.name),
              h('span', { class: 'muted' }, `${doneCount(s.tasks)}/${s.tasks.length}`),
              recurButton(p, { mode: 'section', name: s.name, tasks: s.tasks.map(t => t.text) }, `section ${s.name}`),
              h('button', { class: 'icon', type: 'button', 'aria-label': `Delete section ${s.name}`,
                onclick: e => { e.preventDefault(); e.stopPropagation(); deleteSection(p, s); } }, '×')),
                    h('ul', { class: 'tasks' }, ordered(s.tasks).map(t => taskItem(s, t))),
            form(f => {
              const text = f.elements.task.value.trim();
              if (!text) return;
              s.tasks.push({ id: uid(), text, done: false });
              save();
              document.querySelector(`[data-ptask="${s.id}"]`).focus();
            },
              h('input', { type: 'text', name: 'task', class: 'grow', placeholder: 'Add a task *', maxlength: 120, 'aria-label': `New task in ${s.name}`, 'data-ptask': s.id }),
              h('button', { class: 'btn' }, 'Add'))))))
      : null,
    [['MoSCoW', (MOSCOW.find(([v]) => v === p.moscow) || [])[1]], ['Skills to use', p.skills], ['Deliverable', p.deliverable], ['Where I am', p.where], ['Next action', p.next], ['Blocked by', p.block], ['Waiting on', p.waiting]]
      .filter(([, v]) => v).map(([l, v]) => fact(l, v)),
    p.status !== 'finished' && !p.next
      ? h('p', { class: 'note' }, 'No next action: add one with the pencil (30 min at most, starting with a verb).') : null,
    progress(all, 'No tasks'),
    all.length ? h('p', { class: 'note' }, left ? `${plural(left, 'task')} left` : 'All done!') : null,
    archived.length ? h('details', foldable('arc-' + p.id, { class: 'archives' }),
      h('summary', {}, `Archives (${plural(archived.length, 'section')} done)`),
      h('ul', { class: 'secs' }, archived.map(s => h('li', {},
        h('span', {}, `${s.name} · ${plural(s.tasks.length, 'task')}, done on ${shortDate(s.doneAt)}`),
        h('button', { class: 'ghost', onclick: () => { s.archived = false; s.doneAt = key(today()); save(); } }, 'Restaurer'))))) : null,
  );
}

function renderProjects() {
  // Nouveau projet : nom, fin obligatoire, puis création
  const add = h('div', { class: 'card' }, form(f => {
    const name = f.elements.name.value.trim();
    if (!name) return;
    if (!f.elements.due.value) return toast('Set an end date for the project first.');
    const status = f.elements.status.value;
    if (!status) return toast('Choose Finished or Break.');
    state.projects.push({ id: uid(), name, status, moscow: f.elements.moscow.value, due: f.elements.due.value, skills: f.elements.skills.value.trim(), sections: [], triggers: [], tools: [], answers: {} });
    save();
  },
    h('input', { type: 'text', name: 'name', class: 'grow', placeholder: 'Project name *', maxlength: 80, 'aria-label': 'Project name' }),
    picker('moscow', MOSCOW, '', 'MoSCoW'),
    h('select', { name: 'status', required: true, 'aria-label': 'Status (required)' }, h('option', { value: '' }, 'Status *'), STATUSES.map(([v, l]) => h('option', { value: v }, l))),
    h('input', { type: 'text', name: 'skills', class: 'grow', placeholder: 'Skills to use', maxlength: 160, 'aria-label': 'Skills to use' }),
    h('label', { class: 'dateField' }, h('span', { class: 'muted' }, 'End date *'), h('input', { type: 'date', name: 'due', required: true, 'aria-label': 'End date (required)' })),
    h('div', { class: 'chips' }, [['1 week', 7], ['1 month', 30], ['3 months', 90]].map(([l, d]) => h('button', { class: 'ghost', type: 'button', onclick: e => { e.currentTarget.form.elements.due.value = key(addDays(today(), d)); } }, l))),
    h('button', { class: 'btn' }, 'Create project')));


  const groups = STATUSES.flatMap(([v, label]) => {
    const list = state.projects.filter(p => p.status === v);
    return list.length ? [h('h2', { class: 'group ' + v }, `${label} (${list.length})`), ...list.map(projectCard)] : [];
  });

  document.getElementById('projects').replaceChildren(avancementCard(), add,
    ...(groups.length ? groups : [h('p', { class: 'empty' }, 'No projects yet. Create one in the form above.')]));
}

/* ---------- Calendar : échéances, jours prévus et tâches faites, mois par mois ---------- */
let calMonth = new Date(today().getFullYear(), today().getMonth(), 1);
let calDay = key(today());
function renderCalendar() {
  const root = document.getElementById('calendar');
  const items = {};
  const add = (k, it) => { if (k) (items[k] ||= []).push(it); };
  for (const { p, s, t } of tasks()) {
    const where = placeLabel({ p, s });
    add(t.due, { id: t.id, kind: 'due', text: t.text, done: !!t.done, where });
    add(t.today, { id: t.id, kind: 'planned', text: t.text, done: !!t.done, where, mins: t.mins || 0 });
    if (t.done && t.doneAt) add(t.doneAt, { id: t.id, kind: 'done', text: t.text, done: true, where });
  }
  const first = calMonth;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // la semaine commence le lundi
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'cell empty' }));
  for (let d = 1; d <= days; d++) {
    const k = key(new Date(first.getFullYear(), first.getMonth(), d));
    const list = items[k] || [];
    cells.push(h('button', {
      class: 'cell' + (k === key(today()) ? ' now' : '') + (k === calDay ? ' sel' : ''), type: 'button',
      'aria-label': `${fmt(new Date(k + 'T00:00'), { weekday: 'long', day: 'numeric', month: 'long' })}, ${plural(list.length, 'task')}`,
      title: `${hm(list.reduce((n, it) => n + (it.mins || 0), 0))} planned`,
      'data-drop': '',
      // Glisser une tâche sur ce jour pour la prévoir ce jour-là
      ondragover: e => e.preventDefault(),
      ondrop: e => {
        e.preventDefault();
        const hit = findTask(e.dataTransfer.getData('text/plain'));
        if (!hit) return;
        hit.t.today = k;
        save();
        toast(`Planned for ${fmt(new Date(k + 'T00:00'), { weekday: 'long', day: 'numeric', month: 'long' })}.`);
      },
      onclick: () => { calDay = k; renderCalendar(); nextDayDialog(k); },
    }, h('span', { class: 'num' }, String(d)), list.length ? h('span', { class: 'count' }, String(list.length)) : null));
  }
  const dayItems = items[calDay] || [];
  const kindLabel = { due: 'due', planned: 'planned', done: 'done' };
  root.replaceChildren(
    h('div', { class: 'toolbar' },
      h('button', { class: 'ghost', 'aria-label': 'Previous month', onclick: () => { calMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1); renderCalendar(); } }, '‹'),
      h('strong', {}, fmt(first, { month: 'long', year: 'numeric' })),
      h('button', { class: 'ghost', 'aria-label': 'Next month', onclick: () => { calMonth = new Date(first.getFullYear(), first.getMonth() + 1, 1); renderCalendar(); } }, '›')),
    h('p', { class: 'note' }, (() => { const pre = key(first).slice(0, 7); const ts = tasks().map(x => x.t).filter(t => (t.today || '').startsWith(pre)); const est = ts.reduce((n, t) => n + (t.mins || 0), 0); return `This month: ${plural(ts.length, 'task')} planned · ${hm(est)} estimated.`; })()),
    h('p', { class: 'note' }, 'Drag a task from the Tasks tab onto a day to plan it. Click a day to see its hours.'),
    h('div', { class: 'grid-head' }, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => h('span', {}, d))),
    h('div', { class: 'grid' }, cells),
    methodCard(TIME_BLOCKING),
    h('div', { class: 'card' },
      h('strong', {}, fmt(new Date(calDay + 'T00:00'), { weekday: 'long', day: 'numeric', month: 'long' })),
      dayItems.length
        ? h('ul', { class: 'secs' }, dayItems.map(it => h('li', it.kind === 'planned' ? { draggable: 'true', title: 'Drag onto another day to move it', ondragstart: e => e.dataTransfer.setData('text/plain', it.id) } : {},
          h('span', { class: it.done ? 'done' : '' }, it.text),
          h('small', { class: 'ctx' }, ` ${kindLabel[it.kind]} · ${it.where}`))))
        : h('p', { class: 'empty' }, 'Nothing scheduled this day.'),
      ...dayNotes(calDay)));
}

// Google Agenda (lecture seule). Identifiant client OAuth : voir la note dans le README.
const GCAL_CLIENT_ID = ''; // ex. '1234-abc.apps.googleusercontent.com'
let gcalToken = null;
function gcalConnect(then) {
  if (!GCAL_CLIENT_ID) return toast('Google Agenda: add your OAuth client ID (GCAL_CLIENT_ID) in the file.');
  const go = () => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: 'https://www.googleapis.com/auth/calendar.readonly',
      callback: r => { if (r.access_token) { gcalToken = r.access_token; then(); } else toast('Google Agenda is not connected: access was refused. Click Connect again and allow access.'); },
    });
    client.requestAccessToken();
  };
  if (window.google?.accounts?.oauth2) return go();
  document.head.append(h('script', { src: 'https://accounts.google.com/gsi/client', async: true, onload: go }));
}
async function gcalDay(dateKey) {
  const start = new Date(dateKey + 'T00:00:00'), end = addDays(start, 1);
  const q = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', orderBy: 'startTime' });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: { Authorization: `Bearer ${gcalToken}` } });
  if (r.status === 401) { gcalToken = null; throw new Error('Reconnect Google Agenda.'); }
  if (!r.ok) throw new Error(`Google Agenda error ${r.status}`);
  return (await r.json()).items || [];
}
// Agenda d'une journée : une grille horaire. On dessine un bloc en glissant sur les heures,
// puis on y dépose une tâche ou on le nomme. Les événements Google s'affichent en gris.
const AG_PX = 48, AG_START = 7 * 60, AG_END = 22 * 60; // une heure = 48 px, de 7 h à 22 h
const agMinutes = y => Math.min(AG_END, AG_START + Math.round(y / AG_PX * 4) * 15); // pas de 15 min
const agHM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function dayAgenda(dateKey, refresh) {
  const grid = h('div', { class: 'agenda-grid', style: `height:${(AG_END - AG_START) / 60 * AG_PX}px` });
  const place = (el, a, b) => {
    el.style.top = `${(a - AG_START) / 60 * AG_PX}px`;
    el.style.height = `${(b - a) / 60 * AG_PX}px`;
    return el;
  };
  for (let hr = 7; hr < 22; hr++) {
    grid.append(h('div', { class: 'hour-line', style: `top:${(hr * 60 - AG_START) / 60 * AG_PX}px` },
      h('span', {}, `${String(hr).padStart(2, '0')}:00`)));
  }
  const taskText = id => tasks().find(x => x.t.id === id)?.t.text || '';
  for (const b of (state.blocks || []).filter(x => x.date === dateKey)) {
    grid.append(place(h('div', { class: 'block', 'data-drop': '', ondragover: e => e.preventDefault(), ondrop: e => {
      e.preventDefault();
      const hit = findTask(e.dataTransfer.getData('text/plain'));
      if (!hit) return;
      b.taskId = hit.t.id;
      hit.t.today = dateKey;
      save(); refresh();
    } },
      h('b', {}, `${agHM(b.start)}–${agHM(b.end)}`),
      h('span', {}, b.taskId ? taskText(b.taskId) : (b.label || 'Drop a task here')),
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Delete block', onclick: e => {
        e.stopPropagation();
        state.blocks = state.blocks.filter(x => x !== b);
        save(); refresh();
      } }, '×')), b.start, b.end));
  }
  // Dessiner : glisser de haut en bas sur la grille
  let drag = null, pendingBlock = null, pendingPanel = null;
  const yOf = e => e.clientY - grid.getBoundingClientRect().top;
  grid.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.block')) return;
    drag = { y0: yOf(e), el: h('div', { class: 'block preview' }) };
    grid.append(drag.el);
    try { grid.setPointerCapture(e.pointerId); } catch { /* le geste continue sans capture */ }
  });
  grid.addEventListener('pointermove', e => {
    if (!drag) return;
    const y1 = yOf(e), a = Math.min(drag.y0, y1), b = Math.max(drag.y0, y1);
    drag.el.style.top = `${a}px`;
    drag.el.style.height = `${b - a}px`;
  });
  grid.addEventListener('pointerup', e => {
    if (!drag) return;
    const y1 = yOf(e), a = agMinutes(Math.min(drag.y0, y1)), b = agMinutes(Math.max(drag.y0, y1));
    const chosen = drag.el;
    drag = null;
    if (b - a < 15) { chosen.remove(); return; }
    // Le créneau reste en couleur pendant qu'on choisit la tâche ou son nom, juste en dessous
    if (pendingPanel) pendingPanel.remove();
    if (pendingBlock) pendingBlock.remove();
    pendingBlock = chosen;
    chosen.className = 'block chosen';
    const pick = h('select', { 'aria-label': 'Task for this block' },
      h('option', { value: '' }, 'Choose a task…'),
      tasks().filter(x => !x.t.done).map(x => h('option', { value: x.t.id }, `${x.t.text} · ${durationText(x.t)}`)));
    const name = h('input', { type: 'text', placeholder: 'or name the block', 'aria-label': 'Block name', maxlength: 60 });
    const cancel = () => { chosen.remove(); panel.remove(); pendingBlock = null; pendingPanel = null; };
    const panel = h('div', { class: 'block-pick' }, pick, name,
      h('button', { class: 'btn', type: 'button', onclick: () => {
        if (!pick.value && !name.value.trim()) return toast('Choose a task or name the block first.');
        (state.blocks ||= []).push({ id: uid(), date: dateKey, start: a, end: b, label: name.value.trim(), taskId: pick.value || null });
        if (pick.value) { const hit = findTask(pick.value); if (hit) hit.t.today = dateKey; }
        pendingBlock = null; pendingPanel = null;
        save(); refresh();
      } }, 'Add to block'),
      h('button', { class: 'ghost', type: 'button', onclick: cancel }, 'Cancel'));
    pendingPanel = panel;
    grid.after(panel);
    pick.focus();
  });
  // Événements Google (lecture seule), affichés en gris à leur heure
  grid.addEvents = items => {
    for (const ev of items) {
      const s = new Date(ev.start.dateTime), en = new Date(ev.end.dateTime);
      const a = s.getHours() * 60 + s.getMinutes(), b = Math.max(en.getHours() * 60 + en.getMinutes(), a + 15);
      grid.append(place(h('div', { class: 'block gcal' }, h('b', {}, `${agHM(a)}–${agHM(b)}`), h('span', {}, ev.summary || '(no title)')), a, b));
    }
  };
  return grid;
}

// Au clic sur un jour : ce qui est à faire le lendemain, et l'agenda Google de ce jour-là, heure par heure
function nextDayDialog(k) {
  const next = key(addDays(new Date(k + 'T00:00'), 1));
  const list = [];
  for (const { p, s, t } of tasks()) {
    if (t.due === next || t.today === next) list.push({ id: t.id, text: t.text, kind: t.due === next ? 'due' : 'planned', done: !!t.done, where: placeLabel({ p, s }) });
  }
  // Échéances du jour : projets et sections
  const deadlines = [];
  for (const p of state.projects) {
    if (p.due === next) deadlines.push(`Project deadline: ${p.name}`);
    for (const s of p.sections) if (s.due === next) deadlines.push(`Section deadline: ${s.name} (${p.name})`);
  }
  const hm2 = x => new Date(x).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const refresh = () => nextDayDialog(k);
  const timeline = dayAgenda(next, refresh);
  const agenda = h('div', { class: 'agenda' });
  if (gcalToken) agenda.replaceChildren(h('p', { class: 'muted' }, 'Loading the agenda…'));
  else agenda.replaceChildren(h('button', { class: 'ghost', type: 'button', onclick: () => gcalConnect(() => nextDayDialog(k)) }, 'Connect Google Agenda'));
  // Créer une tâche directement pour ce jour
  const text = h('input', { type: 'text', name: 'text', placeholder: 'Task name *', maxlength: 120, 'aria-label': 'Task name (required)' });
  const pSel = h('select', { name: 'project', 'aria-label': 'Project' },
    h('option', { value: '' }, 'Project *'), state.projects.map(p => h('option', { value: p.id }, p.name)));
  const sSel = h('select', { name: 'section', 'aria-label': 'Section' }, h('option', { value: '' }, 'Section *'));
  pSel.addEventListener('change', () => {
    const p = state.projects.find(x => x.id === pSel.value);
    sSel.replaceChildren(h('option', { value: '' }, 'Section *'), ...(p ? p.sections.map(s => h('option', { value: s.id }, s.name)) : []));
  });
  const addForm = h('form', { class: 'row', onsubmit: e => {
    e.preventDefault();
    const v = text.value.trim();
    const s = state.projects.find(x => x.id === pSel.value)?.sections.find(x => x.id === sSel.value);
    if (!v || !s) return toast('Write the task, then choose its project and section.');
    s.tasks.push({ id: uid(), text: v, done: false, today: next });
    save();
    nextDayDialog(k);
  } }, text, pSel, sSel, h('button', { class: 'btn' }, 'Add'));

  let dlg = document.getElementById('day-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'day-dialog', class: 'banner-picker', 'aria-label': 'Tomorrow' }); document.body.append(dlg); }
  dlg.replaceChildren(
    h('button', { class: 'icon', type: 'button', 'aria-label': 'Close', title: 'Close',
      style: 'position: absolute; top: 8px; right: 10px; font-size: 1.5rem; line-height: 1;', onclick: () => dlg.close() }, '×'),
    h('strong', {}, `To do on ${fmt(new Date(next + 'T00:00'), { weekday: 'long', day: 'numeric', month: 'long' })}`),
    ...(deadlines.length ? [h('ul', { class: 'secs' }, deadlines.map(d => h('li', {}, h('b', {}, d))))] : []),
    h('strong', {}, 'Hours'),
    timeline,
    h('strong', {}, 'Tasks'),
    list.length
      ? h('ul', { class: 'secs' }, list.map(it => h('li', it.kind === 'planned' ? { draggable: 'true', title: 'Drag onto an hour block to attach it', ondragstart: e => e.dataTransfer.setData('text/plain', it.id) } : {},
          h('span', { class: it.done ? 'done' : '' }, it.text),
          h('small', { class: 'ctx' }, ` ${it.kind} · ${it.where}`))))
      : h('p', { class: 'empty' }, 'Nothing planned for that day.'),
    addForm,
    h('strong', {}, 'Google Agenda'), ...(gcalToken ? [h('button', { class: 'ghost', type: 'button', onclick: () => nextDayDialog(k) }, 'Refresh')] : []),
    agenda,
    h('div', { class: 'row' }, h('button', { class: 'ghost', type: 'button', onclick: () => dlg.close() }, 'Close')));
  if (!dlg.open) dlg.showModal(); // une seule fenêtre à la fois, par-dessus la page
  if (gcalToken) {
    gcalDay(next).then(items => {
      const allDay = items.filter(e => e.start?.date).map(e => h('li', {}, h('b', {}, 'All day'), ` · ${e.summary || '(no title)'}`));
      const timed = items.filter(e => e.start?.dateTime);
      timeline.addEvents(timed);
      agenda.replaceChildren(allDay.length ? h('ul', { class: 'secs' }, allDay) : h('p', { class: 'muted' }, 'No all-day event.'));
    }).catch(err => agenda.replaceChildren(h('p', { class: 'muted' }, err.message)));
  }
}

/* ---------- Week : bilan de la semaine et audit des 168 heures ---------- */
// Vue Semaine : les tâches prévues pour chacun des sept jours
function weekGrid(days) {
  const open = tasks().filter(x => !x.t.done);
  return h('div', { class: 'card' },
    h('strong', {}, 'Planned this week'),
    h('div', { class: 'week-cols' }, days.map(d => {
      const k = key(d), list = open.filter(x => x.t.today === k);
      return h('div', { class: 'week-col' },
        h('b', {}, fmt(d, { weekday: 'short', day: 'numeric' })),
        list.length ? h('ul', { class: 'secs' }, list.map(x => h('li', {}, x.t.text))) : h('p', { class: 'muted' }, 'Nothing'));
    })));
}
// Petit bouton « ? » : une explication courte du terme à côté
const helpBtn = (term, text) => h('button', { class: 'icon', type: 'button', 'aria-label': `What is ${term}?`, title: `What is ${term}?`, onclick: () => popupRule(term, text) }, '?');
// Accueil : une seule étape à la fois, selon ce qui manque
function renderHomeNext() {
  const box = document.getElementById('home-next');
  if (!box) return;
  const hasSection = state.projects.some(p => p.sections.length);
  const hasTask = [state.inbox, ...state.projects.flatMap(p => p.sections)].some(s => s.tasks.length);
  const k = key(today());
  const plannedToday = [state.inbox, ...state.projects.flatMap(p => p.sections)].flatMap(s => s.tasks).some(t => t.today === k);
  let step = null;
  if (!state.projects.length) step = ['Step 1 of 4: create a project', 'Give it a name and an end date.', 'plan'];
  else if (!hasSection) step = ['Step 2 of 4: add a section', 'A section holds the tasks of one project.', 'plan'];
  else if (!hasTask) step = ['Step 3 of 4: add a task', 'Write one task in a section, with its duration.', 'plan'];
  else if (!plannedToday) step = ['Step 4 of 4: plan today', 'Pick the tasks for today in the slots on Today.', 'today'];
  box.replaceChildren(...(step ? [h('div', { class: 'card stack' },
    h('strong', {}, step[0]),
    h('p', { class: 'muted' }, step[1]),
    h('button', { class: 'btn', type: 'button', onclick: () => showTab(step[2]) }, step[2] === 'today' ? 'Go to Today' : 'Go to Projects'))] : []));
}
function renderWeek() {
  const mon = addDays(mondayOf(today()), weekOffset * 7);
  const days = [...Array(7)].map((_, i) => addDays(mon, i)), keys = days.map(key);
  const inWeek = k => !!k && k >= keys[0] && k <= keys[6];
  const dayLabel = d => fmt(d, { weekday: 'short', day: 'numeric' });
  const stat = (label, value, max, text, soft) => h('div', { class: 'stat' },
    h('span', {}, label),
    h('div', { class: 'bar' + (soft ? ' soft' : '') }, h('i', { style: `width:${max ? Math.round(value / max * 100) : 0}%` })),
    h('span', {}, text));

  // Tâches terminées (le jour est noté au moment où on coche ; les anciennes tâches cochées n'en ont pas)
  const groups = [[INBOX.name, state.inbox.tasks],...state.projects.map(p => [p.name, p.sections.flatMap(s => s.tasks)])];
  const done = groups.flatMap(([proj, list]) => list.filter(t => t.done && inWeek(t.doneAt)).map(t => ({ t, proj })));
  const perDay = keys.map(k => done.filter(x => x.t.doneAt === k).length);
  const perProj = [...new Set(done.map(x => x.proj))].map(p => [p, done.filter(x => x.proj === p).length]).sort((a, b) => b[1] - a[1]);

  // Temps mesuré par les minuteurs
  const log = state.log.filter(e => inWeek(e.date));
  const sum = (list, kind) => list.filter(e => !kind || e.kind === kind).reduce((n, e) => n + e.mins, 0);
  const focus = sum(log, 'focus'), urgent = sum(log, 'urgent'), tracked = focus + urgent, total = 168 * 60;
  const projTime = [...new Set(log.map(e => e.proj || 'No project'))]
    .map(p => [p, sum(log.filter(e => (e.proj || 'No project') === p))]).sort((a, b) => b[1] - a[1]);

  // Rituels
  const ritual = f => keys.filter(k => state.days[k]?.[f]).length;
  const dots = (label, f) => h('p', { class: 'dots', 'aria-label': `${label}: ${plural(ritual(f), 'day')} out of 7` },
    h('b', {}, label), keys.map(k => state.days[k]?.[f] ? '●' : '○').join(' '));

  // Précision des estimations
  const timed = done.filter(x => x.t.mins && x.t.spent);
  const est = timed.reduce((n, x) => n + x.t.mins, 0), real = timed.reduce((n, x) => n + x.t.spent, 0);

  const summary = [
    `Week ${isoWeek(mon)}`,
    `Tasks done: ${done.length}${perProj.length ? ` (${perProj.map(([p, n]) => `${p} ${n}`).join(', ')})` : ''}`,
    `Time tracked: focus ${hm(focus)}, urgent ${hm(urgent)}`,
    `Rituals: start ${ritual('start')}/7, close ${ritual('close')}/7`,
  ].join('\n');
  const box = h('textarea', { class: 'small', readonly: true, 'aria-label': 'Summary as text' }, summary);

  const nav = h('div', { class: 'card' },
    h('div', { class: 'toolbar' },
      h('button', { class: 'ghost', 'aria-label': 'Previous week', onclick: () => { weekOffset--; render(); } }, '‹'),
      h('strong', {}, `Week ${isoWeek(mon)} · ${shortDate(keys[0])} to ${shortDate(keys[6])}`),
      h('button', { class: 'ghost', 'aria-label': 'Next week', disabled: weekOffset >= 0, onclick: () => { weekOffset++; render(); } }, '›')),
    weekOffset ? h('button', { class: 'ghost', onclick: () => { weekOffset = 0; render(); } }, 'Back to this week') : null);

  document.getElementById('week').replaceChildren(nav, weekGrid(days), weeklyReviewCard(mon), ...prepBlocks(),
    h('div', { class: 'card' },
      h('strong', {}, `Tasks done (${done.length})`),
      done.length ? null : h('p', { class: 'muted' }, 'Nothing ticked this week yet. Tick a task when it is done to see it here.'),
      days.map((d, i) => stat(dayLabel(d), perDay[i], Math.max(...perDay, 1), String(perDay[i]))),
      perProj.length ? h('p', { class: 'note' }, 'By project') : h('p', { class: 'note' }, 'Nothing checked off this week.'),
      perProj.map(([p, n]) => stat(p, n, perProj[0][1], String(n)))),
    h('div', { class: 'card' },
      h('strong', {}, 'Rituels'),
      dots('Start', 'start'), dots('Close', 'close'),
      h('p', { class: 'muted' }, `Start ${ritual('start')}/7 · Close ${ritual('close')}/7`)),
    h('div', { class: 'card' },
      h('strong', {}, 'Week journal'),
      days.filter(d => dayNotes(key(d)).length).length
        ? days.filter(d => dayNotes(key(d)).length).map(d => h('div', { class: 'reprise' }, h('b', {}, dayLabel(d)), ...dayNotes(key(d))))
        : h('p', { class: 'muted' }, 'No notes this week yet. Write them in the end-of-day ritual.')),
    h('div', { class: 'card' },
      h('strong', {}, 'Audit des 168 heures'),
      h('p', { class: 'muted' }, `Estimated ${hm(est)} · real ${hm(real)} on ${timed.length} finished task${timed.length > 1 ? 's' : ''} with both values.`),
      stat('Timer', focus, total, hm(focus)), stat('Urgence', urgent, total, hm(urgent)),
      stat('Not tracked', total - tracked, total, hm(total - tracked), true),
      h('p', { class: 'muted' }, 'Only time tracked by timers is counted: start a focus or an urgent block to fill the audit.'),
      projTime.length ? h('p', { class: 'note' }, 'Time by project') : null,
      projTime.map(([p, m]) => stat(p, m, projTime[0][1], hm(m)))),
    h('div', { class: 'card' },
      h('strong', {}, 'Estimate accuracy'),
      timed.length
        ? h('p', { class: 'fact' }, `${plural(timed.length, 'task')} estimated and timed: ${hm(real)} spent for ${hm(est)} planned (${Math.round(real / est * 100)}%).`)
        : h('p', { class: 'muted' }, 'Estimate a task\'s duration, time it with "Timer", then tick it off: the comparison will appear here.')),
    h('div', { class: 'card stack' },
      h('strong', {}, 'Summary as text'),
      box,
      h('button', { class: 'ghost', onclick: async () => {
        try { await navigator.clipboard.writeText(summary); toast('Summary copied.'); }
        catch { box.select(); toast('Text selected: copy it with Ctrl+C.'); }
      } }, 'Copier')));
}

/* ---------- Général ---------- */
function render() {
  renderToday(); renderTasks(); renderSections(); renderProjects(); renderHomeNext(); renderWeek(); renderCalendar(); renderTimer();
  document.querySelector('section:not([hidden]) [data-edit]')?.focus(); // champ en cours de modification
}


// Sauvegarde dans un fichier, et restauration
// Rappel de sauvegarde : affiché sur Today si le dernier export date de plus de 7 jours
function backupBanner() {
  const last = state.lastBackup;
  const days = last ? (today() - new Date(last + 'T00:00')) / 864e5 : Infinity;
  if (days < 7) return [];
  return [h('div', { class: 'card' },
    h('strong', {}, last ? `Last backup: ${shortDate(last)}` : 'No backup yet'),
    h('p', { class: 'muted' }, 'Export your data once a week, so nothing is lost.'),
    h('button', { class: 'btn', type: 'button', onclick: () => document.getElementById('export').click() }, 'Back up now'))];
}
function importData(data) {
  if (!data || !Array.isArray(data.projects)) throw new Error('format');
  state = normalize(data);
  editing = null;
  save();
}
document.getElementById('export').addEventListener('click', () => {
  state.lastBackup = key(new Date()); // date du dernier export, pour le rappel de sauvegarde
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  h('a', { href: url, download: `mes-projets-${key(new Date())}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
// Export CSV de toutes les tâches, pour un tableur
document.getElementById('csv').addEventListener('click', () => {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['project', 'section', 'task', 'done', 'estimate_min', 'spent_min', 'priority', 'planned', 'due'].join(',')];
  for (const { p, s, t } of tasks()) {
    rows.push([p.inbox ? 'Inbox' : p.name, s.name, t.text, t.done ? 'yes' : 'no', t.mins || '', t.spent || '', QUAD_TITLES[t.quad] || '', t.today || '', t.due || ''].map(esc).join(','));
  }
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  h('a', { href: url, download: `tasks-${key(new Date())}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const file = document.getElementById('file');
document.getElementById('import').addEventListener('click', () => file.click());
file.addEventListener('change', async () => {
  const picked = file.files[0];
  if (!picked) return;
  try {
    const data = JSON.parse(await picked.text());
    if (!Array.isArray(data?.projects)) throw new Error('format');
    if (confirm(`Replace all current data with the file's data (${plural(data.projects.length, 'project')})?`)) importData(data);
  } catch { alert('This file is not a valid backup.'); }
  file.value = '';
});

// Bannière du haut de page : plusieurs dessins, choisis avec le pinceau. « trees » est le défaut de la page.
const BANNER_URL = inner => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='360' height='60' viewBox='0 0 360 60'>${inner}</svg>`)}")`;
const BANNERS = [
  { id: 'trees', name: 'Fir trees and cabins (default)', css: null,
    preview: BANNER_URL(`<g fill='none' stroke='#111' stroke-width='1.2'><path d='M20 52 L30 26 L40 52 M30 52 V58 M70 52 L80 22 L90 52 M80 52 V58 M120 52 L128 30 L136 52'/><path d='M0 56 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0'/></g>`) },
  // Bandeaux sobres en traits fins : une seule idée par motif, beaucoup de vide
  // Bandeaux : une tuile de 360 px qui se répète sans couture, trait fin et régulier
  { id: 'books', name: 'Books', css: BANNER_URL(`<g fill='none' stroke='#111' stroke-width='1'>${Array.from({ length: 24 }, (_, i) => {
      const hgt = 20 + ((i * 7) % 5) * 4; return `<rect x='${i * 15 + 3}' y='${52 - hgt}' width='${6 + (i % 3)}' height='${hgt}'/>`; }).join('')}<path d='M0 52 H360'/></g>`),
    preview: null },
  { id: 'tea', name: 'Tea', css: BANNER_URL(`<g fill='none' stroke='#111' stroke-width='1' stroke-linecap='round'>${[30, 150, 270].map(cx =>
      `<path d='M${cx - 10} 46 H${cx + 10} V40 H${cx - 10} Z'/><path d='M${cx + 10} 42 q5 0 5 3 t-5 3'/><path d='M${cx - 4} 34 q-3 -4 0 -8 t0 -8'/><path d='M${cx + 3} 34 q-3 -4 0 -8 t0 -8'/>`).join('')}<path d='M0 52 H360'/></g>`),
    preview: null },
  { id: 'candle', name: 'Candle', css: BANNER_URL(`<g fill='none' stroke='#111' stroke-width='1' stroke-linecap='round'>${[30, 120, 210, 300].map(x =>
      `<rect x='${x - 5}' y='34' width='10' height='18'/><path d='M${x} 34 V30'/><path d='M${x} 30 q-2 -4 0 -8 q2 4 0 8z'/>`).join('')}<path d='M0 52 H360'/></g>`),
    preview: null },
  { id: 'leaves', name: 'Leaves', css: BANNER_URL(`<g fill='none' stroke='#111' stroke-width='1' stroke-linecap='round'><path d='M0 40 Q90 32 180 40 T360 40'/>${[30, 90, 150, 210, 270, 330].map((x, i) =>
      i % 2 ? `<path d='M${x} 40 q-6 -12 -16 -8 q6 12 16 8z'/>` : `<path d='M${x} 40 q6 -12 16 -8 q-6 12 -16 8z'/>`).join('')}</g>`),
    preview: null },
  { id: 'hills', name: 'Hills', css: BANNER_URL(`<g fill='none' stroke='#111' stroke-width='1'><path d='M0 46 Q45 34 90 46 T180 46 T270 46 T360 46'/><circle cx='300' cy='14' r='5'/></g>`),
    preview: null },
  { id: 'none', name: 'None', css: 'none', preview: 'none' },
];
function applyBanner() {
  const page = document.querySelector('.page');
  const b = BANNERS.find(x => x.id === (state.banner || 'none')) || BANNERS[0];
  if (!b.css) { // défaut : la bannière d'origine, définie dans la feuille de style
    page.style.backgroundImage = page.style.backgroundRepeat = page.style.backgroundPosition = page.style.backgroundSize = '';
    return;
  }
  page.style.backgroundImage = b.css;
  page.style.backgroundRepeat = 'repeat-x';
  page.style.backgroundPosition = '64px 28px';
  page.style.backgroundSize = 'auto 58px';
}
// Fond de la page : l'image choisie parmi les fonds enregistrés (state.backgrounds)
// Fonds par défaut (Unsplash) : le premier est affiché tant qu'on n'en choisit pas un autre
const BG_DEFAULTS = [
  { url: 'https://images.unsplash.com/photo-1722182877533-7378b60bf1e8?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D', name: 'Library' },
  { url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D', name: 'Café' },
  { url: 'https://images.unsplash.com/photo-1698870157085-11632d2ddef8?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D', name: 'Salon' },
];
const bgDefault = () => state.backgroundDefault || BG_DEFAULTS[0].url;
function applyBackground() {
  // La photo choisie, sinon la photo par défaut, sans voile
  const file = state.backgroundUrl || bgDefault();
  // On charge l'image d'abord : si le lien ne marche plus, la page reste blanche au lieu d'afficher un fond cassé
  const im = new Image();
  im.onload = () => { document.body.style.background = `url("${file}") center / cover fixed`; };
  im.onerror = () => { document.body.style.background = '#ffffff'; };
  im.src = file;
}

// Fenêtre du pinceau : un aperçu par bannière, celle en cours est entourée
function bannerPicker() {
  let dlg = document.getElementById('banner-dialog');
  if (!dlg) { dlg = h('dialog', { id: 'banner-dialog', class: 'banner-picker', 'aria-label': 'Page banner' }); document.body.append(dlg); }
  const current = state.banner || 'none';
  // Fonds de page : des cartes (les fonds par défaut et tes photos), et une carte pour en ajouter
  const bgAll = [
    ...BG_DEFAULTS.map(b => ({ url: b.url, name: b.name, photo: false })),
    ...(state.backgrounds || []).map((u, i) => ({ url: u, name: `Photo ${i + 1}`, photo: true })),
  ];
  const curBg = state.backgroundUrl || bgDefault();
  const bgCard = x => h('div', { class: 'bg-card' + (x.url === curBg ? ' on' : '') },
    h('button', { class: 'bg-pick', type: 'button', 'aria-pressed': String(x.url === curBg), 'aria-label': x.name,
      style: `background-image: url("${x.url}")`,
      onclick: () => { state.backgroundUrl = x.url; persist(); applyBackground(); bannerPicker(); } }),
    h('div', { class: 'bg-meta' },
      h('span', {}, `${x.name}${x.url === bgDefault() ? ' · default' : ''}`),
      h('button', { class: 'ghost', type: 'button', disabled: x.url === bgDefault(),
        onclick: () => { state.backgroundDefault = x.url; persist(); bannerPicker(); } }, 'Set as default'),
      x.photo ? h('button', { class: 'icon', type: 'button', 'aria-label': `Delete ${x.name}`, onclick: () => {
        state.backgrounds = state.backgrounds.filter(u => u !== x.url);
        if (state.backgroundUrl === x.url) state.backgroundUrl = '';
        if (state.backgroundDefault === x.url) state.backgroundDefault = '';
        persist(); applyBackground(); bannerPicker();
      } }, '×') : null));
  const bgAdd = h('form', { class: 'bg-card bg-add', onsubmit: async e => {
    e.preventDefault();
    const v = e.target.elements.url.value.trim();
    if (!/^https:\/\//.test(v)) return toast('The link must start with https://');
    // Vérifie que le lien est bien une image (et non une page web) avant de l'enregistrer
    const works = await new Promise(res => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = v; });
    if (!works) return toast('This link is not an image. On Unsplash: right-click the photo › Copy image address.');
    state.backgrounds = [...(state.backgrounds || []).filter(x => x !== v), v];
    state.backgroundUrl = v;
    persist(); applyBackground(); bannerPicker();
  } },
    h('input', { type: 'text', name: 'url', placeholder: 'Image link (https://…) *', 'aria-label': 'Image link (required)' }),
    h('button', { class: 'ghost', type: 'submit' }, '+ Add a photo'));

  dlg.replaceChildren(
    closeX(dlg),
    h('strong', {}, 'Page banner'),
    h('p', { class: 'muted' }, 'Pick a design. It applies right away.'),
    h('div', { class: 'opts' }, BANNERS.map(b => h('button', {
      type: 'button', class: 'opt', 'aria-pressed': String(b.id === current), 'aria-label': b.name,
      style: `background-image: ${b.preview || b.css || 'none'}`,
      onclick: () => { state.banner = b.id; persist(); applyBanner(); bannerPicker(); },
    }, h('span', {}, b.name)))),
    h('strong', {}, 'Page background'),
    h('div', { class: 'bg-grid' }, bgAll.map(bgCard), bgAdd),
    h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Close'));
  if (!dlg.open) dlg.showModal();
}

// Zones de dépôt : la zone survolée s'entoure d'un trait pendant le glisser
document.addEventListener('dragover', e => {
  const zone = e.target.closest?.('[data-drop]');
  document.querySelectorAll('.drop-on').forEach(z => { if (z !== zone) z.classList.remove('drop-on'); });
  zone?.classList.add('drop-on');
});
['drop', 'dragend'].forEach(ev => document.addEventListener(ev, () => {
  document.querySelectorAll('.drop-on').forEach(z => z.classList.remove('drop-on'));
}));
// Raccourcis : N ouvre la nouvelle tâche (hors champ de saisie) ; Échap ferme les fenêtres (natif)
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if (e.key === 'n' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    showTab('plan', 'tasks');
    document.querySelector('#tasks input[name=text]')?.focus();
  }
});
const tabs = [...document.querySelectorAll('.tabs button')];
// Deux niveaux : Today | Plan (Tasks, Sections, Projects) | Bilan (Review, Week)
const subOf = { plan: ['tasks', 'sections', 'projects'], bilan: ['week'] };
const currentSub = { plan: 'tasks', bilan: 'week' };
function showSub(group, id) {
  currentSub[group] = id;
  document.querySelectorAll(`.subtabs[data-group="${group}"] button`)
    .forEach(b => b.setAttribute('aria-selected', String(b.dataset.sub === id)));
  subOf[group].forEach(s => { document.getElementById(s).hidden = s !== id; });
}
function showTab(id, sub) {
  try { localStorage.setItem('tab', id); } catch { /* stockage indisponible : pas de mémoire d'onglet */ }
  tabs.forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === id)));
  ['home', 'today', 'plan', 'bilan', 'calendar'].forEach(s => { document.getElementById(s).hidden = s !== id; });
  if (subOf[id]) showSub(id, sub || currentSub[id]);
  scrollTo(0, 0);
}
tabs.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
// Boutons « Open … » de la page Home
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.go)));
// Au rechargement, on rouvre l'onglet où l'on était
try {
  const last = localStorage.getItem('tab');
  if (last && ['home', 'today', 'plan', 'bilan', 'calendar'].includes(last)) showTab(last);
} catch { /* pas de mémoire disponible */ }
document.querySelectorAll('.subtabs button').forEach(b =>
  b.addEventListener('click', () => showSub(b.closest('.subtabs').dataset.group, b.dataset.sub)));
showSub('plan', currentSub.plan);
showSub('bilan', currentSub.bilan);

const d = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
document.getElementById('page-title').textContent = d[0].toUpperCase() + d.slice(1);
runTriggers();
save();
setInterval(() => { if (runTriggers()) save(); }, 36e5); // si la page reste ouverte après minuit
setInterval(tickTimer, 1000);
applyBanner();
applyBackground();
buildMusic();
INBOX.name = state.inbox.name || INBOX.name;
 // minuteur : décompte, et fin automatique
