# T4. The fuse sounds

A fuse sound is what you hear while your bomb burns. The eight sounds themselves do not change. What changes is how each is shown: as the thing that makes the sound, built like the bombs (`ITEMS_REMODEL.md`): tiny 0.025 m cubes, real raised parts, named motifs, 0.35 to 0.73 m tall and at most 0.7 m wide, so the three kinds of item sit together on the bench and in the book. `reference/models-fuse-sounds.png`.

| Sound | Model | What it is (every part: `ITEMS_REMODEL.md`, section 4) |
|---|---|---|
| Ice chime | `sound_iceChime` | Four tapering icicles under a snowy bar, and a red bead on a cord that taps them |
| 8-bit | `sound_eightBit` | A pocket console whose screen shows a pixel sheep; a D-pad, two red buttons, start and select |
| Wood block | `sound_woodBlock` | A slotted block on felt feet, a red-headed mallet lying across it |
| Cowbell | `sound_cowbell` | A copper bell that widens downward, a brass rim, a clapper, a stitched strap with a buckle |
| Sleigh bells | `sound_sleighBells` | Three round brass bells with slots, on a riveted strap between two posts |
| Music box | `sound_musicBox` | An open red box with a mirror in its lid, a brass comb, and a tiny sheep turning on a turntable |
| Owl | `sound_owl` | A carved owl call with chevron feathers, facial discs and amber eyes on a snowy perch. A carving, not a new animal |
| Lullaby | `sound_lullaby` | A sleeping crescent moon in a red nightcap and a five-point star, hanging from a cradle hook; the moon glows |

**Listen.** Wherever a fuse sound is shown (the bench, the Bell Shelf, a mission slip, the Barn Book, the close view), a small Listen tile with the speaker icon plays 2 seconds of it. Its model moves while it plays: the bead taps, the pixels blink, the mallet lifts, the bells shake, the box's figure turns, the owl's eyes blink, the sheep turns, the moon rocks. Only one sound plays at a time, and it respects the mute setting.

Scenery colours only (LADDER and the named glows); each model uses at most six materials.
