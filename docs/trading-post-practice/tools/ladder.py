"""The game's colour table (LADDER, from PLAN_DEPTH_AND_LIGHT.md section 3.2 and 8.4) and the few
extra colours this plan names. A token is "material:step", step -2..+2. tok('barnRed:-1') -> '#AD4D3A'."""

LADDER = {
    'snow':       ['#D8D2C9', '#E3DDD5', '#EEE9E1', '#F3EEE6', '#F3EEE7'],
    'barnRed':    ['#A3412D', '#AD4D3A', '#B75946', '#C06653', '#CA725F'],
    'trimWhite':  ['#CEC0AC', '#D9CCB8', '#E4D7C4', '#EFE3D0', '#F9EDDA'],
    'slate':      ['#715961', '#7B636B', '#856D75', '#8E7780', '#99828A'],
    'wood':       ['#885A33', '#926540', '#9B704C', '#A57B58', '#AF8564'],
    'darkWood':   ['#5B3923', '#65432E', '#6E4D38', '#775743', '#81614E'],
    'roofBrown':  ['#714B38', '#7A5542', '#84604D', '#8D6A58', '#977563'],
    'stone':      ['#867B71', '#90867C', '#9A9087', '#A59B92', '#AFA69D'],
    'hay':        ['#CAA153', '#D4AC62', '#DEB870', '#E8C37F', '#F3CF8E'],
    'straw':      ['#D0B476', '#DBBF84', '#E5CB91', '#F0D69F', '#FBE2AD'],
    'pine':       ['#306A56', '#3D7460', '#497E6A', '#568875', '#62927F'],
    'spruce':     ['#4C7466', '#577E70', '#63887A', '#6F9285', '#7A9D90'],
    'fir':        ['#30684C', '#3D7257', '#487C61', '#55866C', '#619076'],
    'houseCream': ['#C2AA88', '#CDB594', '#D8C0A1', '#E2CCAD', '#EDD7BA'],
    'tractorRed': ['#A73F30', '#B14C3C', '#BB5949', '#C46555', '#CE7161'],
    'iron':       ['#382E2A', '#413633', '#4A403C', '#544945', '#5D534F'],
    'brass':      ['#DBA342', '#E5AE54', '#EFBA64', '#F9C675', '#FFD38F'],
    'coopYellow': ['#C8A15E', '#D2AC6C', '#DCB87A', '#E7C388', '#F1CF96'],
    'glass':      ['#2B3D4A', '#354653', '#3E505C', '#485965', '#53636F'],
    'ice':        ['#98C3CE', '#A4CED9', '#B0D9E4', '#BDE4EE', '#CAF0F9'],
    'reed':       ['#656B3E', '#6F754A', '#797F55', '#838961', '#8E946D'],
    'scarfRed':   ['#AC473D', '#B65349', '#BF6055', '#C96C61', '#D3786D'],
    'carrot':     ['#CC7228', '#D57E3B', '#DF8A4B', '#E9965B', '#F2A26A'],
    'wool':       ['#D8CEBE', '#E3D9CA', '#EEE5D6', '#F6EDDF', '#F6EDE0'],
    'faceDark':   ['#3B2C2A', '#433533', '#4D3F3C', '#564846', '#5F524F'],
    'pink':       ['#D49A95', '#DEA6A0', '#E8B1AC', '#F3BDB8', '#FDC9C4'],
    'giftGreen':  ['#2A7656', '#398060', '#478A6B', '#549476', '#619E81'],
    'ink':        ['#2D2020', '#2E2221', '#362A2A', '#3F3333', '#483C3C'],
}

# Things that give light. These are drawn unlit (their own colour), as the game's bulbs and lit glass are.
GLOW = {
    'bulbRed':  '#F07A5A',   # the season's three bulb colours (PLAN_DEPTH_AND_LIGHT 3.3)
    'bulbSage': '#9CCB78',
    'bulbGold': '#FFD08A',
    'lit':      '#FFD38F',   # lit glass: brass +2, as the lamp posts use
    'flame':    '#FFE7B0',
    'ember':    '#F2A26A',   # carrot +2
    'moon':     '#FFE9A8',
    'moonDim':  '#F2D58E',
    'aurora1':  '#7BC48E',   # --pasture-hi
    'aurora2':  '#6FB7B0',
    'aurora3':  '#8C8FD8',
}

def tok(t):
    if t.startswith('#'):
        return t
    if t.startswith('glow:'):
        return GLOW[t[5:]]
    if t.startswith('lit:'):           # a skin's own colour that gives light (bomb skins only)
        return t[4:]
    mat, _, step = t.partition(':')
    return LADDER[mat][int(step or 0) + 2]

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
