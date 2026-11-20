// Teacher pages: classes, one class, feedback, lesson plans with answer keys, problem reports.
import { h, add, clear, attempt, toast, modal, copy, download, ago, avatar } from '../ui.js';
import { app, go, render } from '../main.js';
import { lessonsFor, getLesson, courseFor, COURSES, GRADES, standard, PASS } from '../curriculum/index.js';
import { lessonState, statsFor, stageOf, stepsDone } from '../game/rules.js';
import { shortest, caesar, splitMessage, toBits } from '../labs/logic.js';
import { sound } from '../fx.js';

const gradeTabs = (base, grade) => h('div.tabs', { role: 'tablist' }, COURSES.map((c) => h('a.tab', { href: `#${base}/${c.grade}`, role: 'tab', 'aria-selected': String(c.grade === grade) }, `Grade ${c.grade}: ${c.name}`)));
const joinLink = (code) => `${location.origin}${location.pathname}#/join/${code}`;
const lessonLink = (n) => `${location.origin}${location.pathname}#/go/${n}`;

export async function viewTeacherHome(main) {
  const { store } = app;
  const [classes, info] = await Promise.all([store.listClasses(), store.dataInfo()]);
  const name = h('input', { type: 'text', maxlength: 40, placeholder: 'For example Period 3' });
  const grade = h('select', COURSES.map((c) => h('option', { value: c.grade }, `Grade ${c.grade}: ${c.name}`)));
  const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async () => {
    const f = file.files[0];
    if (!f || !confirm('Restoring replaces everything saved in this browser with the backup. Continue?')) return;
    const ok = await attempt(async () => { await store.importData(await f.text()); return true; });
    if (ok) { toast('Backup restored.'); render(); }
  } });
  add(main, h('section.card', h('h1', 'Your classes'), h('p.muted', 'Each class follows one grade\'s course of 10 lessons. Students join with the class code.')),
    h('div.grid3', classes.map((c) => h('a.card.course', { href: `#/class/${c.id}`, style: `--tone:${courseFor(c.grade).color}` }, h('p.tag', `Grade ${c.grade}${c.sample ? ' · sample' : ''}`), h('h3', c.name), h('p.small', `${c.count} student${c.count === 1 ? '' : 's'}`), h('p.mono', { translate: 'no' }, `Code ${c.code}`)))),
    h('form.card.stack', { onsubmit: async (e) => { e.preventDefault(); const c = await attempt(() => store.createClass(name.value, grade.value)); if (c) go(`/class/${c.id}/share`); } },
      h('h2', 'Add a class'), h('div.row', h('label.field', h('span', 'Class name'), name), h('label.field', h('span', 'Course'), grade)), h('button.btn.primary', { type: 'submit' }, 'Create class')),
    store.mode === 'local' && h('section.card.stack', h('h2', '🗄️ Your data'), h('p', `${info.classes} classes and ${info.students} students are saved in this browser, on this device only (${Math.round(info.bytes / 1024)} KB). Clearing the browser's site data erases them, so keep a backup.`),
      h('div.row', h('button.btn', { onclick: async () => { const text = await attempt(() => store.exportData()); if (text) download(`packet-express-backup-${new Date().toISOString().slice(0, 10)}.json`, text, 'application/json'); } }, 'Download a backup'), h('button.btn', { onclick: () => file.click() }, 'Restore from a backup'), file),
      h('p.small.muted', 'The three sample classes hold made-up students so you can see how these pages look. Delete them whenever you like.')));
}

function progressGrid(cls, students) {
  const lessons = lessonsFor(cls.grade);
  if (!students.length) return h('p.muted', 'No students yet. Give them the class code from the Share tab.');
  const cell = (st, l) => {
    const p = st.lessons?.[l.id];
    const state = lessonState(l, p);
    const label = state === 'done' ? `✓ ${p.quiz.best}/${l.quiz.length}` : state === 'started' ? `◐ ${({ mission: 'Mission', build: `Step ${stepsDone(l, p) + 1}`, quiz: 'Quiz', ship: 'Deliver' })[stageOf(l, p)]}` : '';
    return h(`td.cell.${state}`, state === 'new' ? '' : h('button.cell-btn', { onclick: () => showWork(st, l), 'aria-label': `${st.name}, lesson ${l.n}: ${label}` }, label));
  };
  return h('div.scroll', h('table.grid', h('thead', h('tr', h('th', 'Student'), lessons.map((l) => h('th', { title: l.title }, `${l.n}`)), h('th', 'XP'))),
    h('tbody', students.map((st) => { const stats = statsFor(st); return h('tr', h('th', avatar(st.avatar, 'mini'), ' ', h('span', { translate: 'no' }, st.name)), lessons.map((l) => cell(st, l)), h('td.num', `${stats.xp} · L${stats.level}`)); }))),
    h('p.small.muted', '✓ finished, with the best quiz score. ◐ in progress, with where the student is. Click a cell to read their work.'));
}

function showWork(st, l) {
  const p = st.lessons[l.id];
  modal(`${st.name} · ${l.n}. ${l.title}`, [
    h('h3', 'Partner talk'), h('p', l.mission.talk), h('blockquote', p.talk || '(nothing written)'),
    h('h3', 'Quiz'), p.quiz ? h('p', `First try ${p.quiz.firstScore} of ${l.quiz.length}. Best ${p.quiz.best} of ${l.quiz.length}, in ${p.quiz.tries} tr${p.quiz.tries === 1 ? 'y' : 'ies'}.`) : h('p.muted', 'Not taken yet.'),
    p.quiz && h('ul', l.quiz.map((m, i) => h('li.small', p.quiz.first[i] === m.answer ? '✓ ' : '✗ ', m.q, p.quiz.first[i] === m.answer ? '' : ` (first answer: ${m.choices[p.quiz.first[i]]})`))),
    h('h3', 'Delivery'), h('p', l.ship.prompt), h('blockquote', p.ship?.text || '(not delivered yet)'), p.ship?.stretch && h('p.small', '🥾 Says they did the stretch challenge.'),
  ], { wide: true });
}

export async function viewClass(main, id, tab = 'progress') {
  const { store } = app;
  const cls = await store.getClass(id);
  const students = await store.classBoard(id);
  const lessons = lessonsFor(cls.grade);
  const tabs = [['progress', 'Progress'], ['help', 'Help requests'], ['share', 'Share and assign'], ['students', 'Students']];
  const helpCount = h('span');
  const panel = h('section.card.stack');
  add(main, h('section.card', { style: `--tone:${courseFor(cls.grade).color}` }, h('a.linkish', { href: '#/' }, '← Classes'), h('p.tag', `Grade ${cls.grade} · ${courseFor(cls.grade).name}`), h('h1', cls.name), h('p.mono', { translate: 'no' }, `Class code ${cls.code}`)),
    h('div.tabs', { role: 'tablist' }, tabs.map(([key, label]) => h('a.tab', { href: `#/class/${id}/${key}`, role: 'tab', 'aria-selected': String(key === tab) }, label, key === 'help' && helpCount))), panel);

  let known = -1;
  async function drawHelp() {
    const list = await store.helpRequests(id).catch(() => []);
    helpCount.textContent = list.length ? ` (${list.length})` : '';
    if (known >= 0 && list.length > known) { sound.good(); setTimeout(() => sound.good(), 350); }
    known = list.length;
    if (tab !== 'help') return;
    add(clear(panel), h('h2', 'Needs help'), list.length ? list.map((r) => h('div.help-row', avatar(r.avatar), h('div', h('strong', { translate: 'no' }, r.name), h('p.small', r.where), r.note && h('p', `“${r.note}”`), h('p.small.muted', ago(r.at))),
      h('button.btn', { onclick: async () => { await attempt(() => store.markHelped(r.student_id)); drawHelp(); } }, '✓ Helped'))) : h('p.muted', 'Nobody is waiting. Requests from students appear here, with a chime.'));
  }

  if (tab === 'progress') {
    const done = students.reduce((t, st) => t + lessons.filter((l) => lessonState(l, st.lessons?.[l.id]) === 'done').length, 0);
    add(panel, h('h2', 'Progress'), h('p.muted', `${students.length} students · ${done} lessons finished in all`), progressGrid(cls, students));
  }
  if (tab === 'share') {
    const row = (title, text) => h('div.share-row', h('div', h('strong', title), h('p.mono.small', { translate: 'no' }, text)), h('button.btn.small', { onclick: () => copy(text) }, 'Copy'));
    add(panel, h('h2', 'Share and assign'), h('p', 'Paste these into Google Classroom, Canvas, Schoology or any class page. Nothing is sent to that system.'),
      row('Join link', joinLink(cls.code)), row('Class code', cls.code),
      store.mode === 'local' && h('p.note.bad', 'This copy saves work in each student\'s own browser. Their progress will not appear on this page until the course runs on the hosted platform.'),
      h('h3', 'One link per lesson'), lessons.map((l) => row(`${l.n}. ${l.title}`, `${lessonLink(l.n)}\n${l.title}: ${l.goal} About 40 minutes. Finish the mission, the build steps, the quiz and your delivery.`)),
      h('h3', 'Lesson order'), h('label.check', h('input', { type: 'checkbox', checked: cls.open_all, onchange: async (e) => { await attempt(() => store.setOpenAll(id, e.target.checked)); toast(e.target.checked ? 'Every lesson is open.' : 'Lessons open one at a time.'); } }), 'Open every lesson now (otherwise each lesson opens when the one before it is finished)'));
  }
  if (tab === 'students') {
    add(panel, h('h2', 'Students'), students.length ? h('table.plain', students.map((st) => h('tr', h('th', avatar(st.avatar, 'mini'), ' ', h('span', { translate: 'no' }, st.name)), h('td', `${statsFor(st).done} of ${lessons.length} lessons`),
      h('td.num', h('button.btn.small', { onclick: async () => { if (confirm(`Remove ${st.name} and all of their work? This cannot be undone.`)) { await attempt(() => store.removeStudent(st.id)); render(); } } }, 'Remove'))))) : h('p.muted', 'No students yet.'),
      h('h3', 'Delete this class'), h('p.small.muted', 'Deletes the class and all of its students\' work.'), h('button.btn', { onclick: async () => { if (confirm(`Delete ${cls.name} and all of its students' work? This cannot be undone.`)) { await attempt(() => store.deleteClass(id)); go('/'); } } }, 'Delete class'));
  }
  await drawHelp();
  const timer = setInterval(() => { if (!document.hidden) drawHelp(); }, 10000);
  return () => clearInterval(timer);
}

/** Per-lesson feedback numbers, with no student names anywhere. */
function feedbackFor(lesson, rows) {
  const out = { started: 0, finished: 0, ratings: [], flags: {}, missed: [], quotes: [] };
  const firsts = lesson.quiz.map(() => ({ tried: 0, wrong: 0 }));
  for (const r of rows) {
    const p = r.lessons?.[lesson.id];
    const fb = r.fb?.[lesson.id];
    if (p) { out.started++; if (lessonState(lesson, p) === 'done') out.finished++; }
    p?.quiz?.first?.forEach((a, i) => { firsts[i].tried++; if (a !== lesson.quiz[i].answer) firsts[i].wrong++; });
    if (!fb) continue;
    if (fb.rating) out.ratings.push(fb.rating);
    for (const [key, f] of Object.entries(fb.flags || {})) { const x = out.flags[key] || (out.flags[key] = { score: 0, flags: 0, help: 0, notes: [] }); x.flags++; x.score += 2; x.notes.push(f.note ? `${f.reason}: ${f.note}` : f.reason); }
    for (const [key, n] of Object.entries(fb.help || {})) { const x = out.flags[key] || (out.flags[key] = { score: 0, flags: 0, help: 0, notes: [] }); x.help += n; x.score += n; }
    for (const [label, text] of [['Hardest part', fb.hardest], ['Would improve', fb.change]]) if (text) out.quotes.push(`${label}: ${text}`);
  }
  firsts.forEach((f, i) => { if (f.tried && f.wrong / f.tried >= 0.3) out.missed.push({ n: i + 1, q: lesson.quiz[i].q, pct: Math.round((f.wrong / f.tried) * 100) }); });
  out.avg = out.ratings.length ? (out.ratings.reduce((a, b) => a + b, 0) / out.ratings.length).toFixed(1) : null;
  return out;
}
const flagName = (lesson, key) => {
  const [kind, id] = key.split(':');
  if (kind === 'quiz') return `Quiz question ${id}`;
  const i = lesson.steps.findIndex((x) => x.id === id);
  return i >= 0 ? `Step ${i + 1}: ${lesson.steps[i].title}` : key;
};
function reportMarkdown(grade, rows, only) {
  const lines = [`# Packet Express feedback: grade ${grade} (${courseFor(grade).name})`, '', `From ${rows.length} students. No student names are included.`, ''];
  for (const l of lessonsFor(grade)) {
    if (only && l.id !== only) continue;
    const f = feedbackFor(l, rows);
    if (!f.started) continue;
    lines.push(`## Lesson ${l.n}: ${l.title} (\`${l.id}\` in js/curriculum/grade${grade}.js)`, `- Started ${f.started}, finished ${f.finished}, average rating ${f.avg ?? 'none yet'} of 5`);
    for (const [key, x] of Object.entries(f.flags).sort((a, b) => b[1].score - a[1].score)) lines.push(`- ${flagName(l, key)}: ${x.flags} marked confusing, ${x.help} help requests${x.notes.length ? `. Notes: ${x.notes.join(' | ')}` : ''}`);
    for (const m of f.missed) lines.push(`- Quiz question ${m.n} missed by ${m.pct}% on the first try: "${m.q}"`);
    for (const quote of f.quotes) lines.push(`- Student said: ${quote}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function viewFeedback(main, g) {
  const grade = Number(g) || 6;
  const rows = await app.store.feedback(grade);
  add(main, h('section.card.stack', h('h1', 'Feedback'), h('p', 'What students rated, marked confusing, asked for help with and missed on the first quiz try. Paste the report into an AI model or hand it to a colleague to improve the lessons. It contains no names.'),
    h('div.row', h('button.btn.primary', { onclick: () => copy(reportMarkdown(grade, rows)) }, 'Copy report'), h('button.btn', { onclick: () => download(`packet-express-feedback-grade-${grade}.md`, reportMarkdown(grade, rows), 'text/markdown') }, 'Download .md'))), gradeTabs('/feedback', grade),
  lessonsFor(grade).map((l) => {
    const f = feedbackFor(l, rows);
    if (!f.started) return h('section.card.quiet', h('h3', `${l.n}. ${l.title}`), h('p.muted.small', 'No student has started this lesson.'));
    return h('section.card.stack', h('div.row.spread', h('h3', `${l.n}. ${l.title}`), h('button.btn.small', { onclick: () => copy(reportMarkdown(grade, rows, l.id)) }, 'Copy this lesson')),
      h('p', `Started ${f.started} · Finished ${f.finished} · Average rating ${f.avg ? `${f.avg} of 5` : 'none yet'}`),
      Object.keys(f.flags).length ? h('ul', Object.entries(f.flags).sort((a, b) => b[1].score - a[1].score).map(([key, x]) => h('li', h('strong', flagName(l, key)), `: ${x.flags} marked confusing, ${x.help} help requests`, x.notes.length ? h('ul', x.notes.map((n) => h('li.small', n))) : null))) : h('p.muted.small', 'Nothing marked confusing.'),
      f.missed.map((m) => h('p.note.bad', `Quiz question ${m.n} was missed by ${m.pct}% on the first try: ${m.q}`)), f.quotes.length ? h('ul', f.quotes.map((quote) => h('li.small', quote))) : null);
  }));
}

/** The answer to a lab, in a sentence, for the teacher's key. */
function labKey(lab) {
  switch (lab.type) {
    case 'mcq': case 'speed': return `${lab.q} → ${lab.choices[lab.answer]}`;
    case 'sort': return lab.bins.map((b, i) => `${b}: ${lab.items.filter((x) => x[1] === i).map((x) => x[0]).join('; ')}`).join(' ‖ ');
    case 'order': return lab.items.map((x, i) => `${i + 1}. ${x}`).join(' ');
    case 'match': return lab.pairs.map((p) => `${p[0]} = ${p[1]}`).join('; ');
    case 'build': { const name = (id) => lab.devices.find((x) => x.id === id).label; return `One solution: ${lab.solution.map(([a, b]) => `${name(a)}–${name(b)}`).join(', ')}`; }
    case 'route': { const best = shortest(lab); const name = (id) => lab.nodes.find((x) => x.id === id).label; return `${lab.fastest ? `Fastest (${best.cost} ms)` : 'One path'}: ${best.path.map(name).join(' → ')}`; }
    case 'packets': return `"${lab.message}" in ${splitMessage(lab.message, lab.size).length} packets${lab.lose ? `; packet ${lab.lose} is missing and must be asked for` : ''}`;
    case 'binary': return lab.targets.map((t) => `${t}${lab.ascii ? ` (${String.fromCharCode(t)})` : ''} = ${toBits(t, lab.bits)}`).join(', ');
    case 'pixels': return `Fill a pixel for each 1: ${lab.rows.join(' / ')}`;
    case 'deliver': return `Each packet goes to the device with that exact address: ${lab.packets.join(', ')}`;
    case 'cipher': return lab.mode === 'encrypt' ? `${lab.text} → ${caesar(lab.text, lab.shift)}` : `${caesar(lab.text, lab.shift)} → ${lab.text} (shift ${lab.shift})`;
    case 'crack': return `Any setting that takes ${lab.goalYears.toLocaleString('en-US')} years or more${lab.lockSets ? ' (14 lowercase letters is enough)' : ''}`;
    case 'troubleshoot': return `Fix: ${lab.fixes[lab.answer]}. ${lab.why}`;
    default: return '';
  }
}
const LAB_NAME = { mcq: 'Predict question', sort: 'Sorting', order: 'Put in order', match: 'Matching', build: 'Network builder', route: 'Packet routing', packets: 'Packet rebuild', binary: 'Binary switches', pixels: 'Pixel grid', deliver: 'Address delivery', cipher: 'Cipher', crack: 'Password strength', troubleshoot: 'Troubleshooting case', speed: 'Speed race' };

export function viewLessons(main, g) {
  const grade = Number(g) || 6;
  const c = courseFor(grade);
  add(main, h('section.card.stack', h('h1', 'Lessons'), h('p', 'The plan and answer key for every lesson. Each lesson is about 40 minutes: Mission, Build steps, Quiz, Deliver. To try a lesson yourself, use Student view.'), h('button.btn.small.noprint', { onclick: () => window.print() }, '🖨️ Print this page')), gradeTabs('/lessons', grade),
    h('section.card', h('h2', `Grade ${grade}: ${c.name}`), h('p', c.about)),
    lessonsFor(grade).map((l) => h('details.card.plan', h('summary', h('span.plan-title', `${l.emoji} ${l.n}. ${l.title}`), h('span.small.muted', l.big)),
      h('div.stack', h('p', h('strong', 'Goal: '), l.goal), h('p', h('strong', 'Question of the day: '), l.big),
        h('p', h('strong', 'Standards: '), l.standards.map((code) => h('span', h('span.pill', { translate: 'no' }, code), ` ${standard(code).text} `))),
        h('p', h('strong', 'Vocabulary: '), l.vocab.map(([w, d]) => `${w} (${d})`).join('; ')),
        h('p', h('strong', 'Mission: '), l.mission.story), h('p', h('strong', 'Partner talk: '), l.mission.talk),
        h('h3', 'Build steps and key'), h('ol', l.steps.map((st) => h('li', h('strong', st.title), h('span.pill', LAB_NAME[st.lab.type]), h('p.small', st.text.join(' ').replace(/\*\*/g, '')), h('p.small.key', '🔑 ', labKey(st.lab))))),
        h('h3', 'Quiz key'), h('ol', l.quiz.map((m) => h('li', m.q, h('p.small.key', '🔑 ', m.choices[m.answer], '. ', m.why)))), h('p.small.muted', `Passing is ${Math.ceil(l.quiz.length * PASS)} of ${l.quiz.length}.`),
        h('h3', 'Deliver'), h('p', l.ship.prompt), h('p.small', h('strong', 'Sentence starter: '), l.ship.frame), h('p.small', h('strong', 'Stretch: '), l.ship.stretch)))));
}

export async function viewReports(main) {
  const list = await app.store.bugReports();
  add(main, h('section.card.stack', h('h1', 'Problem reports'), h('p.muted', 'Sent from the 🐞 button on any page.'),
    list.length ? list.map((b) => h('div.help-row', h('div', h('strong', b.kind), h('p', b.text), h('p.small.muted', `${b.role} · ${ago(b.at)} · ${(() => { try { return JSON.parse(b.context).page || ''; } catch (_) { return ''; } })()}`)),
      h('button.btn.small', { onclick: async () => { await attempt(() => app.store.closeBug(b.id)); render(); } }, 'Fixed, remove'))) : h('p.muted', 'No reports.')));
}
