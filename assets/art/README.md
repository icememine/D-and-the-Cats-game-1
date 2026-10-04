# Artist sprites (optional)

Drop finished PNGs here to replace the code-drawn placeholders. Any file that is missing keeps the
placeholder, so art can arrive one piece at a time.

| File | What | Shown at (world units tall) | Notes |
| --- | --- | --- | --- |
| `sheet.png` | Ma Vải, kid in a bedsheet | 46 | front-facing, transparent background, feet at the bottom edge |
| `skeleton.png` | Bộ Xương, skeleton onesie | 62 | as above |
| `lantern.png` | Ma Đèn Lồng, paper lantern | 42 | floats; no shadow needed |
| `zombie.png` | Xác Sống (room and boss) | 96 as boss | |
| `neck.png` | Ma Cổ Dài, full body | 118 as boss | the top ~28% is also used as her hanging head in the corridor room |
| `mrd.png` | Mr. D behind his stand | 70 | the stand itself is drawn by the game |
| `zin.png` | Zin, Khách Số 0 | 68 | drawn slightly see-through by the game |

Style: Xanh Đêm palette (indigo `#0a1424`, moss teal `#1c3836`, mint `#a0ead4`, gold `#e7c083`,
rose `#f3889c`), detailed chibi pixel art matching `assets/actors.png`, crisp edges, no
anti-aliased halo, width at most 1.4 × height. Sprites face the viewer; the game mirrors them.

After adding files, run `python3 tools/build-standalone.py` so `simulator.html` includes them.
