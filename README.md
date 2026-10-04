# D and Cats and the Ghost

Forked from the Ánh Trăng game in [icememine/investor365](https://github.com/icememine/investor365) (`game/`). Mr. D, the cats Na, Bơ and Zin, and Khách Số 0.

## Ánh Trăng — Ca đêm ở Công viên Ánh Trăng

A haunted-house game with three ways to play:

- **Vào Hầm Ma** (main visitor mode): a Diablo-style action RPG on procedurally generated
  dungeon floors. The ghosts are still park performers: you "fight" them by breaking their act.
  Knock a performer's Composure to 0 and they crack up laughing, drop loot and leave. Running out
  of Courage never kills you; Mr. D walks you back to the start of the floor.
- **Làm nhân viên** (employee): run the scare show in one of the three hand-made rooms.
- **Tham quan cổ điển** (classic visitor tour): the original stealth tour through the three rooms.

## Hầm Ma

- Floors: 64 × 44 tiles, rooms joined by corridors, stairs in the room furthest from the start.
  The stairs stay sealed until you pick up that floor's **stamp** (con dấu, pink beam), kept in a
  guarded room about halfway out. Each normal floor also hides an optional **bronze key** (chìa
  khóa đồng, gold beam) in its furthest, most crowded room. Keys carry over between floors.
- Every third floor the boss waits in a dead-end room behind a locked door that only a key
  opens. Arrive without a key and a spare one appears in the most heavily guarded room of the boss
  floor, so you are never stuck, but skipping keys costs you that fight.
  Themes change every three floors (Nghĩa Địa, Bàn Tiệc, Hành Lang) and each boss floor's boss
  locks the stairs until broken: Xác Sống (telegraphed slam, summons sheet ghosts), Ma Cà Rồng
  (aimed dash, bat ring) and Ma Cổ Dài (drops her head where you stand). Difficulty scales with depth.
- Performers: Ma Vải (melee), Bộ Xương (fast), Ma Đèn Lồng (ranged), plus "Ngôi Sao" elites.
- Companions: **Na** throws candy and cheers you up when your courage is low; **Bơ** flashes his
  phone to stun performers who get close and sometimes spots the stamp or key (he guesses wrong a
  quarter of the time). Performers go after whoever is closest. Out of courage, a friend steps
  outside for 20 s and comes back. Trust grows when you fight side by side and drops when you leave
  them behind; higher trust makes their help stronger.
- Skills: Rọi đèn (free cone), Ném kẹo (projectile), Chuông đồng (stun, level 3), Đèn sân khấu
  (big beam, level 5), Lướt (dash, untouchable). Potions: bánh bao (courage), pin AA (battery).
- Loot: torch, coat, charm and shoes in four rarities with random affixes. Mr. D's stand on floors
  1, 4, 7… buys gear and sells snacks.
- Controls: left click to move / attack / pick up (hold to keep walking), right click or Q to throw
  candy at the cursor, Space, R, F, Shift, E, 1 / 2, I for the bag. On phones the attack buttons
  auto-aim at the nearest performer.

## Progression (Hầm Ma)

- **Skill tree (K):** 12 nodes in two branches, Đèn (light skills) and Bạn bè (companion buffs);
  one point per level after the first; respec for 50 xu at Mr. D's.
- **Gear:** seven slots (torch, coat, charm, shoes, hat, bag, badge); rarities Thường, Xịn, Hiếm,
  Huyền thoại, plus green **Bộ** set pieces: each boss drops a piece of its 2-piece set (Xác Sống:
  armor and courage per break; Ma Cà Rồng: damage returns as courage; Ma Cổ Dài: crit and faster
  dash). Hiếm and Huyền thoại items can roll one conditional affix ("+X% damage below 30% courage",
  "+X% against untouched performers", legendary "100% crit below 20% courage").
- **Town hub:** between descents (start screen or end screen), Mr. D sells stand upgrades (extra
  bánh bao or pin AA each descent, a map that shows each stamp), costumes with small stats, and
  gadgets for Bơ. Purchases are saved with the character.
- **Zin (Khách Số 0):** each act hides one "Vé 000" fragment (bosses 50%, elites 10%). With one
  fragment, press Z (or ✧ / the radial) once per floor: Zin restores your courage, stuns nearby
  performers and fights for 12 s with the strength of you, Na and Bơ together. Three fragments
  send the next stairs to Tầng 000: stamp the ticket (Xé vé: Zin moves on and can no longer be
  called) or sign the roster (Ma mới: Zin joins the staff and stays callable).
- **Screen layout (Greedy Cave style):** the dungeon fills the window. Top left: portrait, red courage
  and blue battery bars with numbers, a level badge and status icons (keys, stamp, Vé 000, coins,
  skill points), with the quest under them. Top right: minimap. Bottom: round skill icons; right
  side: bánh bao, pin AA, Zin, skill tree and bag; a contextual action button above the skill bar.
- **One-thumb phone mode:** default on touch screens, switchable in Pause. No joystick: tap the floor
  to walk, tap a performer to attack, and the flashlight fires by itself at anyone in reach.
- **Floors:** each floor rolls its look at random (Hầm Mộ, Nghĩa Địa, Phòng Ăn, Hành Lang); boss
  floors are always Địa Ngục. Bosses rotate by act of three floors (Xác Sống, Ma Cà Rồng, Ma Cổ Dài),
  and each act holds one Vé 000 fragment.
- **Companions are cats:** Na (mướp, pink bow), Bơ (tam thể, blue cap and glasses) and Zin (orange),
  in Hầm Ma and in the classic tour.
- **Items on the floor** are large icons with a glow in their rarity colour; coins and snacks too.
- **Art drop-in:** finished sprites placed in `assets/art/` replace the painted placeholders; see
  `assets/art/README.md` for the file list and specs.

## Players and saves

Players choose a name on the start screen; several players can share a device. Saves live in the
player's own browser (there is no server):

- `localStorage` key `anhtrang.save.v1` holds every player on this device: Hầm Ma character
  (level, XP, coins, gear, bag, potions, keys, Na and Bơ's trust), an unfinished descent to resume
  at the start of its floor, best depth, unlocked classic endings and the best employee score.
  Each player record notes the device type (phone, tablet, desktop).
- Cookies `anhtrang_device` (a random device ID, not a fingerprint) and `anhtrang_player` (who
  played last). The ID is kept in both places, so clearing one does not lose it.
- Leaving the dungeon keeps the character and clears the descent; "Nhân vật mới" resets it.
- Private windows and sandboxed frames may refuse storage; the game then says progress will not
  be kept. `src/save.mjs` takes storage and cookies as parameters, so a cloud backend can replace
  them later without touching the game.

## Hand-made rooms (employee and classic tour)

1. **Phòng Nghĩa Địa** (cemetery): Xác Sống hunts by ear. Loose boards creak, running is loud,
   and a thrown coin pulls him away. Light only makes him flinch, then he follows it, and a lit
   flashlight gives away the coat hiding spot. Na's lost hair clip is hidden here. Staff can hide
   in the standing coffin and burst out for a guaranteed surprise. The arch leads on to room 2.
2. **Bàn Tiệc Ma Cà Rồng** (dining room): the vampire hunts by sight. Three clues unlock Khách
   Số 0 (Zin) and the story endings. The door leads on to room 3.
3. **Hành lang Ma Cổ Dài** (corridor): a head rides a ceiling rail and drops on whoever stands
   under its shadow. Crouch (Q), yank the pulley rope, shine the flashlight on the pulley to jam
   it, or take the dark staff back door. Light on her face only helps her find you. A wig on a
   second rope casts a decoy shadow. Staff work the rope: movement steers the head, Space drops
   it, and the walkie-talkie calls a coworker to take over for a while. The far door ends the visit.

The start screen picks the starting room; a visitor run normally starts in the cemetery. Full design, script and architecture notes: [GAME-DESIGN.md](GAME-DESIGN.md).

Plain HTML5 Canvas + ES modules. No framework, package manager or server code.

## Play

- **Offline:** open `simulator.html` directly in a browser.
- **From source:** ES modules need HTTP, so serve this folder and open `src/index.html`:

  ```sh
  python3 -m http.server 8000   # then http://localhost:8000/src/index.html
  ```

Controls: WASD/arrows or tap the floor to move · E use · Space flashlight / scare ·
Q hide / trigger speaker · P place speaker · Shift run · J journal · Esc pause.
Phones get a joystick and action buttons.

## Layout

| Path | Role |
|---|---|
| `src/rooms.mjs` | Room data: bounds, colliders, spots, ghost type, guest routes. Add rooms here. |
| `src/sim.mjs` | Authoritative game state, pathfinding, interactions, ghost/guest AI, endings. No DOM. |
| `src/art.mjs` | Procedural placeholder art: room backdrops, dungeon tiles, and the zombie, long-neck, sheet ghost, skeleton, lantern and Mr. D sprites. |
| `src/progression.mjs` | Skill tree, boss sets, town catalog, Zin constants. No DOM. |
| `src/dungeon.mjs` | Hầm Ma rules: floor generation, combat, bosses, loot, levels. No DOM. |
| `src/save.mjs` | Players, device ID and save games (localStorage + cookies). No DOM in the core. |
| `src/dungeon-view.mjs` | Hầm Ma rendering (darkness, telegraphs, minimap, boss bar), pointer input, bag and shop HTML. |
| `src/app.js` | Input, camera, Canvas rendering, HUD, dialogs. |
| `src/index.html`, `src/style.css` | Layout, HUD, touch controls. |
| `assets/world.png`, `assets/actors.png` | Room backdrop and the 4-sprite character atlas (`actors.atlas.json`; the crops are mirrored in `app.js`). |
| `tools/build-standalone.py` | Generates `simulator.html` with CSS, JS and PNGs inlined. |
| `tests/sim.test.mjs` | Headless tests for the simulation rules. |

`src/` is the source of truth. `simulator.html` is generated, so don't edit it by hand.

## Develop

```sh
node --test tests/*.test.mjs        # rule tests for both modes (Node 18+)
python3 tools/build-standalone.py   # rebuild simulator.html after changing src/ or assets/
```

Open the page with `?debug` to expose the running game as `window.anhTrangDebug` for testing.
