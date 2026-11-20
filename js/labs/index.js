// The interactive labs. Each one draws itself into a box and calls done() once it is solved.
// The rules they check live in logic.js.
import { h, add, s, clear } from '../ui.js';
import { sound, calm } from '../fx.js';
import { shuffle, hasLink, linkProblem, checkBuild, shortest, linkBetween, caesar, lettersOnly, splitMessage, toBits, poolSize, crackSeconds, howLong, YEAR, transferSeconds, WIRELESS } from './logic.js';

export const ICON = { pc: '🖥️', laptop: '💻', phone: '📱', tablet: '📲', watch: '⌚', printer: '🖨️', server: '🗄️', switch: '🔀', router: '🧭', ap: '📶', modem: '📟', internet: '🌐', tower: '🗼', firewall: '🧱', tv: '📺', console: '🎮', town: '🏘️' };

/** Keep a label under its device from running off the edge of the board. */
const labelX = (x, text) => Math.min(Math.max(x, text.length * 0.78 + 1), 99 - text.length * 0.78);
const status = () => h('p.lab-msg', { role: 'status', 'aria-live': 'polite' });
const say = (el, text, kind = '') => { el.textContent = text; el.className = `lab-msg ${kind}`; };
const shake = (el) => { if (calm()) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

function mcq(box, lab, { done }) {
  const msg = status();
  const buttons = lab.choices.map((c, i) => h('button.choice', { onclick: () => {
    if (i === lab.answer) {
      buttons.forEach((b) => { b.disabled = true; });
      buttons[i].classList.add('right');
      say(msg, `✓ ${lab.why}`, 'ok'); sound.good(); done();
    } else { buttons[i].classList.add('wrong'); buttons[i].disabled = true; say(msg, 'Not quite. Read it again and try another.', 'bad'); sound.buzz(); }
  } }, c));
  add(box, h('p.lab-q', lab.q), h('div.choices', buttons), msg);
}

function sort(box, lab, { seed, done }) {
  const items = shuffle(lab.items, seed);
  let i = 0;
  const msg = status();
  const card = h('div.sort-card', { 'aria-live': 'polite' });
  const count = h('span.muted.small');
  const lists = lab.bins.map(() => h('ul.bin-list'));
  const choose = (b) => {
    if (i >= items.length) return;
    if (items[i][1] === b) { add(lists[b], h('li', items[i][0])); i++; sound.tick(); say(msg, ''); show(); } else { sound.buzz(); shake(card); say(msg, 'Not that one. Think again.', 'bad'); }
  };
  function show() {
    if (i >= items.length) { card.textContent = '✓ All sorted'; card.classList.add('finished'); count.textContent = ''; say(msg, 'Every card is in the right place.', 'ok'); sound.good(); done(); return; }
    card.textContent = items[i][0];
    count.textContent = `Card ${i + 1} of ${items.length}`;
  }
  add(box, h('p.lab-q', lab.prompt), h('div.sort-top', card, count),
    h('div.bins', lab.bins.map((name, b) => h('div.bin', h('button.btn.bin-btn', { onclick: () => choose(b) }, name), lists[b]))), msg);
  show();
}

function order(box, lab, { seed, done }) {
  let items = shuffle(lab.items, seed);
  let locked = false;
  const msg = status();
  const list = h('ol.order-list');
  const move = (i, by) => { const j = i + by; if (locked || j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; sound.tick(); draw(); list.children[j].querySelector(by < 0 ? '.up' : '.down').focus(); };
  function draw(marks) {
    add(clear(list), ...items.map((text, i) => h(`li.order-item${marks ? (marks[i] ? '.right' : '.wrong') : ''}`, h('span.order-text', text),
      h('span.order-btns', h('button.btn.small.up', { 'aria-label': `Move up: ${text}`, onclick: () => move(i, -1) }, '▲'), h('button.btn.small.down', { 'aria-label': `Move down: ${text}`, onclick: () => move(i, 1) }, '▼')))));
  }
  const check = () => {
    if (locked) return;
    const marks = items.map((t, i) => t === lab.items[i]);
    draw(marks);
    if (marks.every(Boolean)) { locked = true; say(msg, '✓ That is the right order.', 'ok'); sound.good(); done(); } else { say(msg, `${marks.filter(Boolean).length} of ${items.length} are in the right place. Move the red ones.`, 'bad'); sound.buzz(); }
  };
  add(box, h('p.lab-q', lab.prompt), list, h('button.btn.primary', { onclick: check }, 'Check the order'), msg);
  draw();
}

function match(box, lab, { seed, done }) {
  const right = shuffle(lab.pairs.map((p) => p[1]), seed);
  let picked = null;
  let made = 0;
  const msg = status();
  const lefts = lab.pairs.map(([term], i) => h('button.match-btn', { onclick: () => { picked = i; lefts.forEach((b, j) => b.setAttribute('aria-pressed', j === i)); say(msg, 'Now pick its match on the right.'); } }, term));
  const rights = right.map((text, j) => h('button.match-btn', { onclick: () => {
    if (picked === null) { say(msg, 'Pick one on the left first.', 'bad'); return; }
    if (lab.pairs[picked][1] === text) {
      made++;
      for (const b of [lefts[picked], rights[j]]) { b.disabled = true; b.classList.add('matched'); b.prepend(h('span.match-n', String(made))); b.removeAttribute('aria-pressed'); }
      picked = null; sound.tick();
      if (made === lab.pairs.length) { say(msg, '✓ All matched.', 'ok'); sound.good(); done(); } else say(msg, '');
    } else { sound.buzz(); shake(rights[j]); say(msg, 'Those do not go together. Try again.', 'bad'); }
  } }, text));
  add(box, h('p.lab-q', lab.prompt), h('div.match', h('div.match-col', lefts), h('div.match-col', rights)), msg,
    lab.table && h('table.ref', lab.table.map((row, i) => h('tr', row.map((cell) => h(i ? 'td' : 'th', cell))))));
}

function build(box, lab, { done }) {
  let links = [];
  let picked = null;
  let solved = false;
  const msg = status();
  const at = (id) => lab.devices.find((x) => x.id === id);
  const gLinks = s('g');
  const gDevs = s('g');
  const goals = h('ul.goals');
  const svg = s('svg.board', { viewBox: '0 0 100 62', role: 'group', 'aria-label': 'Network board' }, gLinks, gDevs);
  function click(id) {
    if (picked === null) { picked = id; say(msg, `${at(id).label} picked. Now click what it connects to.`); } else if (picked === id) { picked = null; say(msg, ''); } else {
      const a = picked;
      picked = null;
      if (hasLink(links, a, id)) { links = links.filter((l) => !(l.includes(a) && l.includes(id))); sound.tick(); say(msg, 'Connection removed.'); } else {
        const why = linkProblem(lab, links, a, id);
        if (why) { sound.buzz(); say(msg, why, 'bad'); } else { links.push([a, id]); sound.tick(); say(msg, ''); }
      }
    }
    draw();
  }
  function draw() {
    add(clear(gLinks), ...links.map(([a, b]) => s(`line.link${WIRELESS.has(at(a).kind) || WIRELESS.has(at(b).kind) ? '.wireless' : ''}`, { x1: at(a).x, y1: at(a).y, x2: at(b).x, y2: at(b).y })));
    add(clear(gDevs), ...lab.devices.map((dev) => s(`g.dev${picked === dev.id ? '.picked' : ''}`, { tabindex: 0, role: 'button', 'aria-label': dev.label, 'aria-pressed': picked === dev.id, 'data-id': dev.id,
      onclick: () => click(dev.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(dev.id); gDevs.querySelector(`[data-id="${dev.id}"]`)?.focus(); } } },
      s('rect', { x: dev.x - 5.5, y: dev.y - 5.5, width: 11, height: 11, rx: 2 }), s('text.dev-icon', { x: dev.x, y: dev.y + 2.4, 'text-anchor': 'middle' }, ICON[dev.kind] || '❔'), s('text.dev-label', { x: labelX(dev.x, dev.label), y: dev.y + 9, 'text-anchor': 'middle' }, dev.label))));
    const result = checkBuild(lab, links);
    add(clear(goals), ...result.goals.map((g) => h(`li${g.ok ? '.ok' : ''}`, g.ok ? '✓ ' : '○ ', g.text)));
    if (result.ok && !solved) { solved = true; say(msg, '✓ The network works. Every goal is met.', 'ok'); sound.good(); done(); }
  }
  add(box, h('p.lab-q', lab.prompt), h('p.muted.small', 'Click one device, then another, to connect them. Click the same pair again to disconnect. Dashed lines are wireless.', lab.max ? ` You have ${lab.max} cables.` : ''), svg, goals, msg,
    h('button.btn.small', { onclick: () => { links = []; picked = null; say(msg, 'Cleared.'); draw(); } }, 'Clear all connections'));
  draw();
}

function route(box, lab, { done }) {
  const best = shortest(lab);
  let path = [lab.from];
  let cost = 0;
  let solved = false;
  const msg = status();
  const node = (id) => lab.nodes.find((x) => x.id === id);
  const svg = s('svg.board', { viewBox: '0 0 100 62', role: 'group', 'aria-label': 'Routing board' });
  const trail = h('p.trail');
  const isDown = (a, b) => (lab.down || []).some((x) => x.includes(a) && x.includes(b));
  const onPath = (a, b) => path.some((id, i) => i && ((path[i - 1] === a && id === b) || (path[i - 1] === b && id === a)));
  function click(id) {
    const here = path[path.length - 1];
    if (here === lab.to || id === here) return;
    const l = linkBetween(lab, here, id);
    if (!l) { sound.buzz(); say(msg, isDown(here, id) ? 'That link is down. Find another way.' : `There is no link from ${node(here).label} to ${node(id).label}.`, 'bad'); return; }
    path.push(id); cost += l[2]; sound.tick(); say(msg, '');
    if (id === lab.to) {
      if (lab.fastest && cost > best.cost) { sound.buzz(); say(msg, `Delivered in ${cost} ms, but ${best.cost} ms is possible. Start again and look for a faster path.`, 'bad'); } else { solved = true; say(msg, lab.fastest ? `✓ Delivered in ${cost} ms. That is the fastest path.` : `✓ Delivered in ${path.length - 1} hops.`, 'ok'); sound.good(); done(); }
    }
    draw();
  }
  function draw() {
    const here = path[path.length - 1];
    add(clear(svg), 
      ...lab.links.flatMap(([a, b, ms]) => {
        const A = node(a); const B = node(b); const down = isDown(a, b);
        const mx = (A.x + B.x) / 2; const my = (A.y + B.y) / 2;
        return [s(`line.link${down ? '.down' : ''}${onPath(a, b) ? '.used' : ''}`, { x1: A.x, y1: A.y, x2: B.x, y2: B.y }),
          down ? s('text.link-x', { x: mx, y: my + 1.5, 'text-anchor': 'middle' }, '✕') : lab.fastest && s('g', s('rect.link-tag', { x: mx - 3.6, y: my - 2.2, width: 7.2, height: 4.2, rx: 1 }), s('text.link-cost', { x: mx, y: my + 1, 'text-anchor': 'middle' }, `${ms}`))];
      }),
      ...lab.nodes.map((nd) => s(`g.dev.node${nd.id === here ? '.picked' : ''}${nd.id === lab.to ? '.goal' : ''}`, { tabindex: 0, role: 'button', 'aria-label': `${nd.label}${nd.id === here ? ', your packet is here' : ''}`, 'data-id': nd.id,
        onclick: () => click(nd.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(nd.id); svg.querySelector(`[data-id="${path[path.length - 1]}"]`)?.focus(); } } },
        s('circle', { cx: nd.x, cy: nd.y, r: 5 }), s('text.dev-icon', { x: nd.x, y: nd.y + 2.3, 'text-anchor': 'middle' }, nd.id === here ? '📦' : nd.id === lab.to ? '🏁' : '🧭'), s('text.dev-label', { x: labelX(nd.x, nd.label), y: nd.y + 9, 'text-anchor': 'middle' }, nd.label))));
    trail.textContent = `Path: ${path.map((id) => node(id).label).join(' → ')}${lab.fastest ? ` · ${cost} ms so far` : ''}`;
  }
  add(box, h('p.lab-q', lab.prompt), h('p.muted.small', 'Your packet is the 📦. Click a router joined to it to hop there.', lab.fastest ? ' The numbers are milliseconds for each link.' : ''), svg, trail, msg,
    h('button.btn.small', { onclick: () => { if (solved) return; path = [lab.from]; cost = 0; say(msg, 'Back at the start.'); draw(); } }, 'Start again'));
  draw();
}

function packets(box, lab, { seed, done }) {
  const all = splitMessage(lab.message, lab.size);
  let tray = shuffle(all.filter((p) => p.n !== lab.lose), seed);
  let next = 1;
  let resent = !lab.lose;
  const msg = status();
  const trayEl = h('div.tray');
  const out = h('p.assembled', { translate: 'no' });
  const show = (data) => data.replace(/ /g, '␣');
  function take(p) {
    if (p.n !== next) { sound.buzz(); say(msg, `That is packet ${p.n}. You need packet ${next} next.`, 'bad'); return; }
    tray = tray.filter((x) => x !== p); next++; sound.tick(); say(msg, '');
    draw();
    if (next > all.length) { say(msg, '✓ Message rebuilt, every packet in order.', 'ok'); sound.good(); done(); }
  }
  function draw() {
    add(clear(trayEl), ...tray.map((p) => h('button.packet', { onclick: () => take(p), 'aria-label': `Packet ${p.n}` }, h('span.packet-n', `#${p.n}`), h('span.packet-data', { translate: 'no' }, show(p.data)))));
    if (!tray.length && next <= all.length) add(trayEl, h('span.muted', 'No packets left here.'));
    out.textContent = all.filter((p) => p.n < next).map((p) => p.data).join('') || '…';
  }
  const resend = lab.lose && h('div.resend', h('span', 'Missing a packet? Ask the sender to send again:'), all.map((p) => h('button.btn.small', { onclick: (e) => {
    if (resent) { say(msg, 'The missing packet has already been sent again.'); return; }
    if (p.n !== lab.lose) { sound.buzz(); shake(e.target); say(msg, `Packet ${p.n} already arrived. Which number is missing?`, 'bad'); return; }
    resent = true; tray.push(p); sound.good(); say(msg, `Packet ${p.n} was sent again and has arrived.`, 'ok'); draw();
  } }, `#${p.n}`)));
  add(box, h('p.lab-q', lab.prompt || 'Rebuild the message: click the packets in order, starting with #1.'), h('p.muted.small', `${all.length} packets were sent. ␣ marks a space.`), trayEl, resend, h('p.small.muted', 'Message so far:'), out, msg);
  draw();
}

function binary(box, lab, { done }) {
  const bits = Array(lab.bits).fill(0);
  let t = 0;
  const msg = status();
  const goal = h('p.lab-q');
  const total = h('p.bin-total', { 'aria-live': 'polite' });
  const solvedList = h('ul.goals');
  const value = () => bits.reduce((sum, b, i) => sum + b * 2 ** (lab.bits - 1 - i), 0);
  const name = (n) => (lab.ascii ? `${n}, the code for ${String.fromCharCode(n)}` : `${n}`);
  const switches = bits.map((_, i) => h('button.bit', { 'aria-pressed': 'false', 'aria-label': `Switch worth ${2 ** (lab.bits - 1 - i)}`, onclick: () => { if (t >= lab.targets.length) return; bits[i] = bits[i] ? 0 : 1; sound.tick(); draw(); } }));
  function draw() {
    switches.forEach((b, i) => { b.textContent = bits[i]; b.setAttribute('aria-pressed', String(!!bits[i])); });
    const v = value();
    total.textContent = `Your switches add up to ${v}${lab.ascii && v >= 65 && v <= 90 ? ` → ${String.fromCharCode(v)}` : ''}`;
    if (t < lab.targets.length && v === lab.targets[t]) {
      add(solvedList, h('li.ok', `✓ ${name(v)} = ${toBits(v, lab.bits)}`));
      t++; sound.good();
    }
    if (t >= lab.targets.length) { goal.textContent = 'All targets sent.'; say(msg, '✓ You can count in binary.', 'ok'); done(); } else goal.textContent = `Make ${name(lab.targets[t])}`;
  }
  add(box, goal, h('div.bits', bits.map((_, i) => h('div.bit-col', h('span.bit-worth', String(2 ** (lab.bits - 1 - i))), switches[i]))), total, solvedList, msg);
  draw();
}

function pixels(box, lab, { done }) {
  const grid = lab.rows.map((r) => Array(r.length).fill(0));
  let solved = false;
  const msg = status();
  const cells = lab.rows.map((r, y) => [...r].map((_, x) => h('button.px', { 'aria-pressed': 'false', 'aria-label': `Row ${y + 1}, column ${x + 1}`, onclick: () => {
    if (solved) return;
    grid[y][x] = grid[y][x] ? 0 : 1;
    cells[y][x].setAttribute('aria-pressed', String(!!grid[y][x])); sound.tick();
    const wrong = grid.flat().filter((v, i) => String(v) !== lab.rows.join('')[i]).length;
    if (!wrong) { solved = true; say(msg, '✓ The picture arrived.', 'ok'); sound.good(); done(); } else say(msg, `${wrong} pixel${wrong === 1 ? '' : 's'} still to fix.`);
  } })));
  add(box, h('p.lab-q', 'Fill in a pixel for every 1. Leave every 0 empty.'),
    h('div.px-wrap', h('pre.px-bits', { translate: 'no' }, lab.rows.join('\n')), h('div.px-grid', { style: `grid-template-columns:repeat(${lab.rows[0].length},1fr)` }, cells.flat())), msg);
}

function deliver(box, lab, { done }) {
  let i = 0;
  const msg = status();
  const label = h('p.packet-to', { 'aria-live': 'polite' });
  const click = (addr, btn) => {
    if (i >= lab.packets.length) return;
    if (addr === lab.packets[i]) { i++; sound.tick(); say(msg, ''); show(); } else { sound.buzz(); shake(btn); say(msg, `That device is ${addr}. ${lab.hide ? 'Read the network part first, then the last number.' : 'Compare every number.'}`, 'bad'); }
  };
  function show() {
    if (i >= lab.packets.length) { label.textContent = '✓ Every packet delivered'; say(msg, 'Each one reached the right device.', 'ok'); sound.good(); done(); return; }
    label.textContent = `📦 Packet ${i + 1} of ${lab.packets.length} · To: ${lab.packets[i]}`;
  }
  add(box, h('p.lab-q', 'Click the device this packet is addressed to.'), label,
    h('div.nets', lab.nets.map((net) => h('div.net', h('h3', net.name), h('p.mono', { translate: 'no' }, `${net.prefix}.x`),
      h('div.net-hosts', net.hosts.map(([num, kind, name]) => { const addr = `${net.prefix}.${num}`; const btn = h('button.host', { onclick: () => click(addr, btn) }, h('span.host-icon', ICON[kind]), h('span', name), h('span.mono', { translate: 'no' }, lab.hide ? `.${num}` : addr)); return btn; }))))), msg);
  show();
}

function cipher(box, lab, { done }) {
  const msg = status();
  const secret = caesar(lab.text, lab.shift);
  const ABC = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  const rows = (shift) => h('div.abc', { translate: 'no' }, h('div.abc-row', h('span.abc-name', 'Plain'), ABC.map((c) => h('span', c))), h('div.abc-row.shifted', h('span.abc-name', 'Secret'), ABC.map((c) => h('span', caesar(c, shift)))));
  if (lab.mode === 'crack') {
    const out = h('p.assembled', { translate: 'no' });
    const num = h('strong', '0');
    const slider = h('input', { type: 'range', min: 0, max: 25, value: 0, 'aria-label': 'Shift to try', oninput: () => { num.textContent = slider.value; out.textContent = caesar(secret, -Number(slider.value)); } });
    out.textContent = secret;
    add(box, h('p.lab-q', 'Try shifts until the message reads as English.'), h('p', 'Caught message: ', h('code', { translate: 'no' }, secret)), h('label.field', h('span', 'Shift back by ', num), slider), out,
      h('button.btn.primary', { onclick: () => { if (Number(slider.value) === lab.shift) { slider.disabled = true; say(msg, `✓ Cracked. The key was ${lab.shift}, and it took you at most 25 tries.`, 'ok'); sound.good(); done(); } else { sound.buzz(); say(msg, 'That does not read as English yet. Keep trying.', 'bad'); } } }, 'This is the message'), msg);
    return;
  }
  const encrypt = lab.mode === 'encrypt';
  const want = lettersOnly(encrypt ? secret : lab.text);
  const input = h('input.answer', { type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Your answer', onkeydown: (e) => { if (e.key === 'Enter') check(); } });
  function check() {
    if (lettersOnly(input.value) === want) { input.disabled = true; say(msg, `✓ Correct: ${encrypt ? secret : lab.text}`, 'ok'); sound.good(); done(); } else { sound.buzz(); shake(input); say(msg, lettersOnly(input.value).length !== want.length ? `Your answer should have ${want.length} letters.` : 'Not yet. Check each letter against the two rows.', 'bad'); }
  }
  add(box, h('p.lab-q', encrypt ? `Encrypt this message with a shift of ${lab.shift}.` : `Decrypt this message. The key is a shift of ${lab.shift}.`),
    h('p', encrypt ? 'Message: ' : 'Secret message: ', h('code', { translate: 'no' }, encrypt ? lab.text : secret)), rows(lab.shift),
    h('p.muted.small', encrypt ? 'Find each letter in the Plain row and write the letter below it.' : 'Find each letter in the Secret row and write the letter above it.'),
    h('div.row', input, h('button.btn.primary', { onclick: check }, 'Check')), msg);
}

function crack(box, lab, { done }) {
  const opt = { length: lab.start, upper: false, digits: false, symbols: false };
  let solved = false;
  const msg = status();
  const time = h('p.crack-time', { 'aria-live': 'polite' });
  const detail = h('p.muted.small');
  const lenLabel = h('strong');
  const bar = h('div.meter-fill');
  function draw() {
    const secs = crackSeconds(opt);
    const years = secs / YEAR;
    lenLabel.textContent = String(opt.length);
    time.textContent = `Time to crack: ${howLong(secs)}`;
    detail.textContent = `${poolSize(opt)} possible characters in each of ${opt.length} places. That is about 10 to the power of ${Math.round(opt.length * Math.log10(poolSize(opt)))} passwords.`;
    bar.style.width = `${Math.max(3, Math.min(100, (Math.log10(years + 1e-9) + 9) / (Math.log10(lab.goalYears) + 9) * 100))}%`;
    bar.classList.toggle('full', years >= lab.goalYears);
    if (years >= lab.goalYears && !solved) { solved = true; say(msg, `✓ That would take more than ${lab.goalYears.toLocaleString('en-US')} years.`, 'ok'); sound.good(); done(); }
  }
  const box2 = (key, label) => h('label.check', h('input', { type: 'checkbox', disabled: !!lab.lockSets, onchange: (e) => { opt[key] = e.target.checked; draw(); } }), label);
  add(box, h('p.lab-q', `Goal: at least ${lab.goalYears.toLocaleString('en-US')} years to crack.`),
    h('label.field', h('span', 'Length: ', lenLabel, ' characters'), h('input', { type: 'range', min: 4, max: lab.max, value: lab.start, 'aria-label': 'Password length', oninput: (e) => { opt.length = Number(e.target.value); draw(); } })),
    h('div.row', h('label.check', h('input', { type: 'checkbox', checked: true, disabled: true }), 'lowercase a–z'), box2('upper', 'CAPITALS'), box2('digits', 'digits 0–9'), box2('symbols', 'symbols !?#')),
    lab.lockSets && h('p.muted.small', 'Lowercase letters only in this round.'), h('div.meter', bar), time, detail, msg);
  draw();
}

function troubleshoot(box, lab, { done }) {
  const need = lab.need || 1;
  let ran = 0;
  const msg = status();
  const findings = h('ul.findings');
  const checks = lab.checks.map(([label, finding]) => h('button.btn', { onclick: (e) => { if (e.target.disabled) return; e.target.disabled = true; ran++; sound.tick(); add(findings, h('li', h('strong', label), ' ', finding)); } }, `🔍 ${label}`));
  const fixes = lab.fixes.map((label, i) => h('button.choice', { onclick: () => {
    if (ran < need) { sound.buzz(); say(msg, `Run at least ${need} checks before you choose a fix. Do not guess.`, 'bad'); return; }
    if (i === lab.answer) { fixes.forEach((b) => { b.disabled = true; }); fixes[i].classList.add('right'); say(msg, `✓ Fixed. ${lab.why}`, 'ok'); sound.good(); done(); } else { fixes[i].classList.add('wrong'); fixes[i].disabled = true; sound.buzz(); say(msg, 'That would not fix it. Look again at what the checks found.', 'bad'); }
  } }, label));
  add(box, h('p.scenario', `📋 ${lab.scenario}`), h('h3', 'Checks you can run'), h('div.row', checks), findings, h('h3', 'Choose the fix'), h('div.choices', fixes), msg);
}

function speed(box, lab, ctx) {
  const times = lab.lanes.map(([, mbps]) => transferSeconds(lab.mb, mbps));
  const slow = Math.max(...times);
  const fills = lab.lanes.map(() => h('div.meter-fill'));
  const labels = lab.lanes.map(() => h('span.mono'));
  const quiz = h('div');
  let ran = false;
  const start = () => {
    if (ran) return;
    ran = true;
    sound.tick();
    const scale = calm() ? 0 : 4 / slow;
    fills.forEach((f, i) => { f.style.transition = `width ${times[i] * scale}s linear`; f.style.width = '100%'; setTimeout(() => { labels[i].textContent = `${times[i] < 10 ? times[i].toFixed(2).replace(/\.?0+$/, '') : Math.round(times[i])} seconds`; f.classList.add('full'); }, times[i] * scale * 1000 + 30); });
    setTimeout(() => mcq(quiz, lab, ctx), slow * scale * 1000 + 60);
  };
  add(box, h('p.lab-q', `Download: ${lab.file}`), lab.lanes.map(([name, mbps], i) => h('div.lane', h('span.lane-name', `${name} · ${mbps} Mbps`), h('div.meter', fills[i]), labels[i])), h('button.btn.primary', { onclick: start }, '▶ Start the race'), quiz);
}

const LABS = { mcq, sort, order, match, build, route, packets, binary, pixels, deliver, cipher, crack, troubleshoot, speed };

/** Draw a lab into `root`. `onDone` is called once, when the student solves it. */
export function mountLab(root, lab, { seed = '', onDone }) {
  let finished = false;
  const box = h('div.lab', { 'data-lab': lab.type });
  add(root, box);
  LABS[lab.type](box, lab, { seed, done: () => { if (!finished) { finished = true; box.classList.add('solved'); onDone?.(); } } });
  return box;
}
