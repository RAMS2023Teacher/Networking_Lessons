// Pure rules behind the interactive labs. No page code here, so the tests (and later the
// server) can run exactly the same checks the browser does.

/** A repeatable shuffle: the same seed always gives the same order. */
export function shuffle(list, seed = 'x') {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  const rand = () => { n ^= n << 13; n >>>= 0; n ^= n >>> 17; n ^= n << 5; n >>>= 0; return n / 4294967296; };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  // A shuffle that changes nothing teaches nothing: turn it by one.
  if (out.length > 1 && out.every((x, i) => x === list[i])) out.push(out.shift());
  return out;
}

const same = (l, a, b) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a);
export const hasLink = (links, a, b) => links.some((l) => same(l, a, b));

/** Can data get from a to b over these links? */
export function reachable(links, a, b) {
  const seen = new Set([a]);
  const todo = [a];
  while (todo.length) {
    const at = todo.pop();
    if (at === b) return true;
    for (const l of links) {
      const next = l[0] === at ? l[1] : l[1] === at ? l[0] : null;
      if (next && !seen.has(next)) { seen.add(next); todo.push(next); }
    }
  }
  return false;
}

/** Devices with no cable port: they join by radio, through an access point or a cell tower. */
export const WIRELESS = new Set(['laptop', 'phone', 'tablet', 'watch']);
const RADIO = new Set(['ap', 'tower']);
const NAMES = { pc: 'computer', ap: 'access point', tower: 'cell tower', internet: 'internet', tv: 'TV', console: 'game console' };
const nameOf = (kind) => NAMES[kind] || kind;

/** Why two devices may not be joined, or '' if they may. */
export function linkProblem(spec, links, a, b) {
  const A = spec.devices.find((d) => d.id === a);
  const B = spec.devices.find((d) => d.id === b);
  if (!A || !B || a === b) return 'Pick two different devices.';
  for (const [k1, k2, why] of spec.ban || []) {
    if ((A.kind === k1 && B.kind === k2) || (A.kind === k2 && B.kind === k1)) return why;
  }
  for (const [x, y] of [[A, B], [B, A]]) {
    if (WIRELESS.has(x.kind) && !RADIO.has(y.kind)) return `The ${nameOf(x.kind)} has no cable port. It joins by radio, through an access point or a cell tower.`;
  }
  for (const d of [A, B]) {
    const max = spec.ports?.[d.id] ?? spec.ports?.[d.kind];
    if (max && links.filter((l) => l.includes(d.id)).length >= max) return `${d.label} has only ${max} port${max === 1 ? '' : 's'}, and ${max === 1 ? 'it is' : 'they are all'} in use.`;
  }
  if (spec.max && links.length >= spec.max) return `You only have ${spec.max} cables. Remove one first.`;
  return '';
}

/** Which goals of a network-building lab are met. */
export function checkBuild(spec, links) {
  const label = (id) => spec.devices.find((d) => d.id === id).label;
  const goals = spec.goals.map(([a, b]) => ({ text: `${label(a)} can reach ${label(b)}`, ok: reachable(links, a, b) }));
  return { goals, ok: goals.every((g) => g.ok) };
}

/** Cheapest path between two routers, skipping broken links. Null if there is none. */
export function shortest(spec) {
  const down = spec.down || [];
  const links = spec.links.filter((l) => !down.some((d) => same(d, l[0], l[1])));
  const dist = { [spec.from]: 0 };
  const prev = {};
  const left = new Set(spec.nodes.map((n) => n.id));
  while (left.size) {
    let at = null;
    for (const id of left) if (dist[id] !== undefined && (at === null || dist[id] < dist[at])) at = id;
    if (at === null) break;
    left.delete(at);
    for (const [a, b, cost] of links) {
      const next = a === at ? b : b === at ? a : null;
      if (next && left.has(next) && (dist[next] === undefined || dist[at] + cost < dist[next])) { dist[next] = dist[at] + cost; prev[next] = at; }
    }
  }
  if (dist[spec.to] === undefined) return null;
  const path = [spec.to];
  while (path[0] !== spec.from) path.unshift(prev[path[0]]);
  return { cost: dist[spec.to], path };
}

/** The working link between two routers, or null. */
export function linkBetween(spec, a, b) {
  const l = spec.links.find((x) => same(x, a, b));
  if (!l || (spec.down || []).some((d) => same(d, a, b))) return null;
  return l;
}

/** Shift every letter along the alphabet. Spaces and punctuation stay put. */
export function caesar(text, shift) {
  return text.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + shift + 26 * 4) % 26) + 65));
}
export const lettersOnly = (text) => String(text).toUpperCase().replace(/[^A-Z]/g, '');

/** Cut a message into numbered packets. */
export function splitMessage(message, size) {
  const out = [];
  for (let i = 0; i < message.length; i += size) out.push({ n: out.length + 1, data: message.slice(i, i + size) });
  return out;
}

export const toBits = (n, bits) => n.toString(2).padStart(bits, '0');

/** How long guessing a password takes on average, at ten billion guesses a second. */
export const GUESSES_PER_SECOND = 1e10;
export function poolSize(opt) { return 26 + (opt.upper ? 26 : 0) + (opt.digits ? 10 : 0) + (opt.symbols ? 32 : 0); }
export function crackSeconds(opt) { return Math.pow(poolSize(opt), opt.length) / GUESSES_PER_SECOND / 2; }
export const YEAR = 31557600;
export function howLong(seconds) {
  const units = [['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['year', YEAR]];
  if (seconds < 1) return 'less than a second';
  if (seconds >= YEAR * 1e9) return 'billions of years';
  let best = units[0];
  for (const u of units) if (seconds >= u[1]) best = u;
  const n = seconds / best[1];
  const shown = n >= 1e6 ? `${Math.round(n / 1e6).toLocaleString('en-US')} million` : Math.round(n).toLocaleString('en-US');
  return `${shown} ${best[0]}${Math.round(n) === 1 ? '' : 's'}`;
}

/** Seconds to move a file: megabytes are 8 megabits each. */
export const transferSeconds = (megabytes, mbps) => (megabytes * 8) / mbps;
