#!/usr/bin/env python3
"""Sprite sheet tools for Eclipse Survival. Rules live in Documentation/ART.md.

  python3 Tools/sprites.py fit   in.png --rows R --cols C [--order a,b,c] [--height 140] --out out.png
  python3 Tools/sprites.py check Assets/Eclipse/Art/Sprites

fit   re-cuts a loosely drawn sheet into the exact cell grid: transparent background, feet on the bottom row,
      feet centred, one shared scale. Use it on anything a generator returns.
check validates finished sheets against the rules and exits with 1 if any fail.
"""
import argparse, os, re, sys
from PIL import Image

CELL = (96, 160)          # human-sized character cell
FACINGS = ["S", "SE", "E", "NE", "N"]   # rows, top to bottom. SW, W and NW are mirrored at runtime.
HEIGHT = 140              # a standing human, in pixels, inside the cell
THRESH = 24               # alpha below this is treated as empty
ACTIONS = {"idle": 2, "walk": 6, "crouchwalk": 4, "swing": 4, "run": 6, "prone": 4, "shoot": 3, "hurt": 2, "death": 6}
MIN_ACTIONS = ("idle", "walk", "crouchwalk", "swing")   # the first slice needs only these


def clean(im):
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < THRESH:
                px[x, y] = (0, 0, 0, 0)
    return im


def feet_x(im, box):
    """Horizontal centre of the lowest 12 opaque rows: where the character really stands."""
    x0, y0, x1, y1 = box
    a = im.getchannel("A").point(lambda v: 255 if v >= THRESH else 0)
    xs = []
    for y in range(max(y0, y1 - 12), y1):
        row = [x for x in range(x0, x1) if a.getpixel((x, y))]
        xs += row
    return (min(xs) + max(xs)) / 2 if xs else (x0 + x1) / 2


def fit(args):
    src = clean(Image.open(args.input))
    cw, ch = src.width // args.cols, src.height // args.rows
    cells = []
    for r in range(args.rows):
        for c in range(args.cols):
            cell = src.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            box = cell.getbbox()
            cells.append((r, c, cell, box))
    heights = sorted(b[3] - b[1] for _, _, _, b in cells if b)
    if not heights:
        sys.exit("No visible pixels found.")
    scale = args.height / heights[len(heights) // 2] if args.height else 1.0
    out = Image.new("RGBA", (CELL[0] * args.cols, CELL[1] * args.rows), (0, 0, 0, 0))
    notes = []
    order = args.order.split(",") if args.order else None
    for r, c, cell, box in cells:
        if not box:
            notes.append(f"row {r} col {c}: empty cell")
            continue
        if scale != 1.0:
            cell = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.LANCZOS)
            cell = clean(cell)
            box = cell.getbbox()
        fx = feet_x(cell, box)
        left = round(CELL[0] / 2 - fx)
        top = CELL[1] - box[3]
        if box[3] - box[1] > CELL[1] or left + box[0] < 0 or left + box[2] > CELL[0]:
            notes.append(f"row {r} col {c}: does not fit in {CELL[0]}x{CELL[1]}")
        tile = Image.new("RGBA", CELL, (0, 0, 0, 0))
        tile.alpha_composite(cell, (left, top))
        dest_row = r
        if order:
            dest_row = FACINGS.index(order[r]) if order[r] in FACINGS else r
        out.alpha_composite(tile, (c * CELL[0], dest_row * CELL[1]))
    out.save(args.out)
    print(f"wrote {args.out} ({out.width}x{out.height}), scale {scale:.3f}")
    for n in notes:
        print("  note:", n)


def check_file(path):
    problems = []
    name = os.path.basename(path)
    m = re.fullmatch(r"([a-z0-9]+)_([a-z]+)\.png", name)
    if not m:
        return [f"{name}: name must look like player_walk.png (lowercase id, action)"]
    action = m.group(2)
    if action not in ACTIONS:
        problems.append(f"{name}: unknown action '{action}' (known: {', '.join(ACTIONS)})")
    im = Image.open(path).convert("RGBA")
    if im.width % CELL[0] or im.height != CELL[1] * len(FACINGS):
        return problems + [f"{name}: size {im.width}x{im.height} must be (n x {CELL[0]}) by {CELL[1] * len(FACINGS)}"]
    cols = im.width // CELL[0]
    if action in ACTIONS and cols != ACTIONS[action]:
        problems.append(f"{name}: has {cols} frames, spec says {ACTIONS[action]}")
    a = im.getchannel("A")
    halo = sum(a.histogram()[1:THRESH])
    if halo:
        problems.append(f"{name}: {halo} faint halo pixels (alpha 1-{THRESH - 1}); run fit to clean them")
    heights = []
    for r, f in enumerate(FACINGS):
        for c in range(cols):
            cell = im.crop((c * CELL[0], r * CELL[1], (c + 1) * CELL[0], (r + 1) * CELL[1]))
            box = cell.getbbox()
            if not box:
                problems.append(f"{name}: facing {f} frame {c} is empty")
                continue
            if CELL[1] - box[3] > 1:
                problems.append(f"{name}: facing {f} frame {c} floats {CELL[1] - box[3]} px above the bottom row")
            if box[0] == 0 or box[2] == CELL[0]:
                problems.append(f"{name}: facing {f} frame {c} touches the side of the cell")
            if action in ("idle", "walk", "run", "swing", "shoot", "hurt", "crouchwalk"):
                heights.append(box[3] - box[1])
    if heights and action == "idle":
        med = sorted(heights)[len(heights) // 2]
        if abs(med - HEIGHT) > HEIGHT * 0.06:
            problems.append(f"{name}: standing height {med} px, spec says {HEIGHT} +/- 6%")
    return problems


def check(args):
    files = []
    for root, _, names in os.walk(args.path):
        files += [os.path.join(root, n) for n in names if n.endswith(".png") and "Characters" in root]
    if not files:
        print("No character sheets found yet.")
        return
    bad = 0
    for f in sorted(files):
        p = check_file(f)
        print(("FAIL " if p else "ok   ") + os.path.relpath(f))
        for line in p:
            print("     " + line)
        bad += bool(p)
    sys.exit(1 if bad else 0)


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
f = sub.add_parser("fit"); f.add_argument("input"); f.add_argument("--rows", type=int, required=True); f.add_argument("--cols", type=int, required=True)
f.add_argument("--order", help="facing of each input row, e.g. S,SE,E,NE,N"); f.add_argument("--height", type=int); f.add_argument("--out", required=True)
c = sub.add_parser("check"); c.add_argument("path")
a = ap.parse_args()
fit(a) if a.cmd == "fit" else check(a)
