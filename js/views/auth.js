// Sign-in screen.
import { h, attempt } from '../ui.js';
import { app, enter } from '../main.js';
import { COURSES } from '../curriculum/index.js';

export function viewLogin() {
  const { store } = app;
  const preset = (location.hash.match(/^#\/join\/(\w+)/) || [])[1] || '';
  const code = h('input', { type: 'text', value: preset, maxlength: 12, autocomplete: 'off', autocapitalize: 'characters', placeholder: 'For example DEMO6', 'data-nudge': 'Type the class code your teacher gave you', style: 'text-transform:uppercase' });
  const name = h('input', { type: 'text', maxlength: 30, autocomplete: 'off', placeholder: 'First name and last initial' });
  const join = async (e) => { e.preventDefault(); const s = await attempt(() => store.studentJoin(code.value, name.value)); if (s) enter(s); };
  return h('main.page.login',
    h('div.hero', h('p.hero-emoji', { 'aria-hidden': 'true' }, '📦'), h('h1', { translate: 'no' }, 'Packet Express'), h('p.lead', 'Learn how networks and the internet really work, one delivery at a time.')),
    h('div.grid2',
      h('form.card.stack', { onsubmit: join }, h('h2', 'I am a student'), h('label.field', h('span', 'Class code'), code), h('label.field', h('span', 'Your name'), name),
        h('button.btn.primary', { type: 'submit' }, 'Join my class'),
        store.mode === 'local' && h('p.muted.small', 'Just trying it out? Use class code DEMO6, DEMO7 or DEMO8.')),
      h('div.card.stack', h('h2', 'I am a teacher'), h('p', 'Set up classes, see progress, read the lesson plans and answer keys, and try every lesson in student view.'),
        h('button.btn', { onclick: async () => { const s = await attempt(() => store.teacherEnter()); if (s) enter(s); } }, 'Open the teacher desk'),
        store.mode === 'local' && h('p.muted.small', 'This copy keeps all work in this browser. Students on other devices will not appear here until the course runs on the hosted platform.'))),
    h('div.grid3', COURSES.map((c) => h('div.card.course', { style: `--tone:${c.color}` }, h('p.tag', `Grade ${c.grade}`), h('h3', c.name), h('p.small', c.about), h('p.small.muted', '10 lessons')))));
}
