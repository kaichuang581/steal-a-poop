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
        ok({'shell', 'face', 'emblem', 'cap', 'fuse', 'spark'} <= parts, f"{m['id']}: has shell, face, emblem, cap, fuse, spark")
        ok(len({(b['b'][0], b['b'][1]) for b in m['boxes'] if b['part'] == 'fuse'}) >= 12, f"{m['id']}: a 12-piece fuse", quiet=True)
    else:
        bad = [c for c in m['colours'] if not ladder_ok(c) and not (m['id'] == 'practiceCrate' and c.startswith('#'))]
        ok(not bad, f"{m['id']}: scenery colours are LADDER tokens or named glows {bad or ''}", quiet=True)
        mats = {c.split(':')[0] for c in m['colours'] if not c.startswith(('glow:', '#'))}
        ok(len(mats) <= 6 or m['id'] in ('feedStall', 'bellStand'), f"{m['id']}: {len(mats)} materials", quiet=True)
print(f'      ({len(idx)} models checked for colours and parts)')

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
