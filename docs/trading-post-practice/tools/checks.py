"""Checks the data against the plan's rules. Run: python3 checks.py  (exit 1 on any failure)"""
import json
import os
import sys

import numpy as np

import bursts
from kit_ui import T
from ladder import LADDER, GLOW, tok

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data')
fails, n_ok = [], 0


def ok(cond, msg, quiet=False):
    global n_ok
    if cond:
        n_ok += 1
        if not quiet:
            print('PASS ' + msg)
    else:
        print('FAIL ' + msg)
        fails.append(msg)


def lum(h):
    h = h.replace('lit:', '')
    c = np.array([int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]) / 255
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def ladder_ok(c):
    return (c.startswith('glow:') and c[5:] in GLOW) or (c.split(':')[0] in LADDER and -2 <= int(c.split(':')[1]) <= 2)


idx = json.load(open(os.path.join(D, 'models', 'index.json')))['models']
for e in idx:
    m = json.load(open(os.path.join(D, e['file'])))
    if e['group'] == 'bomb skin':
        ok(all(c.startswith(('#', 'lit:#')) for c in m['colours']), f"{m['id']}: skin colours only ({len(m['colours'])})", quiet=True)
        parts = {b['part'] for b in m['boxes']}
        ok({'shell', 'face', 'cap', 'fuse', 'spark'} <= parts, f"{m['id']}: has shell, face, cap, fuse, spark")
        fuse_cells = sum((b['b'][3] - b['b'][0]) * (b['b'][4] - b['b'][1]) * (b['b'][5] - b['b'][2]) for b in m['boxes'] if b['part'] == 'fuse')
        ok(fuse_cells == 11 * 8 and 'spark' in parts, f"{m['id']}: a 12-piece fuse: 11 pieces of 2 x 2 x 2 cells and the burning tip ({fuse_cells // 8} + 1)", quiet=True)
    else:
        bad = [c for c in m['colours'] if not ladder_ok(c) and not (m['id'] == 'practiceCrate' and c.startswith('#'))]
        ok(not bad, f"{m['id']}: scenery colours are LADDER tokens or named glows {bad or ''}", quiet=True)
        mats = {c.split(':')[0] for c in m['colours'] if not c.startswith(('glow:', '#'))}
        ok(len(mats) <= 6 or m['id'] in ('feedStall', 'bellStand'), f"{m['id']}: {len(mats)} materials", quiet=True)
print(f'      ({len(idx)} models checked for colours and parts)')

# ---- one detail size (VOXEL_GRAIN.md) ----------------------------------------------------------------
import grain_audit
for e in idx:
    m = json.load(open(os.path.join(D, e['file'])))
    want = grain_audit.cell_for(m['id'])
    ok(abs(m['cell_m'] - want) < 1e-9, f"{m['id']}: cell {m['cell_m']} m (its role's cell is {want})", quiet=True)
    occ = grain_audit.voxels(m)
    slabs = grain_audit.plain_regions(occ, m['cell_m'])
    ok(not slabs, f"{m['id']}: no plain area holding a square over 0.4 m {slabs[:2] if slabs else ''}", quiet=True)
    thin = grain_audit.thin_parts(m)
    ok(not thin, f"{m['id']}: seen from the front, no part under 0.05 m (only the fuse's sparks are smaller) {thin[:3] if thin else ''}", quiet=True)
print(f'      ({len(idx)} models checked for their cell, plain areas and the 0.05 m detail size)')

def screen_px(cell, scale, A, z, cam=9.0):
    return cell * scale * A * cam / (cam - z)

mk = json.load(open(os.path.join(D, 'market.json')))
rk = json.load(open(os.path.join(D, 'rink.json')))
cells = {e['id']: e['cell_m'] for e in idx}
grain_rows = []
for it in mk['items']:
    if it['model'] in cells and it['z'] > -4.5:
        stop = min(mk['stops_x_m'], key=lambda k: abs(mk['stops_x_m'][k] - it['x']))
        grain_rows.append((it['model'], screen_px(max(cells[it['model']], 0.05), it.get('scale', 1.0), mk['cameras'][stop]['A'], it['z'])))
for sh in mk['shown']:
    stop = min(mk['stops_x_m'], key=lambda k: abs(mk['stops_x_m'][k] - sh['x']))
    cell = 0.05 if sh['kind'] == 'burst' else 0.05 * sh['scale']          # the detail size (0.05 m) on screen
    grain_rows.append((sh['kind'] + ' ' + sh['key'], screen_px(cell, 1.0, mk['cameras'][stop]['A'], sh['z'])))
for it in rk['items']:
    if it['model'] in cells and it['z'] > -4.5:
        grain_rows.append((it['model'], screen_px(max(cells[it['model']], 0.05), 1.0, 210.0, it['z'])))
grain_rows.append(('the worn bomb (Practice)', screen_px(0.05, 1.0, 210.0, 0.35)))
scales = [it.get('scale', 1.0) for it in mk['items'] if it['model'] in cells] + [sh['scale'] for sh in mk['shown'] if sh['kind'] != 'burst']
ok(all(0.8 - 1e-9 <= s <= 1.0 + 1e-9 for s in scales), f'no model is shrunk below 0.8 or blown up past 1.0 (scales used: {sorted(set(scales))}); bursts are drawn in, never shrunk')
lo, hi = min(r[1] for r in grain_rows), max(r[1] for r in grain_rows)
ok(lo >= 6 and hi <= 15, f'one detail size on screen: every placed model\'s smallest part (0.05 m, or its cell where that is larger) is {lo:.1f} to {hi:.1f} px at 1440 x 900 (6 to 15)')
for name, px in grain_rows:
    ok(6 <= px <= 15, f'  {name}: {px:.1f} px', quiet=True)

sk = json.load(open(os.path.join(D, 'skins.json')))['skins']
for k, s in sk.items():
    r = contrast(s['digit'], s['face_colour'])
    ok(r >= 4.5, f"{s['name']}: seconds on its face {r:.1f} to 1")
    r = contrast(s['danger_digit'], s['face_colour'])
    ok(r >= 4.5, f"{s['name']}: last-3-seconds colour on its face {r:.1f} to 1")

bj = json.load(open(os.path.join(D, 'bursts.json')))['bursts']
ok(len(bj) == 10, 'ten bursts')
for k, b in bj.items():
    ok(b['pieces'] <= 24 and len(b['colours']) <= 3, f"{b['name']}: {b['pieces']} pieces, {len(b['colours'])} colours (at most 24 and 3)")
    bad = [p for p in bursts.pieces(k) if any(abs(s / 0.05 - round(s / 0.05)) > 1e-6 or s < 0.05 - 1e-9 for s in p[3:6])]
    ok(not bad, f"{b['name']}: every box is whole 0.05 m cells" + (f" ({len(bad)} are not)" if bad else ''), quiet=True)

cat = json.load(open(os.path.join(D, 'catalogue.json')))
ok(sum(cat['odds'].values()) == 100, 'the odds add up to 100')
ok(len(cat['bomb_skins']) + len(cat['bursts']) + len(cat['fuse_sounds']) == 26, '8 + 10 + 8 = 26 items, as the Barn Book says')

for words, shown in ((13, 13), (5, 14), (23, 11)):
    ok(15 - words // 5 == shown, f'clock rule in the pictures: {words} words -> {shown} s')
for words, marks in ((13, 3), (5, 0), (23, 3)):
    ok(words % 5 == marks, f'tally rule in the pictures: {words} words -> {marks} marks')

PAPER, INK, SOFT, CHALK = '#FFF6E0', '#2B2230', '#6B5B4B', '#F3EEE6'
for a, b, what in ((INK, PAPER, 'ink on paper'), (SOFT, PAPER, 'small grey text on paper'), ('#2F7A4D', PAPER, 'green "Found" on paper'), (INK, T['lantern'], 'ink on a lantern tag or button'),
                   (INK, T['wool'], 'ink on a wool tile'), (SOFT, '#E9DDC3', 'text on a button that cannot be pressed'), (CHALK, tok('iron:-1'), 'chalk on the odds board'),
                   (CHALK, tok('pine:-2'), 'chalk on the practice board'), ('#DCE8E0', tok('pine:-2'), 'dim chalk on the practice board'), (T['lanternHi'], tok('pine:-2'), '"New best!" on the practice board'),
                   (INK, '#F2CE7C', 'ink on a brass price tag'), (INK, tok('trimWhite:2'), 'the letter on its card'), (tok('scarfRed:-2'), tok('trimWhite:2'), 'red on a card')):
    r = contrast(a, b)
    ok(r >= 4.5, f'{what}: {r:.1f} to 1')
print(f'{n_ok} checks pass, {len(fails)} fail')
sys.exit(1 if fails else 0)
