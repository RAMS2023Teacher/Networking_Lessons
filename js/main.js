// App shell and router.
import { h, add, clear, attempt, toast, modal, avatar } from './ui.js';
import { createLocalStore } from './data/local.js';
import { createHostedStore } from './data/hosted.js';
import { statsFor } from './game/rules.js';
import { getLesson, lessonsFor, GRADES, courseFor } from './curriculum/index.js';
import { applySettings, openSettings } from './settings.js';
import { startIdleHints, sound, confetti } from './fx.js';
import { viewLogin } from './views/auth.js';
import { viewHome, viewMap, viewCourier } from './views/student.js';
import { viewLesson } from './views/lesson.js';
import { viewStandards } from './views/standards.js';
import { viewTeacherHome, viewClass, viewFeedback, viewLessons, viewReports } from './views/teacher.js';

applySettings();

// Work is kept in this browser unless the page says it is running on the hosted platform.
const hosted = document.querySelector('meta[name="r4a-store"]')?.content === 'hosted';
const store = hosted ? createHostedStore() : createLocalStore();

export const app = { store, session: null };
export const go = (hash) => { if (location.hash === `#${hash}`) render(); else location.hash = hash; };

const errors = [];
window.addEventListener('error', (e) => { errors.push(String(e.message).slice(0, 200)); if (errors.length > 5) errors.shift(); });

/**
 * Take in a student record the store just returned, and celebrate anything new in it.
 * Returns the new stats.
 */
export function updateStudent(student) {
  const before = statsFor(app.session.student);
  app.session.student = student;
  const after = statsFor(student);
  for (const b of after.badges) if (!before.badges.includes(b)) { sound.badge(); toast(`${b.emoji} New badge: ${b.name}`, 'good'); }
  if (after.level > before.level) { sound.level(); confetti(); toast(`⬆️ Level ${after.level}: ${after.title}`, 'good'); }
  drawPurse(after);
  return after;
}
function drawPurse(stats) {
  const el = document.getElementById('purse');
  if (el) el.textContent = `⚡ ${stats.xp} XP · Level ${stats.level}`;
}

/** After signing in. A link the teacher posted can point straight at a lesson, so that address is kept. */
export function enter(session) {
  app.session = session;
  const at = location.hash.slice(1) || '/';
  if (/^\/(lesson|go)\//.test(at)) render(); else go('/');
}

/** "#/go/3" is lesson 3 of whichever course this student is in. */
function viewGo(main, n) {
  const lesson = lessonsFor(app.session.student.grade)[Number(n) - 1];
  location.replace(`#${lesson ? `/lesson/${lesson.id}` : '/'}`);
  return null;
}

const STUDENT_ROUTES = [[/^\/$/, viewHome], [/^\/map$/, viewMap], [/^\/courier$/, viewCourier], [/^\/standards$/, viewStandards], [/^\/lesson\/([\w-]+)$/, viewLesson], [/^\/go\/(\d+)$/, viewGo]];
const TEACHER_ROUTES = [[/^\/$/, viewTeacherHome], [/^\/class\/([\w-]+)(?:\/(\w+))?$/, viewClass], [/^\/feedback(?:\/(\d))?$/, viewFeedback], [/^\/lessons(?:\/(\d))?$/, viewLessons], [/^\/standards$/, viewStandards], [/^\/reports$/, viewReports]];

export function openBugReport() {
  const kind = h('select', store.BUG_KINDS.map((k) => h('option', k)));
  const text = h('textarea', { rows: 4, placeholder: 'What happened? What did you expect?' });
  const close = modal('Report a problem', [h('label.field', h('span', 'What kind of problem?'), kind), h('label.field', h('span', 'Describe it'), text),
    h('button.btn.primary', { onclick: async () => {
      const ok = await attempt(async () => { await store.reportBug(kind.value, text.value, { page: location.hash, screen: `${innerWidth}×${innerHeight}`, browser: navigator.userAgent, errors }); return true; });
      if (ok) { close(); toast('Thank you. Your teacher can see the report.'); }
    } }, 'Send report')]);
}

async function studentView() {
  const close = modal('Student view', [h('p', 'Use a course exactly as a student would. Nothing you do here appears in any class.'),
    h('div.row', GRADES.map((g) => h('button.btn.primary', { onclick: async () => { const s = await attempt(() => store.previewStart(g)); if (s) { close(); app.session = s; go('/'); } } }, `Grade ${g}: ${courseFor(g).name}`)))]);
}

function topbar() {
  const s = app.session;
  const hash = location.hash.slice(1) || '/';
  const link = (href, label) => h('a.nav', { href: `#${href}`, 'aria-current': (href === '/' ? hash === '/' : hash.startsWith(href)) ? 'page' : null }, label);
  const student = s.role === 'student';
  const links = student ? [link('/', 'Home'), link('/map', 'Network'), link('/courier', 'Courier'), link('/standards', 'Standards')]
    : [link('/', 'Classes'), link('/lessons', 'Lessons'), link('/feedback', 'Feedback'), link('/standards', 'Standards'), link('/reports', 'Reports'), h('button.btn.small', { onclick: studentView }, '👀 Student view')];
  const stats = student && statsFor(s.student);
  return h('header.topbar', h('a.brand', { href: '#/', translate: 'no' }, '📦 Packet Express'), h('nav.navs', { 'aria-label': 'Main' }, links),
    h('div.who', student && h('span.purse', { id: 'purse' }, `⚡ ${stats.xp} XP · Level ${stats.level}`),
      h('button.btn.small', { onclick: () => openSettings(openBugReport) }, 'Aa Display'),
      h('span.who-name', { translate: 'no' }, student ? [avatar(s.student.avatar, 'mini'), ' ', s.student.name] : s.teacher.name),
      !s.student?.preview && h('button.btn.small', { onclick: async () => { await attempt(() => store.signOut()); app.session = null; go('/'); } }, 'Sign out')));
}

function previewBanner() {
  const reload = (s) => { if (s) { app.session = s; go('/'); } };
  return h('aside.banner', h('span', '👀 Student view: this is what a student sees. Every lesson is open, and nothing here reaches your classes.'),
    h('button.btn.small', { onclick: async () => { const s = await attempt(() => store.previewReset()); if (s) { toast('Started over as a new student.'); reload(s); } } }, 'Start over'),
    h('button.btn.small', { onclick: async () => reload(await attempt(() => store.previewEnd())) }, 'Back to teacher'));
}

let cleanup = null;
export async function render() {
  const root = document.getElementById('app');
  cleanup?.(); cleanup = null;
  if (!app.session) { add(clear(root), viewLogin()); return; }
  const hash = location.hash.slice(1) || '/';
  const main = h('main.page');
  const routes = app.session.role === 'student' ? STUDENT_ROUTES : TEACHER_ROUTES;
  add(clear(root), topbar(), app.session.student?.preview && previewBanner() || '', main,
    h('footer.foot', store.mode === 'local' && h('span', 'Work is saved in this browser on this device.'), h('button.linkish', { onclick: openBugReport }, '🐞 Report a problem')));
  for (const [re, view] of routes) {
    const m = hash.match(re);
    if (m) { try { cleanup = (await view(main, ...m.slice(1))) || null; } catch (e) { add(main, h('div.card', h('h2', 'Something went wrong'), h('p', e.message))); } window.scrollTo(0, 0); return; }
  }
  go('/');
}

window.addEventListener('hashchange', render);
window.addEventListener('signed-out', () => { app.session = null; render(); });

(async () => {
  try { app.session = await store.session(); } catch (e) {
    add(clear(document.getElementById('app')), h('main.page', h('div.card', h('h1', 'Packet Express could not start'), h('p', e.message))));
    return;
  }
  startIdleHints();
  render();
})();

// Expose a little for the browser check.
window.__lesson = getLesson;
