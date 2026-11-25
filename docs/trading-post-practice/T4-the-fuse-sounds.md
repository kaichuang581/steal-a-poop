# T4. The fuse sounds

A fuse sound is what you hear while your bomb burns. The eight sounds themselves do not change. What changes is how each is shown: as the thing that makes the sound, built at the same scale as the bombs (0.025 m cells, 0.25 to 0.55 m tall) so the three kinds of item sit together on the bench and in the book. `reference/models-fuse-sounds.png`.

| Sound | Model | What it is |
|---|---|---|
| Ice chime | `sound_iceChime` | A small frame with four icicles hanging from threads (10, 7, 12 and 8 cells long) and a red bead that taps them. Snow on the top bar |
| 8-bit | `sound_eightBit` | A pocket game standing on a foot: a dark screen with six lit pixels, a plus-shaped pad, two red buttons |
| Wood block | `sound_woodBlock` | A hollow block with its slot, and a red-headed mallet resting on top |
| Cowbell | `sound_cowbell` | A copper bell that widens downward, a brass rim, a clapper showing under it, a leather strap with a buckle |
| Sleigh bells | `sound_sleighBells` | Five round brass bells with slits, on an arched leather strap |
| Music box | `sound_musicBox` | An open red box: a lined lid, a brass comb and drum, a crank with a red knob, and a tiny wool figure that turns |
| Owl | `sound_owl` | A carved wooden owl call on a snowy perch: tufts, round eyes, a small beak, rows of chest feathers. It is a carving, not a new animal |
| Lullaby | `sound_lullaby` | A crescent moon and a small star hanging from a cradle hook; the moon glows |

**Listen.** Wherever a fuse sound is shown (the bench, the Bell Shelf, a mission slip, the Barn Book, the close view), a small Listen tile with the speaker icon plays 2 seconds of it. Its model moves while it plays: the bead taps, the pixels blink, the mallet lifts, the bells shake, the box's figure turns, the owl's eyes blink, the moon rocks. Only one sound plays at a time, and it respects the mute setting.

Scenery colours only (LADDER and the named glows); each model uses at most six materials.
