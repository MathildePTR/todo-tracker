// Tests des calculs de l'app (sans navigateur) : node --test tests/
// Lit le bloc marqué /* test:start */ … /* test:end */ dans app.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = html.indexOf('/* test:start */');
const end = html.indexOf('/* test:end */');
assert.ok(start >= 0 && end > start, 'bloc de test introuvable dans app.js');
const { ordered, priorityOf, isQuick } = new Function(html.slice(start, end) + '; return { ordered, priorityOf, isQuick };')();

// Les tâches sont { text, mins, quad, key } ; ordered reçoit des objets { t } comme dans l'app.
const wrap = t => ({ t });

test('une tâche de moins de 2 minutes passe avant toutes les autres', () => {
  const list = [wrap({ text: 'long', mins: 30 }), wrap({ text: 'vite', mins: 1 })];
  assert.deepEqual(ordered(list).map(x => x.t.text), ['vite', 'long']);
});

test('une tâche sans durée n’est pas considérée comme rapide', () => {
  assert.equal(isQuick(wrap({ text: 'x' })), false);
  assert.equal(isQuick(wrap({ text: 'x', mins: 2 })), false);
  assert.equal(isQuick(wrap({ text: 'x', mins: 1 })), true);
});

test('après les rapides, les 20 % clés passent avant le reste', () => {
  const list = [wrap({ text: 'normal', quad: 'do' }), wrap({ text: 'clé', quad: 'plan', key: true })];
  assert.deepEqual(ordered(list).map(x => x.t.text), ['clé', 'normal']);
});

test('à priorité égale, l’ordre d’origine est gardé', () => {
  const list = [wrap({ text: 'a', quad: 'plan' }), wrap({ text: 'b', quad: 'plan' }), wrap({ text: 'c', quad: 'plan' })];
  assert.deepEqual(ordered(list).map(x => x.t.text), ['a', 'b', 'c']);
});

test('l’ordre des quadrants d’Eisenhower : à faire maintenant d’abord', () => {
  const list = [wrap({ text: 'drop', quad: 'drop' }), wrap({ text: 'do', quad: 'do' }), wrap({ text: 'plan', quad: 'plan' }), wrap({ text: 'frame', quad: 'frame' })];
  assert.deepEqual(ordered(list).map(x => x.t.text), ['do', 'plan', 'frame', 'drop']);
});

test('une tâche sans quadrant passe après les quadrants renseignés', () => {
  const list = [wrap({ text: 'sans' }), wrap({ text: 'drop', quad: 'drop' })];
  assert.deepEqual(ordered(list).map(x => x.t.text), ['drop', 'sans']);
});

// Récurrences : triggerHits dit si une règle tombe un jour donné
const recurStart = html.indexOf('/* test:start:recur */');
const recurEnd = html.indexOf('/* test:end:recur */');
const mondayOf = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const { triggerHits } = new Function('mondayOf', html.slice(recurStart, recurEnd) + '; return { triggerHits };')(mondayOf);
const day = s => new Date(s + 'T12:00:00');

test('récurrence quotidienne : tous les jours', () => {
  const tr = { freq: 'daily', days: [], dom: 1, anchor: '2026-11-01' };
  assert.equal(triggerHits(tr, day('2026-11-12')), true);
  assert.equal(triggerHits(tr, day('2026-11-15')), true);
});

test('récurrence hebdomadaire : seulement les jours cochés (plusieurs jours)', () => {
  const tr = { freq: 'weekly', days: [1, 3], dom: 1, anchor: '2026-11-01' }; // lundi et mercredi
  assert.equal(triggerHits(tr, day('2026-11-16')), true);  // lundi
  assert.equal(triggerHits(tr, day('2026-11-18')), true);  // mercredi
  assert.equal(triggerHits(tr, day('2026-11-17')), false); // mardi
});

test('récurrence mensuelle : le jour du mois choisi', () => {
  const tr = { freq: 'monthly', days: [], dom: 10, anchor: '2026-11-01' };
  assert.equal(triggerHits(tr, day('2026-11-10')), true);
  assert.equal(triggerHits(tr, day('2026-11-11')), false);
});

test('mensuelle le 31 : tombe le dernier jour des mois plus courts', () => {
  const tr = { freq: 'monthly', days: [], dom: 31, anchor: '2026-01-01' };
  assert.equal(triggerHits(tr, day('2026-11-30')), true); // novembre a 30 jours
});

test('une semaine sur deux : seulement les semaines de même parité que l’ancrage', () => {
  const tr = { freq: 'biweekly', days: [1], dom: 1, anchor: '2026-11-09' }; // lundi 9 nov
  assert.equal(triggerHits(tr, day('2026-11-16')), false); // semaine suivante
  assert.equal(triggerHits(tr, day('2026-11-23')), true);  // deux semaines après
});

// Temps : affichage des durées et taille du créneau (Small < 30 min, Medium < 90 min, Big au-delà)
const timeStart = html.indexOf('/* test:start:time */');
const timeEnd = html.indexOf('/* test:end:time */');
const { hm, sizeFromMins, durationText } = new Function(html.slice(timeStart, timeEnd) + '; return { hm, sizeFromMins, durationText };')();

test('hm affiche les minutes puis les heures', () => {
  assert.equal(hm(45), '45 min');
  assert.equal(hm(60), '1 h');
  assert.equal(hm(95), '1 h 35');
});

test('la taille suit la durée estimée', () => {
  assert.equal(sizeFromMins({ mins: 15 }), 'Small');
  assert.equal(sizeFromMins({ mins: 30 }), 'Medium');
  assert.equal(sizeFromMins({ mins: 90 }), 'Big');
  assert.equal(sizeFromMins({}), 'no estimate');
  assert.equal(durationText({ mins: 25 }), '25 min estimated');
});

test('priorityOf donne un nombre croissant selon la priorité', () => {
  assert.ok(priorityOf(wrap({ mins: 1 })) < priorityOf(wrap({ key: true, quad: 'do' })));
  assert.ok(priorityOf(wrap({ quad: 'do' })) < priorityOf(wrap({ quad: 'plan' })));
});
