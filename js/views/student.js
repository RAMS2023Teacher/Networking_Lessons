// Student pages: home, the network map and the courier page.
import { h, add, s, attempt, toast, avatar } from '../ui.js';
import { app, go, updateStudent, render } from '../main.js';
import { lessonsFor, courseFor } from '../curriculum/index.js';
import { statsFor, lessonState, isOpen, stageOf, BADGES, RIDES, COLORS, LEVELS } from '../game/rules.js';
import { calm } from '../fx.js';

const openAll = () => !!(app.session.student.preview || app.session.class?.open_all);
const STAGE_WORD = { mission: 'Mission', build: 'Build', quiz: 'Quiz', ship: 'Deliver', done: 'Done' };

function xpBar(stats) {
  const span = stats.next ? stats.next - stats.floor : 1;
  const pct = stats.next ? Math.round(((stats.xp - stats.floor) / span) * 100) : 100;
  return h('div.xp', h('div.xp-top', h('strong', `Level ${stats.level} · ${stats.title}`), h('span.muted', stats.next ? `${stats.next - stats.xp} XP to level ${stats.level + 1}` : 'Top level')),
    h('div.meter', { role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progress to the next level' }, h('div.meter-fill.full', { style: `width:${pct}%` })));
}

/** The line as a picture that grows: each finished lesson lights its station and the track to it. */
export function networkMap(student, { small = false } = {}) {
  const lessons = lessonsFor(student.grade);
  const at = [[8, 46], [26, 46], [44, 46], [62, 46], [80, 46], [92, 30], [80, 14], [62, 14], [44, 14], [26, 14]];
  const hq = [8, 14];
  const state = lessons.map((l) => lessonState(l, student.lessons?.[l.id]));
  const current = lessons.findIndex((l, i) => state[i] !== 'done');
  const svg = s(`svg.map${small ? '.small' : ''}`, { viewBox: '0 0 100 60', role: 'img', 'aria-label': `Your network: ${state.filter((x) => x === 'done').length} of ${lessons.length} stations connected` });
  add(svg, s('line.track', { x1: 0, y1: 46, x2: at[0][0], y2: at[0][1] }));
  lessons.forEach((l, i) => {
    const from = i ? at[i - 1] : [0, 46];
    const lit = state[i] === 'done';
    if (i) add(svg, s(`line.track${lit ? '.lit' : ''}`, { x1: from[0], y1: from[1], x2: at[i][0], y2: at[i][1] }));
    if (lit && !calm() && !small) add(svg, s('circle.pulse', { r: 0.9 }, s('animateMotion', { dur: '2.4s', repeatCount: 'indefinite', begin: `${i * 0.24}s`, path: `M${from[0]},${from[1]} L${at[i][0]},${at[i][1]}` })));
  });
  const allDone = current === -1;
  add(svg, s(`line.track${allDone ? '.lit' : ''}`, { x1: at[9][0], y1: at[9][1], x2: hq[0], y2: hq[1] }));
  add(svg, s(`g.station${allDone ? '.done' : '.locked'}`, s('circle', { cx: hq[0], cy: hq[1], r: 5.2 }), s('text.st-icon', { x: hq[0], y: hq[1] + 2.2, 'text-anchor': 'middle' }, allDone ? '🏆' : '🌐'), s('text.st-n', { x: hq[0], y: hq[1] + 9, 'text-anchor': 'middle' }, 'Finish')));
  lessons.forEach((l, i) => {
    const open = isOpen(l, student, openAll());
    const g = s(`g.station.${state[i]}${open ? '' : '.locked'}${i === current ? '.current' : ''}`, { tabindex: small ? null : 0, role: small ? null : 'link', 'aria-label': `Lesson ${l.n}: ${l.title}. ${state[i] === 'done' ? 'Finished' : open ? 'Open' : 'Locked'}` },
      s('circle', { cx: at[i][0], cy: at[i][1], r: 5.2 }), s('text.st-icon', { x: at[i][0], y: at[i][1] + 2.2, 'text-anchor': 'middle' }, open ? l.emoji : '🔒'),
      s('text.st-n', { x: at[i][0], y: at[i][1] + 9, 'text-anchor': 'middle' }, `${l.n}`));
    if (!small) {
      const visit = () => (open ? go(`/lesson/${l.id}`) : toast(`Finish lesson ${l.n - 1} to open this station.`));
      g.addEventListener('click', visit);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') visit(); });
    }
    add(svg, g);
  });
  if (current >= 0) add(svg, s('text.st-me', { x: at[current][0], y: at[current][1] - 6.5, 'text-anchor': 'middle' }, student.avatar?.ride || '🚲'));
  return svg;
}

function nextLine(student, stats) {
  const l = stats.nextLesson;
  if (!l) return `Every station is connected. The ${courseFor(student.grade).line} is complete!`;
  return `${stats.done} of ${stats.total} stations connected. Next up: finish "${l.title}" to add ${l.adds}.`;
}

export function viewHome(main) {
  const { student } = app.session;
  const stats = statsFor(student);
  const course = courseFor(student.grade);
  const lessons = lessonsFor(student.grade);
  const next = stats.nextLesson;
  const stage = next && stageOf(next, student.lessons?.[next.id]);
  add(main, 
    h('section.card.hello', { style: `--tone:${course.color}` }, h('div.hello-top', avatar(student.avatar, 'big'), h('div', h('p.tag', `Grade ${student.grade} · ${course.line}`), h('h1', `Hello, ${student.name.split(' ')[0]}!`), h('p.muted', course.about))), xpBar(stats),
      next ? h('a.btn.primary.big', { href: `#/lesson/${next.id}`, 'data-nudge': 'Start your next mission here' }, stage === 'mission' ? `▶ Start lesson ${next.n}: ${next.title}` : `▶ Continue lesson ${next.n}: ${next.title} (${STAGE_WORD[stage]})`)
        : h('p.lead', '🏆 You finished the whole line. Go back to any lesson to practice.')),
    h('section.card', h('h2', 'Your network'), networkMap(student, { small: true }), h('p', nextLine(student, stats)), h('a.btn.small', { href: '#/map' }, 'Open the network map')),
    h('section', h('h2', 'Lessons'), h('div.lesson-list', lessons.map((l) => {
      const st = lessonState(l, student.lessons?.[l.id]);
      const open = isOpen(l, student, openAll());
      return h(`a.lesson-row.${st}${open ? '' : '.locked'}`, { href: open ? `#/lesson/${l.id}` : null, 'aria-disabled': open ? null : 'true', onclick: open ? null : () => toast(`Finish lesson ${l.n - 1} first.`) },
        h('span.lesson-n', open ? l.emoji : '🔒'), h('span.lesson-t', h('strong', `${l.n}. ${l.title}`), h('span.muted.small', l.big)), h('span.pill', st === 'done' ? '✓ Done' : st === 'started' ? 'In progress' : open ? 'Open' : 'Locked'));
    }))),
    h('section.card', h('h2', 'Badges'), h('div.badges', BADGES.map((b) => { const got = stats.badges.includes(b); return h(`div.badge${got ? '.got' : ''}`, { title: b.how }, h('span.badge-e', b.emoji), h('strong', b.name), h('span.small.muted', got ? 'Earned' : b.how)); }))));
}

export function viewMap(main) {
  const { student } = app.session;
  const stats = statsFor(student);
  add(main, h('section.card', h('h1', `The ${courseFor(student.grade).line}`), h('p', nextLine(student, stats)), networkMap(student), h('p.muted.small', 'Click a station to open its lesson. Lit track means the lesson is finished.')));
}

export function viewCourier(main) {
  const { student } = app.session;
  const stats = statsFor(student);
  const pick = { ...student.avatar };
  const preview = h('div');
  const draw = () => preview.replaceChildren(avatar(pick, 'big'));
  const save = async () => { const out = await attempt(() => app.store.updateProfile({ avatar: pick })); if (out) { updateStudent(out); toast('Saved.'); render(); } };
  draw();
  add(main, 
    h('section.card.stack', h('h1', 'Your courier'), h('div.row', preview, h('div', h('strong', student.name), h('p.muted', `Level ${stats.level} · ${stats.title}`))),
      h('h3', 'Ride'), h('div.row', RIDES.map(([ride, level]) => { const locked = !student.preview && level > stats.level; return h(`button.swatch${locked ? '.locked' : ''}`, { 'aria-label': locked ? `Unlocks at level ${level}` : `Ride ${ride}`, title: locked ? `Unlocks at level ${level}` : '', onclick: () => { if (locked) { toast(`That ride unlocks at level ${level}.`); return; } pick.ride = ride; draw(); } }, locked ? '🔒' : ride, locked && h('span.small', `L${level}`)); })),
      h('h3', 'Color'), h('div.row', COLORS.map((c) => h('button.swatch', { style: `background:${c}`, 'aria-label': `Color ${c}`, onclick: () => { pick.color = c; draw(); } }))),
      h('button.btn.primary', { onclick: save }, 'Save my courier')),
    h('section.card', h('h2', 'Where your XP came from'), stats.log.length ? h('table.plain', stats.log.map((row) => h('tr', h('th', `${row.lesson.n}. ${row.lesson.title}`), h('td', row.parts.map((p) => `${p[0]} +${p[1]}`).join(' · ')), h('td.num', `${row.sum} XP`))),
      stats.badges.length ? h('tr', h('th', 'Badges'), h('td', stats.badges.map((b) => b.name).join(' · ')), h('td.num', `${stats.badges.length * 25} XP`)) : null) : h('p.muted', 'Finish a mission to earn your first XP.')),
    h('section.card', h('h2', 'Levels'), h('ol.levels', LEVELS.map(([need, title], i) => h(`li${stats.level === i + 1 ? '.here' : ''}`, `${title} · ${need} XP`)))));
}
