// Browser check: a pretend student joins each sample class and finishes every lesson through
// the real page, solving every lab by clicking. Then the teacher pages are opened.
//   node tools/serve.mjs   (in another terminal)
//   node e2e/walk.mjs http://localhost:8080 [folder for screenshots]
import { createRequire } from 'node:module';
import { lessonsFor, GRADES } from '../js/curriculum/index.js';
import { shortest, splitMessage, toBits, caesar } from '../js/labs/logic.js';

// Playwright is installed on the machine, not in this project, so it is loaded the way Node finds global packages.
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:8080';
const shots = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, reducedMotion: 'reduce' });
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.css|Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

async function solve(lab) {
  const box = page.locator('.lab').last();
  if (lab.type === 'speed') { await box.getByRole('button', { name: /Start the race/ }).click(); await box.locator('.choice').first().waitFor(); }
  if (lab.type === 'mcq' || lab.type === 'speed') await box.locator('.choice', { hasText: exact(lab.choices[lab.answer]) }).click();
  if (lab.type === 'sort') {
    for (let i = 0; i < lab.items.length; i++) {
      const text = await box.locator('.sort-card').textContent();
      await box.locator('.bin-btn').nth(lab.items.find((x) => x[0] === text)[1]).click();
    }
  }
  if (lab.type === 'order') {
    for (let i = 0; i < lab.items.length; i++) {
      const now = await box.locator('.order-text').allTextContents();
      for (let at = now.indexOf(lab.items[i]); at > i; at--) await box.locator('.order-item').nth(at).locator('.up').click();
    }
    await box.getByRole('button', { name: 'Check the order' }).click();
  }
  if (lab.type === 'match') {
    for (const [a, b] of lab.pairs) {
      await box.locator('.match-col').first().locator('.match-btn', { hasText: exact(a) }).click();
      await box.locator('.match-col').last().locator('.match-btn', { hasText: exact(b) }).click();
    }
  }
  if (lab.type === 'build') for (const [a, b] of lab.solution) { await box.locator(`[data-id="${a}"] rect`).click(); await box.locator(`[data-id="${b}"] rect`).click(); }
  if (lab.type === 'route') for (const id of shortest(lab).path.slice(1)) await box.locator(`[data-id="${id}"] circle`).click();
  if (lab.type === 'packets') {
    for (const p of splitMessage(lab.message, lab.size)) {
      if (p.n === lab.lose) await box.locator('.resend button', { hasText: exact(`#${p.n}`) }).click();
      await box.getByRole('button', { name: `Packet ${p.n}`, exact: true }).click();
    }
  }
  if (lab.type === 'binary') {
    for (const target of lab.targets) {
      const want = toBits(target, lab.bits);
      for (let i = 0; i < lab.bits; i++) {
        const on = (await box.locator('.bit').nth(i).getAttribute('aria-pressed')) === 'true';
        if (on !== (want[i] === '1')) await box.locator('.bit').nth(i).click();
      }
    }
  }
  if (lab.type === 'pixels') { const bits = lab.rows.join(''); for (let i = 0; i < bits.length; i++) if (bits[i] === '1') await box.locator('.px').nth(i).click(); }
  if (lab.type === 'deliver') {
    for (const addr of lab.packets) {
      const n = lab.nets.findIndex((net) => net.hosts.some((x) => `${net.prefix}.${x[0]}` === addr));
      await box.locator('.net').nth(n).locator('.host').nth(lab.nets[n].hosts.findIndex((x) => `${lab.nets[n].prefix}.${x[0]}` === addr)).click();
    }
  }
  if (lab.type === 'cipher') {
    if (lab.mode === 'crack') { await box.locator('input[type=range]').fill(String(lab.shift)); await box.getByRole('button', { name: 'This is the message' }).click(); } else {
      await box.locator('.answer').fill(lab.mode === 'encrypt' ? caesar(lab.text, lab.shift) : lab.text.toLowerCase());
      await box.getByRole('button', { name: 'Check' }).click();
    }
  }
  if (lab.type === 'crack') {
    await box.locator('input[type=range]').fill(String(lab.max));
    if (!lab.lockSets) for (const name of ['CAPITALS', 'digits 0–9', 'symbols !?#']) await box.getByLabel(name).check();
  }
  if (lab.type === 'troubleshoot') {
    for (let i = 0; i < (lab.need || 1); i++) await box.locator('.row .btn').nth(i).click();
    await box.locator('.choice', { hasText: exact(lab.fixes[lab.answer]) }).click();
  }
  await page.locator('.lab.solved').last().waitFor({ timeout: 4000 });
}

async function doLesson(lesson, first) {
  await page.goto(`${base}/#/go/${lesson.n}`);
  await page.locator('.lesson-head h1', { hasText: lesson.title }).waitFor();
  if (first) {
    // A locked button explains itself instead of doing nothing.
    // (Playwright will not click a button marked aria-disabled unless forced. A person can.)
    await page.getByRole('button', { name: /Accept the mission/ }).click({ force: true });
    await page.locator('.gate-note.bad').waitFor();
    await shot(`g${lesson.grade}-mission`);
  }
  await page.locator('textarea').fill('Phones, laptops and the printer.');
  await page.getByRole('button', { name: /Accept the mission/ }).click();
  for (const [i, step] of lesson.steps.entries()) {
    await page.locator('h2', { hasText: exact(step.title) }).waitFor();
    if (first && i === 1) await shot(`g${lesson.grade}-step-before`);
    try { await solve(step.lab); } catch (e) { await shot(`FAIL-${lesson.id}-${step.id}`); throw new Error(`${lesson.id} step ${step.id} (${step.lab.type}): ${e.message.split('\n')[0]}`); }
    if (first && i === 1) await shot(`g${lesson.grade}-step-solved`);
    await page.locator('.gate .btn:not(.locked)').click();
  }
  await page.locator('h2', { hasText: 'Check what you know' }).waitFor();
  for (const [i, m] of lesson.quiz.entries()) await page.locator('fieldset.q').nth(i).locator('label.opt', { hasText: exact(m.choices[m.answer]) }).click();
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await page.getByRole('button', { name: /On to your delivery/ }).click();
  await page.locator('textarea').fill('A network is devices connected so they can share information with each other.');
  await page.getByRole('button', { name: /Deliver it/ }).click();
  await page.locator('h2', { hasText: 'Delivered!' }).waitFor();
  await page.locator('.face').nth(4).click();
  await page.getByRole('button', { name: 'Send my rating' }).click();
  await page.locator('.note.ok', { hasText: 'Thanks for rating' }).waitFor();
  if (first) await shot(`g${lesson.grade}-done`);
}

try {
  await page.goto(base);
  await page.locator('h1', { hasText: 'Packet Express' }).waitFor();
  await shot('login');
  for (const grade of GRADES) {
    await page.locator('input').first().fill(`demo${grade}`);
    await page.locator('input').nth(1).fill('Test Kid');
    await page.getByRole('button', { name: 'Join my class' }).click();
    await page.locator('h1', { hasText: 'Hello, Test!' }).waitFor();
    if (grade === 6) await shot('home-new');
    for (const [i, lesson] of lessonsFor(grade).entries()) await doLesson(lesson, i === 0);
    await page.goto(`${base}/#/map`);
    await page.locator('.station.done').nth(10).waitFor();
    await shot(`g${grade}-map-complete`);
    const purse = await page.locator('#purse').textContent();
    console.log(`grade ${grade}: 10 lessons finished through the page · ${purse}`);
    if (grade === 6) { await page.goto(`${base}/#/`); await shot('home-finished'); await page.goto(`${base}/#/courier`); await shot('courier'); }
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.locator('h2', { hasText: 'I am a student' }).waitFor();
  }
  // A student asks for help; the teacher sees it.
  await page.locator('input').first().fill('DEMO6');
  await page.locator('input').nth(1).fill('Stuck Kid');
  await page.getByRole('button', { name: 'Join my class' }).click();
  await page.goto(`${base}/#/go/1`);
  await page.getByRole('button', { name: /I'm stuck/ }).click();
  await page.locator('.modal input').fill('Which box do I click?');
  await page.getByRole('button', { name: 'Ask my teacher' }).click();
  await page.locator('.help.asked').waitFor();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.getByRole('button', { name: 'Open the teacher desk' }).click();
  await page.locator('h1', { hasText: 'Your classes' }).waitFor();
  await shot('teacher-home');
  await page.locator('a.card', { hasText: 'Sample 6th grade' }).click();
  await page.locator('table.grid').waitFor();
  await page.locator('tr', { hasText: 'Test Kid' }).locator('.cell.done').nth(9).waitFor();
  await shot('teacher-progress');
  await page.getByRole('tab', { name: /Help requests \(1\)/ }).click();
  await page.locator('.help-row', { hasText: 'Which box do I click?' }).getByRole('button', { name: /Helped/ }).click();
  await page.locator('p', { hasText: 'Nobody is waiting' }).waitFor();
  await page.getByRole('tab', { name: 'Share and assign' }).click();
  await page.locator('.share-row').nth(11).waitFor();
  for (const [hash, text] of [['/feedback', 'Feedback'], ['/lessons/8', 'Lessons'], ['/standards', 'Standards'], ['/reports', 'Problem reports']]) {
    await page.goto(`${base}/#${hash}`);
    await page.locator('h1', { hasText: text }).waitFor();
    if (hash === '/lessons/8') await page.locator('details.plan').first().locator('summary').click();
    await shot(`teacher-${text.toLowerCase().replace(/ /g, '-')}`);
  }
  // Student view, and back.
  await page.getByRole('button', { name: /Student view/ }).click();
  await page.getByRole('button', { name: /Grade 7/ }).click();
  await page.locator('h1', { hasText: 'Hello, Student!' }).waitFor();
  await page.getByRole('button', { name: 'Back to teacher' }).click();
  await page.locator('h1', { hasText: 'Your classes' }).waitFor();
  // Phone width.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole('button', { name: /Student view/ }).click();
  await page.getByRole('button', { name: /Grade 6/ }).click();
  await page.goto(`${base}/#/lesson/g6-03`);
  await page.locator('textarea').fill('The router at home.');
  await page.getByRole('button', { name: /Accept the mission/ }).click();
  await shot('phone-step');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (wide) problems.push('the lesson page scrolls sideways at phone width');
} catch (e) { problems.push(e.message.split('\n').slice(0, 12).join('\n  ')); await shot('FAIL-last'); }

await browser.close();
if (problems.length) { console.error(`FAILED\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Browser check passed.');
