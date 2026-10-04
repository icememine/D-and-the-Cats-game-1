#!/usr/bin/env python3
"""Embed CSS, the ES modules and the PNGs into one offline simulator.html.

The modular files under src/ and assets/ are the source of truth; simulator.html
is generated output. This is tied to the current file layout on purpose and is
not a general bundler: new modules, fonts or sounds must be added here explicitly.
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, ASSETS = ROOT / "src", ROOT / "assets"


def data_uri(name):
    return "data:image/png;base64," + base64.b64encode((ASSETS / name).read_bytes()).decode()


MODULES = ["rooms.mjs", "sim.mjs", "art.mjs", "progression.mjs", "dungeon.mjs", "dungeon-view.mjs", "save.mjs", "app.js"]  # dependency order


def main():
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    code = []
    for name in MODULES:
        js = (SRC / name).read_text(encoding="utf-8")
        # Each module runs in its own function scope so private names cannot collide;
        # its exports are returned and become top-level constants for the modules after it.
        assert not re.search(r"^import\s*\{[^}]*\bas\b", js, flags=re.M), f"aliased import in {name}: use the exported name"
        js = re.sub(r"^import\s*\{[^}]*\}\s*from\s*'\./[\w.-]+';\s*$", "", js, flags=re.M)
        assert not re.search(r"^\s*import\b", js, flags=re.M), f"unhandled import in {name}"
        exports = re.findall(r"^export\s+(?:const|let|function|class)\s+([\w$]+)", js, flags=re.M)
        assert len(exports) == len(re.findall(r"^export\b", js, flags=re.M)), f"use one declaration per export in {name}"
        multi = re.search(r'''^export\s+(?:const|let)\s+[\w$]+\s*=\s*(?:[\w$.]+|'[^'\n]*'|"[^"\n]*")\s*,\s*[\w$]+\s*=''', js, flags=re.M)
        assert not multi, f"split '{multi.group(0)}' into one export per line in {name}"
        js = re.sub(r"^export\s+", "", js, flags=re.M)
        names = ",".join(exports)
        head = f"const {{{names}}}=" if exports else ""
        code.append(f"// ---- {name}\n{head}(()=>{{\n{js}\nreturn{{{names}}};}})();")
    js = "\n".join(code)
    # Optional artist sprites in assets/art/ are inlined so the single file uses them too.
    art = {p.stem: data_uri("art/" + p.name) for p in sorted((ASSETS / "art").glob("*.png"))} if (ASSETS / "art").is_dir() else {}
    marker = "/*ART*/{}/*ART*/"
    assert marker in js, "missing ART_URLS marker in app.js"
    js = js.replace(marker, "{" + ",".join(f"{k!r}:{v!r}" for k, v in art.items()) + "}")
    for name in ("world.png", "actors.png"):
        ref = f"'../assets/{name}'"
        assert ref in js, f"missing {ref} in app.js"
        js = js.replace(ref, f"'{data_uri(name)}'")

    link = '<link rel="stylesheet" href="style.css">'
    script = '<script type="module" src="app.js"></script>'
    assert link in html and script in html, "index.html layout changed; update the exporter"
    html = html.replace(link, f"<style>\n{css}</style>")
    html = html.replace(script, f'<script type="module">\n{js}</script>')

    out = ROOT / "simulator.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
