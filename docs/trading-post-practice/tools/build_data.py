"""Writes data/: every model as boxes, the skins, the bursts, both scenes' placements, the timings. Run: python3 build_data.py"""
import json
import os
import shutil

import bursts
import market
import scene
import skins
import sounds

ROOT = scene.ROOT
D = os.path.join(ROOT, 'data')
TP = ['feedStall', 'sampleBench', 'oddsBoard', 'barrel', 'stallLantern', 'bigBell', 'bellStand', 'noticeBoard', 'barnBook8', 'barnBook10', 'rowPost',
      'sack_oat', 'sack_corn', 'sack_barley', 'sackCrate_straw', 'sackCrate_brass', 'sackCrate_wood']
PR = ['rinkBoards', 'rinkBoardsFront', 'snowBank', 'broom', 'tallyBoard', 'coachChair', 'tileRack', 'iceBlock', 'practiceCrate', 'whistle', 'bibEasy', 'bibMedium', 'bibHard', 'lightPost']

TIMINGS = {
    'about': 'Every time in the Trading Post and in Practice, in milliseconds. Reduced motion: values change at once; nothing slides, hops, shakes or flies.',
    'trading_post': {
        'enter': {'fade_from_home_ms': 200, 'camera_settle_ms': 0},
        'walk_between_stops': {'next_door_ms': 500, 'further_ms': 700, 'ease': 'cubic-bezier(.3, 0, .2, 1)', 'tag_swing_deg': 6, 'tag_swing_ms': 400},
        'pick_a_sack': {'slide_forward_m': 0.12, 'slide_ms': 200, 'bench_items_drop_in_ms': 240, 'stagger_ms': 40, 'drop_from_m': 0.25},
        'open_a_sack': {'hop_to_centre_ms': 250, 'shake_1_ms': [250, 430], 'shake_2_ms': [470, 650], 'shake_m': 0.035, 'light_from_ms': 250, 'bow_unties_ms': [650, 850],
                        'item_rises_ms': [850, 1250], 'item_turns_deg': 360, 'lands_ms': 1600, 'skip': 'any tap or key jumps to the landed state', 'duplicate': 'the item fades to coins that drop into the wallet chip over 400 ms, then "+{refund}"'},
        'buy_with_bells': {'big_bell_swings_deg': 14, 'swings': 2, 'ms': 700, 'item_hops_m': 0.15, 'hop_ms': 250},
        'wear': {'tag_flips_ms': 200},
        'try_a_burst': {'plays_ms': 1400, 'again_after_ms': 300},
        'barn_book': {'page_turn_ms': 350, 'pop_up_ms': 220, 'stagger_ms': 30},
        'mission_done': {'stamp_ms': 180, 'slip_wiggles_deg': 3},
    },
    'bomb': {'fuse_pieces': 12, 'danger_from_s': 3, 'wobble_deg': 1.5, 'wobble_hz': 4, 'spark_scale_in_danger': 1.6, 'tick_every_ms': 500},
    'burst': {'flash_ms_max': 80, 'out_ms': 300, 'hold_ms': 0, 'fall_and_fade_ms': 1100, 'total_ms': 1400, 'shake_px': 6, 'shake_ms': 220,
              'per_burst_hold_ms': {'frost': 300, 'starlight': 250, 'lantern': 0}, 'never': 'smoke, a cloud, a blocky puff, a crater, a mark left on the ground'},
    'practice': {
        'countdown': {'card_flip_ms': 200, 'cards': ['3', '2', '1', '<letter>'], 'step_ms': 600},
        'pass': {'hop_ms': 420, 'hop_peak_m': 0.9, 'land_squash': [1.12, 0.88], 'land_squash_ms': 120, 'ice_chips': 6, 'ice_chip_life_ms': 380},
        'count': {'chalk_number_redraw_ms': 160, 'tally_mark_draw_ms': 180},
        'wrong_word': {'tiles_shake_px': [6, -6, 4, -4, 2, 0], 'shake_ms': 300, 'tiles_ember_ms': 600, 'coach_bubble_ms': 2400},
        'speed_up': {'whistle_raise_ms': 150, 'whistle_hold_ms': 300, 'puff_cubes': 3, 'puff_ms': 500, 'clock_card_flip_ms': 200, 'clock_card_red_ms': 1200, 'tally_wipe_ms': 250, 'coach_bubble_ms': 2400},
        'frozen': {'ice_grows_ms': 260, 'from': 'the ice at its hooves, upward'},
        'report': {'starts_after_burst_ms': 1100, 'camera_crane_ms': 700, 'cards_lift_ms': 200, 'chalk_writes_ms': 600, 'slips_pin_in_ms': 30, 'buttons_after_ms': 400},
        'bubble': {'show_ms_after_turn_passes': 1200, 'fade_ms': 200},
    },
}

CATALOGUE = {
    'about': 'The 26 items, as today. Names, rarities, prices and where each comes from are read from the code; nothing here changes them. '
             'Which burst is the starter and which seven are in the Corn Sack is as the catalogue has it (the pictures show seven of them).',
    'bomb_skins': [{'id': k, 'name': skins.SKINS[k]['name'], 'from': skins.SKINS[k]['source'], 'model': 'models/bomb_%s.json' % k} for k in skins.ORDER],
    'bursts': [{'id': k, 'name': bursts.BURSTS[k]['name'], 'pieces_file': 'bursts.json'} for k in bursts.ORDER],
    'fuse_sounds': [{'id': k, 'name': sounds.SOUNDS[k][0], 'model': 'models/sound_%s.json' % k} for k in sounds.ORDER],
    'odds': {'common': 62, 'uncommon': 28, 'rare': 8, 'legendary': 2}, 'pity': {'rare_or_better_within': 10, 'legendary_within': 40}, 'sack_price_wool_coins': 250,
}


def layout_json(L):
    return {'items': [{k: v for k, v in it.items() if k != 'kw'} | {k: v for k, v in it['kw'].items() if v is not None} for it in L.items], 'raw_boxes': L.raw, 'shown': L.shown}


def main():
    md = os.path.join(D, 'models')
    shutil.rmtree(md, ignore_errors=True)
    os.makedirs(md)
    idx = []
    def save(m, group):
        m.save(md)
        j = m.to_json()
        idx.append({'id': m.id, 'file': 'models/%s.json' % m.id, 'group': group, 'what': m.what, 'cell_m': m.cell, 'size_m': j['size_m'], 'boxes': j['box_count']})
    sk = {}
    for k in skins.ORDER:
        m = skins.bomb(k)
        save(m, 'bomb skin')
        sk[k] = m.meta
    for m in sounds.all_models():
        save(m, 'fuse sound')
    for mid in TP:
        save(market.MODELS[mid], 'trading post')
    for mid in PR:
        save(scene.MODELS[mid], 'practice')
    json.dump({'about': "Every new model. Home's own barn, silo, farmhouse, fence and pines are placed as they are and are not copied here.", 'models': idx},
              open(os.path.join(md, 'index.json'), 'w'), indent=1)
    json.dump({'about': 'The eight bomb skins: where the face is, the colour of its seconds, the fuse and spark colours. '
                        'Cells are 0.025 m; every part is at least 2 cells (0.05 m), as VOXEL_GRAIN.md says. "lit:" colours give light. '
                        'The fuse is 12 pieces of 2 x 2 x 2 cells; with a share s of the turn left, show ceil(12 x s) of them.', 'fuse_pieces_cells': skins.FUSE, 'skins': sk}, open(os.path.join(D, 'skins.json'), 'w'), indent=1)
    bj = {}
    for k in bursts.ORDER:
        b = bursts.BURSTS[k]
        bj[k] = {'name': b['name'], 'colours': {c: bursts.C[c] for c in b['colours']}, 'pieces': b['pieces'], 'move': b['move'], 'sound': b['sound'],
                 'boxes_at_fullest': [[round(v, 3) for v in p[:6]] + [p[6], bool(p[7] or p[6] in bursts.LIT)] for p in bursts.pieces(k)]}
    json.dump({'about': 'The ten bursts at their fullest (300 ms). Each box: x, y, z of its lower-left-back corner in metres from the bomb\'s spot on the ground, '
                        'then width, height, depth, colour key, gives light. One piece cube is %.2f m, the detail size of VOXEL_GRAIN.md. In the Trading Post a burst stands over its stand '
                        'with its positions drawn in to 42%% toward its middle (0.6 m up) and its pieces at full size.' % bursts.P,
               'all_colours': bursts.C, 'bursts': bj}, open(os.path.join(D, 'bursts.json'), 'w'), indent=1)
    L = market.market('oat')
    mj = {'about': 'The market row, in metres. x along the row, y up, z toward the camera; the snow is y 0. Shown: what stands on the bench, the shelf and in the book in the pictures.',
          'stops_x_m': market.STOP_X, 'cameras': market.CAM, 'camera_distance_m': 9.0, 'eye_height_m': 1.9, 'light': market.LIGHT, 'sky': market.SKY,
          'fog': dict(zip(('start_m', 'end_m', 'most'), market.FOG)), 'tint_at_z': {'z': [-60, -20, -6, -1.6, -0.8, 0, 3], 'tint': [0.50, 0.56, 0.66, 0.74, 0.90, 1.0, 1.0]},
          'sacks': {k: {kk: vv for kk, vv in v.items()} for k, v in market.SACKS.items()}, 'inside_in_the_pictures': market.INSIDE,
          'book_pockets_cells': {'8': market.book_pockets(8)[0], '10': market.book_pockets(10)[0]}, **layout_json(L)}
    json.dump(mj, open(os.path.join(D, 'market.json'), 'w'), indent=1)
    scene.save_data()
    json.dump(TIMINGS, open(os.path.join(D, 'timings.json'), 'w'), indent=1)
    json.dump(CATALOGUE, open(os.path.join(D, 'catalogue.json'), 'w'), indent=1)
    print(len(idx), 'models')


if __name__ == '__main__':
    main()
