// Greed and gear depth: Vé về, rest stops, the forge, gems and unidentified items.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Dungeon, makeItem, rng, SLOTS} from '../src/dungeon.mjs';
import {upgradeItem, upgradeChance, upgradeCost, plusBase, socketGem, socketsFor, identifyItem, isRestStop, MAX_PLUS} from '../src/progression.mjs';
import {snapshotDungeon, restoreDungeon} from '../src/save.mjs';

const clear = d => { d.enemies = []; d.drops = []; for (const c of d.companions) { c.state = 'away'; c.awayT = 1e9; } return d; };
const item = (over = {}) => ({slot: 'torch', rarity: 'rare', rarityName: 'Hiếm', name: 'Đèn thử', ilvl: 5, stats: {dmg: 10, crit: 3}, base: {dmg: 10}, affixes: ['+3% chí mạng'], value: 40, ...over});

test('every slot says where it is worn', () => {
  assert.deepEqual(Object.values(SLOTS).map(s => s.body), ['Đầu', 'Cổ', 'Ngực', 'Tay', 'Thân', 'Lưng', 'Chân']);
});

test('Vé về ends the descent safely and banks what was found', () => {
  const d = clear(new Dungeon(21)); d.enterFloor(2); clear(d);
  d.drops.push({id: 1, kind: 'item', item: item({rarity: 'common'}), x: d.p.x, y: d.p.y}, {id: 2, kind: 'gold', amount: 12, x: d.p.x, y: d.p.y});
  d.collect(d.drops[0]); d.collect(d.drops[0]);
  assert.ok(d.inventory[0].found);
  assert.equal(d.usePotion('ticket'), true);
  assert.equal(d.ending, 'dungeon');
  assert.equal(d.inventory[0].found, undefined);
  assert.equal(d.runGold, 0);
});

test('the ladder up only works at rest stops; rest stops become the checkpoint', () => {
  assert.deepEqual([1, 2, 3, 4, 7].map(isRestStop), [true, false, false, true, true]);
  const d = clear(new Dungeon(22)); d.enterFloor(2); clear(d);
  Object.assign(d.p, d.floor.exitUp); d.interact();
  assert.equal(d.ending, null, 'floor 2: the ladder is broken');
  d.enterFloor(4); clear(d);
  assert.equal(d.checkpoint, 4);
  Object.assign(d.p, d.floor.exitUp); d.interact();
  assert.equal(d.ending, 'dungeon');
});

test('equipping an item secures it against fainting', () => {
  const d = clear(new Dungeon(23)); const it = item({rarity: 'magic', slot: 'hat', base: {courage: 5}, stats: {courage: 5}});
  d.drops.push({id: 1, kind: 'item', item: it, x: d.p.x, y: d.p.y}); d.collect(d.drops[0]);
  d.equip(it, true); d.hurt(9999);
  assert.equal(d.equipped.hat, it);
});

test('forge: +1 to +3 always work, then odds fall; failing from +5 drops a level', () => {
  assert.deepEqual([0, 2, 3, 9].map(upgradeChance), [1, 1, .9, .3]);
  const purse = {gold: 1e6}, it = item();
  assert.equal(upgradeItem(purse, it, .99), 'up');
  assert.equal(it.plus, 1);
  assert.equal(it.stats.dmg, plusBase(it).dmg, 'base stat grows by 12% a level');
  assert.equal(it.stats.crit, 3, 'affixes stay as they were');
  it.plus = 5; const before = it.stats.dmg;
  assert.equal(upgradeItem(purse, it, .99), 'down');
  assert.equal(it.plus, 4); assert.ok(it.stats.dmg < before);
  it.plus = 3; assert.equal(upgradeItem(purse, it, .99), 'fail'); assert.equal(it.plus, 3);
  it.plus = MAX_PLUS; assert.equal(upgradeItem(purse, it, 0), 'max');
  const poor = {gold: 1}; assert.equal(upgradeItem(poor, item(), 0), 'gold');
  const cost = upgradeCost(item()), p2 = {gold: cost}; upgradeItem(p2, item(), 0); assert.equal(p2.gold, 0);
});

test('gems: sockets by rarity, permanent stats, one gem used up', () => {
  assert.equal(socketsFor({rarity: 'magic'}), 0);
  assert.equal(socketsFor({rarity: 'legendary'}), 2);
  const pouch = {gems: {ruby: 2, sapphire: 0, emerald: 0, topaz: 0}}, it = item({stats: {dmg: 10}});
  assert.equal(socketGem(pouch, it, 'ruby'), null);
  assert.equal(it.stats.dmgPct, 6);
  assert.equal(pouch.gems.ruby, 1);
  assert.equal(socketGem(pouch, it, 'ruby'), 'full');
  assert.equal(socketGem(pouch, item(), 'sapphire'), 'none');
});

test('good drops come unidentified and cannot be worn until a lens or Mr. D looks at them', () => {
  const d = clear(new Dungeon(24)); d.keys = 1; d.enterFloor(3); clear(d);
  d.damage(d.spawn('zombie', d.p.x + 50, d.p.y, 1), 1e9);
  const set = d.drops.find(x => x.kind === 'item' && x.item.rarity === 'set').item;
  assert.equal(set.unid, true);
  d.inventory.push(set);
  assert.equal(d.equip(set, true), 'unid');
  d.potions.lens = 1;
  assert.equal(d.usePotion('lens'), true);
  assert.equal(set.unid, false);
  const purse = {gold: 100}, other = item({unid: true});
  assert.equal(identifyItem(purse, other), null); assert.ok(purse.gold < 100);
});

test('bosses always drop a gem; gems are picked up into the pouch', () => {
  const d = clear(new Dungeon(25)); d.keys = 1; d.enterFloor(3); clear(d);
  d.damage(d.spawn('zombie', d.p.x + 50, d.p.y, 1), 1e9);
  const gem = d.drops.find(x => x.kind === 'gem');
  assert.ok(gem);
  d.collect(gem); assert.equal(d.gems[gem.gem], 1);
});

test('new items remember their look; gems, checkpoint and run coins survive a save', () => {
  assert.ok(Number.isInteger(makeItem(rng(5), 3).style));
  const d = new Dungeon(26); d.gems.topaz = 2; d.checkpoint = 7; d.runGold = 40; d.potions.ticket = 3;
  const back = restoreDungeon(new Dungeon(26), JSON.parse(JSON.stringify(snapshotDungeon(d))));
  assert.equal(back.gems.topaz, 2); assert.equal(back.checkpoint, 7); assert.equal(back.runGold, 40); assert.equal(back.potions.ticket, 3);
});
