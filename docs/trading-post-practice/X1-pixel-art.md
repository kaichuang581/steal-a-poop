# X1. Pixel art

Every icon in the Trading Post and Practice. Draw with crisp edges (fill rectangles, or `image-rendering: pixelated`) at 2 px per art pixel unless a file says otherwise. `.` is empty. Also in `data/pixel-art.json`.

## `return-key`
The Pass tile. Colours: `X` = ink.
```
......XX
......XX
......XX
..X...XX
.XX...XX
XXXXXXXX
.XX.....
..X.....
```

## `book`
Practice, top right: how Practice works. Also the Barn Book tab. Colours: `X` = ink, `o` = #8A7F78.
```
XXXX..XXXX
XooXX.XooX
XXXXX.XXXX
XooXX.XooX
XXXXX.XXXX
XooXX.XooX
XXXXX.XXXX
.XXXXXXXX.
```

## `list`
Practice, top right: the word log. Colours: `X` = ink.
```
XX.XXXXXXX
XX.XXXXXXX
..........
XX.XXXXXXX
XX.XXXXXXX
..........
XX.XXXXXXX
XX.XXXXXXX
```

## `speaker`
Sound; and Listen on a fuse sound. Colours: `X` = ink.
```
....X.....
...XX..X..
XXXXX...X.
XXXXX.X.X.
XXXXX.X.X.
XXXXX...X.
...XX..X..
....X.....
```

## `cross`
Close; leave. Colours: `X` = ink.
```
XX....XX
XXX..XXX
.XXXXXX.
..XXXX..
..XXXX..
.XXXXXX.
XXX..XXX
XX....XX
```

## `easy`
Easy bot: a sprout (plate, bib, Home card). Colours: `X` = giftGreen -1.
```
XX...XX
XXX.XXX
.XX.XX.
...X...
...X...
...X...
..XXX..
```

## `medium`
Medium bot: a sapling. Colours: `X` = coopYellow -2.
```
..XXX..
.XXXXX.
XXXXXXX
.XXXXX.
...X...
...X...
..XXX..
```

## `hard`
Hard bot: a full pine. Colours: `X` = scarfRed -2.
```
...X...
..XXX..
.XXXXX.
..XXX..
.XXXXX.
XXXXXXX
...X...
```

## `rosette`
New best: pinned to the chalkboard. Colours: `X` = lantern, `o` = lanternHi, `r` = scarfRed 0, `k` = ink.
```
..XXXXXX..
.XooooooX.
XooXXXXooX
XoXooooXoX
XoXooooXoX
XooXXXXooX
.XooooooX.
..XXXXXX..
..rr..rr..
..rr..rr..
.rr....rr.
```

## `moon-small`
The report's tag about tonight's dream. Colours: `X` = #C98A1E.
```
..XXX...
.XXX....
XXX.....
XXX.....
XXX.....
XXXX...X
.XXXXXX.
..XXXX..
```

## `sack`
Tab: Feed Sacks. Colours: `X` = ink.
```
..XXXX..
...XX...
..XXXX..
.XXXXXX.
XXXXXXXX
XXXXXXXX
XXXXXXXX
.XXXXXX.
```

## `bell`
Golden Bells (wallet, prices, tab). Colours: `X` = #E0A93A, `o` = #F7DE95, `k` = #8A5F16.
```
....kk....
...XXXX...
..XoXXXX..
..XoXXXX..
..XXXXXX..
.XXXXXXXX.
kkkkkkkkkk
....kk....
```

## `pin`
Tab: Missions (a pinned slip). Colours: `X` = ink.
```
XXXXXXXX
X......X
X.XXXX.X
X......X
X.XXXX.X
X......X
X.XX...X
XXXXXXXX
```

## `coin`
Wool Coins (wallet, prices). Colours: `X` = #E0A93A, `o` = #F7DE95, `k` = #8A5F16.
```
..XXXXXX..
.XooooooX.
XooXXXXooX
XoXooooXoX
XoXoXXoXoX
XoXoXooXoX
XoXooXXooX
XooXooooXk
.XooXXXXk.
..kkkkkk..
```

## `yarn`
The level strip: the ball the knitted row grows from. Colours: `X` = scarfRed 0, `o` = scarfRed +2, `k` = scarfRed -2.
```
..XXXXXX..
.XXoXXXXX.
XXoXXXoXXX
XoXXXoXXXX
XXXXoXXXoX
XXXoXXXoXX
XXoXXXoXXk
XoXXXoXXXk
.XXXXXXXk.
..kkkkkk..
```

## `lock`
Not found yet. Colours: `X` = #6B5B4B.
```
..XXXX..
.X....X.
.X....X.
XXXXXXXX
XXXXXXXX
XXX..XXX
XXX..XXX
XXXXXXXX
```

## `tick`
Found; done. Colours: `X` = #4E9A6A.
```
.......X
......XX
X....XX.
XX..XX..
.XXXX...
..XX....
```

## `note`
Fuse sound. Colours: `X` = ink.
```
...XXXXX
...X...X
...X...X
...X...X
.XXX.XXX
XXXX.XXX
.XX...X.
```

## `play`
Try a burst; listen to a fuse sound. Colours: `X` = ink.
```
X.....
XXX...
XXXXX.
XXXXXX
XXXXXX
XXXXX.
XXX...
X.....
```

The three sack stencils are voxels on the models, not icons: they are in `data/market.json` (`sacks.*.emblem`). The bombs carry no mark (`T2`, `ITEMS_REMODEL.md`).
