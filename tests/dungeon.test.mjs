// Headless checks for Hầm Ma, the action-RPG mode. Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {Dungeon, generateFloor, flowField, floorPassable as passable, makeItem, rng, xpForLevel, isBossFloor, MAP_W, TILE, ENEMIES, DOOR} from '../src/dungeon.mjs';

const clearFloor = d => { d.enemies = []; d.drops = []; };
const put = (d, type, dx, dy, opts = {}) => { const e = d.spawn(type, d.p.x + dx, d.p.y + dy, 1); Object.assign(e, opts); return e; };
const run = (d, seconds, input = {}) => { for (let t = 0; t < seconds; t += 0.05) d.step(0.05, input); };
// Send Na and Bơ out for a breather so a test only measures the player.
const solo = d => { for (const c of d.companions) { c.state = 'away'; c.awayT = 1e9; } return d; };

test('generated floors are fully connected, with stairs, stamp and key in different rooms', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const depth = 1 + seed % 9, f = generateFloor(depth, seed * 131);
    const field = flowField(f, f.rooms[0].cx, f.rooms[0].cy);
    f.rooms.forEach((r, i) => {
      if (i === f.bossRoom) assert.ok(field[r.cy * MAP_W + r.cx] < 0, `seed ${seed}: boss room reachable without the door`);
      else assert.ok(field[r.cy * MAP_W + r.cx] >= 0, `seed ${seed}: room ${i} unreachable`);
    });
    assert.ok(passable(f, f.start.x, f.start.y), `seed ${seed}: start blocked`);
    assert.ok(passable(f, f.stairs.x, f.stairs.y), `seed ${seed}: stairs blocked`);
    assert.ok(passable(f, f.key.x, f.key.y, 6), `seed ${seed}: key blocked`);
    assert.notEqual(f.keyRoom, f.stairsRoom);
    if (isBossFloor(depth)) {
      assert.equal(f.stairsRoom, f.bossRoom);
      assert.ok(f.door.tiles.length >= 1 && f.door.tiles.length <= 4);
      assert.ok(f.door.tiles.every(i => f.tiles[i] === DOOR));
    } else {
      assert.ok(passable(f, f.stamp.x, f.stamp.y, 6), `seed ${seed}: stamp blocked`);
      assert.notEqual(f.stampRoom, f.keyRoom);
      assert.notEqual(f.stampRoom, f.stairsRoom);
      assert.notEqual(f.stampRoom, 0);
    }
  }
});

test('opening the boss door connects the boss room', () => {
  const d = new Dungeon(21); d.keys = 1; d.enterFloor(3);
  const f = d.floor, r = f.rooms[f.bossRoom];
  Object.assign(d.p, {x: f.door.x, y: f.door.y});
  d.interact();
  assert.equal(f.doorOpen, true);
  assert.equal(d.keys, 0);
  const field = flowField(f, f.rooms[0].cx, f.rooms[0].cy);
  assert.ok(field[r.cy * MAP_W + r.cx] >= 0);
});

test('floors are deterministic per seed', () => {
  assert.deepEqual(generateFloor(2, 77).tiles, generateFloor(2, 77).tiles);
});

test('the flashlight hits performers in front, not behind', () => {
  const d = new Dungeon(1); clearFloor(d);
  const front = put(d, 'sheet', 60, 0), back = put(d, 'sheet', -60, 0);
  d.cast('flash', {x: d.p.x + 100, y: d.p.y});
  assert.ok(front.hp < front.maxHp);
  assert.equal(back.hp, back.maxHp);
});

test('breaking a performer gives XP and coins; levels raise courage', () => {
  const d = new Dungeon(2); clearFloor(d);
  const e = put(d, 'sheet', 50, 0);
  d.damage(e, 999);
  assert.equal(e.state, 'defeated');
  assert.equal(d.p.xp, e.xp);
  assert.ok(d.drops.some(x => x.kind === 'gold'), 'performers always drop something worth picking up when lucky; this seed drops coins');
  d.gainXp(xpForLevel(1));
  assert.equal(d.p.level, 2);
  assert.equal(d.derived.maxCourage, 110);
  assert.equal(d.p.courage, 110);
});

test('candy flies and hits the first performer in its path', () => {
  const d = new Dungeon(3); clearFloor(d);
  const e = put(d, 'sheet', 150, 0);
  e.aggro = false; e.cd = 99;
  d.cast('candy', {x: d.p.x + 200, y: d.p.y});
  assert.equal(d.p.battery, 92);
  run(d, 0.6);
  assert.ok(e.hp < e.maxHp);
  assert.equal(d.projectiles.length, 0);
});

test('skills unlock by level and cost battery', () => {
  const d = new Dungeon(4); clearFloor(d);
  assert.equal(d.cast('bell'), false);
  d.p.level = 3;
  assert.equal(d.cast('bell'), true);
  assert.equal(d.cast('bell'), false, 'on cooldown');
  d.p.level = 5; d.p.battery = 10;
  assert.equal(d.cast('spotlight'), false, 'not enough battery');
});

test('the bell stuns nearby performers so their windup is cancelled', () => {
  const d = new Dungeon(5); clearFloor(d); d.p.level = 3;
  const e = put(d, 'sheet', 30, 0, {aggro: true, state: 'windup', t: .3});
  d.cast('bell');
  assert.ok(e.stun > 0);
  assert.notEqual(e.state, 'windup');
  const courage = d.p.courage;
  run(d, 0.5);
  assert.equal(d.p.courage, courage);
});

test('performers chase and scare an idle player; armor softens the scare', () => {
  const d = solo(new Dungeon(6)); clearFloor(d);
  put(d, 'sheet', 120, 0);
  run(d, 4);
  const lost = 100 - d.p.courage;
  assert.ok(lost > 0, 'the performer reached and scared the player');
  const tough = solo(new Dungeon(6)); clearFloor(tough);
  tough.equipped.coat = makeItem(rng(1), 1, 0, 'coat'); tough.equipped.coat.stats = {armor: 100};
  put(tough, 'sheet', 120, 0);
  run(tough, 4);
  assert.ok(100 - tough.p.courage < lost);
});

test('dashing makes you untouchable', () => {
  const d = new Dungeon(7); clearFloor(d);
  d.cast('dash');
  assert.equal(d.hurt(50), false);
  run(d, 0.3);
  assert.equal(d.hurt(10), true);
});

test('running out of courage sends you back to the floor start with your items, minus some coins', () => {
  const d = new Dungeon(8); clearFloor(d);
  d.p.gold = 100; const torch = d.equipped.torch;
  d.p.x += 200;
  d.hurt(999);
  assert.equal(d.p.gold, 90);
  assert.equal(d.p.x, d.floor.start.x);
  assert.equal(d.p.courage, d.derived.maxCourage);
  assert.equal(d.equipped.torch, torch);
  assert.equal(d.ending, null);
});

test('coins are picked up by walking over them; gear needs a pick-up', () => {
  const d = new Dungeon(9); clearFloor(d);
  d.drops.push({id: 900, kind: 'gold', amount: 7, x: d.p.x + 10, y: d.p.y});
  d.drops.push({id: 901, kind: 'item', item: makeItem(rng(2), 1), x: d.p.x + 12, y: d.p.y});
  d.step(0.05);
  assert.equal(d.p.gold, 7);
  assert.equal(d.inventory.length, 0);
  d.interact();
  assert.equal(d.inventory.length, 1);
});

test('equipping swaps gear and changes stats', () => {
  const d = new Dungeon(10);
  const torch = makeItem(rng(3), 5, 0, 'torch');
  d.inventory.push(torch);
  const before = d.derived.damage;
  d.equip(torch);
  assert.equal(d.equipped.torch, torch);
  assert.equal(d.inventory.length, 1, 'the old torch goes back in the bag');
  assert.ok(d.derived.damage > before);
});

test('Mr. D buys gear and sells snacks on floor 1', () => {
  const d = new Dungeon(11);
  assert.ok(d.vendor);
  Object.assign(d.p, {x: d.vendor.x, y: d.vendor.y + 20});
  const it = makeItem(rng(4), 1); d.inventory.push(it);
  assert.ok(d.sell(it));
  assert.equal(d.p.gold, it.value);
  d.p.gold = 25; const bread = d.potions.bread;
  assert.ok(d.buy('bread'));
  assert.equal(d.potions.bread, bread + 1);
  assert.equal(d.buy('bread'), false, 'not enough coins');
});

const grab = (d, quest) => { const q = d.drops.find(x => x.quest === quest); Object.assign(d.p, {x: q.x, y: q.y}); d.step(0.05); };

test('the stairs stay sealed until you pick up the floor stamp', () => {
  const d = new Dungeon(12); d.enemies = [];
  Object.assign(d.p, d.floor.stairs); d.interact();
  assert.equal(d.depth, 1, 'sealed without the stamp');
  grab(d, 'stamp');
  assert.equal(d.stampFound, true);
  Object.assign(d.p, d.floor.stairs); d.interact();
  assert.equal(d.depth, 2);
  assert.equal(d.stampFound, false, 'each floor needs its own stamp');
});

test('keys are optional on normal floors and carry over', () => {
  const d = new Dungeon(15); d.enemies = [];
  assert.ok(d.drops.some(x => x.quest === 'key'));
  grab(d, 'key');
  assert.equal(d.keys, 1);
  grab(d, 'stamp'); Object.assign(d.p, d.floor.stairs); d.drops = d.drops.filter(x => x.kind !== 'item'); d.interact();
  assert.equal(d.depth, 2);
  assert.equal(d.keys, 1);
});

test('boss floor: the door needs a key, the boss locks the stairs until broken', () => {
  const d = new Dungeon(16); d.keys = 1; d.enterFloor(3); d.enemies = d.enemies.filter(e => e.boss);
  assert.ok(!d.drops.some(x => x.quest === 'key'), 'no spare key when you brought one');
  assert.equal(d.floor.doorOpen, false);
  const boss = d.enemies[0];
  assert.equal(boss.type, 'zombie');
  d.openDoor(); d.keys = 0;
  Object.assign(d.p, d.floor.stairs); d.interact();
  assert.equal(d.depth, 3, 'stairs locked while the boss stands');
  d.damage(boss, 99999);
  assert.equal(d.stairsLocked, false);
  assert.equal(d.drops.filter(x => x.kind === 'item').length, 3);
  d.drops = [];                            // the boss's loot lands by the stairs; E would pick it up first
  d.interact();
  assert.equal(d.depth, 4);
  assert.equal(d.floor.boss, 'vampire', 'act 2 belongs to Ma Cà Rồng');
});

test('arriving at a boss floor without a key spawns a guarded spare key, so you are never stuck', () => {
  const d = new Dungeon(17); d.keys = 0; d.enterFloor(3);
  const key = d.drops.find(x => x.quest === 'key');
  assert.ok(key);
  const room = d.floor.rooms[d.floor.keyRoom];
  const guards = d.enemies.filter(e => !e.boss && e.x >= room.x * TILE && e.x < (room.x + room.w) * TILE && e.y >= room.y * TILE && e.y < (room.y + room.h) * TILE);
  assert.ok(guards.length >= 4, `key room has ${guards.length} guards`);
  assert.ok(guards.some(e => e.elite));
  Object.assign(d.p, d.floor.door); d.interact();
  assert.equal(d.floor.doorOpen, false, 'cannot open without a key');
});

test('Mr. D keeping you safe does not take your keys', () => {
  const d = new Dungeon(18); d.keys = 2; d.hurt(9999);
  assert.equal(d.keys, 2);
});

test('Ma Cổ Dài drops her head where you stood: step away and it misses, stay and it lands', () => {
  for (const stay of [false, true]) {
    const d = new Dungeon(13);
    d.enterFloor(9);
    const boss = d.enemies.find(e => e.boss);
    assert.equal(boss.type, 'neck');
    d.enemies = [boss]; d.drops = [];
    Object.assign(boss, {x: d.p.x + 180, y: d.p.y, aggro: true, special: 0});
    d.step(0.05);
    d.marks = d.marks.slice(0, 1);          // keep only the mark under the player
    boss.special = 99;                       // no new marks during the test
    assert.ok(Math.hypot(d.marks[0].x - d.p.x, d.marks[0].y - d.p.y) < 1);
    const courage = d.p.courage;
    if (!stay) { d.cast('dash', {x: d.p.x, y: d.p.y + 200}); }
    run(d, 1.1);
    if (stay) assert.ok(d.p.courage < courage, 'standing still gets hit');
    else assert.ok(d.p.courage >= courage, 'stepping away avoids it');
  }
});

test('leaving by the up-ladder ends the run', () => {
  const d = new Dungeon(14);
  Object.assign(d.p, d.floor.exitUp);
  d.interact();
  assert.equal(d.ending, 'dungeon');
});

test('item rarity improves for bosses', () => {
  const r = rng(99), rank = {common: 0, magic: 1, rare: 2, legendary: 3};
  let normal = 0, boss = 0;
  for (let i = 0; i < 400; i++) { normal += rank[makeItem(r, 3, 0).rarity]; boss += rank[makeItem(r, 3, 1.6).rarity]; }
  assert.ok(boss > normal * 1.5);
});

test('every enemy type has the fields the simulation needs', () => {
  for (const [k, e] of Object.entries(ENEMIES)) for (const f of ['name', 'hp', 'dmg', 'speed', 'cd', 'windup', 'xp', 'r']) assert.ok(e[f] !== undefined, `${k}.${f}`);
  assert.equal(TILE, 32);
});

// --- Na and Bơ ------------------------------------------------------------------

const na = d => d.companions.find(c => c.id === 'na'), bo = d => d.companions.find(c => c.id === 'bo');

test('Na and Bơ start beside you and keep up when you walk off', () => {
  const d = new Dungeon(30); clearFloor(d);
  for (const c of d.companions) assert.ok(Math.hypot(c.x - d.p.x, c.y - d.p.y) < 80);
  d.moveTo(d.floor.stairs.x, d.floor.stairs.y);
  run(d, 12);
  for (const c of d.companions) assert.ok(Math.hypot(c.x - d.p.x, c.y - d.p.y) < 200, `${c.name} fell behind`);
});

test('they come along to the next floor', () => {
  const d = new Dungeon(31); d.enterFloor(2);
  for (const c of d.companions) assert.ok(Math.hypot(c.x - d.floor.start.x, c.y - d.floor.start.y) < 80);
});

test('Na throws candy at performers who are after you', () => {
  const d = new Dungeon(32); clearFloor(d); bo(d).state = 'away'; bo(d).awayT = 1e9;
  const e = put(d, 'sheet', 200, 0, {aggro: true, cd: 99, speed: 0});
  run(d, 2.5);
  assert.ok(e.hp < e.maxHp, 'Na hit the performer');
});

test('Na cheers you up when your courage is low, then needs time before doing it again', () => {
  const d = new Dungeon(33); clearFloor(d);
  d.p.courage = 20; na(d).cd2 = 0;
  d.step(0.05);
  assert.ok(d.p.courage > 40);
  d.p.courage = 20; d.step(0.05);
  assert.ok(d.p.courage < 25, 'on cooldown');
});

test('Bơ flashes his phone at performers who get close, stunning them', () => {
  const d = new Dungeon(34); clearFloor(d); na(d).state = 'away'; na(d).awayT = 1e9;
  const c = bo(d); c.cd = 0;
  const e = put(d, 'sheet', 0, 0, {aggro: true, cd: 99}); e.x = c.x + 60; e.y = c.y;
  d.stepCompanions(0.05);
  assert.ok(e.stun > 0);
  assert.ok(e.hp < e.maxHp);
});

test('Bơ sometimes spots the stamp for you', () => {
  const d = new Dungeon(35); clearFloor(d);
  const x = d.p.x + 300, y = d.p.y, tile = Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE);
  d.drops.push({id: 999, kind: 'quest', quest: 'stamp', x, y});
  // He guesses wrong about a quarter of the time, so give him a few tries.
  for (let i = 0; i < 12 && !d.explored[tile]; i++) { d.explored[tile] = 0; bo(d).cd2 = 0; d.stepCompanions(0.05); }
  assert.equal(d.explored[tile], 1);
});

test('performers go for a companion standing closer than you', () => {
  const d = new Dungeon(36); clearFloor(d); bo(d).state = 'away'; bo(d).awayT = 1e9;
  const c = na(d); c.x = d.p.x + 100; c.y = d.p.y; c.cd = 99;
  const e = put(d, 'sheet', 140, 0, {aggro: true});
  const courage = c.courage, mine = d.p.courage;
  for (let i = 0; i < 60; i++) { c.x = d.p.x + 100; c.y = d.p.y; d.step(0.05); }
  assert.ok(c.courage < courage, 'Na got scared');
  assert.equal(d.p.courage, mine);
});

test('a companion out of courage takes a breather and comes back', () => {
  const d = new Dungeon(37); clearFloor(d);
  const c = na(d);
  d.hurtCompanion(c, 999);
  assert.equal(c.state, 'away');
  run(d, 20.5);
  assert.equal(c.state, 'follow');
  assert.equal(c.courage, d.companionMax());
});

test('trust drops when you leave them behind and grows when you fight together', () => {
  const d = new Dungeon(38); clearFloor(d);
  const c = na(d), start = c.trust;
  c.x = d.p.x; c.y = d.p.y;
  for (let i = 0; i < 120; i++) { c.x = d.p.x + 450; c.y = d.p.y; c.farT = Math.max(c.farT, 3.1); d.stepCompanions(0.05); }
  assert.ok(c.trust < start);
  const low = c.trust;
  const e = put(d, 'sheet', 200, 0, {aggro: true, cd: 99, hp: 1e9, maxHp: 1e9});
  for (let i = 0; i < 200; i++) { c.x = d.p.x - 30; c.y = d.p.y; d.stepCompanions(0.05); }
  assert.ok(c.trust > low);
  assert.ok(e);
});

test('floors roll their look at random; boss floors are always hell', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const f = generateFloor(1 + seed % 2, seed * 17);
    assert.notEqual(f.theme.id, 'hell');
    seen.add(f.theme.id);
    assert.equal(generateFloor(3, seed * 17).theme.id, 'hell');
  }
  assert.deepEqual([...seen].sort(), ['catacomb', 'cemetery', 'corridor', 'dining']);
  assert.equal(generateFloor(4, 9).boss, 'vampire');
  assert.equal(generateFloor(9, 9).boss, 'neck');
});
