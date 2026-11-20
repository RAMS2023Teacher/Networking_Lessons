// The three courses, and the checks every lesson must pass.
import { STANDARDS } from './standards.js';
import { GRADE6 } from './grade6.js';
import { GRADE7 } from './grade7.js';
import { GRADE8 } from './grade8.js';
import { checkBuild, linkProblem, shortest, splitMessage, crackSeconds, YEAR, lettersOnly } from '../labs/logic.js';

export const COURSES = [
  { grade: 6, name: 'Connected', line: 'Local Line', about: 'What a network is, what it is made of, and how bits travel on it.', color: 'var(--g6)' },
  { grade: 7, name: 'How the Internet Works', line: 'Long-Distance Line', about: 'Addresses, names, packets, routing, protocols and the cloud.', color: 'var(--g7)' },
  { grade: 8, name: 'Secure and Design', line: 'Secure Line', about: 'Threats, passwords, encryption, firewalls, ethics, privacy and access.', color: 'var(--g8)' },
];
export const GRADES = COURSES.map((c) => c.grade);
export const courseFor = (grade) => COURSES.find((c) => c.grade === Number(grade));

const BY_GRADE = { 6: GRADE6, 7: GRADE7, 8: GRADE8 };
for (const grade of GRADES) BY_GRADE[grade].forEach((l, i) => { l.grade = grade; l.n = i + 1; });
export const LESSONS = GRADES.flatMap((g) => BY_GRADE[g]);
const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export const lessonsFor = (grade) => BY_GRADE[Number(grade)] || [];
export const getLesson = (id) => BY_ID.get(id);
export const standard = (code) => STANDARDS.find((s) => s.code === code);

/** Standards a course covers, each with the lessons that teach it. */
export function coverage(grade) {
  const map = new Map();
  for (const l of lessonsFor(grade)) for (const code of l.standards) { if (!map.has(code)) map.set(code, []); map.get(code).push(l); }
  return [...map].map(([code, lessons]) => ({ ...standard(code), lessons })).sort((a, b) => a.code.localeCompare(b.code));
}

export const PASS = 0.75;
export const MIN_SHIP = 20;

const LAB_TYPES = ['mcq', 'sort', 'order', 'match', 'build', 'route', 'packets', 'binary', 'pixels', 'deliver', 'cipher', 'crack', 'troubleshoot', 'speed'];

function mcqProblems(m) {
  const out = [];
  if (!m.q || !Array.isArray(m.choices) || m.choices.length < 2) out.push('needs a question and choices');
  else if (!(m.answer >= 0 && m.answer < m.choices.length)) out.push('answer is not one of the choices');
  if (!m.why) out.push('needs a "why"');
  if (new Set(m.choices).size !== (m.choices || []).length) out.push('has repeated choices');
  return out;
}

/** What is wrong with one lab, as a list of sentences. Empty means it can be solved. */
export function labProblems(lab) {
  const out = [];
  if (!LAB_TYPES.includes(lab.type)) return [`unknown lab type "${lab.type}"`];
  if (lab.type === 'mcq') out.push(...mcqProblems(lab));
  if (lab.type === 'sort') {
    if (lab.items.some(([, b]) => !(b >= 0 && b < lab.bins.length))) out.push('an item points at a bin that does not exist');
    lab.bins.forEach((_, i) => { if (!lab.items.some(([, b]) => b === i)) out.push(`bin ${i} is never used`); });
  }
  if (lab.type === 'order' && (lab.items.length < 3 || new Set(lab.items).size !== lab.items.length)) out.push('needs 3 or more different items');
  if (lab.type === 'match' && (new Set(lab.pairs.map((p) => p[0])).size !== lab.pairs.length || new Set(lab.pairs.map((p) => p[1])).size !== lab.pairs.length)) out.push('has repeated pairs');
  if (lab.type === 'build') {
    const ids = new Set(lab.devices.map((x) => x.id));
    if (ids.size !== lab.devices.length) out.push('has repeated device ids');
    for (const pair of [...lab.goals, ...lab.solution]) for (const id of pair) if (!ids.has(id)) out.push(`unknown device "${id}"`);
    if (out.length) return out;
    const links = [];
    for (const [a, b] of lab.solution) {
      const why = linkProblem(lab, links, a, b);
      if (why) out.push(`solution link ${a}-${b} is refused: ${why}`);
      links.push([a, b]);
    }
    if (!checkBuild(lab, links).ok) out.push('the solution does not meet the goals');
    if (checkBuild(lab, []).ok) out.push('is already solved with no cables');
  }
  if (lab.type === 'route') {
    const best = shortest(lab);
    if (!best) out.push('has no working path');
    else if (best.path.length < 3) out.push('is solved in one hop');
  }
  if (lab.type === 'packets') {
    const count = splitMessage(lab.message, lab.size).length;
    if (count < 3) out.push('needs 3 or more packets');
    if (lab.lose && !(lab.lose >= 1 && lab.lose <= count)) out.push('loses a packet that does not exist');
  }
  if (lab.type === 'binary' && lab.targets.some((t) => !(t > 0 && t < 2 ** lab.bits))) out.push('has a target that does not fit in its bits');
  if (lab.type === 'pixels' && (new Set(lab.rows.map((r) => r.length)).size !== 1 || !lab.rows.join('').includes('1'))) out.push('rows must be the same length and not blank');
  if (lab.type === 'deliver') {
    const all = lab.nets.flatMap((net) => net.hosts.map((h) => `${net.prefix}.${h[0]}`));
    if (new Set(all).size !== all.length) out.push('has two devices with one address');
    for (const p of lab.packets) if (!all.includes(p)) out.push(`packet for ${p} has nowhere to go`);
  }
  if (lab.type === 'cipher') {
    if (!['encrypt', 'decrypt', 'crack'].includes(lab.mode)) out.push('unknown mode');
    if (!(lab.shift >= 1 && lab.shift <= 25) || !lettersOnly(lab.text)) out.push('needs text and a shift from 1 to 25');
  }
  if (lab.type === 'crack') {
    const best = crackSeconds({ length: lab.max, upper: !lab.lockSets, digits: !lab.lockSets, symbols: !lab.lockSets }) / YEAR;
    const start = crackSeconds({ length: lab.start, upper: false, digits: false, symbols: false }) / YEAR;
    if (best < lab.goalYears) out.push('goal cannot be reached');
    if (start >= lab.goalYears) out.push('is already solved at the start');
  }
  if (lab.type === 'troubleshoot') {
    if (!(lab.answer >= 0 && lab.answer < lab.fixes.length)) out.push('answer is not one of the fixes');
    if (lab.checks.length < (lab.need || 1)) out.push('asks for more checks than it has');
  }
  if (lab.type === 'speed') { out.push(...mcqProblems(lab)); if (lab.lanes.length !== 2) out.push('needs two lanes'); }
  return out;
}

/** Every problem in the curriculum, as sentences. Used by the tests and shown to nobody else. */
export function validate() {
  const out = [];
  const say = (l, msg) => out.push(`${l.id}: ${msg}`);
  for (const grade of GRADES) if (lessonsFor(grade).length !== 10) out.push(`grade ${grade} has ${lessonsFor(grade).length} lessons, not 10`);
  if (BY_ID.size !== LESSONS.length) out.push('two lessons share an id');
  for (const l of LESSONS) {
    for (const key of ['title', 'emoji', 'big', 'goal', 'adds']) if (!l[key]) say(l, `missing ${key}`);
    if (l.big && l.big.split(/\s+/).length > 15) say(l, 'the big question is longer than 15 words');
    if (!l.standards?.length) say(l, 'has no standards');
    for (const code of l.standards || []) if (!standard(code)) say(l, `unknown standard ${code}`);
    if (!l.mission?.story || !l.mission?.talk) say(l, 'mission needs a story and a talk question');
    if (!l.vocab?.length) say(l, 'has no vocabulary');
    if (!(l.steps?.length >= 3)) say(l, 'needs 3 or more steps');
    if (new Set(l.steps.map((s) => s.id)).size !== l.steps.length) say(l, 'two steps share an id');
    for (const s of l.steps) {
      if (!s.title || !s.text?.length || !s.lab) { say(l, `step ${s.id} needs a title, text and a lab`); continue; }
      for (const p of labProblems(s.lab)) say(l, `step ${s.id} (${s.lab.type}) ${p}`);
    }
    if (l.quiz?.length !== 4) say(l, 'needs exactly 4 quiz questions');
    (l.quiz || []).forEach((m, i) => mcqProblems(m).forEach((p) => say(l, `quiz ${i + 1} ${p}`)));
    if (!l.ship?.prompt || !l.ship?.frame || !l.ship?.stretch) say(l, 'ship needs a prompt, a frame and a stretch');
  }
  return out;
}
