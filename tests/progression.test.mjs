// Skill tree, boss sets, conditional affixes, the town hub, one-thumb auto-attack and Zin.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILL_TREE, canLearn, skillPoints, SETS, setBonuses, TOWN, buyTown, townPrice, emptyTown, ZIN_DURATION} from '../src/progression.mjs';
import {Dungeon, makeItem, makeSetItem, rng, SLOTS, describeBase} from '../src/dungeon.mjs';
import {snapshotDungeon, restoreDungeon} from '../src/save.mjs';

const clear = d => { d.enemies = []; d.drops = []; for (const c of d.companions) { c.state = 'away'; c.awayT = 1e9; } return d; };
const put = (d, type, dx, dy, opts = {}) => Object.assign(d.spawn(type, d.p.x + dx, d.p.y + dy, 1), opts);

test('the tree has 12 nodes, six per branch, one per tier', () => {
  assert.equal(SKILL_TREE.length, 12);
  for (const b of ['den', 'ban']) assert.deepEqual(SKILL_TREE.filter(n => n.branch === b).map(n => n.tier).sort(), [0, 1, 2, 3, 4, 5]);
});

test('one point per level after the first; nodes open top-down within a branch', () => {
  assert.equal(skillPoints(1, {}), 0);
  assert.equal(skillPoints(4, {beam: 2}), 1);
  assert.equal(canLearn(1, {}, 'beam'), 'points');
  assert.equal(canLearn(3, {}, 'cells'), 'locked');
  assert.equal(canLearn(3, {beam: 1}, 'cells'), null);
  assert.equal(canLearn(9, {popcandy: 1, beam: 1, cells: 1, dazzle: 1}, 'popcandy'), 'max');
});

test('learned nodes change the numbers that matter', () => {
  const d = clear(new Dungeon(1)); d.p.level = 6;
  const base = d.derived;
  assert.equal(d.learnSkill('beam'), null); d.learnSkill('beam');
  assert.ok(Math.abs(d.derived.damage / base.damage - 1.16) < 1e-9);
  d.learnSkill('cells');
  assert.equal(d.derived.maxBattery, base.maxBattery + 15);
  d.learnSkill('nacandy'); d.learnSkill('boeyes');
  assert.equal(d.skillPoints, 0);
  assert.equal(d.learnSkill('together'), 'points');
});

test('the bell grows and recharges faster with Chuông vang', () => {
  const d = clear(new Dungeon(2)); d.p.level = 12; d.tree = {beam: 1, cells: 1, dazzle: 1, popcandy: 1, bigbell: 2};
  const far = put(d, 'sheet', 170, 0);
  d.cast('bell');
  assert.ok(far.hp < far.maxHp, 'a performer 170 away is inside the bigger ring');
  assert.equal(d.cooldowns.bell, 3);
});

test('popping candy splashes nearby performers', () => {
  const d = clear(new Dungeon(3)); d.tree = {beam: 1, cells: 1, dazzle: 1, popcandy: 1};
  const a = put(d, 'sheet', 120, 0, {cd: 99}), b = put(d, 'sheet', 150, 30, {cd: 99});
  d.cast('candy', {x: a.x, y: a.y - 20});
  for (let i = 0; i < 8; i++) d.step(0.05);
  assert.ok(a.hp < a.maxHp && b.hp < b.maxHp);
});

test('three new gear slots with their own base stat', () => {
  for (const slot of ['hat', 'bag', 'badge']) {
    assert.ok(SLOTS[slot]);
    const it = makeItem(rng(4), 6, 0, slot);
    assert.equal(it.slot, slot);
    assert.ok(describeBase(it).length > 0);
  }
  assert.ok('hat' in new Dungeon(4).equipped);
});

test('conditional affixes only appear on Hiếm and Huyền thoại items', () => {
  const r = rng(77), cond = /khi can đảm|còn nguyên|Chí mạng 100%/;
  let condSeen = 0;
  for (let i = 0; i < 600; i++) {
    const it = makeItem(r, 8, 1.5);
    const n = it.affixes.filter(a => cond.test(a)).length;
    if (['common', 'magic'].includes(it.rarity)) assert.equal(n, 0, it.rarity);
    assert.ok(n <= 1);
    condSeen += n;
  }
  assert.ok(condSeen > 0);
});

test('a conditional affix kicks in only under its condition', () => {
  const d = clear(new Dungeon(5));
  d.equipped.badge = {slot: 'badge', stats: {lastStand: 50, crit: -5}, base: {crit: 0}, affixes: []};
  const e = put(d, 'skeleton', 60, 0, {hp: 1e6, maxHp: 1e6});
  const avg = () => { let t = 0; for (let i = 0; i < 40; i++) { const before = e.hp; d.damage(e, 100); t += before - e.hp; } return t / 40; };
  const normal = avg();
  d.p.courage = 10;
  assert.ok(avg() > normal * 1.4);
});

test('boss sets: a boss drops a piece of its own set; two pieces give the bonus', () => {
  const d = clear(new Dungeon(6)); d.keys = 1; d.enterFloor(3); clear(d);
  const boss = d.spawn('zombie', d.p.x + 50, d.p.y, 1); d.damage(boss, 1e9);
  const set = d.drops.filter(x => x.kind === 'item' && x.item.set === 'zombie');
  assert.equal(set.length, 1);
  const armor = d.derived.armor;
  for (const slot of Object.keys(SETS.zombie.pieces)) d.equip(makeSetItem(rng(9), 3, 'zombie', slot), true);
  assert.deepEqual(setBonuses(d.equipped).active, ['zombie']);
  assert.ok(d.derived.armor >= armor + 20);
});

test('the vampire set turns damage into courage', () => {
  const d = clear(new Dungeon(7));
  for (const slot of Object.keys(SETS.vampire.pieces)) d.equip(makeSetItem(rng(10), 3, 'vampire', slot), true);
  d.p.courage = 10;
  const e = put(d, 'skeleton', 60, 0, {hp: 1e6, maxHp: 1e6});
  d.damage(e, 200);
  assert.ok(d.p.courage > 10);
});

test('town: buy stand levels, costumes and gadgets with saved coins', () => {
  const ch = {gold: 500, town: emptyTown()};
  assert.equal(buyTown(ch, 'bread'), null);
  assert.equal(ch.gold, 440);
  assert.equal(townPrice(ch.town, 'bread'), 120);
  assert.equal(buyTown(ch, 'raincoat'), null);
  assert.equal(ch.town.costume, 'raincoat');
  assert.equal(buyTown(ch, 'raincoat'), null, 'buying an owned costume toggles it');
  assert.equal(ch.town.costume, null);
  assert.equal(buyTown(ch, 'camera'), null);
  assert.equal(buyTown(ch, 'camera'), 'owned');
  assert.equal(buyTown({gold: 10, town: emptyTown()}, 'map'), 'gold');
  assert.ok(TOWN.length >= 9);
});

test('town upgrades take effect in the dungeon', () => {
  const d = clear(new Dungeon(8));
  const bread = d.potions.bread, crit = d.derived.crit;
  d.town = {stand: {bread: 2, battery: 1, map: 1}, costumes: ['cape'], costume: 'cape', gadgets: []};
  d.startDescent();
  assert.equal(d.potions.bread, bread + 2);
  assert.ok(Math.abs(d.derived.crit - crit - 0.05) < 1e-9, 'the cape adds 5% crit');
  d.enterFloor(2);
  const s = d.drops.find(x => x.quest === 'stamp');
  assert.equal(d.explored[Math.floor(s.y / 32) * 64 + Math.floor(s.x / 32)], 1, 'the map shows the stamp');
});

test('one-thumb mode: the flashlight fires by itself at a performer in reach', () => {
  const d = clear(new Dungeon(9)); d.autoAttack = true;
  const e = put(d, 'sheet', 80, 0, {cd: 99});
  d.step(0.05);
  assert.ok(e.hp < e.maxHp);
  const off = clear(new Dungeon(9));
  const e2 = put(off, 'sheet', 80, 0, {cd: 99});
  off.step(0.05);
  assert.equal(e2.hp, e2.maxHp);
});

test('Zin can be called once per floor after the first ticket fragment', () => {
  const d = clear(new Dungeon(10));
  assert.equal(d.callZin(), false);
  d.fragments = ['cemetery'];
  const e = put(d, 'sheet', 100, 0, {hp: 1e5, maxHp: 1e5, cd: 99});
  d.p.courage = 5;
  assert.equal(d.callZin(), true);
  assert.equal(d.p.courage, d.derived.maxCourage);
  assert.ok(e.stun > 0);
  for (let t = 0; t < ZIN_DURATION + 0.5; t += 0.05) d.step(0.05);
  assert.ok(e.hp < e.maxHp, 'Zin breaks performers');
  assert.equal(d.zin, null, 'Zin leaves after his time');
  assert.equal(d.callZin(), false, 'once per floor');
  d.enterFloor(2);
  assert.equal(d.canCallZin, true);
});

test('fragments drop from elites and bosses, one per theme', () => {
  let got = 0;
  for (let s = 1; s <= 30 && !got; s++) { const d = clear(new Dungeon(s)); for (let i = 0; i < 20; i++) d.damage(d.spawn('sheet', d.p.x + 40, d.p.y, 1, true), 1e9); got = d.drops.filter(x => x.quest === 'fragment').length; assert.ok(got <= 1); }
  assert.equal(got, 1);
});

test('three fragments lead to Zin\'s floor and its two endings', () => {
  for (const [spot, ending, state] of [['table', 'ticket', 'gone'], ['roster', 'new', 'staff']]) {
    const d = clear(new Dungeon(11));
    d.fragments = ['cemetery', 'dining', 'corridor']; d.stampFound = true;
    Object.assign(d.p, d.floor.stairs); d.interact();
    assert.equal(d.floor.special, 'zin');
    Object.assign(d.p, d.floor[spot]); d.interact();
    assert.equal(d.ending, ending);
    assert.equal(d.zinState, state);
  }
});

test('after Xé vé Zin is gone; after Ma mới he still answers the call', () => {
  const gone = clear(new Dungeon(12)); gone.fragments = ['a']; gone.zinState = 'gone';
  assert.equal(gone.canCallZin, false);
  const staff = clear(new Dungeon(12)); staff.fragments = ['a', 'b', 'c']; staff.zinState = 'staff';
  assert.equal(staff.canCallZin, true);
});

test('tree, town, fragments and Zin survive a save', () => {
  const d = new Dungeon(13); d.p.level = 5; d.tree = {beam: 2, cells: 1}; d.town.stand.bread = 1; d.town.gadgets.push('walkie');
  d.fragments = ['cemetery']; d.zinState = 'staff';
  const back = restoreDungeon(new Dungeon(13), JSON.parse(JSON.stringify(snapshotDungeon(d))));
  assert.deepEqual(back.tree, {beam: 2, cells: 1});
  assert.equal(back.town.stand.bread, 1);
  assert.deepEqual(back.town.gadgets, ['walkie']);
  assert.deepEqual(back.fragments, ['cemetery']);
  assert.equal(back.zinState, 'staff');
});
