// Headless checks for save games. Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {SaveStore, cleanName, nameKey, deviceType, snapshotDungeon, restoreDungeon, COOKIE_DEVICE, COOKIE_PLAYER, SAVE_VERSION} from '../src/save.mjs';
import {Dungeon, makeItem, rng} from '../src/dungeon.mjs';

const memoryStorage = () => { const m = new Map(); return {m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; };
const memoryCookies = () => { const m = new Map(); return {m, get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v)}; };
let n = 0;
const store = (storage = memoryStorage(), cookies = memoryCookies(), device = 'phone') => new SaveStore({storage, cookies, device, randomId: () => `dev-${++n}`, now: () => 1000 + n});

test('names are trimmed, capped at 20 characters and stripped of markup', () => {
  assert.equal(cleanName('  Bin   Bin  '), 'Bin Bin');
  assert.equal(cleanName('<b>Na</b>'), 'bNa/b');
  assert.equal(cleanName('x'.repeat(30)).length, 20);
  assert.equal(cleanName('   '), '');
  assert.equal(nameKey('Ánh TRĂNG'), nameKey('ánh trăng'));
});

test('device type is a coarse class from the user agent and pointer', () => {
  assert.equal(deviceType({ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile', coarse: true, width: 390}), 'phone');
  assert.equal(deviceType({ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit', coarse: true, width: 1200}), 'tablet');
  assert.equal(deviceType({ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', coarse: true, width: 1024}), 'tablet');
  assert.equal(deviceType({ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', coarse: false, width: 1440}), 'desktop');
});

test('a device ID is created once and kept in both the cookie and storage', () => {
  const storage = memoryStorage(), cookies = memoryCookies();
  const a = store(storage, cookies);
  assert.ok(a.deviceId);
  assert.equal(cookies.get(COOKIE_DEVICE), a.deviceId);
  assert.equal(store(storage, cookies).deviceId, a.deviceId, 'same device on reload');
  cookies.m.clear();
  assert.equal(store(storage, cookies).deviceId, a.deviceId, 'survives cleared cookies');
  const fresh = memoryStorage();
  assert.equal(store(fresh, cookies).deviceId, a.deviceId, 'survives cleared storage via the cookie');
});

test('players are picked by name; the cookie remembers who played last', () => {
  const storage = memoryStorage(), cookies = memoryCookies();
  const s = store(storage, cookies, 'phone');
  assert.equal(s.current(), null);
  assert.equal(s.select('   '), null);
  const bin = s.select('Bin');
  assert.equal(bin.deviceType, 'phone');
  assert.equal(cookies.get(COOKIE_PLAYER), 'Bin');
  s.select('Na');
  assert.equal(s.profiles().length, 2);
  assert.equal(s.select('bin'), s.data.profiles.bin, 'same player, any capitalisation');
  // A reload with an empty "current" falls back to the cookie.
  const raw = JSON.parse(storage.getItem('anhtrang.save.v1')); raw.current = null; storage.setItem('anhtrang.save.v1', JSON.stringify(raw));
  assert.equal(store(storage, cookies).current().name, 'Bin');
});

test('corrupted or future-version saves never crash; they start fresh', () => {
  const storage = memoryStorage();
  storage.setItem('anhtrang.save.v1', '{not json');
  assert.deepEqual(store(storage).profiles(), []);
  storage.setItem('anhtrang.save.v1', JSON.stringify({version: SAVE_VERSION + 1, deviceId: 'keep-me', profiles: {x: {}}}));
  const s = store(storage);
  assert.deepEqual(s.profiles(), []);
  assert.equal(s.deviceId, 'keep-me');
});

test('works with no storage and no cookies at all (private window)', () => {
  const s = new SaveStore({storage: null, cookies: null, randomId: () => 'tmp'});
  assert.ok(s.select('Bin'));
  assert.equal(s.recordEnding('shift'), false, 'nothing could be written, and it says so');
  assert.deepEqual(s.current().endings, ['shift']);
});

test('throwing storage is treated like missing storage', () => {
  const bad = {getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() {}};
  const s = new SaveStore({storage: bad, cookies: {get() { throw Error('no'); }, set() { throw Error('no'); }}});
  assert.ok(s.select('Bin'));
});

test('endings and best scores are recorded once per player', () => {
  const s = store(); s.select('Bin');
  s.recordEnding('ticket'); s.recordEnding('ticket'); s.recordEnding('new');
  s.recordScore(40); s.recordScore(25);
  assert.deepEqual(s.current().endings, ['ticket', 'new']);
  assert.equal(s.current().best.score, 40);
  s.select('Na');
  assert.deepEqual(s.current().endings, []);
});

test('a Hầm Ma character survives a save and restore', () => {
  const d = new Dungeon(5);
  d.p.level = 6; d.p.xp = 33; d.p.gold = 210; d.keys = 2; d.potions = {bread: 4, battery: 3};
  const torch = makeItem(rng(1), 6, 1, 'torch'); d.equip(torch, true);
  d.inventory.push(makeItem(rng(2), 5)); d.companions[0].trust = 82; d.enterFloor(5); d.stats.deepest = 5;
  const snap = JSON.parse(JSON.stringify(snapshotDungeon(d)));
  const back = restoreDungeon(new Dungeon(snap.seed), snap);
  assert.equal(back.depth, 5);
  assert.equal(back.p.level, 6); assert.equal(back.p.xp, 33); assert.equal(back.p.gold, 210);
  assert.equal(back.keys, 2); assert.deepEqual(back.potions, {bread: 4, battery: 3});
  assert.equal(back.equipped.torch.name, torch.name);
  assert.equal(back.inventory.length, d.inventory.length);
  assert.equal(back.companions[0].trust, 82);
  assert.equal(back.p.courage, back.derived.maxCourage);
});

test('finishing a descent keeps the character but clears the unfinished floor', () => {
  const s = store(); s.select('Bin');
  const d = new Dungeon(6); d.p.level = 4; d.enterFloor(3); d.stats.deepest = 3;
  s.saveDungeon(snapshotDungeon(d));
  assert.equal(s.current().dungeon.depth, 3);
  s.saveDungeon(snapshotDungeon(d), {finished: true});
  assert.equal(s.current().dungeon, null);
  assert.equal(s.current().character.level, 4);
  assert.equal(s.current().best.depth, 3);
  s.resetCharacter();
  assert.equal(s.current().character, null);
});
