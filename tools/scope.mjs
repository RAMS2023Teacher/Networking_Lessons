// Writes docs/CURRICULUM.md from the lesson files, so the document never drifts from the lessons.
//   node tools/scope.mjs
import { writeFileSync } from 'node:fs';
import { COURSES, lessonsFor, coverage } from '../js/curriculum/index.js';

const out = ['# Scope and sequence', '', 'Written by `node tools/scope.mjs` from the lesson files. Do not edit by hand.', '',
  'Standards are from the Massachusetts Digital Literacy and Computer Science framework, grades 6 to 8. All three grades share one set of standards, so the courses spiral: grade 6 builds and names the parts, grade 7 follows data across the internet, grade 8 protects and designs.', ''];
for (const c of COURSES) {
  out.push(`## Grade ${c.grade}: ${c.name}`, '', c.about, '', '| # | Lesson | Question of the day | Students can say | Standards |', '| --- | --- | --- | --- | --- |');
  for (const l of lessonsFor(c.grade)) out.push(`| ${l.n} | ${l.title} | ${l.big} | ${l.goal} | ${l.standards.join(', ')} |`);
  out.push('', '| Standard | Text | Lessons |', '| --- | --- | --- |');
  for (const s of coverage(c.grade)) out.push(`| ${s.code} | ${s.text} | ${s.lessons.map((l) => l.n).join(', ')} |`);
  out.push('');
}
writeFileSync(new URL('../docs/CURRICULUM.md', import.meta.url), out.join('\n'));
console.log('Wrote docs/CURRICULUM.md');
