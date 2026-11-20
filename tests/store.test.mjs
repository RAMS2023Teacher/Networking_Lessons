import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore } from '../js/data/local.js';
import { lessonsFor } from '../js/curriculum/index.js';
import { statsFor, isDone, XP } from '../js/game/rules.js';

function memory(start) {
  const data = new Map(start ? [['packet-express:v1', start]] : []);
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), data };
}
const [L1, L2] = lessonsFor(6);
async function finish(store, lesson, quiz = lesson.quiz.map((m) => m.answer)) {
  await store.saveProgress(lesson.id, { mission: { talk: 'idea' } });
  for (const s of lesson.steps) await store.saveProgress(lesson.id, { step: s.id });
  await store.saveProgress(lesson.id, { quiz });
  return store.saveProgress(lesson.id, { ship: { text: 'A network is devices that share information.', stretch: true } });
}

test('a student joins, finishes a lesson and earns XP once', async () => {
  const store = createLocalStore(memory());
  const s = await store.studentJoin('demo6', 'Kai P.');
  assert.equal(s.student.grade, 6);
  const out = await finish(store, L1);
  assert.ok(isDone(L1, out.lessons[L1.id]));
  const want = XP.mission + L1.steps.length * XP.step + XP.quiz + XP.perfect + XP.first + XP.ship + XP.stretch + XP.lesson + XP.badge;
  assert.equal(statsFor(out).xp, want);
  assert.equal(statsFor(await finish(store, L1)).xp, want, 'doing it again pays nothing more');
});
test('the store grades the quiz itself and keeps the first try', async () => {
  const store = createLocalStore(memory());
  await store.studentJoin('DEMO6', 'Kai P.');
  const wrong = L1.quiz.map((m) => (m.answer + 1) % m.choices.length);
  let out = await finish(store, L1, wrong);
  assert.equal(out.lessons[L1.id].quiz.best, 0);
  assert.ok(!isDone(L1, out.lessons[L1.id]));
  out = await store.saveProgress(L1.id, { quiz: L1.quiz.map((m) => m.answer) });
  assert.equal(out.lessons[L1.id].quiz.firstScore, 0);
  assert.equal(out.lessons[L1.id].quiz.best, 4);
  assert.ok(isDone(L1, out.lessons[L1.id]));
});
test('refuses locked lessons, other courses, unknown steps and half-answered quizzes', async () => {
  const store = createLocalStore(memory());
  await store.studentJoin('DEMO6', 'Kai P.');
  await assert.rejects(store.saveProgress(L2.id, { mission: { talk: 'x' } }), /before this one/);
  await assert.rejects(store.saveProgress('g7-01', { mission: { talk: 'x' } }), /not in your course/);
  await assert.rejects(store.saveProgress(L1.id, { step: 'zz' }), /Unknown step/);
  await assert.rejects(store.saveProgress(L1.id, { quiz: [0] }), /every question/);
  await assert.rejects(store.listClasses(), /Only a teacher/);
  await assert.rejects(store.updateProfile({ avatar: { ride: '🛸', color: '#3a3a3a' } }), /level 10/);
});
test('saved work that cannot be read is never replaced', async () => {
  const mem = memory('{broken');
  const store = createLocalStore(mem);
  await assert.rejects(store.session(), /could not be read/);
  assert.equal(mem.data.get('packet-express:v1'), '{broken');
});
test('teacher: classes, help queue, feedback without names, student view, backup', async () => {
  const mem = memory();
  const store = createLocalStore(mem);
  await store.teacherEnter();
  const cls = await store.createClass('Period 3', 7);
  await store.studentJoin(cls.code, 'Rosa M.');
  await store.askHelp('Lesson 1', 'help', 'g7-01', 'step:a');
  await store.flagStep('g7-01', 'step:a', 'Too hard', 'huh');
  await store.teacherEnter();
  assert.equal((await store.helpRequests(cls.id)).length, 1);
  assert.ok(!JSON.stringify(await store.feedback(7)).includes('Rosa'));
  const preview = await store.previewStart(8);
  assert.ok(preview.student.preview);
  await store.saveProgress('g8-05', { mission: { talk: 'any lesson is open' } });
  await store.previewEnd();
  assert.ok(!(await store.listClasses()).some((c) => c.count > 5 && c.sample), 'the pretend student is in no class');
  const backup = await store.exportData();
  await store.deleteClass(cls.id);
  await store.importData(backup);
  assert.equal((await store.classBoard(cls.id))[0].name, 'Rosa M.');
  await assert.rejects(store.importData('{"v":2}'), /not a Packet Express backup/);
});
