// The lesson player: Mission → Build → Quiz → Deliver, one step per screen.
import { h, add, clear, rich, attempt, toast, modal, ago } from '../ui.js';
import { app, go, updateStudent } from '../main.js';
import { getLesson, lessonsFor, standard, MIN_SHIP, PASS } from '../curriculum/index.js';
import { stageOf, quizPassed, stepsDone, lessonXp, isOpen, XP } from '../game/rules.js';
import { mountLab } from '../labs/index.js';
import { sound, floatXp, confetti, refuse, speak } from '../fx.js';

const STAGES = [['mission', 'Mission'], ['build', 'Build'], ['quiz', 'Quiz'], ['ship', 'Deliver']];
const FACES = ['😖', '🙁', '😐', '🙂', '🤩'];

export function viewLesson(main, id) {
  const { store } = app;
  const lesson = getLesson(id);
  const me = () => app.session.student;
  if (!lesson || lesson.grade !== me().grade) { go('/'); return null; }
  if (!isOpen(lesson, me(), me().preview || app.session.class?.open_all)) { toast(`Finish lesson ${lesson.n - 1} first.`); go('/'); return null; }
  const prog = () => me().lessons?.[lesson.id] || { steps: {} };
  const reached = () => stageOf(lesson, prog());
  let stage = reached();
  let stepAt = Math.min(lesson.steps.length - 1, Math.max(0, lesson.steps.findIndex((x) => !prog().steps?.[x.id])));
  if (stepsDone(lesson, prog()) === lesson.steps.length) stepAt = 0;

  const body = h('div.stack');
  const bar = h('ol.stages');
  const helpBox = h('div');
  let helpTimer = null;

  /** Save one piece of progress, then celebrate the XP it earned. */
  async function save(patch, from) {
    const before = lessonXp(lesson, prog(), me().fb?.[lesson.id]).reduce((t, x) => t + x[1], 0);
    const out = await attempt(() => store.saveProgress(lesson.id, patch));
    if (!out) return false;
    updateStudent(out);
    const gained = lessonXp(lesson, prog(), me().fb?.[lesson.id]).reduce((t, x) => t + x[1], 0) - before;
    if (gained > 0) floatXp(from, gained);
    return true;
  }

  const order = ['mission', 'build', 'quiz', 'ship', 'done'];
  const canVisit = (name) => order.indexOf(name) <= order.indexOf(reached());
  function drawBar() {
    add(clear(bar), ...STAGES.map(([name, label], i) => {
      const done = order.indexOf(reached()) > i;
      return h(`li${stage === name || (stage === 'done' && name === 'ship') ? '.here' : ''}${done ? '.done' : ''}`, h('button', { 'aria-current': stage === name ? 'step' : null, onclick: () => { if (canVisit(name)) show(name); else toast('Finish the part before this one first.'); } }, done ? '✓ ' : `${i + 1}. `, label));
    }));
  }
  function show(name) { stage = name; draw(); window.scrollTo(0, 0); }
  const gate = (ready, label, nudge, onGo, whyNot) => {
    const note = h('p.gate-note.small.muted', ready() ? '' : `To go on: ${whyNot().text}`);
    const btn = h(`button.btn.primary.big${ready() ? '' : '.locked'}`, { 'aria-disabled': ready() ? null : 'true', 'data-nudge': nudge, onclick: () => { if (ready()) onGo(btn); else { const w = whyNot(); refuse(btn, `To go on: ${w.text}`, w.el); } } }, label);
    return { el: h('div.gate', btn, note), refresh: () => { const ok = ready(); btn.classList.toggle('locked', !ok); if (ok) { btn.removeAttribute('aria-disabled'); note.textContent = ''; note.classList.remove('bad'); btn.classList.add('ready'); sound.good(); } } };
  };
  const readAloud = (text) => ('speechSynthesis' in window) && h('button.btn.small', { onclick: () => speak(text), title: 'Read this aloud' }, '🔊 Read aloud');

  function confusing(key, where) {
    const reason = h('select', store.FLAG_REASONS.map((r) => h('option', r)));
    const note = h('input', { type: 'text', maxlength: 300, placeholder: 'Anything to add? (optional)' });
    const close = modal('What was confusing?', [h('p.muted', where), h('label.field', h('span', 'Reason'), reason), h('label.field', h('span', 'Note'), note),
      h('button.btn.primary', { onclick: async () => { const ok = await attempt(async () => { await store.flagStep(lesson.id, key, reason.value, note.value); return true; }); if (ok) { close(); toast('Thanks. Your teacher will see this, without your name on it.'); } } }, 'Send')]);
  }
  const confusingLink = (key, where) => h('button.linkish.small', { onclick: () => confusing(key, where) }, '🤔 Confusing?');

  function mission() {
    const p = prog();
    const talk = h('textarea', { rows: 3, maxlength: 500, placeholder: 'Talk with a partner, then write one idea here.', 'data-nudge': 'Answer the partner question' });
    talk.value = p.talk || '';
    const text = `${lesson.mission.story} Goal: ${lesson.goal}`;
    const g = gate(() => p.mission || talk.value.trim().length >= 3, p.mission ? 'Go to the build steps →' : 'Accept the mission →', 'Press here to start building',
      async (btn) => { if (p.mission || await save({ mission: { talk: talk.value } }, btn)) show('build'); }, () => ({ text: 'write one idea in the partner box.', el: talk }));
    talk.addEventListener('input', () => { if (talk.value.trim().length >= 3) g.refresh(); });
    add(body, h('section.card.stack', h('p.tag', 'Your mission'), h('p.story', lesson.mission.story), h('div.row', readAloud(text)),
      h('div.goal', h('strong', '🎯 Goal: '), lesson.goal), h('div.goal', h('strong', '❓ Big question: '), lesson.big)),
    h('section.card', h('h3', 'Words for this lesson'), h('dl.vocab', lesson.vocab.flatMap(([w, d]) => [h('dt', w), h('dd', d)]))),
    h('section.card.stack', h('h3', '💬 Partner talk'), h('p', lesson.mission.talk), talk, g.el));
  }

  function build() {
    const step = lesson.steps[stepAt];
    const last = stepAt === lesson.steps.length - 1;
    const was = !!prog().steps?.[step.id];
    const where = `Step ${stepAt + 1}: ${step.title}`;
    const labBox = h('div');
    const g = gate(() => !!prog().steps?.[step.id], last ? 'On to the quiz →' : 'Next step →', 'Finish the activity, then press Next',
      () => { if (last) show('quiz'); else { stepAt++; show('build'); } }, () => ({ text: 'finish the activity above.', el: labBox }));
    mountLab(labBox, step.lab, { seed: `${lesson.id}${step.id}`, onDone: async () => { if (!prog().steps?.[step.id] && await save({ step: step.id }, labBox)) { g.refresh(); drawBar(); dots(); } } });
    const dotsEl = h('div.dots');
    function dots() { add(clear(dotsEl), ...lesson.steps.map((x, i) => h(`button.dot${i === stepAt ? '.here' : ''}${prog().steps?.[x.id] ? '.done' : ''}`, { 'aria-label': `Step ${i + 1}: ${x.title}`, onclick: () => { if (i <= stepsDone(lesson, prog())) { stepAt = i; show('build'); } else toast('Finish the steps before that one first.'); } }, prog().steps?.[x.id] ? '✓' : String(i + 1)))); }
    dots();
    add(body, h('section.card.stack', h('div.step-head', h('p.tag', `Step ${stepAt + 1} of ${lesson.steps.length}`), dotsEl), h('h2', step.title),
      step.text.map((t) => h('p', rich(t))), h('div.row', readAloud(step.text.join(' ')), confusingLink(`step:${step.id}`, where)),
      was && h('p.note.ok', '✓ You finished this step. You can do it again for practice.'), labBox,
      h('div.row.spread', stepAt > 0 ? h('button.btn', { onclick: () => { stepAt--; show('build'); } }, '← Back') : h('span'), g.el)));
  }

  function quiz() {
    const p = prog();
    const passedBefore = quizPassed(lesson, p);
    const answers = lesson.quiz.map(() => null);
    const need = Math.ceil(lesson.quiz.length * PASS);
    const blocks = lesson.quiz.map((m, i) => h('fieldset.q', h('legend', `${i + 1}. ${m.q}`), m.choices.map((c, j) => h('label.opt', h('input', { type: 'radio', name: `q${i}`, onchange: () => { answers[i] = j; if (answers.every((a) => a !== null)) g.refresh(); } }), h('span', c))), h('div.q-foot', confusingLink(`quiz:${i + 1}`, `Quiz question ${i + 1}`))));
    const result = h('div.stack');
    const g = gate(() => answers.every((a) => a !== null), 'Check my answers', 'Answer every question, then check', async (btn) => {
      if (!await save({ quiz: answers }, btn)) return;
      const score = answers.filter((a, i) => a === lesson.quiz[i].answer).length;
      const passed = score >= need;
      blocks.forEach((b, i) => { const right = answers[i] === lesson.quiz[i].answer; b.classList.add(right ? 'right' : 'wrong'); b.querySelectorAll('input').forEach((x) => { x.disabled = true; }); b.querySelector('.q-foot').prepend(h('p.small', right ? '✓ ' : '✗ ', lesson.quiz[i].why)); });
      g.el.remove();
      if (passed) sound.pass(); else sound.buzz();
      add(clear(result), h(`p.note.${passed ? 'ok' : 'bad'}`, passed ? `You got ${score} of ${lesson.quiz.length}. Passed!` : `You got ${score} of ${lesson.quiz.length}. You need ${need} to pass. Read the notes under each question, then try again.`),
        h('div.row', passed && h('button.btn.primary.big', { onclick: () => show('ship'), 'data-nudge': 'Press here to finish the lesson' }, 'On to your delivery →'), h('button.btn', { onclick: () => show('quiz') }, passed ? 'Try for a better score' : 'Try again')));
      drawBar();
      result.scrollIntoView({ block: 'center' });
    }, () => { const i = answers.findIndex((a) => a === null); return { text: `answer question ${i + 1}.`, el: blocks[i] }; });
    add(body, h('section.card.stack', h('p.tag', 'Quiz'), h('h2', 'Check what you know'), h('p.muted', `${lesson.quiz.length} questions. Get ${need} right to pass. You can try again as often as you like.`),
      passedBefore && h('p.note.ok', `✓ Already passed. Your best score is ${p.quiz.best} of ${lesson.quiz.length}. `, h('button.linkish', { onclick: () => show('ship') }, 'Skip to your delivery')),
      blocks, g.el, result));
  }

  function ship() {
    const p = prog();
    const text = h('textarea', { rows: 5, maxlength: 2000, 'data-nudge': 'Write your answer here' });
    text.value = p.ship?.text || '';
    const stretch = h('input', { type: 'checkbox', checked: !!p.ship?.stretch });
    const count = h('span.small.muted');
    const ready = () => text.value.trim().length >= MIN_SHIP;
    const g = gate(ready, '📦 Deliver it', 'Press here to deliver your work', async (btn) => {
      const first = reached() !== 'done';
      if (!await save({ ship: { text: text.value, stretch: stretch.checked } }, btn)) return;
      if (first) { sound.pass(); confetti(); }
      show('done');
    }, () => ({ text: `write at least ${MIN_SHIP} characters.`, el: text }));
    const tally = () => { count.textContent = `${text.value.trim().length} characters`; if (ready()) g.refresh(); };
    text.addEventListener('input', tally);
    tally();
    add(body, h('section.card.stack', h('p.tag', 'Deliver'), h('h2', 'Show what you learned'), h('p', lesson.ship.prompt),
      h('div.frame', h('span.small.muted', 'Sentence starter: '), h('span', lesson.ship.frame), ' ', h('button.btn.small', { onclick: () => { if (!text.value.trim()) { text.value = lesson.ship.frame; tally(); } text.focus(); } }, 'Use it')),
      text, count, h('div.stretch', h('h3', `🥾 Stretch challenge (+${XP.stretch} XP)`), h('p', lesson.ship.stretch), h('label.check', stretch, 'I did the stretch challenge')), g.el));
  }

  function done() {
    const parts = lessonXp(lesson, prog(), me().fb?.[lesson.id]);
    const next = lessonsFor(lesson.grade)[lesson.n];
    const rate = h('section.card.stack');
    function drawRate() {
      if (me().fb?.[lesson.id]?.rating) { add(clear(rate), h('p.note.ok', `Thanks for rating this lesson ${FACES[me().fb[lesson.id].rating - 1]}`)); return; }
      let picked = 0;
      const faces = FACES.map((f, i) => h('button.face', { 'aria-label': `${i + 1} out of 5`, 'aria-pressed': 'false', onclick: () => { picked = i + 1; faces.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); } }, f));
      const hardest = h('input', { type: 'text', maxlength: 300 });
      const change = h('input', { type: 'text', maxlength: 300 });
      add(clear(rate), h('h3', `⭐ Rate this lesson (+${XP.rated} XP)`), h('div.row', faces), h('label.field', h('span', 'What was the hardest part? (optional)'), hardest), h('label.field', h('span', 'What would make this lesson better? (optional)'), change),
        h('button.btn', { onclick: async (e) => { const out = await attempt(() => store.rateLesson(lesson.id, picked, hardest.value, change.value)); if (out) { updateStudent(out); floatXp(e.target, XP.rated); drawRate(); } } }, 'Send my rating'));
    }
    drawRate();
    add(body, h('section.card.stack.center', h('p.big-emoji', '🎉'), h('h2', 'Delivered!'), h('p.lead', `You finished "${lesson.title}" and added ${lesson.adds} to your network.`),
      h('table.plain.narrow', parts.map(([why, xp]) => h('tr', h('td', why), h('td.num', `+${xp} XP`))), h('tr.total', h('th', 'This lesson'), h('th.num', `${parts.reduce((t, x) => t + x[1], 0)} XP`))),
      h('div.row.center', next ? h('a.btn.primary.big', { href: `#/lesson/${next.id}`, 'data-nudge': 'Go on to the next lesson' }, `Next: ${next.title} →`) : h('a.btn.primary.big', { href: '#/map' }, '🏆 See your finished line'), h('a.btn', { href: '#/map' }, 'Network map'), h('button.btn', { onclick: () => show('ship') }, 'Edit my delivery'))),
    rate);
  }

  // "I'm stuck": one request per student, cleared by the student or the teacher.
  async function drawHelp() {
    if (me().preview || !app.session.class) { clear(helpBox); return; }
    const mine = await store.myHelp().catch(() => null);
    const step = lesson.steps[stepAt];
    const where = stage === 'build' ? `${lesson.title} · Step ${stepAt + 1}: ${step.title}` : `${lesson.title} · ${stage === 'ship' ? 'Deliver' : stage[0].toUpperCase() + stage.slice(1)}`;
    if (mine) {
      add(clear(helpBox), h('div.help.asked', h('strong', '✋ Help is on the way. '), `Keep trying while you wait. (Asked ${ago(mine.at)}.) `, h('button.btn.small', { onclick: async () => { await attempt(() => store.cancelHelp()); drawHelp(); } }, 'I figured it out 👍')));
    } else {
      add(clear(helpBox), h('div.help', h('button.btn', { onclick: () => {
        const note = h('input', { type: 'text', maxlength: 140, placeholder: 'What are you stuck on? (optional)' });
        const close = modal('Ask for help', [h('p.muted', where), note, h('button.btn.primary', { onclick: async () => { const ok = await attempt(async () => { await store.askHelp(where, note.value, lesson.id, stage === 'build' ? `step:${step.id}` : stage); return true; }); if (ok) { close(); drawHelp(); } } }, 'Ask my teacher')]);
      } }, '✋ I\'m stuck: ask for help')));
    }
  }

  function draw() {
    clear(body);
    drawBar();
    ({ mission, build, quiz, ship, done })[stage]();
    drawHelp();
  }
  add(main, h('div.lesson-head', h('a.linkish', { href: '#/' }, '← Home'), h('h1', h('span', { 'aria-hidden': 'true' }, `${lesson.emoji} `), `${lesson.n}. ${lesson.title}`),
    h('p.small.muted', lesson.standards.map((c) => h('span.pill', { title: standard(c).text, translate: 'no' }, c)))), bar, body, helpBox);
  draw();
  helpTimer = setInterval(() => { if (!document.hidden) drawHelp(); }, 30000);
  return () => { clearInterval(helpTimer); window.speechSynthesis?.cancel(); };
}
