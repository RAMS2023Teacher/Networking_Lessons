// XP, levels and badges. Everything here is worked out from saved progress, so nothing can be
// paid twice and nothing needs to be stored except the progress itself.
import { PASS, MIN_SHIP, lessonsFor } from '../curriculum/index.js';

export const XP = { mission: 10, step: 10, quiz: 30, perfect: 20, first: 10, stretch: 25, ship: 50, rated: 10, lesson: 50, badge: 25 };

export const LEVELS = [
  [0, 'New Courier'], [100, 'Cable Runner'], [250, 'Signal Scout'], [450, 'Switch Operator'], [700, 'Packet Pilot'], [1000, 'Route Finder'],
  [1350, 'Protocol Pro'], [1750, 'Network Builder'], [2200, 'Code Breaker'], [2700, 'Firewall Guardian'], [3250, 'Chief Engineer'], [3850, 'Internet Legend'],
];

/** Courier rides. Each unlocks at a level. */
export const RIDES = [['🚲', 1], ['🛴', 1], ['🛵', 2], ['🚗', 3], ['🚚', 4], ['🚂', 5], ['🚁', 6], ['✈️', 7], ['🚀', 8], ['🛸', 10]];
export const COLORS = ['#c0392b', '#1f8a4c', '#1d3f8f', '#b0379c', '#c9741b', '#0e7c86', '#5b4bb3', '#3a3a3a'];
export const defaultAvatar = (seed = '') => {
  let n = 0;
  for (const c of String(seed)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return { ride: RIDES[n % 2][0], color: COLORS[n % COLORS.length] };
};

export const quizPassed = (lesson, p) => !!p?.quiz && p.quiz.best / lesson.quiz.length >= PASS;
export const stepsDone = (lesson, p) => lesson.steps.filter((s) => p?.steps?.[s.id]).length;
export const shipped = (p) => (p?.ship?.text || '').trim().length >= MIN_SHIP;
export const isDone = (lesson, p) => !!p?.mission && stepsDone(lesson, p) === lesson.steps.length && quizPassed(lesson, p) && shipped(p);

/** 'new', 'started' or 'done'. */
export const lessonState = (lesson, p) => (isDone(lesson, p) ? 'done' : p && (p.mission || stepsDone(lesson, p) || p.quiz) ? 'started' : 'new');

/** Which stage of the lesson the student should be on: mission, build, quiz, ship or done. */
export function stageOf(lesson, p) {
  if (!p?.mission) return 'mission';
  if (stepsDone(lesson, p) < lesson.steps.length) return 'build';
  if (!quizPassed(lesson, p)) return 'quiz';
  if (!shipped(p)) return 'ship';
  return 'done';
}

/** XP earned in one lesson, as a list of [reason, amount]. */
export function lessonXp(lesson, p, fb) {
  const parts = [];
  if (!p) return parts;
  if (p.mission) parts.push(['Mission accepted', XP.mission]);
  const steps = stepsDone(lesson, p);
  if (steps) parts.push([`${steps} build step${steps === 1 ? '' : 's'}`, steps * XP.step]);
  if (quizPassed(lesson, p)) {
    parts.push(['Quiz passed', XP.quiz]);
    if (p.quiz.best === lesson.quiz.length) parts.push(['Perfect quiz', XP.perfect]);
    if (p.quiz.firstScore === lesson.quiz.length) parts.push(['Perfect on the first try', XP.first]);
  }
  if (shipped(p)) {
    parts.push(['Delivered', XP.ship]);
    if (p.ship.stretch) parts.push(['Stretch challenge', XP.stretch]);
  }
  if (fb?.rating) parts.push(['Rated the lesson', XP.rated]);
  if (isDone(lesson, p)) parts.push(['Lesson complete', XP.lesson]);
  return parts;
}

export const BADGES = [
  { id: 'first', emoji: '📦', name: 'First Delivery', how: 'Finish a lesson', test: (s) => s.done >= 1 },
  { id: 'three', emoji: '🔥', name: 'On a Roll', how: 'Finish 3 lessons', test: (s) => s.done >= 3 },
  { id: 'five', emoji: '🚉', name: 'Halfway Hub', how: 'Finish 5 lessons', test: (s) => s.done >= 5 },
  { id: 'line', emoji: '🏆', name: 'Line Complete', how: 'Finish all 10 lessons', test: (s) => s.done >= 10 },
  { id: 'whiz', emoji: '🧠', name: 'Quiz Whiz', how: 'Get 3 perfect quizzes', test: (s) => s.perfect >= 3 },
  { id: 'sharp', emoji: '🎯', name: 'Sharpshooter', how: 'Get 2 quizzes perfect on the first try', test: (s) => s.firstTry >= 2 },
  { id: 'mile', emoji: '🥾', name: 'Extra Mile', how: 'Do 3 stretch challenges', test: (s) => s.stretch >= 3 },
  { id: 'voice', emoji: '📣', name: 'Loud and Clear', how: 'Rate 3 lessons', test: (s) => s.rated >= 3 },
];

/** Everything the screens show about one student: XP, level, badges, what is next. */
export function statsFor(student) {
  const lessons = lessonsFor(student.grade);
  const s = { done: 0, perfect: 0, firstTry: 0, stretch: 0, rated: 0, xp: 0, log: [] };
  for (const l of lessons) {
    const p = student.lessons?.[l.id];
    const fb = student.fb?.[l.id];
    const parts = lessonXp(l, p, fb);
    const sum = parts.reduce((t, x) => t + x[1], 0);
    if (sum) s.log.push({ lesson: l, parts, sum });
    s.xp += sum;
    if (isDone(l, p)) s.done++;
    if (quizPassed(l, p) && p.quiz.best === l.quiz.length) s.perfect++;
    if (p?.quiz?.firstScore === l.quiz.length) s.firstTry++;
    if (shipped(p) && p.ship.stretch) s.stretch++;
    if (fb?.rating) s.rated++;
  }
  s.badges = BADGES.filter((b) => b.test(s));
  s.xp += s.badges.length * XP.badge;
  let level = 1;
  LEVELS.forEach(([need], i) => { if (s.xp >= need) level = i + 1; });
  s.level = level;
  s.title = LEVELS[level - 1][1];
  s.floor = LEVELS[level - 1][0];
  s.next = LEVELS[level]?.[0] ?? null;
  s.total = lessons.length;
  s.nextLesson = lessons.find((l) => !isDone(l, student.lessons?.[l.id])) || null;
  return s;
}

/** A lesson opens when the one before it is finished, or when the teacher has opened them all. */
export function isOpen(lesson, student, openAll) {
  if (openAll || lesson.n === 1) return true;
  const before = lessonsFor(lesson.grade)[lesson.n - 2];
  return isDone(before, student.lessons?.[before.id]);
}
