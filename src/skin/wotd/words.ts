/**
 * The word of the day (docs/PLAN_WORD_OF_THE_DAY.md): 365 words, one a day, the same for everyone. Every meaning and
 * example is written for this game; none is taken from a dictionary site. Every word is in public/words.txt, so it can
 * be played.
 *
 * Levels: 1 = uncommon but familiar (Monday and Tuesday), 2 = a step up (Wednesday to Friday), 3 = the hardest that is
 * still learnable (Saturday and Sunday). 104 / 157 / 104, which is exactly how many of each day 2026 has, so in the
 * first year every word comes up once. `short` is the gist in a few words, for Home.
 *
 * The longer meaning and the example sentence of each word are shown on no screen, so they are not in the game's code:
 * they live in public/wotd-notes.json, keyed by word ({ meaning, example }; meanings are at most 90 characters, in
 * words a 12-year-old knows). The game never fetches that file. A word added or renamed here needs its entry there;
 * the test in __tests__/wotd.test.ts reads the file from disk and checks every word has one.
 *
 * Drafted 2026-11-08; Brian's review of the words is still to come. Shown by WordOfDay.tsx, picked by pick.ts.
 */
export interface WotdEntry {
  word: string;
  level: 1 | 2 | 3;
  /** Part of speech, as a dictionary abbreviates it. */
  pos: 'n' | 'v' | 'adj';
  /** How to say it: a plain respelling, the stressed syllable in capitals (TRAN-shunt). Written for the game. */
  say: string;
  /** A few words, shown under the word on Home: at most 32 characters. */
  short: string;
}

/** One level's words, a line each: word|pos|say|short (kept as text, which ships smaller than 365 object literals). */
const level = (n: 1 | 2 | 3, lines: string): WotdEntry[] =>
  lines.trim().split('\n').map((line) => {
    const [word, pos, say, short] = line.split('|');
    return { word, level: n, pos: pos as WotdEntry['pos'], say, short };
  });

export const WOTD: readonly WotdEntry[] = [
  // Level 1: uncommon but familiar (104)
  ...level(1, `
hibernate|v|HY-ber-nayt|to sleep through the winter
migrate|v|MY-grayt|to travel far as seasons change
burrow|v|BUR-oh|to dig a hole to live in
forage|v|FOR-ij|to search around for food
nocturnal|adj|nok-TUR-nul|awake at night
camouflage|n|KAM-uh-flahzh|colors that help you hide
dormant|adj|DOR-munt|asleep for now
flurry|n|FLUR-ee|a short, light fall of snow
sleet|n|SLEET|half-frozen rain
avalanche|n|AV-uh-lanch|a rush of snow down a mountain
glacier|n|GLAY-sher|a slow river of ice
blustery|adj|BLUS-tuh-ree|very windy, with strong gusts
drizzle|n|DRIZ-ul|light rain falling in tiny drops
overcast|adj|OH-ver-kast|gray and cloudy
orchard|n|OR-cherd|a field of fruit trees
pasture|n|PAS-cher|a grassy field for grazing
fertile|adj|FUR-tul|good for growing things
barren|adj|BAIR-un|bare, with nothing growing
drought|n|DROWT|a long spell without rain
scarce|adj|SKAIRS|hard to find
abundant|adj|uh-BUN-dunt|more than enough
wither|v|WITH-er|to dry up, shrink and fade
ember|n|EM-ber|a glowing bit of a dying fire
kindle|v|KIN-dul|to start a fire burning
smolder|v|SMOHL-der|to burn slowly with no flame
flicker|v|FLIK-er|to shine unsteadily
glimmer|n|GLIM-er|a faint, wavering light
glisten|v|GLIS-un|to sparkle wet or icy
huddle|v|HUD-ul|to crowd close together
trudge|v|TRUJ|to walk slowly and heavily
scurry|v|SKUR-ee|to run with quick, short steps
waddle|v|WAD-ul|to walk swaying side to side
pounce|v|POWNS|to leap on something
prowl|v|PROWL|to sneak around hunting
lurk|v|LURK|to hide and wait, out of sight
nuzzle|v|NUZ-ul|to rub gently with the nose
graze|v|GRAYZ|to eat grass in a field
devour|v|dih-VOWR|to eat hungrily
stampede|n|stam-PEED|a wild rush of scared animals
shear|v|SHEER|to cut the wool off a sheep
fleece|n|FLEES|the woolly coat of a sheep
sturdy|adj|STUR-dee|strong and well made
flimsy|adj|FLIM-zee|thin and weak
nimble|adj|NIM-bul|quick and light in how you move
clumsy|adj|KLUM-zee|awkward; always bumping things
timid|adj|TIM-id|shy and easily frightened
cautious|adj|KAW-shus|careful to avoid danger
eager|adj|EE-ger|keen to get going
weary|adj|WEER-ee|very tired
drowsy|adj|DROW-zee|sleepy and only half awake
stubborn|adj|STUB-ern|refusing to give in
loyal|adj|LOY-ul|always on someone's side
fierce|adj|FEERS|wild and a bit scary
curious|adj|KYOOR-ee-us|eager to find things out
generous|adj|JEN-er-us|happy to give or share
grateful|adj|GRAYT-ful|feeling thankful for something
humble|adj|HUM-bul|not boastful
rustic|adj|RUS-tik|simple and country-like
snug|adj|SNUG|warm, cozy and comfortable
hearth|n|HARTH|the fireside
thaw|v|THAW|to melt after freezing
slush|n|SLUSH|snow that is half melted and wet
brisk|adj|BRISK|quick and lively
crisp|adj|KRISP|dry, firm and fresh
gust|n|GUST|a sudden strong rush of wind
murmur|n|MUR-mer|a soft, low sound
rumble|n|RUM-bul|a deep, rolling sound
clatter|n|KLAT-er|a loud rattling noise
rustle|n|RUS-ul|a soft, crackly sound
shudder|v|SHUD-er|to shake suddenly
dawdle|v|DAW-dul|to go slowly and waste time
linger|v|LING-ger|to stay longer than needed
meander|v|mee-AN-der|to wander with many turns
scamper|v|SKAM-per|to run quickly and playfully
hoard|v|HORD|to stash away a big store
ration|v|RASH-un|to share out so it lasts
dwindle|v|DWIN-dul|to slowly get smaller or fewer
ample|adj|AM-pul|more than enough
meager|adj|MEE-ger|very small in amount
thicket|n|THIK-it|a clump of bushes
hollow|adj|HOL-oh|empty inside
ravine|n|ruh-VEEN|a deep, narrow valley
brook|n|BROOK|a small stream
murky|adj|MUR-kee|dark and cloudy
dreary|adj|DREER-ee|dull, gray and gloomy
bleak|adj|BLEEK|cold, bare and cheerless
scowl|n|SKOWL|an angry frown
bellow|n|BEL-oh|a deep, loud shout or roar
bleat|n|BLEET|the cry of a sheep or goat
whinny|n|WIN-ee|a horse's gentle neigh
cackle|n|KAK-ul|a loud, harsh laugh
snicker|n|SNIK-er|a small, sneaky laugh
frolic|v|FROL-ik|to play and jump about happily
plod|v|PLOD|to walk slowly and heavily
replenish|v|rih-PLEN-ish|to fill something up again
brittle|adj|BRIT-ul|hard but easy to snap
riddle|n|RID-ul|a puzzle with a clever answer
ripen|v|RY-pun|to become ready to pick or eat
predator|n|PRED-uh-ter|an animal that hunts others
shelter|n|SHEL-ter|a safe place from weather
lantern|n|LAN-tern|a lamp you can carry
icicle|n|EYE-sih-kul|a hanging spike of ice
hatch|v|HACH|to break out of an egg
instinct|n|IN-stinkt|a born way of acting
`),
  // Level 2: a step up (157)
  ...level(2, `
ephemeral|adj|ih-FEM-er-ul|lasting only a very short time
gregarious|adj|grih-GAIR-ee-us|loving company
rime|n|RYME|white frost from freezing fog
frugal|adj|FROO-gul|careful not to waste
diligent|adj|DIL-ih-junt|hardworking and careful
tenacious|adj|tuh-NAY-shus|holding on firmly
resilient|adj|rih-ZIL-yunt|quick to bounce back
meticulous|adj|muh-TIK-yuh-lus|careful with every detail
serene|adj|suh-REEN|calm and peaceful
tranquil|adj|TRANG-kwil|quiet, still and peaceful
placid|adj|PLAS-id|calm and not easily upset
docile|adj|DOS-ul|gentle and easy to handle
agile|adj|AJ-ul|able to move quickly and easily
sluggish|adj|SLUG-ish|slow and short of energy
lethargic|adj|luh-THAR-jik|very tired and without energy
vigilant|adj|VIJ-uh-lunt|watchful and alert for danger
wary|adj|WAIR-ee|careful and a little suspicious
solitary|adj|SOL-ih-tair-ee|alone
nomadic|adj|noh-MAD-ik|always on the move
translucent|adj|trans-LOO-sunt|letting some light through
opaque|adj|oh-PAYK|not letting any light through
luminous|adj|LOO-mih-nus|glowing with light
radiant|adj|RAY-dee-unt|shining brightly
iridescent|adj|eer-ih-DES-unt|shimmering with rainbow colors
frigid|adj|FRIJ-id|extremely cold
temperate|adj|TEM-per-it|mild
torrent|n|TOR-unt|a rushing stream of water
deluge|n|DEL-yooj|a huge flood or downpour
squall|n|SKWAWL|a sudden, short, violent storm
tempest|n|TEM-pist|a wild, violent storm
hardy|adj|HAR-dee|tough enough for hard times
robust|adj|roh-BUST|strong and healthy
frail|adj|FRAYL|weak and easily hurt
pliable|adj|PLY-uh-bul|easy to bend without breaking
supple|adj|SUP-ul|bending easily and smoothly
pungent|adj|PUN-junt|strong-smelling
fragrant|adj|FRAY-grunt|having a sweet, pleasant smell
savory|adj|SAY-vuh-ree|salty, not sweet
morsel|n|MOR-sul|a small bite of food
ravenous|adj|RAV-uh-nus|extremely hungry
famished|adj|FAM-isht|very, very hungry
wistful|adj|WIST-ful|quietly longing
melancholy|n|MEL-un-kol-ee|a gentle, lasting sadness
elated|adj|ih-LAY-tid|very happy and excited
jubilant|adj|JOO-bih-lunt|full of joy because of a success
sullen|adj|SUL-un|silent and in a bad mood
irritable|adj|EER-ih-tuh-bul|easily annoyed
apprehensive|adj|ap-rih-HEN-siv|worried about what may happen
reluctant|adj|rih-LUK-tunt|not wanting to do something
hesitant|adj|HEZ-ih-tunt|unsure and slow to act
earnest|adj|UR-nist|serious and sincere
candid|adj|KAN-did|honest and direct
modest|adj|MOD-ist|not boasting about yourself
meek|adj|MEEK|quiet and gentle
valiant|adj|VAL-yunt|very brave
gallant|adj|GAL-unt|brave and kind
cunning|adj|KUN-ing|clever at tricking others
shrewd|adj|SHROOD|sharp at judging things
naive|adj|ny-EEV|trusting too easily
gullible|adj|GUL-ih-bul|easily fooled
obstinate|adj|OB-stih-nit|stubborn
mischievous|adj|MIS-chih-vus|playfully naughty
boisterous|adj|BOY-ster-us|noisy, lively and full of energy
raucous|adj|RAW-kus|loud and harsh-sounding
din|n|DIN|a loud, ongoing noise
muffled|adj|MUF-uld|made quieter or less clear
lullaby|n|LUL-uh-by|a soft song for sleep
warble|v|WOR-bul|to sing with trills
chortle|n|CHOR-tul|a happy, chuckling laugh
ponder|v|PON-der|to think something over
contemplate|v|KON-tem-playt|to think deeply about something
scrutinize|v|SKROO-tih-nyz|to look at very closely
saunter|v|SAWN-ter|to walk in a slow, relaxed way
amble|v|AM-bul|to walk at an easy, slow pace
gambol|v|GAM-bul|to run and jump about playfully
glean|v|GLEEN|to gather the leftovers
lush|adj|LUSH|thick, green and growing well
fallow|adj|FAL-oh|left unplanted to rest
furrow|n|FUR-oh|a groove cut by a plow
glade|n|GLAYD|a grassy gap in a forest
knoll|n|NOHL|a small, rounded hill
gully|n|GUL-ee|a ditch cut by running water
vapor|n|VAY-per|a mist or cloud of tiny drops
haze|n|HAYZ|a thin, blurry mist
desolate|adj|DES-uh-lit|empty, bare and lonely
forlorn|adj|for-LORN|sad and lonely
kindling|n|KIND-ling|small sticks to start a fire
tinder|n|TIN-der|dry stuff that lights easily
glower|v|GLOW-er|to stare angrily
grimace|n|GRIM-is|a face of pain or disgust
cordial|adj|KOR-jul|warm and polite
amiable|adj|AY-mee-uh-bul|friendly and pleasant
hospitable|adj|hos-PIT-uh-bul|welcoming to guests
aloof|adj|uh-LOOF|distant and not very friendly
reclusive|adj|rih-KLOO-siv|avoiding other people
nonchalant|adj|non-shuh-LAHNT|calm and relaxed
dappled|adj|DAP-uld|patched with color or light
speckled|adj|SPEK-uld|covered with small spots
mottled|adj|MOT-uld|blotchy with colors
burly|adj|BUR-lee|big, strong and heavy
scrawny|adj|SKRAW-nee|very thin and bony
haughty|adj|HAW-tee|proud and snooty
benevolent|adj|buh-NEV-uh-lunt|kind and wanting to do good
compassion|n|kum-PASH-un|caring for those who hurt
empathy|n|EM-puh-thee|feeling what others feel
perseverance|n|pur-suh-VEER-uns|not giving up
endure|v|en-DOOR|to last through hard times
vigorous|adj|VIG-er-us|strong, energetic and active
feeble|adj|FEE-bul|very weak
sparse|adj|SPARS|thinly spread
bountiful|adj|BOWN-tih-ful|giving or having plenty
copious|adj|KOH-pee-us|very large in amount
cascade|n|kas-KAYD|a small waterfall
crystalline|adj|KRIS-tuh-lin|clear and sparkling
jagged|adj|JAG-id|sharp and uneven
serrated|adj|SAIR-ay-tid|with a jagged, toothed edge
sheen|n|SHEEN|a soft shine on a surface
incandescent|adj|in-kun-DES-unt|glowing with heat
billow|v|BIL-oh|to swell out in waves
plummet|v|PLUM-it|to fall straight down, very fast
swoop|v|SWOOP|to dive through the air
roost|n|ROOST|a place where birds sleep
brood|n|BROOD|a family of young birds
fledgling|n|FLEJ-ling|a young bird learning to fly
domesticated|adj|duh-MES-tih-kay-tid|tamed to live with people
livestock|n|LYV-stok|farm animals
fodder|n|FOD-er|food for farm animals
trough|n|TRAWF|a long feeding box for animals
homestead|n|HOHM-sted|a farmhouse and its land
threshold|n|THRESH-hohld|the bottom of a doorway
gale|n|GAYL|a very strong wind
tundra|n|TUN-druh|a cold, treeless northern plain
insulate|v|IN-suh-layt|to keep heat in, cold out
congeal|v|kun-JEEL|to thicken and set as it cools
condensation|n|kon-den-SAY-shun|water drops from cooling air
anagram|n|AN-uh-gram|a word from mixed-up letters
synonym|n|SIN-uh-nim|a word that means the same
antonym|n|AN-tuh-nim|a word meaning the opposite
homophone|n|HOM-uh-fohn|a sound-alike word
palindrome|n|PAL-in-drohm|reads the same both ways
prefix|n|PREE-fiks|letters added to a word's start
diminutive|adj|dih-MIN-yuh-tiv|very small
dialect|n|DY-uh-lekt|a local way of speaking
eloquent|adj|EL-uh-kwunt|speaking well and movingly
articulate|adj|ar-TIK-yuh-lit|able to say things clearly
verbose|adj|ver-BOHS|using more words than needed
succinct|adj|suk-SINKT|saying a lot in few words
whimsical|adj|WIM-zih-kul|playfully odd
quaint|adj|KWAYNT|charming in an old-fashioned way
ramshackle|adj|RAM-shak-ul|badly built and falling apart
immaculate|adj|ih-MAK-yuh-lit|perfectly clean and tidy
pristine|adj|pris-TEEN|fresh and clean
rickety|adj|RIK-ih-tee|shaky and likely to break
trepidation|n|trep-ih-DAY-shun|nervous worry
exuberant|adj|ig-ZOO-ber-unt|full of energy and happiness
serendipity|n|sair-un-DIP-ih-tee|a happy accident
nostalgia|n|nuh-STAL-juh|longing for the past
`),
  // Level 3: the hardest that is still learnable (104)
  ...level(3, `
somnolent|adj|SOM-nuh-lunt|sleepy
ebullient|adj|ih-BUL-yunt|bubbling with cheer
lugubrious|adj|luh-GOO-bree-us|gloomy in a big way
crepuscular|adj|krih-PUS-kyuh-ler|active at dawn and dusk
halcyon|adj|HAL-see-un|calm, happy and peaceful
sonorous|adj|SON-er-us|deep, rich and full in sound
mellifluous|adj|muh-LIF-loo-us|sweet and smooth to hear
effervescent|adj|ef-er-VES-unt|bubbly and fizzy
sagacious|adj|suh-GAY-shus|wise and good at judging things
loquacious|adj|loh-KWAY-shus|very talkative
taciturn|adj|TAS-ih-turn|quiet; says very little
laconic|adj|luh-KON-ik|using very few words
garrulous|adj|GAIR-uh-lus|talking a lot
obstreperous|adj|ub-STREP-er-us|noisy and hard to control
recalcitrant|adj|rih-KAL-sih-trunt|stubbornly refusing to obey
indefatigable|adj|in-dih-FAT-ih-guh-bul|never getting tired
insouciant|adj|in-SOO-see-unt|carefree and not worried at all
phlegmatic|adj|fleg-MAT-ik|calm and not easily excited
querulous|adj|KWAIR-uh-lus|complaining in a whiny way
truculent|adj|TRUK-yuh-lunt|eager to argue or fight
pugnacious|adj|pug-NAY-shus|quick to start a fight
magnanimous|adj|mag-NAN-ih-mus|generous and forgiving
parsimonious|adj|par-sih-MOH-nee-us|very stingy
gelid|adj|JEL-id|icy cold
boreal|adj|BOR-ee-ul|of the far north
hibernal|adj|hy-BUR-nul|having to do with winter
quiescent|adj|kwee-ES-unt|quiet and still for now
torpid|adj|TOR-pid|sluggish and barely moving
torpor|n|TOR-per|a heavy, sleepy slowness
languid|adj|LANG-gwid|slow, relaxed and lacking energy
lassitude|n|LAS-ih-tood|tiredness and lack of energy
ennui|n|on-WEE|restless boredom
circumspect|adj|SUR-kum-spekt|careful and wary
fastidious|adj|fa-STID-ee-us|very fussy and tidy
assiduous|adj|uh-SIJ-oo-us|working steadily and carefully
punctilious|adj|punk-TIL-ee-us|exact about every rule
jocund|adj|JOK-und|cheerful and merry
jocular|adj|JOK-yuh-ler|joking and playful
mirthful|adj|MURTH-ful|full of laughter and fun
blithe|adj|BLYTH|happy and carefree
winsome|adj|WIN-sum|sweetly charming
beguile|v|bih-GYL|to charm someone
cajole|v|kuh-JOHL|to coax with sweet talk
wheedle|v|WEE-dul|to get by pleading
cavort|v|kuh-VORT|to leap about excitedly
cacophony|n|kuh-KOF-uh-nee|a jumble of harsh sounds
clamor|n|KLAM-er|a loud, continuous noise
tumult|n|TOO-mult|a loud, confused uproar
maelstrom|n|MAYL-strum|a powerful whirlpool
tempestuous|adj|tem-PES-choo-us|stormy
inclement|adj|in-KLEM-unt|cold, wet and stormy
hoary|adj|HOR-ee|gray or white with age or frost
diaphanous|adj|dy-AF-uh-nus|thin enough to see through
gossamer|adj|GOS-uh-mer|very light and delicate
luminescent|adj|loo-mih-NES-unt|softly glowing
opalescent|adj|oh-puh-LES-unt|shimmering milky colors
scintillate|v|SIN-tih-layt|to sparkle and flash
effulgent|adj|ih-FUL-junt|shining brightly
resplendent|adj|rih-SPLEN-dunt|dazzling and splendid to look at
verdant|adj|VUR-dunt|green with growing plants
bucolic|adj|byoo-KOL-ik|of peaceful country life
pastoral|adj|PAS-ter-ul|of shepherds and countryside
sylvan|adj|SIL-vun|of the woods
idyllic|adj|eye-DIL-ik|extremely peaceful and lovely
petulant|adj|PECH-uh-lunt|sulky and childish
sanguine|adj|SANG-gwin|cheerfully hopeful
dour|adj|DOOR|stern, gloomy and unfriendly
morose|adj|muh-ROHS|sullen and gloomy
lachrymose|adj|LAK-rih-mohs|tearful
doleful|adj|DOHL-ful|sad and sorrowful
plaintive|adj|PLAYN-tiv|sounding sad and mournful
reverie|n|REV-er-ee|a pleasant daydream
soporific|adj|sop-uh-RIF-ik|making you sleepy
frisson|n|free-SOHN|a sudden shiver of excitement
alacrity|n|uh-LAK-rih-tee|eager speed and readiness
aplomb|n|uh-PLOM|calm confidence
panache|n|puh-NASH|bold, stylish flair
audacious|adj|aw-DAY-shus|bold and daring
intrepid|adj|in-TREP-id|fearless and adventurous
dauntless|adj|DAWNT-lis|never put off by danger
stalwart|adj|STAWL-wert|strong, loyal and dependable
steadfast|adj|STED-fast|firm and unchanging in loyalty
fortitude|n|FOR-tih-tood|courage in pain or hardship
equanimity|n|ee-kwuh-NIM-ih-tee|calmness, even under stress
ameliorate|v|uh-MEEL-yuh-rayt|to make a bad situation better
exacerbate|v|ig-ZAS-er-bayt|to make a bad situation worse
mitigate|v|MIT-ih-gayt|to make something less severe
ubiquitous|adj|yoo-BIK-wih-tus|found everywhere
evanescent|adj|ev-uh-NES-unt|quickly fading and vanishing
transient|adj|TRAN-shunt|lasting only a short while
germinate|v|JUR-mih-nayt|to start to grow from a seed
burgeon|v|BUR-jun|to grow or spread quickly
arable|adj|AIR-uh-bul|good for growing crops
agrarian|adj|uh-GRAIR-ee-un|to do with farming
bovine|adj|BOH-vyn|having to do with cows
ovine|adj|OH-vyn|having to do with sheep
porcine|adj|POR-syn|having to do with pigs
equine|adj|EE-kwyn|having to do with horses
avian|adj|AY-vee-un|having to do with birds
vulpine|adj|VUL-pyn|like a fox
onomatopoeia|n|on-uh-mat-uh-PEE-uh|a sound word, like moo or buzz
alliteration|n|uh-lit-uh-RAY-shun|repeating starting sounds
portmanteau|n|port-man-TOH|two words blended into one
lexicon|n|LEK-sih-kon|all the words of a language
`),
];
