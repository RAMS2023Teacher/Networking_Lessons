import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, LESSONS, lessonsFor, coverage, GRADES } from '../js/curriculum/index.js';
import { shortest, caesar, splitMessage, shuffle, reachable, linkProblem, crackSeconds, YEAR, transferSeconds, howLong } from '../js/labs/logic.js';

test('every lesson is complete and every lab can be solved', () => assert.deepEqual(validate(), []));
test('three courses of ten lessons', () => { assert.equal(LESSONS.length, 30); for (const g of GRADES) assert.equal(lessonsFor(g).length, 10); });
test('each course teaches all three Networks standards', () => {
  for (const g of [6, 7]) { const codes = coverage(g).map((c) => c.code); for (const c of ['6-8.CS.c.1', '6-8.CS.c.2', '6-8.CS.c.3']) assert.ok(codes.includes(c), `grade ${g} misses ${c}`); }
  assert.ok(coverage(8).some((c) => c.code === '6-8.CAS.a.1'));
});
test('the fastest route is not the one with the fewest hops', () => {
  const lab = lessonsFor(7)[4].steps[1].lab;
  assert.deepEqual(shortest(lab), { cost: 14, path: ['a', 'b', 'd', 'e', 'g'] });
  assert.equal(shortest({ ...lab, down: [['d', 'e']] }).cost, 16);
});
test('caesar shifts and shifts back', () => { assert.equal(caesar('HELLO', 3), 'KHOOR'); assert.equal(caesar(caesar('Meet at noon', 5), -5), 'MEET AT NOON'); });
test('packets rejoin into the message', () => assert.equal(splitMessage('MEET AT THE GYM', 4).map((p) => p.data).join(''), 'MEET AT THE GYM'));
test('shuffle is repeatable and never leaves the order unchanged', () => { const a = [1, 2, 3, 4, 5]; assert.deepEqual(shuffle(a, 'k'), shuffle(a, 'k')); assert.notDeepEqual(shuffle(a, 'k'), a); assert.deepEqual(shuffle(a, 'k').slice().sort(), a); });
test('network rules', () => {
  const spec = { devices: [{ id: 'l', kind: 'laptop', label: 'Laptop' }, { id: 's', kind: 'switch', label: 'Switch' }, { id: 'a', kind: 'ap', label: 'AP' }, { id: 'p', kind: 'pc', label: 'PC' }], ports: { pc: 1 } };
  assert.match(linkProblem(spec, [], 'l', 's'), /no cable port/);
  assert.equal(linkProblem(spec, [], 'l', 'a'), '');
  assert.match(linkProblem(spec, [['p', 's']], 'p', 'a'), /only 1 port/);
  assert.ok(reachable([['l', 'a'], ['a', 's']], 'l', 's'));
  assert.ok(!reachable([['l', 'a']], 'l', 's'));
});
test('password and speed sums', () => {
  assert.ok(crackSeconds({ length: 14 }) / YEAR > 100);
  assert.ok(crackSeconds({ length: 13 }) / YEAR < 100);
  assert.equal(transferSeconds(50, 10), 40);
  assert.equal(howLong(90), '2 minutes');
});
