# Cohesive cute farm-animal sets, cosy painted palettes, and winter-farm accessories

Scope: how games, toys and picture books keep a six-animal set (pig, cow, goat, horse, hen, sheep) reading as one family while each stays distinct; palette rules for a desaturated painted/storybook look (no pure black, 2–3 tones per material); winter accessories; and the "one signature feature" per animal.

Research caveat up front: several primary pages were unreachable (stardewvalleywiki.com returned 403, hayday.fandom.com and farmtogether.fandom.com returned 402, Mattel's shop 429, CGTrader empty). Where I could only get search snippets or secondary summaries I say so. Per-animal hex palettes below are my own constructions built from cited rules and cited anchor colours; they are labelled as inferences, not as values any source published.

## Key question 1: How do Stardew Valley, Story of Seasons, Animal Crossing and Hay Day differentiate pig, cow, goat, horse, chicken and sheep at small size, and what makes them read?

### Takeaway
The clearest documented principle comes from Nintendo's Animal Crossing team: give every species a simple, distinct silhouette and keep everything else (expression system, emotional range, body language) identical across species. Stardew-style pixel art backs this with a limited 3–4-shade palette per material, darker-base-colour outlines instead of black, and small colour variants (white/brown cow) rather than new shapes.

### Cited Findings
- Animal Crossing (CEDEC 2020 talk, as relayed): each animal species has a distinctive silhouette so players can tell villagers apart from a distance; designers start with the silhouette and keep it simple, because adding a trait like "fluffy fur" would narrow the designs the team could create; individual characters are then built through textures and surface detail. — [Siliconera](https://www.siliconera.com/?p=850169)
- Animal Crossing: across all 35 species the emotional expressions are the same, which the team says helps players connect; the goal was for players to "want to interact with them" and "want to watch what they are doing." — [Siliconera](https://www.siliconera.com/?p=850169); same talk summarised by [Nintendo Soup](https://nintendosoup.com/?p=196954) and [TheGamer](https://www.thegamer.com/animal-crossing-new-horizons-villager-design/)
- Animal Crossing: the team "tried several styles before settling on the signature character design." — [Siliconera](https://www.siliconera.com/?p=850169)
- Stardew Valley modding wiki on the official style: "SDV uses a limited colour palette for sprites and portraits"; character sprites use "3-4 shades of each colour for clothing and skin" and "4-5 shades for hair"; rule of thumb "shift shadows to a cooler hue and highlights to a warmer hue" (green base with teal/blue shadows and yellow highlights); "make sure to change the hue as well as the lightness value to avoid colours looking washed out or muddy." — [Stardew Modding Wiki: How to make pixel art](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)
- Stardew: drop shadows under objects are "40% opacity in black" offset about one pixel left and two pixels down; for animals the shadow value is "apparently... 42% or something awkward like that" (wiki's own hedge). — [Stardew Modding Wiki](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)
- Stardew outlines: "Games like Stardew Valley use darker variations of the base color for outlines, giving sprites a softer and far more professional appearance"; "Character outlines do not always need to be pure black"; "every material should ideally have at least three shades" (base, shadow, highlight). — [dev.to pixel-art guide](https://dev.to/autosprites/from-zero-to-mastery-a-complete-pixel-art-guide-for-modern-game-developers-205i)
- Stardew vanilla cows "come in two varieties: White and Brown" (mod page listing vanilla entries); 1.6 added multiple random "skins" per animal chosen by a Weight field; the sheep has a separate "sheared sprite" shown when it has nothing to collect. — [Nexus Mods listing](https://www.nexusmods.com/stardewvalley/mods/9057); [Stardew wiki Modding:Animal data](https://stardewvalleywiki.com/Modding:Animal_data) (page itself blocked to fetch; from search snippet)
- Stardew fan-art influence: a modder says their sprites were made "like the ones from Harvest Moon for the SNES, but kept their white cows and chickens actually white." — [Nexus Mods](https://www.nexusmods.com/stardewvalley/mods/597)
- Stardew sheet constraints: a 64x224-pixel sheet for chickens/ducks is the example in a modding thread about how many sprites a barn-animal sheet can hold. — [Stardew forums](https://forums.stardewvalley.net/threads/modding-barn-animals-a-couple-of-questions.28741/post-123948)
- Story of Seasons: Pioneers of Olive Town cows "can come in both black and white spotted and brown" (black-and-white available from the start); it adds second breeds "Suffolk Sheep" and "Alpine Goat"; chickens include a regular chicken and a "Silkie Chicken." — [GameWith PoOT](https://gamewith.net/pioneers-of-olive-town/article/show/25165); [Harvest Moon wiki Cow (PoOT)](https://harvestmoon.fandom.com/wiki/Cow_(PoOT))
- Story of Seasons: A Wonderful Life cow lineup is "normal, brown, marble, and star" types. — [Prima Games](https://primagames.com/tips/all-animals-in-story-of-seasons-a-wonderful-life-listed)
- Hay Day: livestock described as "cuddly cartoon livestock" and the game "one of the prettiest farming sims to date." — [Gamezebo review](https://www.gamezebo.com/reviews/hay-day-review/)
- Hay Day: goats "wear themed outfits during summer, Halloween, and winter" and the wiki page has an "Alternate appearance" section. — [Hay Day Wiki: Goat](https://hayday.fandom.com/wiki/Goat) (from search snippet; page returned 402 on fetch)
- Hay Day: a fan crochet pattern set covers "chicken, cow, pig, and sheep" from the game, i.e. the four core animals fans reproduce as plush. — [Ravelry](https://www.ravelry.com/patterns/library/hayday-animals-pack)
- Small-size pixel packs sell species as shared bases: a 32x32 pack ships "animated hooved animal bases, interchangeable faces," i.e. cow/goat/sheep/pig built from one hooved body with swapped heads. — [Modular Hooved Creator (itch.io)](https://pixelspriteshop.itch.io/hooved-pack)
- Common commercial farm sprite sizes are 16x16 and 32x32 with idle/walk/graze animations. — e.g. [Cow and sheep 16x16](https://adamgamer1111.itch.io/cow-and-sheep-16x16), [Farm animals sprite pack](https://finalbossblues.itch.io/farm-animals-sprite-pack)
- At 16x16, hue shifts of 8° or more appeared in only 2% of measured colour pairs; hue shifting "starts to pay off once a ramp has three or more steps," so tiny sprites should rely on the lightness gap. Recommended tone counts by canvas: 2 stages at 16x16, 3 at 32x32, 3–4 at 48x48, 4–5 at 64x64+. — [Pixnote shading guide](https://pixnote.net/en/learn/shading)

### Inferences
- The Animal Crossing rule maps directly to a six-animal farm set: give each species one silhouette-level difference (cow = wide body + horns + udder; pig = low round body + snout; goat = slim + beard + swept horns; horse = tall + long neck + mane; hen = tiny + comb + tail fan; sheep = round fleece blob + bare face/legs) and then make the eyes, mouth shape, leg thickness, head-to-body ratio and animation set identical, so the family reads as one cast.
- Stardew's colour-variant approach (white/brown cow, random skins) shows that variants should be palette swaps on the same silhouette, never new shapes. For a storybook set, keep one shape per species and do colour variants only.
- The Harvest Moon-SNES comment about "actually white" cows suggests a known readability failure: in warm-toned palettes, white animals drift to beige and lose contrast with cream sheep and pale hens. Keep cow white cooler/bluer than sheep cream and hen buff so the three "light" animals separate.
- Hay Day's seasonal goat outfits confirm that in cosy mobile farm games, accessories are layered on a fixed base model as seasonal costumes, not baked into the base design.

### Gaps
- No developer breakdown of Stardew Valley's or Hay Day's actual animal sprite designs was found; stardewvalleywiki.com animal pages (403) and hayday.fandom.com animal pages (402) could not be fetched, so per-animal colour descriptions for those games are unverified.
- No Story of Seasons art-direction interview on animal design was found; findings are limited to variant lists.
- No source gave the exact pixel dimensions of Stardew's barn-animal sprites.

## Key question 2: What palette rules do cute/cosy illustrated styles use (desaturation, warm highlights, cool shadows, no pure black, limited tones), with example hex palettes per farm animal?

### Takeaway
The well-supported rules are: no pure black (use a warm or purple-shifted near-black), warm highlights and cool shadows except on skin/pink materials where shadows go warm-reddish, three tones per material (base/shadow/highlight), hue-shift every step so ramps don't go muddy, and a warm golden-hour bias for cosiness. Desaturation is a stylistic preference, not a hard rule.

### Cited Findings
- No pure black/white: a palette-planning guide calls pure white and pure black "usually wrong for a palette" and specifies "#1f1a16 UI base (warm near-black, NOT pure black)" with cream text. — [SummerEngine art-direction skill](https://www.claudepluginhub.com/skills/summerengine-summer/art-direction)
- A devlog: "All our dark areas are #0a0a08, never pure black." — [maxonice devlog](https://maxonice.com/posts/wl-devlog-art-direction)
- "The best secret I ever learned for making warm environments is to simply avoid using black (including shadows). If you shift your blacks towards a dark purple everything will appear warmer." — [r/Unity3D post](https://red.127.pp.ua/r/Unity3D/comments/1l36hp8/testing_environment_lighting_in_a_cozy_blacksmith)
- Highlights get "a sun-like 'yellow' tint" with shadows "closer to the actual color." — [Pixelcraft: The Colors of Frogatto](https://gamedev.net/blogs/entry/2177585-pixelcraft-the-colors-of-frogatto)
- Cosy = golden hour: Stardew's art direction "leans heavily into yellow, orange, and soft brown hues. This mimics the lighting of a late afternoon sun—the 'golden hour'—which humans instinctively associate with relaxation." (promotional blog; treat as opinion) — [image-to-pixel-art blog](https://image-to-pixel-art.pages.dev/blog/stardew-valley-cozy-pixel-art)
- Desaturation is optional: Dead Cells' team argued a cryptic, dangerous ambiance "does not necessarily demand desaturated colors." — [Game Developer: Dead Cells colour deep dive](https://gamedeveloper.com/production/art-design-deep-dive-giving-back-colors-to-cryptic-worlds-in-i-dead-cells-i-)
- Flat shading warning: shading by only darkening/lightening "is the quickest way to make pixel art look flat." — [Wayline colour lesson](https://www.wayline.io/learn/color-palettes/2)
- Shadows cool, highlights warm; the stated reasoning is that light reads as warm and shadow as cold. — [Wayline](https://www.wayline.io/learn/color-palettes/2); [Stardew Modding Wiki](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)
- Skin is the exception: "Shadows lean warm (slightly reddish)," soft gradients, subtle highlights; fabric suits hue shifting with soft shadow boundaries and minimal highlights; example ramp main #3498db / shadow #2c6a8f. — [Pixnote shading](https://pixnote.net/en/learn/shading)
- Sel-out (selective outlining): lighter outlines on light-facing edges, darker in shadow; inner outlines are "a darker version of adjacent color"; "especially effective for characters 32x32 and larger." — [Pixnote shading](https://pixnote.net/en/learn/shading)
- Tones per material in Stardew style: 3–4 shades for clothing/skin, 4–5 for hair (sprites). — [Stardew Modding Wiki](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)
- Stardew avoids 90s checkerboard dithering: "Stardew Valley rejects this." (promotional blog) — [image-to-pixel-art blog](https://image-to-pixel-art.pages.dev/blog/stardew-valley-cozy-pixel-art)
- Lospec "Cozy Tones" (Free Toaster, 8 colours, tags: cozy, desaturated, warm, pastel, 3bit, orange, green), "A cozy 8-color version of the color wheel": #4d0f32, #e3de88, #76bd5e, #234a57, #280a33, #b35f47, #5c9974, #080826. — [Lospec: Cozy Tones](https://lospec.com/palette-list/cozy-tones)
- Lospec "Wheat Field" (bess, 10 colours, tags: wheat, field, nature, soft, warm, cozy): #97c89b, #3e8e92, #305472, #1c1f2b, #2c313c, #625e60, #999172, #dfcd6d, #b78f43, #895c35. — [Lospec: Wheat Field](https://lospec.com/palette-list/wheat-field)
- Lospec "Pumpkin Patch 15" (Jude Buffum; tags include farm, countryside, cozy, rustic, warm): "A rustic autumn palette rich with orange, gold, and deep teal" for cozy farm scenes: #18221c, #2e3124, #444127, #304446, #2e4d52, #3f5f65, #63635f, #4f6c63, #9b5c43, #66896b, #908d5e, #b18d56, #969874, #dc8b4d, #fdb156. — [Lospec: Pumpkin Patch 15](https://lospec.com/palette-list/pumpkin-patch-15)
- Other Lospec cozy-tagged palettes: Glomzy 05/06/07 (muted, gloomy, cozy), Ekko-64 (desaturated, gray, comfy), Shimmering Sunset (desaturated, 12), Anthill (warm, earthy, pink/brown/green). — [Lospec tag: cozy](https://lospec.com/palette-list/tag/cozy)
- Pastel/cute Lospec palettes noted in search: FUNTIME5 (calm, cute, fun, pastel), Sweethope (8 pastel colours), Midnite's Light Pastel. — [Lospec cozy/pastel tag search](https://lospec.com/palette-list/tag/cozy)
- Anchor colours from colour dictionaries: Chestnut #954535 — [Wikipedia](https://en.wikipedia.org/wiki/Chestnut_(color)); Pale Chestnut #DDADAF — [ArtyClick](https://artyclick.com/color-names-dictionary/color-names/pale-chestnut-color/); "Liver Chestnut (Horses) #4c4438" — [ColorsWall](https://colorswall.com/palette/178453); "Liver (Organ) #643425" and "Pastel Pink #deab9a" from a cow-themed palette — [ColorsWall](https://colorswall.com/palette/216136)
- A sheep-character landscape palette lists #a0584b, #e9af96, #5a312a among its values (warm earthy scheme, not wool-white). — [ColorsWall 262924](https://colorswall.com/palette/262924)
- Bay horse definition: brown body with "black mane, tail, ear edges, and lower legs" (no hex given). — [Colors of Quarter Horses](https://iris.londoncouncils.gov.uk/viewer/colors-of-quarter-horses.html)
- Sheep colouring cue: "sheep are primarily white but their face and feet can be colored in black or brown." — [coloring-page source](https://msoid.icmbio.gov.br/en/printable-farm-animal-pictures.html)
- Cast-design palette cap: one guide sets "2/3 main colors per character." — [Brookes Eggleston worldbuilding blog](https://brookes-eggleston-za54.squarespace.com/blog/worldbuilding-101-how-to-design-unique-yet-unified-races-and-factions)

### Inferences
Rule set distilled from the citations (how to pick tones for one animal):
- Body = 3 tones: base, shadow (hue rotated toward blue/purple, saturation slightly up, value down ~15–25%), highlight (hue rotated toward yellow, value up ~10–15%). Belly/muzzle/inner-ear = a lighter, warmer, less saturated variant of the body base (2 tones). Nose/hooves/horns = a darker warm neutral (2 tones), never #000000. Eyes = darkest near-black in the whole set (one shared value for all six animals).
- Pink materials (pig skin, snouts, inner ears, udders) follow the skin exception: shadows go warmer/redder, not blue.
- Global unification: every animal's shadow tone should be pulled toward the same cool hue (e.g. the Wheat Field #305472 / #2c313c family) and every highlight toward the same warm hue (Pumpkin Patch #fdb156 family). That shared light colour is what makes six different body colours read as one painted scene.
- Desaturate the bodies to roughly 25–45% saturation; keep one small accent (scarf, bell, comb) at higher saturation so it pops.

Example palettes (MY CONSTRUCTION following the cited rules; anchor values cited above are marked *; all other hex values are proposals, not sourced):
- Pink pig: body base #e3a79a (near Pastel Pink #deab9a*), body shadow #c27d7a (warm-red shift), body highlight #f1c3b3; snout/belly light #f2d2c6, snout shadow #d5a39a; hooves/nostrils #7a5a55; curly-tail tip = body highlight.
- Holstein cow: white base #f1ece2, white shadow #c9c6c0 (cool grey, keep it bluer than sheep cream), white highlight #fbf8f0; black patches base #3b3a3f (purple-near-black, not #000), patch highlight #55535a; muzzle pink #d9aa9f, muzzle shadow #b98680; hooves/horns #6a5a52 with horn highlight #a3917f.
- Jersey cow (alternative): body base #c2905f, shadow #8f6446, highlight #dbb183; muzzle light #e7d2b7; dark muzzle ring #5c4536; hooves #4c4438*.
- Grey/tan goat: body base #b9ad9b (grey-tan), shadow #857b70 (cool), highlight #d4cab8; belly/beard light #e2d9c8; horns/hooves #6e6256, horn highlight #978a78; eye-stripe/nose #5b5049.
- Bay horse: body base #8c5a3c (between Chestnut #954535* and Liver #643425*), shadow #5e3c2c, highlight #ad7a55; mane/tail/lower legs near-black #3a3133 (warm) with highlight #57494a; blaze/belly #e7dccd; hooves #4c4438*.
- Chestnut horse (alternative): body #a8623f, shadow #76442f, highlight #c88a62; flaxen mane #d9bd94 / shadow #b09269.
- White/buff hen: body base #ead9bd (buff), shadow #bfae95, highlight #f6ebd6; comb/wattle #c9574e (the set's one allowed strong red), comb shadow #9d3f3a; beak/legs #d9a052, shadow #b07a38; tail-tip darker buff #9c8a70.
- Cream sheep: fleece base #efe6d2, fleece shadow #cbbfa7 (slightly warm-grey, warmer than cow white), fleece highlight #faf5e8; face/legs #6c5a52 (brown, per the colouring cue) or #d4b8a4 for a pale-faced breed; inner-ear pink #d9aa9f; hooves #4c4438*.
- Shared across all six: eye #2a2326 (warm near-black), eye highlight #fbf8f0, shared shadow-tint hue ~#305472 at low opacity, shared highlight-tint ~#fdb156 at low opacity, snow dusting #f7f4ee with shadow #d9dde3 (cool, so snow separates from cream fleece).

### Gaps
- No source published a ready-made hex palette for a pig, Holstein/Jersey cow, goat, bay horse, hen or sheep in a cosy painted style; the per-animal palettes above are mine and need visual checking in-engine.
- The Stardew "In-Game Pixel Art: HEX Color Index" and the Sundrop Art Guide (the community guide to the official style) are referenced by the modding wiki but neither could be fetched, so exact official Stardew hex values are missing.
- No quantitative guidance on "how desaturated" cosy styles are (e.g. HSV saturation ranges) was found; the 25–45% figure above is an inference.

## Key question 3: Which accessories/props appear on each farm animal in cosy winter picture books and toys, and which would clash?

### Takeaway
Picture books put knitted gear on farm animals (coats, scarves, booties, shawls, hats, and comic "horn-warmers"/"tail-warmers"), and winter scenes lean on environmental cues: icicles on the chicken coop, sleigh bells, snow. Toys and games keep accessories simple and seasonal (themed winter outfits on a fixed base). The cow's bell is a long-standing picture-book signature.

### Cited Findings
- Snowy Sunday (Phyllis Root, ill. Helen Craig): the farmer "keeps her farm animals warm by knitting them clothing"; the duck gets "a bright and cheerful cozy beak warmer, coat, scarf, and boots." — [School Library Journal](https://www.schoollibraryjournal.com/review/snowy-sunday)
- Snowy Sunday, per Kirkus: dog Spot gets boots (two pairs of booties); duck a scarf; sheep "shawls"; the cow "a coat" plus "purple horn-warmers" in the pictures; "everyone" gets "tail-warmers, horn-warmers, and hats"; she also knits a hat for the sun. Illustrations are "ink-and-watercolor," "breezy," with humorous details. — [Kirkus Reviews](https://kirkusreviews.com/book-reviews/phyllis-root/snowy-sunday/print)
- Jan Brett, The Snowy Nap: "Icicles decorating the chicken coop!", "the sleigh with sleigh bells"; art is watercolor and gouache with "both soft and bright colors," "fine lines and copious textures," "trademark patterned borders," "a winter idyll." — [Penguin Random House](https://www.penguinrandomhouse.com/books/316441/the-snowy-nap-by-jan-brett-illustrated-by-jan-brett); SLJ notes the "icy chicken coop, the frozen pond, and the tinkling of sleigh bells" and Brett's "signature Scandinavian-style drawings" with page borders — [School Library Journal](https://www.schoollibraryjournal.com/review/the-snowy-nap)
- Jan Brett, The Hat: set on a Scandinavian farm as snow falls; cast is "a mother hen, a noisy goose, a talkative barn cat, a playful farm dog, a mama pig and her piglets, and a pony"; the plot is a hedgehog stuck in a woollen stocking that he passes off as a "new hat." — [Penguin Australia](https://www.penguin.com.au/books/the-hat-9781101652039); companion to The Mitten — [Symposium Books](https://symposiumbooks.com/products/the-hat-by-jan-brett)
- Richard Scarry, The Animals of Farmer Jones: "the cow jangles her bell" at suppertime; illustrated in "Richard Scarry's early, more painterly style." — [Penguin Random House Canada](https://penguinrandomhouse.ca/books/66733/richard-scarrys-the-animals-of-farmer-jones-by-leah-gale-illustrated-by-richard-scarry/9780553498172); [Barnes & Noble](https://www.barnesandnoble.com/w/richard-scarrys-the-animals-of-farmer-jones-richard-scarry/1100058406)
- Sleep Tight Farm (ill. Becca Stadtlander): "a long, cozy winter story" of a farm preparing for winter. — [School Library Journal](https://www.schoollibraryjournal.com/review/sleep-tight-farm-a-farm-prepares-for-winter)
- Barn In Winter: Safe & Warm Farm Book (Cottage Door Press): toddler board book whose "rich illustrations capture the magic of winter on the farm." — [NRS World listing](https://nrsworld.com/products/cottage-door-press-barn-in-winter-safe-warm-farm-book)
- Snowflakes on Our Tongues (Mike Ornstein): Pumpernickel Farm animals act up when it snows; ends with facts on how real farm animals cope with cold. — [Kirkus](https://kirkusreviews.com/book-reviews/mike-ornstein/snowflakes-on-our-tongues/print)
- Jan Brett, Cozy: musk ox "with the warmest fur you ever did feel" shelters animals in her coat (fur-as-shelter motif). — [CCBC Winter Is Here list](https://ccbc.education.wisc.edu/winter-is-here)
- Hay Day goats "wear themed outfits during summer, Halloween, and winter." — [Hay Day Wiki: Goat](https://hayday.fandom.com/wiki/Goat) (snippet)
- Fisher-Price Little People Farm Animal Friends (ages ~1–5): "8 different animal friends, including a llama, a chicken, a cow, a goat, a horse, a pig, a sheep, and a sweet dog"; figures are softer and larger than older farm-set animals. — [Smyths listing](https://www.smythstoys.com/ie/en-ie/toys/pre-school-and-electronic-learning/fisher-price/fisher-price-little-people/fisher-price-little-people-farm-animal-figures-8-pack/p/204436); [Mattel](https://shop.mattel.com/products/fisher-price-little-people-farm-animal-friends-gfl21) (page rate-limited; details from search snippets)
- Schleich vs Playmobil: Schleich "looks more detailed although the pieces can't move unlike the playmobil," is "VERY expensive," and horses/stable are "more display pieces than play pieces"; Playmobil "pieces can move" and the Large Country Farm has a milking machine; a Schleich Farm World starter set includes "lifelike cat, horse, puppy, and calf." — [Mumsnet thread](https://www.mumsnet.com/talk/christmas/4676553-schleich-or-playmobil-farm)

### Inferences
Accessory fit per animal, from the picture-book precedents above:
- Cow: bell on a collar/strap is the canonical signature (Scarry); knitted coat and horn-warmers (Snowy Sunday) are the comedy upgrade. A scarf also reads fine on the long neck.
- Horse/pony: blanket-style coat (real stable blankets) and a scarf; a sleigh-bell harness strap ties into the sleigh-bells motif in Brett's winter farm.
- Sheep: shawl (Snowy Sunday) is the book-sanctioned choice; because the fleece is already "warm," a small scarf or ear-muffs is enough; snow dusting on the fleece top reads well since fleece is a flat-topped mass.
- Goat: beard plus a tiny scarf or a bell (goats wear bells in alpine tradition); Hay Day shows goats as the species that gets seasonal outfits.
- Pig: Snowy Sunday's generic "hats" and "tail-warmers" suggest hats and ear-muffs; a collar on a pig has no precedent in any source found and real pigs are never collared, so it clashes; keep pigs bare except a hat/ear-muffs or a knitted tail-warmer joke.
- Hen: beak-warmer and scarf (the duck gets these in Snowy Sunday); a knitted stocking-cap over the comb echoes The Hat's stocking gag. Avoid anything on the legs; the comb is the signature and must stay visible.
- Environmental winter cues from Brett that need no clothing: icicles on the coop, frozen pond, sleigh bells, snow on roofs; add breath puffs (no source found; inference from winter illustration conventions) and snow dusting on backs/heads.
- Accessory colour rule: the cited "2/3 main colours per character" cap means the accessory should be the animal's third colour, picked as a shared warm accent (reds, mustard, teal from the Pumpkin Patch/Wheat Field palettes) so the scarves themselves form a family.

### Gaps
- No source directly stated which accessories clash on which animal; the "collar on a pig clashes" judgement is inferred from absence in all sources.
- Interior art of The Hat, Snowy Nap and Barn in Winter could not be viewed; accessory lists come from reviews/publisher copy.
- Little People/Schleich/Playmobil product pages gave species lists but no description of colours or accessories on the figures.
- No source mentioned breath puffs; this remains an untested convention.

## Key question 4: What techniques keep a set cohesive (shared eye style, leg thickness, head grid, matched saturation) while giving each animal a different silhouette and colour, and which single feature does each animal get?

### Takeaway
Cast-design guides converge on: a written style sheet (shape language, palette, detail level), a shared shape vocabulary, a colour cap per character, a silhouette (fill-black) lineup test, and exactly one unique detail per character inside the shared system. Nintendo's "same expressions, different silhouettes" is the game-industry version of the same rule.

### Cited Findings
- "a clearly defined style is a huge help in cohesive cast design"; make a styleguide covering shape language, colour palette and level of detail. — [UPD Cohesion Guide: basics](https://sites.google.com/view/updcohesionguide/basics)
- "never straying from consistency will ultimately weaken your cast design through erasure of personality and individuality"; fix: "Every character in the cast should have had one unique detail like this in their uniform" (Sailor Mercury's visor example); Sailor Moon's cast "all wear the same uniform with a simple palette swap"; Steven Universe: "Every character is built out of very simple shapes," with repeating motifs (star vs diamond) and restrictive monochrome palettes for one faction. — [UPD Cohesion Guide: basics](https://sites.google.com/view/updcohesionguide/basics)
- Pick style points "specific enough to form a cohesive style, but allow for enough diversity so not all your characters look the same"; example cap "2/3 main colors per character." — [Brookes Eggleston blog](https://brookes-eggleston-za54.squarespace.com/blog/worldbuilding-101-how-to-design-unique-yet-unified-races-and-factions)
- Silhouette test: fill each character with black and check the lineup is still readable; designs that "look good alone but not together" were made as isolated portraits, so build a lineup first. — [LlamaGen comic body-types guide](https://llamagen.ai/blogs/comic-character-design-body-types)
- Shape language: basic forms (circle, square, triangle) communicate personality; in a team like the Powerpuff Girls "each character embodies unique shapes... but they look like a cohesive unit together." — [CG Wire](https://blog.cg-wire.com/character-shape-language/); [RocketBrush](https://rocketbrush.com/blog/shape-language-in-game-character-design-how-to-make-characters-readable-and-consistent)
- Limited palette forces shape and material to carry the differentiation (TF2 analysis). — [Medium: Character Readability in TF2 and Overwatch](https://medium.com/@xavierck/character-readability-in-team-fortress-2-and-overwatch-68c41d454465) (fetch blocked; from search summary)
- Animal Crossing: species silhouette distinct, emotional expressions identical across species (see Q1). — [Siliconera](https://www.siliconera.com/?p=850169)
- Commercial 3D packs describe their cohesion recipe as "a consistent chibi art direction, rounded silhouettes, soft colors and clean cartoon proportions." — [CGTrader: 10 stylized low poly farmyard animals](https://www.cgtrader.com/3d-models/animal/mammal/10-stylized-low-poly-farmyard-animals-pack); another uses "a shared palette texture" across nine blocky Crossy Road-style animals at 100–500 tris — [Daniele De Sanctis, Unreal forums](https://forums.unrealengine.com/t/daniele-de-sanctis-low-poly-blocky-animals-farm-pack-9-characters/2720857)
- Signature-feature anchors from sources: cow bell (Scarry); hen comb/tail (the "mother hen" is listed as a distinct cast member in The Hat); sheep "shawls" cover the fleece; cow "horn-warmers" (Snowy Sunday) highlight horns; bay horse defined by black mane/tail/lower legs (Quarter Horse colour guide); sheep white body with brown/black face and feet (colouring cue). — citations as in Q2/Q3.

### Inferences
Shared-system checklist for the six-animal set (derived from the citations):
- Same eye: one eye shape, one near-black value, one highlight dot position; same mouth/cheek treatment (the Animal Crossing "same expressions" rule).
- Same head grid and leg stock: one head-size unit, one leg thickness, one hoof block for cow/goat/sheep/pig/horse (the itch.io "hooved bases with interchangeable faces" model literally does this); hen uses the same eye and a scaled-down body.
- Same light: one shared cool shadow tint and one shared warm highlight tint across every body colour; matched saturation band for bodies; one saturated accent allowed per animal (the "2/3 main colours" cap).
- Same detail budget: the Animal Crossing warning that "fluffy fur" narrows the design space means fleece/mane texture should be a silhouette bump, not a rendered texture, so the sheep and horse don't out-detail the pig.
- Silhouette lineup test: fill all six black and check they separate by height (horse > cow > goat ≈ pig > sheep > hen), width (cow, sheep, pig wide; goat, horse narrow), and one protrusion each.
- One signature feature each (the "one unique detail" rule applied): cow = bell (plus horns/udder); pig = curly tail (plus flat snout); goat = beard (plus swept-back horns); horse = mane and blaze (plus black "points" if bay); hen = red comb and wattle (the only strong red in the set); sheep = fleece outline with bare face/legs. Winter accessories should sit next to the signature feature, never cover it (scarf below the goat's beard, hat behind the hen's comb, coat leaving the pig's tail free).

### Gaps
- No source gives a numeric rule for shared leg thickness or head-to-body ratio in cute animal sets; those are inferred from the shared-base asset-pack approach.
- The TF2/Overwatch readability article and the original CEDEC slides could not be fetched, so the value-grouping and detail-placement rules there are not quoted.

## Key question 5: Are there blocky/voxel/low-poly cosy farm games whose animals are praised as cute, and what do they do?

### Takeaway
Praise exists but is thin and non-analytical: reviewers call Staxel's voxel animals a "cute addition" and Garden Paws' characters "cute," and commercial low-poly/voxel packs describe their recipe as rounded chibi silhouettes, soft colours, shared palette textures and vertex colours. No Farm Together art analysis was found.

### Cited Findings
- Staxel (voxel): "animals like cows and cats are a cute addition, and it's fun to see them mooching about your farm throughout the day." — [Switch Player review](https://switchplayer.net/?p=39339); one Steam user: "don't mind the graphics or play mechanics but didn't like it as a farming game." — [Steam discussion](https://steamcommunity.com/app/666140/discussions/0/1742230617614690343)
- Garden Paws (3D, not low poly): "characters are cute, the music is soothing, and the environment design is charming"; roster includes "Chicks, Ducks, Calves, Alpacas, Foxes, Ferrets, Goats, Sheep, Horses, Rabbits and more"; Steam rating "Very Positive" (1,890 reviews). — [myPotatoGames](https://mypotatogames.com/?p=18659); [Steam](https://store.steampowered.com/app/840010?l=danish)
- Farm Together: only a generic store description was found ("relaxing farming experience"); no art or animal review. — [Farm Together wiki (402 on fetch)](https://farmtogether.fandom.com/wiki/Animals)
- Voxel farm packs: MrMustache Voxel Farm Animals Pack (10 animals, .vox included) and v2 "fully rigged and animated" in .vox/.glb/.unitypackage — [itch.io](https://mrmgames.itch.io/voxel-farm-animals-pack), [Unreal forums](https://forums.unrealengine.com/t/mrmustache-voxel-farm-animals-pack-2/2747282); The Voxel Store "Voxel Farm" with cow, bull, sheep, goat, pig, duck, mallard, rooster, chicken — [itch.io](https://the-voxel-store.itch.io/voxel-farm); Cute Voxel Animal Pack (10 models) — [itch.io](https://dabt.itch.io/cute-voxel-animal-pack)
- Low-poly cute packs: BundleSmith's cartoon pack uses "a simple palette for coloring" — [itch.io](https://bundlesmith.itch.io/farm-animals-pack); vertexcat's CC0 duck/chicken/cow/pig/sheep are "vertex colored," each under 900 tris — [itch.io](https://vertexcat.itch.io/farm-animals-set); CGTrader's chibi pack: "consistent chibi art direction, rounded silhouettes, soft colors and clean cartoon proportions" — [CGTrader](https://www.cgtrader.com/3d-models/animal/mammal/10-stylized-low-poly-farmyard-animals-pack); Crossy-Road-style blocky pack with "a shared palette texture" — [Unreal forums](https://forums.unrealengine.com/t/daniele-de-sanctis-low-poly-blocky-animals-farm-pack-9-characters/2720857)
- Hay Day (2.5D cartoon, not blocky) remains the most-praised cute livestock reference: "cuddly cartoon livestock." — [Gamezebo](https://www.gamezebo.com/reviews/hay-day-review/)

### Inferences
- The blocky packs that read as cute all share: one palette texture or vertex colours for the whole set (automatic colour cohesion), rounded/chibi proportions (big head, short legs), and very low tri counts, which forces each species to be a silhouette plus one or two feature blocks (comb, horns, snout). This is the voxel equivalent of the pixel-art "hooved base + swapped face" approach.
- For a voxel set, a shared "palette texture" is the practical way to enforce the Q2 rules: put every body base/shadow/highlight triplet, the shared eye colour and the shared accent colours in one small texture so no animal can drift in saturation.

### Gaps
- No critical or developer analysis of why Staxel's, Garden Paws' or Farm Together's animals read as cute; only passing reviewer adjectives.
- Kenney and Synty farm packs did not surface in search; their colour conventions were not verified.
- No sources on Lonely Mountains-style low-poly farms or on Fae Farm/Coral Island/Fields of Mistria animal design were gathered within the call budget.
