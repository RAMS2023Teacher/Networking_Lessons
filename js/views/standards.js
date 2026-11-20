// Which Massachusetts standards each course covers, in the framework's own words.
import { h, add } from '../ui.js';
import { app } from '../main.js';
import { coverage, COURSES } from '../curriculum/index.js';

export function viewStandards(main) {
  const student = app.session.role === 'student';
  const courses = student ? COURSES.filter((c) => c.grade === app.session.student.grade) : COURSES;
  add(main, h('section.card', h('h1', 'Standards'), h('p', 'From the Massachusetts Digital Literacy and Computer Science framework for grades 6 to 8. The words are the framework\'s own.')),
    courses.map((c) => h('section.card', h('h2', `Grade ${c.grade}: ${c.name}`), h('table.plain', h('tr', h('th', 'Standard'), h('th', 'What it says'), h('th', 'Lessons')),
      coverage(c.grade).map((row) => h('tr', h('td.mono', { translate: 'no' }, row.code), h('td', h('span.small.muted', `${row.strand} · ${row.topic}`), h('br'), row.text),
        h('td', row.lessons.map((l) => (student ? h('a.pill', { href: `#/lesson/${l.id}` }, `${l.n}`) : h('span.pill', { title: l.title }, `${l.n}`))))))))));
}
