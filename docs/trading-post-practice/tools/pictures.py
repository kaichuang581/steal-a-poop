"""Draws Practice's reference pictures from the data. Run: python3 pictures.py"""
import os

from PIL import Image, ImageDraw

import bursts
import scene
import ui
from kit_ui import F, FR, NU8, T
from ladder import tok
from scene import MODELS, camera, shot, SHEEP_X

REF = os.path.join(scene.ROOT, 'reference')
BUILD = os.path.join(REF, 'build-today')
WORDS = ['tundra', 'acorn', 'nutmeg', 'gravy', 'yonder', 'raft', 'tinsel', 'lantern', 'nest', 'tallow', 'wool', 'larder', 'rivet', 'tavern', 'nectar', 'raven',
         'needle', 'elder', 'rook', 'kettle', 'easel', 'leek', 'kernel']


def dress(img, cam, letter='T', count=13, clock=13, best=21, secs=11, danger=False, bubble='velvet', typed='IN', wrong=False, flash=False, out=False,
          bomb_at=-0.62, phone=False, say=None, your_turn=True):
    ui.board(img, cam, count, letter, clock, best=best, flash=flash, out=out)
    if bomb_at is not None and secs is not None:
        ui.face(img, cam, bomb_at, 0.35, secs, danger)
    if phone and bubble:
        ui.plate(img, cam, -SHEEP_X, 'Brian', you=True)
        ui.bubble(img, cam, SHEEP_X, bubble, phone=True)
    else:
        ui.plate(img, cam, -SHEEP_X, 'Brian', you=True)
        ui.plate(img, cam, SHEEP_X, 'Bram', level='easy')
        if bubble:
            ui.bubble(img, cam, SHEEP_X, bubble)
    ui.buttons(img, phone)
    if say:
        ui.coach(img, cam, *say, phone=phone)
    if phone:
        ui.rack_phone(img, letter, typed, wrong)
    else:
        ui.rack(img, cam, letter, typed, wrong, your_turn)


def pc_run(path):
    cam = camera()
    img, n = shot(cam)
    dress(img, cam, say=('Best 21. Beat it!', None))
    img.save(path)
    return img, n


def pc_danger(path):
    cam = camera()
    img, n = shot(cam, bomb='bomb_ice_low')
    dress(img, cam, secs=2, danger=True, typed='UNDRA', wrong=True, say=('Already played!', 'You played tundra this run. Another T word.'))
    img.save(path)


def pc_speedup(path):
    cam = camera()
    puff = lambda sc: [sc.box(-1.62 + i * 0.1, 2.08 + i * 0.07, -3.1, -1.56 + i * 0.1, 2.14 + i * 0.07, -3.04, tok('snow:2'), False, 1.0) for i in range(3)]
    img, n = shot(cam, holder='bot', extra=puff)
    dress(img, cam, count=5, clock=14, flash=True, bubble=None, typed='', bomb_at=0.62, secs=14, say=('Faster! 14 s a turn', 'Every 5 words, a second comes off.'), your_turn=False)
    img.save(path)


def pc_burst(path):
    cam = camera()
    img, n = shot(cam, holder=None, bomb=None, frozen='player', extra=lambda sc: bursts.place(sc, 'snowfall', -0.62, 0.0, 0.35))
    dress(img, cam, secs=None, out=True, bubble=None, typed='', count=13, bomb_at=None, your_turn=False)
    img.save(path)


def results(path, phone=False):
    W, H = (1440, 900) if not phone else (390, 844)
    cam = camera(W=W, H=H, A=420.0, EYE=4.8, lane=1.754) if not phone else camera(W=W, H=H, A=225.0, EYE=4.8, lane=1.089)   # the camera cranes up to the board
    img, n = shot(cam, holder=None, bomb=None, frozen='player', board_skip=('card',))
    x0, y0, x1, y1 = ui.report(img, cam, 23, 21, True, 15, 11, 'easy', 23)
    d = ImageDraw.Draw(img)
    if not phone:
        f = F(NU8, 13)
        d.text((W / 2 - d.textlength('Your words', font=f) / 2, y1 + 44), 'Your words', font=f, fill=T['woolHi'])
        ui.slips(img, x0 - 40, x1 + 40, y1 + 68, WORDS, rows=2)
        ui.end_buttons(img, W / 2, y1 + 150, 320)
    else:
        f = F(NU8, 13)
        d.text((W / 2 - d.textlength('Your words', font=f) / 2, y1 + 40), 'Your words', font=f, fill=T['woolHi'])
        ui.slips(img, 14, W - 14, y1 + 64, WORDS, rows=4)
        ui.end_buttons(img, W / 2, H - 196, W - 28)
    ui.buttons(img, phone)
    img.save(path)
    return img


def phone_cam():
    return camera(W=390, H=844, A=82.0, CAM=9.0, EYE=2.7, lane=0.70)


def phone_run(path):
    cam = phone_cam()
    img, n = shot(cam)
    dress(img, cam, phone=True, say=('Best 21. Beat it!', None))
    img.save(path)


def before_after(path, new):
    old = Image.open(os.path.join(BUILD, 'pc-run.jpg')).convert('RGB').resize((720, 450), Image.LANCZOS)
    out = Image.new('RGB', (1460, 500), '#F3EBDD')
    out.paste(old, (10, 40)); out.paste(new.resize((720, 450), Image.LANCZOS), (730, 40))
    d = ImageDraw.Draw(out)
    d.text((14, 10), 'Today: a snow slab floating in the dark, the letter three times, the count in a corner box', font=F(NU8, 15), fill='#6B5B4B')
    d.text((734, 10), 'This plan: the swept farm pond, a chalkboard, a coach, your word as tiles on the boards', font=F(NU8, 15), fill='#2B2230')
    out.save(path)


if __name__ == '__main__':
    os.makedirs(REF, exist_ok=True)
    img, n = pc_run(os.path.join(REF, 'practice-run-computer.png'))
    print('boxes', n)
    pc_danger(os.path.join(REF, 'practice-danger-and-a-wrong-word.png'))
    pc_speedup(os.path.join(REF, 'practice-speed-up.png'))
    pc_burst(os.path.join(REF, 'practice-the-bomb-goes-off.png'))
    results(os.path.join(REF, 'practice-results-computer.png'))
    results(os.path.join(REF, 'practice-results-phone.png'), phone=True)
    phone_run(os.path.join(REF, 'practice-run-phone.png'))
    before_after(os.path.join(REF, 'practice-before-and-after.png'), img)
