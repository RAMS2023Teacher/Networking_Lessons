// Data store that keeps everything in this browser. It has the same methods a hosted store
// needs, and it does the server's jobs itself: it grades quizzes, checks which lessons are
// open and refuses anything a student should not be able to save.
import { getLesson, lessonsFor, GRADES } from '../curriculum/index.js';
import { isDone, isOpen, defaultAvatar, statsFor, RIDES, COLORS } from '../game/rules.js';

const KEY = 'packet-express:v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const clip = (text, max) => String(text ?? '').trim().slice(0, max);
const FLAG_REASONS = ['Instructions unclear', 'It did not work', 'Too hard', 'Too easy', 'Other'];
const BUG_KINDS = ['Something did not work', 'Words are wrong or confusing', 'I cannot find something', 'Something else'];

/** Finished progress for one lesson, for the made-up students in the sample classes. */
function sampleProgress(lesson, score, text) {
  const answers = lesson.quiz.map((m, i) => (i < score ? m.answer : (m.answer + 1) % m.choices.length));
  return { mission: true, talk: '', steps: Object.fromEntries(lesson.steps.map((s) => [s.id, true])), quiz: { first: answers, firstScore: score, best: Math.max(score, 3), tries: score < 3 ? 2 : 1, last: answers }, ship: { text, stretch: score === 4 }, done: true, at: now() };
}

function seed() {
  const db = { v: 1, teacher: { name: 'Teacher' }, classes: [], students: [], help: [], bugs: [], session: null };
  const names = ['Ava R.', 'Ben K.', 'Chloe M.', 'Diego S.', 'Emi T.'];
  for (const grade of GRADES) {
    const cls = { id: uid(), name: `Sample ${grade}th grade`, grade, code: `DEMO${grade}`, open_all: false, sample: true };
    db.classes.push(cls);
    const lessons = lessonsFor(grade);
    names.forEach((name, i) => {
      const s = { id: uid(), class_id: cls.id, name, avatar: defaultAvatar(name + grade), lessons: {}, fb: {}, sample: true, joined: now() };
      lessons.slice(0, 4 - i).forEach((l, j) => {
        s.lessons[l.id] = sampleProgress(l, 4 - ((i + j) % 3), 'A network is devices connected so they can share information.');
        s.fb[l.id] = { flags: {}, rating: 5 - ((i + j) % 3), hardest: j === 0 ? 'Knowing which port to use.' : '', change: '' };
      });
      if (i === 1) s.fb[lessons[0].id].flags = { 'step:c': { reason: 'Instructions unclear', note: 'I did not know I could click the switch.', at: now() } };
      db.students.push(s);
    });
  }
  return db;
}

export function createLocalStore(storage = globalThis.localStorage) {
  let db = null;

  function open() {
    if (db) return db;
    const raw = storage.getItem(KEY);
    if (raw === null) { db = seed(); write(); return db; }
    // Saved work that cannot be read is an error. It is never treated as "nothing saved yet".
    try { db = JSON.parse(raw); } catch (_) { throw new Error('The saved work on this device could not be read. Nothing has been changed. Ask your teacher before clearing any browser data.'); }
    if (!db || !Array.isArray(db.students) || !Array.isArray(db.classes)) { db = null; throw new Error('The saved work on this device is damaged. Nothing has been changed.'); }
    return db;
  }
  function write() {
    try { storage.setItem(KEY, JSON.stringify(db)); } catch (_) { throw new Error('Could not save. This browser\'s storage may be full or switched off.'); }
  }

  const classOf = (id) => open().classes.find((c) => c.id === id);
  const publicClass = (c) => c && { id: c.id, name: c.name, grade: c.grade, code: c.code, open_all: !!c.open_all, sample: !!c.sample };
  const gradeOf = (s) => s.grade || classOf(s.class_id)?.grade;
  const publicStudent = (s) => ({ id: s.id, name: s.name, avatar: s.avatar, grade: gradeOf(s), lessons: s.lessons, fb: s.fb, preview: !!s.preview, class_id: s.class_id || null });

  function who() {
    const d = open();
    if (!d.session) throw new Error('SIGNED_OUT');
    return d.session;
  }
  function me() {
    const s = who();
    if (s.role !== 'student') throw new Error('Only a student can do that.');
    const student = open().students.find((x) => x.id === s.id);
    if (!student) throw new Error('SIGNED_OUT');
    return student;
  }
  function teacher() {
    if (who().role !== 'teacher') throw new Error('Only a teacher can do that.');
  }
  function sessionView() {
    const d = open();
    const s = d.session;
    if (!s) return null;
    if (s.role === 'teacher') return { role: 'teacher', teacher: { name: d.teacher.name } };
    const student = d.students.find((x) => x.id === s.id);
    if (!student) { d.session = null; write(); return null; }
    return { role: 'student', student: publicStudent(student), class: publicClass(classOf(student.class_id)) };
  }
  const wrap = (fn) => async (...args) => fn(...args);

  const api = {
    mode: 'local',
    session: sessionView,

    /** Join a class with its code and a name. The same name in the same class is the same student. */
    studentJoin(code, name) {
      const d = open();
      const cls = d.classes.find((c) => c.code === clip(code, 12).toUpperCase());
      if (!cls) throw new Error('No class has that code. Check it with your teacher.');
      const clean = clip(name, 30);
      if (clean.length < 2) throw new Error('Type your first name and last initial.');
      let s = d.students.find((x) => x.class_id === cls.id && x.name.toLowerCase() === clean.toLowerCase());
      if (!s) { s = { id: uid(), class_id: cls.id, name: clean, avatar: defaultAvatar(clean), lessons: {}, fb: {}, joined: now() }; d.students.push(s); }
      d.session = { role: 'student', id: s.id };
      write();
      return sessionView();
    },
    teacherEnter() { const d = open(); d.session = { role: 'teacher' }; write(); return sessionView(); },
    signOut() { const d = open(); d.session = null; write(); },

    /** Student view: the teacher uses a course as a pretend student who is in no class. */
    previewStart(grade) {
      teacher();
      const d = open();
      if (!GRADES.includes(Number(grade))) throw new Error('Pick a grade.');
      const id = `preview-${grade}`;
      if (!d.students.some((x) => x.id === id)) d.students.push({ id, class_id: null, grade: Number(grade), name: 'Student view', avatar: defaultAvatar(id), lessons: {}, fb: {}, preview: true, joined: now() });
      d.session = { role: 'student', id, back: 'teacher' };
      write();
      return sessionView();
    },
    previewReset() { const s = me(); if (!s.preview) throw new Error('Only in student view.'); s.lessons = {}; s.fb = {}; write(); return sessionView(); },
    previewEnd() { const d = open(); if (who().back !== 'teacher') throw new Error('Not in student view.'); d.session = { role: 'teacher' }; write(); return sessionView(); },

    /** Save one piece of lesson progress. `patch` is one of {mission}, {step}, {quiz}, {ship}. */
    saveProgress(lessonId, patch) {
      const s = me();
      const lesson = getLesson(lessonId);
      if (!lesson || lesson.grade !== gradeOf(s)) throw new Error('That lesson is not in your course.');
      if (!isOpen(lesson, s, s.preview || classOf(s.class_id)?.open_all)) throw new Error('Finish the lesson before this one first.');
      const p = s.lessons[lessonId] || (s.lessons[lessonId] = { steps: {} });
      if (patch.mission) { p.mission = true; p.talk = clip(patch.mission.talk, 500); }
      if (patch.step) {
        if (!lesson.steps.some((x) => x.id === patch.step)) throw new Error('Unknown step.');
        p.steps[patch.step] = true;
      }
      if (patch.quiz) {
        const answers = lesson.quiz.map((_, i) => Number(patch.quiz[i]));
        if (answers.some((a, i) => !(a >= 0 && a < lesson.quiz[i].choices.length))) throw new Error('Answer every question first.');
        const score = answers.filter((a, i) => a === lesson.quiz[i].answer).length;
        const quiz = p.quiz || (p.quiz = { tries: 0, best: 0 });
        if (!quiz.first) { quiz.first = answers; quiz.firstScore = score; }
        quiz.tries++; quiz.best = Math.max(quiz.best, score); quiz.last = answers;
      }
      if (patch.ship) p.ship = { text: clip(patch.ship.text, 2000), stretch: !!patch.ship.stretch };
      p.done = isDone(lesson, p);
      if (p.done && !p.done_at) p.done_at = now();
      p.at = now();
      write();
      return publicStudent(s);
    },
    updateProfile({ avatar }) {
      const s = me();
      const ride = RIDES.find((r) => r[0] === avatar?.ride);
      if (!ride || !COLORS.includes(avatar.color)) throw new Error('Pick a ride and a color.');
      if (!s.preview && ride[1] > statsFor(publicStudent(s)).level) throw new Error(`That ride unlocks at level ${ride[1]}.`);
      s.avatar = { ride: ride[0], color: avatar.color };
      write();
      return publicStudent(s);
    },

    flagStep(lessonId, key, reason, note) {
      const s = me();
      if (!getLesson(lessonId) || !/^(step|quiz):\w+$/.test(key) || !FLAG_REASONS.includes(reason)) throw new Error('Pick a reason.');
      const fb = s.fb[lessonId] || (s.fb[lessonId] = { flags: {} });
      fb.flags[key] = { reason, note: clip(note, 300), at: now() };
      write();
    },
    rateLesson(lessonId, rating, hardest, change) {
      const s = me();
      if (!getLesson(lessonId) || !(rating >= 1 && rating <= 5)) throw new Error('Pick a face.');
      const fb = s.fb[lessonId] || (s.fb[lessonId] = { flags: {} });
      Object.assign(fb, { rating: Math.round(rating), hardest: clip(hardest, 300), change: clip(change, 300) });
      write();
      return publicStudent(s);
    },

    askHelp(where, note, lessonId, stepKey) {
      const s = me();
      const d = open();
      d.help = d.help.filter((x) => x.student_id !== s.id);
      d.help.push({ student_id: s.id, class_id: s.class_id, name: s.name, avatar: s.avatar, where: clip(where, 120), note: clip(note, 140), at: now() });
      if (getLesson(lessonId) && stepKey) { const fb = s.fb[lessonId] || (s.fb[lessonId] = { flags: {} }); fb.help = fb.help || {}; fb.help[stepKey] = (fb.help[stepKey] || 0) + 1; }
      write();
    },
    cancelHelp() { const s = me(); const d = open(); d.help = d.help.filter((x) => x.student_id !== s.id); write(); },
    myHelp() { const s = me(); return open().help.find((x) => x.student_id === s.id) || null; },
    helpRequests(classId) { teacher(); const hour = Date.now() - 3600e3; return open().help.filter((x) => x.class_id === classId && Date.parse(x.at) > hour); },
    markHelped(studentId) { teacher(); const d = open(); d.help = d.help.filter((x) => x.student_id !== studentId); write(); },

    listClasses() { teacher(); const d = open(); return d.classes.map((c) => ({ ...publicClass(c), count: d.students.filter((s) => s.class_id === c.id).length })); },
    createClass(name, grade) {
      teacher();
      const d = open();
      const clean = clip(name, 40);
      if (!clean) throw new Error('Give the class a name.');
      if (!GRADES.includes(Number(grade))) throw new Error('Pick a grade.');
      let code;
      do { code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join(''); } while (d.classes.some((c) => c.code === code));
      const cls = { id: uid(), name: clean, grade: Number(grade), code, open_all: false };
      d.classes.push(cls);
      write();
      return publicClass(cls);
    },
    deleteClass(id) { teacher(); const d = open(); d.classes = d.classes.filter((c) => c.id !== id); d.students = d.students.filter((s) => s.class_id !== id); d.help = d.help.filter((x) => x.class_id !== id); write(); },
    setOpenAll(id, on) { teacher(); const c = classOf(id); if (!c) throw new Error('No such class.'); c.open_all = !!on; write(); return publicClass(c); },
    getClass(id) { teacher(); const c = classOf(id); if (!c) throw new Error('No such class.'); return publicClass(c); },
    classBoard(id) { teacher(); return open().students.filter((s) => s.class_id === id).map(publicStudent).sort((a, b) => a.name.localeCompare(b.name)); },
    removeStudent(id) { teacher(); const d = open(); d.students = d.students.filter((s) => s.id !== id); d.help = d.help.filter((x) => x.student_id !== id); write(); },
    /** Every student's feedback and first quiz tries for one grade, with no names attached. */
    feedback(grade) {
      teacher();
      const d = open();
      const inGrade = new Set(d.classes.filter((c) => c.grade === Number(grade)).map((c) => c.id));
      return d.students.filter((s) => inGrade.has(s.class_id)).map((s) => ({ lessons: s.lessons, fb: s.fb }));
    },

    reportBug(kind, text, context) {
      const d = open();
      if (!BUG_KINDS.includes(kind) || clip(text, 1000).length < 3) throw new Error('Pick a kind and describe the problem.');
      d.bugs.push({ id: uid(), kind, text: clip(text, 1000), context: clip(JSON.stringify(context || {}), 2000), role: d.session?.role || 'visitor', at: now(), fixed: false });
      write();
    },
    bugReports() { teacher(); return open().bugs.slice().reverse(); },
    closeBug(id) { teacher(); const d = open(); d.bugs = d.bugs.filter((b) => b.id !== id); write(); },

    /** Everything saved on this device, as text the teacher can keep as a backup. */
    exportData() { teacher(); const d = open(); return JSON.stringify({ ...d, session: null, exported: now() }, null, 1); },
    importData(text) {
      teacher();
      let next;
      try { next = JSON.parse(text); } catch (_) { throw new Error('That file is not a Packet Express backup.'); }
      if (next?.v !== 1 || !Array.isArray(next.students) || !Array.isArray(next.classes)) throw new Error('That file is not a Packet Express backup.');
      db = { v: 1, teacher: next.teacher || { name: 'Teacher' }, classes: next.classes, students: next.students, help: [], bugs: next.bugs || [], session: { role: 'teacher' } };
      write();
    },
    dataInfo() { teacher(); const d = open(); return { classes: d.classes.length, students: d.students.filter((s) => !s.preview).length, bytes: (storage.getItem(KEY) || '').length }; },
  };

  const store = { FLAG_REASONS, BUG_KINDS };
  for (const [name, fn] of Object.entries(api)) store[name] = typeof fn === 'function' ? wrap(fn) : fn;
  return store;
}
