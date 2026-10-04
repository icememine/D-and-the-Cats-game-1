// Headless checks of the simulation rules described in GAME-DESIGN.md. Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {distance, passable, findPath, Simulation} from '../src/sim.mjs';
import {ROOMS} from '../src/rooms.mjs';

const DINING = ROOMS.dining, CEMETERY = ROOMS.cemetery, CORRIDOR = ROOMS.corridor;

const spot = (id, room = DINING) => room.spots.find(s => s.id === id);
const standAt = (sim, id) => { const s = spot(id, sim.room); sim.p.x = s.x; sim.p.y = s.y + 20; };
const run = (sim, seconds, input = {}) => { for (let t = 0; t < seconds; t += 0.05) sim.step(0.05, input); };
// Park the vampire far away so it does not interfere with tests about other rules.
const parkGhost = sim => { Object.assign(sim.monster, {x: 120, y: 500, state: 'rest', t: 999, path: []}); };

test('rejects unknown roles', () => {
  assert.throws(() => new Simulation('ghost'));
});

test('dining room: pathfinding stays on walkable floor and routes around the table', () => {
  const path = findPath(DINING, {x: 380, y: 300}, {x: 660, y: 300});
  assert.ok(path.length > 0);
  for (const n of path) assert.ok(passable(DINING, n.x, n.y), `node ${n.x},${n.y} is blocked`);
  const table = DINING.blocks[0];
  assert.ok(path.some(n => n.y > table.y + table.h), 'path should detour below the table');
});

test('objects cannot be used from far away; tapping queues navigation', () => {
  const sim = new Simulation('visitor', 'dining'); parkGhost(sim);
  assert.equal(sim.interact('bell'), false);
  sim.navigate(spot('bell').x, spot('bell').y, 'bell');
  run(sim, 6);
  assert.ok(sim.objectCooldowns.bell > 0, 'bell should have been rung on arrival');
});

test('clues are collected once and unlock nothing without all three', () => {
  const sim = new Simulation('visitor', 'dining'); parkGhost(sim);
  standAt(sim, 'portrait'); sim.interact('portrait');
  standAt(sim, 'portrait'); sim.interact('portrait');
  assert.deepEqual(sim.clues, ['name']);
  assert.equal(sim.mystery, false);
});

test('repeated prop use is weaker and respects cooldown', () => {
  const sim = new Simulation('visitor', 'dining');
  standAt(sim, 'bell');
  assert.ok(sim.effect('bell', spot('bell')));
  const first = sim.monster.effectDuration;
  assert.equal(sim.effect('bell', spot('bell')), false, 'still cooling down');
  sim.objectCooldowns.bell = 0;
  sim.effect('bell', spot('bell'));
  assert.ok(Math.abs(first - sim.monster.effectDuration - 0.65) < 1e-9);
});

test('flashlight aimed at the ghost stuns it; aimed away does nothing', () => {
  const sim = new Simulation('visitor', 'dining');
  Object.assign(sim.p, {x: 500, y: 450});
  Object.assign(sim.monster, {x: 700, y: 450, state: 'patrol', path: []});
  sim.p.face = Math.PI; // facing left, away from the ghost
  sim.action(); sim.step(0.05);
  assert.notEqual(sim.monster.state, 'stunned');
  sim.p.face = 0;
  sim.step(0.05);
  assert.equal(sim.monster.state, 'stunned');
});

test('max fear sends the visitor to rest without losing clues', () => {
  const sim = new Simulation('visitor', 'dining'); parkGhost(sim);
  sim.clues.push('ticket'); sim.monster.state = 'patrol'; sim.monster.t = 0;
  sim.fear = 100; sim.stepVisitor(0.05);
  assert.equal(sim.fear, 40);
  assert.equal(sim.resting, true);
  assert.deepEqual(sim.clues, ['ticket']);
});

test('visitor exit endings depend on time and clues', () => {
  const quick = new Simulation('visitor', 'corridor'); standAt(quick, 'door'); quick.interact('door');
  assert.equal(quick.ending, 'leave');
  const found = new Simulation('visitor', 'corridor'); found.clues.push('tape'); standAt(found, 'door'); found.interact('door');
  assert.equal(found.ending, 'tricks');
});

test('the dining room door leads on to the corridor', () => {
  const sim = new Simulation('visitor', 'dining');
  standAt(sim, 'door'); sim.interact('door');
  assert.equal(sim.roomId, 'corridor');
  assert.equal(sim.ending, null);
});

test('Zin appears with all clues after 20 s, and the table resolves the ticket', () => {
  const sim = new Simulation('visitor', 'dining'); parkGhost(sim);
  sim.clues.push('name', 'tape', 'ticket');
  sim.time = 19; sim.tryMystery(); assert.equal(sim.mystery, false);
  sim.time = 20; sim.tryMystery(); assert.equal(sim.mystery, true);
  standAt(sim, 'ticket'); sim.interact('ticket');
  assert.equal(sim.ending, 'ticket');
});

test('wardrobe invites Zin onto the staff once the story is active', () => {
  const sim = new Simulation('visitor', 'dining');
  sim.clues.push('name', 'tape', 'ticket'); sim.time = 25; sim.tryMystery();
  standAt(sim, 'wardrobe'); sim.interact('wardrobe');
  assert.equal(sim.ending, 'new');
});

test('employee places at most three spaced speakers', () => {
  const sim = new Simulation('employee', 'dining');
  for (const x of [200, 300, 400, 500]) { sim.p.x = x; sim.p.y = 450; sim.place(); }
  assert.equal(sim.props.length, 3);
  assert.equal(sim.stamina, 85);
  sim.props.length = 0; sim.p.x = 200; sim.place(); sim.p.x = 230; sim.place();
  assert.equal(sim.props.length, 1, 'too close to the first speaker');
});

test('employee admits one group at a time and guests act on their own', () => {
  const sim = new Simulation('employee', 'dining');
  standAt(sim, 'door'); sim.interact('door');
  assert.equal(sim.npcs.length, 2);
  const before = sim.npcs.map(n => ({x: n.x, y: n.y}));
  standAt(sim, 'door'); sim.interact('door');
  assert.equal(sim.wave, 1, 'second group must wait');
  Object.assign(sim.p, {x: 150, y: 500});
  run(sim, 3);
  assert.ok(sim.npcs.some((n, i) => distance(n, before[i]) > 20), 'guests should move while player idles');
});

test('surprise scare scores more than a seen scare, repeats score little', () => {
  const sim = new Simulation('employee', 'dining');
  standAt(sim, 'door'); sim.interact('door');
  const g = sim.npcs[0];
  Object.assign(g, {x: 500, y: 450, face: Math.PI, caution: 0.1, path: []});
  sim.npcs[1].gone = true;
  Object.assign(sim.p, {x: 600, y: 450});
  sim.action(); // guest faces away -> surprise
  assert.equal(sim.score, 25);
  sim.cooldown = 0; g.flee = 0; g.face = 0; // now facing the performer and cautious
  sim.action();
  assert.equal(sim.score, 35);
  sim.cooldown = 0; g.flee = 0;
  sim.action();
  assert.equal(sim.score, 38);
});

test('speaker pulls each guest only once', () => {
  const sim = new Simulation('employee', 'dining');
  standAt(sim, 'door'); sim.interact('door');
  Object.assign(sim.p, {x: 700, y: 450}); sim.place();
  assert.equal(sim.npcs.filter(n => distance(n, sim.props[0]) <= 300).length > 0, true);
  sim.secondary();
  const pulled = sim.distracted;
  assert.ok(pulled > 0);
  sim.propCooldown = 0; sim.secondary();
  assert.equal(sim.distracted, pulled);
});

test('finished runs stop advancing', () => {
  const sim = new Simulation('employee', 'dining');
  sim.finish('together');
  const t = sim.time; sim.step(0.05);
  assert.equal(sim.time, t);
});

// --- Room 2: Phòng Nghĩa Địa -------------------------------------------------

const zombieAt = (sim, x, y, state = 'patrol') => Object.assign(sim.monster, {x, y, state, t: 0, path: []});

test('a new run starts in the cemetery, and every cemetery spot is reachable', () => {
  const sim = new Simulation('visitor');
  assert.equal(sim.roomId, 'cemetery');
  assert.equal(sim.monster.sprite, CEMETERY.ghost.sprite);
  for (const s of CEMETERY.spots) {
    const path = findPath(CEMETERY, CEMETERY.start, s);
    const end = path.at(-1) || CEMETERY.start;
    assert.ok(distance(end, s) < 48, `${s.id} is not reachable`);
  }
});

test('cemetery art blocks and guest routes stay on walkable ground', () => {
  for (const route of CEMETERY.routes) for (const p of route) assert.ok(passable(CEMETERY, p.x, p.y), `route point ${p.x},${p.y}`);
  for (const p of CEMETERY.ghost.patrol) assert.ok(passable(CEMETERY, p.x, p.y), `patrol point ${p.x},${p.y}`);
  for (const room of [CEMETERY, DINING]) {
    assert.ok(passable(room, room.start.x, room.start.y), `${room.id} start`);
    for (const o of room.companionOffsets) assert.ok(passable(room, room.start.x + o.x, room.start.y + o.y), `${room.id} companion start`);
  }
  // Nothing should be usable from the spawn point by accident (e.g. leaving the room).
  for (const s of CEMETERY.spots.filter(s => s.kind === 'entrance' || s.kind === 'exit')) assert.ok(distance(s, CEMETERY.start) > 64, `${s.id} is in reach at spawn`);
});

test('walking on loose boards makes noise the zombie walks toward', () => {
  const sim = new Simulation('visitor');
  zombieAt(sim, 400, 470);
  Object.assign(sim.p, {x: 600, y: 470});
  sim.step(0.05, {dx: 1});
  assert.equal(sim.monster.state, 'investigate');
  assert.ok(sim.monster.path.length > 0);
});

test('walking quietly off the boards is not heard', () => {
  const sim = new Simulation('visitor');
  zombieAt(sim, 400, 300);
  Object.assign(sim.p, {x: 150, y: 470});
  run(sim, 0.5, {dx: 1});
  assert.equal(sim.monster.state, 'patrol');
});

test('a thrown coin lands where the player faces and pulls the zombie there', () => {
  const sim = new Simulation('visitor');
  zombieAt(sim, 500, 470);
  const coin = sim.spots().find(s => s.id === 'coin');
  Object.assign(sim.p, {x: coin.x, y: coin.y + 20});
  assert.ok(sim.interact('coin'));
  assert.equal(sim.coinHeld, true);
  sim.p.face = 0;
  sim.secondary();
  assert.equal(sim.coinHeld, false);
  assert.ok(sim.coin.x > sim.p.x + 100, 'coin flies forward');
  assert.equal(sim.monster.state, 'investigate');
  assert.ok(sim.spots().some(s => s.id === 'coin'), 'coin can be picked up again');
});

test('the zombie smells an exposed player up close, but not one hiding', () => {
  const sim = new Simulation('visitor');
  const coat = spot('coat', CEMETERY);
  Object.assign(sim.p, {x: coat.x, y: coat.y + 20});
  sim.interact('coat');
  assert.equal(sim.hidden, true);
  zombieAt(sim, coat.x - 40, coat.y + 40);
  sim.stepVisitor(0.05);
  assert.notEqual(sim.monster.state, 'windup');
  sim.hidden = false;
  zombieAt(sim, coat.x - 40, coat.y + 40);
  sim.stepVisitor(0.05);
  assert.equal(sim.monster.state, 'windup');
});

test('a lit flashlight gives away the coat hiding spot', () => {
  const sim = new Simulation('visitor');
  const coat = spot('coat', CEMETERY);
  Object.assign(sim.p, {x: coat.x, y: coat.y + 20});
  sim.action();             // torch on
  sim.interact('coat');     // hide with it still on
  assert.equal(sim.hidden, true);
  assert.equal(sim.torch, true);
  zombieAt(sim, 600, 300);
  sim.stepVisitor(0.05);
  assert.equal(sim.monster.state, 'investigate', 'the light is seen like a sound');
});

test('light only makes the zombie flinch, then it follows the light', () => {
  const sim = new Simulation('visitor');
  Object.assign(sim.p, {x: 400, y: 480, face: 0});
  zombieAt(sim, 520, 480);
  sim.action(); sim.stepVisitor(0.05);
  assert.equal(sim.monster.state, 'stunned');
  assert.ok(sim.monster.t <= 2);
  sim.torch = false;
  for (let i = 0; i < 50; i++) sim.stepVisitor(0.05);
  assert.equal(sim.monster.effectLabel, 'Lần theo ánh đèn');
});

test('finding Na\'s lost clip records it and removes the spot', () => {
  const sim = new Simulation('visitor');
  standAt(sim, 'clip');
  sim.interact('clip');
  assert.deepEqual(sim.found, ['clip']);
  assert.ok(!sim.spots().some(s => s.id === 'clip'));
});

test('the arch leads to the dining room and keeps progress', () => {
  const sim = new Simulation('visitor');
  sim.fear = 55; sim.battery = 60; sim.found.push('clip');
  standAt(sim, 'door'); sim.interact('door');
  assert.equal(sim.roomId, 'dining');
  assert.equal(sim.ending, null);
  assert.equal(sim.fear, 55);
  assert.equal(sim.battery, 60);
  assert.deepEqual(sim.found, ['clip']);
  assert.equal(sim.monster.sprite, DINING.ghost.sprite);
});

test('leaving by the cemetery entrance ends the run early', () => {
  const sim = new Simulation('visitor');
  standAt(sim, 'entrance'); sim.interact('entrance');
  assert.equal(sim.ending, 'leave');
});

test('employee: guests enter at the cemetery entrance and leave by the arch', () => {
  const sim = new Simulation('employee');
  standAt(sim, 'door'); sim.interact('door');
  assert.equal(sim.npcs.length, 0, 'the arch does not admit guests');
  standAt(sim, 'entrance'); sim.interact('entrance');
  assert.equal(sim.npcs.length, 2);
  for (const n of sim.npcs) n.interest = 0;
  Object.assign(sim.p, {x: 150, y: 300});
  run(sim, 30);
  assert.equal(sim.served, 2);
  assert.equal(sim.phase, 'between');
});

test('employee: bursting out of the coffin always surprises, with longer reach', () => {
  const sim = new Simulation('employee');
  standAt(sim, 'entrance'); sim.interact('entrance');
  const coffin = spot('coffin', CEMETERY);
  Object.assign(sim.p, {x: coffin.x, y: coffin.y});
  sim.interact('coffin');
  assert.equal(sim.hidden, true);
  const g = sim.npcs[0]; sim.npcs[1].gone = true;
  // Facing the coffin, fully cautious, 165 units away: a normal scare would miss and not surprise.
  Object.assign(g, {x: coffin.x - 165, y: coffin.y, face: 0, caution: 1, path: []});
  sim.action();
  assert.equal(sim.score, 25);
  assert.equal(sim.hidden, false);
});

// --- Every room ---------------------------------------------------------------

test('every room: spots reachable, routes and spawns on walkable floor, exits out of reach at spawn', () => {
  for (const room of Object.values(ROOMS)) {
    for (const s of room.spots) {
      const end = findPath(room, room.start, s).at(-1) || room.start;
      assert.ok(distance(end, s) < 48, `${room.id}/${s.id} is not reachable`);
    }
    for (const route of room.routes) for (const p of route) assert.ok(passable(room, p.x, p.y), `${room.id} route ${p.x},${p.y}`);
    for (const p of room.guestSpawn) assert.ok(passable(room, p.x, p.y), `${room.id} guest spawn`);
    assert.ok(passable(room, room.start.x, room.start.y), `${room.id} start`);
    for (const o of room.companionOffsets) assert.ok(passable(room, room.start.x + o.x, room.start.y + o.y), `${room.id} companion`);
    for (const s of room.spots.filter(s => ['entrance', 'exit', 'backdoor'].includes(s.kind))) assert.ok(distance(s, room.start) > 64, `${room.id}/${s.id} in reach at spawn`);
  }
});

// --- Room 3: Hành lang Ma Cổ Dài ----------------------------------------------

const headAt = (sim, x, y, state = 'patrol') => Object.assign(sim.monster, {x, y, state, t: 0});

test('the head drops on a player standing under its shadow, not on one crouching', () => {
  const sim = new Simulation('visitor', 'corridor');
  Object.assign(sim.p, {x: 600, y: 440});
  headAt(sim, 600, 440); sim.stepVisitor(0.05);
  assert.equal(sim.monster.state, 'windup');
  const low = new Simulation('visitor', 'corridor');
  Object.assign(low.p, {x: 600, y: 440});
  low.secondary(); assert.equal(low.crouch, true);
  headAt(low, 600, 440); low.stepVisitor(0.05);
  assert.notEqual(low.monster.state, 'windup');
});

test('crouching halves walking speed', () => {
  const sim = new Simulation('visitor', 'corridor');
  Object.assign(sim.p, {x: 300, y: 440}); headAt(sim, 860, 320);
  sim.step(0.05, {dx: 1}); const walk = sim.p.x - 300;
  sim.secondary(); const x = sim.p.x; sim.step(0.05, {dx: 1});
  assert.ok(Math.abs((sim.p.x - x) * 2 - walk) < 1e-6);
});

test('a scare lands if the player is still under the head when it drops', () => {
  const sim = new Simulation('visitor', 'corridor');
  Object.assign(sim.p, {x: 600, y: 440}); headAt(sim, 600, 440);
  const fear = sim.fear;
  for (let i = 0; i < 20; i++) sim.stepVisitor(0.05);
  assert.equal(sim.fear, fear + 24);
});

test('light on the pulley jams the rail; light on her face does not', () => {
  const sim = new Simulation('visitor', 'corridor');
  Object.assign(sim.p, {x: 300, y: 420, face: 0}); headAt(sim, 420, 420);
  sim.action(); sim.stepVisitor(0.05);
  assert.notEqual(sim.monster.state, 'jammed');
  const mech = CORRIDOR.ghost.mechanism;
  Object.assign(sim.p, {x: 500, y: 440, face: Math.atan2(mech.y - 440, mech.x - 500)}); headAt(sim, 800, 330);
  sim.stepVisitor(0.05);
  assert.equal(sim.monster.state, 'jammed');
  for (let i = 0; i < 110; i++) sim.stepVisitor(0.05);
  assert.notEqual(sim.monster.state, 'jammed', 'jam wears off and cannot be held forever');
});

test('yanking the rope pulls the head up out of reach', () => {
  const sim = new Simulation('visitor', 'corridor');
  standAt(sim, 'pulley'); headAt(sim, sim.p.x, sim.p.y);
  sim.interact('pulley');
  assert.equal(sim.monster.state, 'retract');
  sim.stepVisitor(0.05);
  assert.equal(sim.monster.state, 'retract');
});

test('the back door hides the visitor, then lets them out near the far end, a little more scared', () => {
  const sim = new Simulation('visitor', 'corridor');
  standAt(sim, 'backdoor'); sim.interact('backdoor');
  assert.equal(sim.hidden, true);
  const fear = sim.fear;
  run(sim, 4.2);
  assert.equal(sim.hidden, false);
  assert.ok(sim.p.x > 700);
  assert.ok(sim.fear >= fear + 6 - 0.5);
});

test('the mirror is a one-time find, and the radio is staff-only', () => {
  const sim = new Simulation('visitor', 'corridor');
  assert.ok(!sim.spots().some(s => s.id === 'radio'));
  standAt(sim, 'mirror'); sim.interact('mirror');
  assert.deepEqual(sim.found, ['mirror']);
  assert.ok(!sim.spots().some(s => s.id === 'mirror'));
});

test('employee: holding the rope steers the head, not the performer', () => {
  const sim = new Simulation('employee', 'corridor');
  standAt(sim, 'pulley'); sim.interact('pulley');
  assert.equal(sim.puppet, true);
  const p = {x: sim.p.x, y: sim.p.y}, hx = sim.monster.x;
  sim.step(0.05, {dx: -1});
  assert.deepEqual({x: sim.p.x, y: sim.p.y}, p);
  assert.ok(sim.monster.x < hx);
  sim.interact('pulley'); assert.equal(sim.puppet, false);
});

test('employee: dropping the head scares guests under it; guests who saw the shadow are not surprised', () => {
  const sim = new Simulation('employee', 'corridor');
  standAt(sim, 'entrance'); sim.interact('entrance');
  standAt(sim, 'pulley'); sim.interact('pulley');
  const [a, b] = sim.npcs;
  Object.assign(a, {x: 600, y: 440, caution: 0.1, path: []});
  Object.assign(b, {x: 300, y: 340, caution: 1, path: []});
  Object.assign(sim.monster, {x: 600, y: 430});
  sim.action();
  assert.equal(sim.score, 25, 'only the guest under the head is hit');
  sim.cooldown = 0; a.flee = 0; a.caution = 1; a.hits = 0;
  sim.action();
  assert.equal(sim.score, 35, 'a cautious guest only counts as seen');
});

test('employee: the radio restores stamina once per 45 s', () => {
  const sim = new Simulation('employee', 'corridor');
  sim.stamina = 40; standAt(sim, 'radio');
  sim.interact('radio'); assert.equal(sim.stamina, 75);
  sim.interact('radio'); assert.equal(sim.stamina, 75);
});
