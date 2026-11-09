import { FENCE_WORDS } from '../dream/dream';

/**
 * Everyday words a child knows, for the rule cards' YES and NO examples (plan v7 Part 4.2). The game's own notion of
 * a friendly word (`isFriendly`) only looks at letters, so it lets through words nobody uses; the cards try these
 * first and fall back to the whole list only when none fits. Every word here is also in public/words.txt (a test checks).
 */
const MORE = (
  'about above actor adult after again agree alarm album alert alive allow alone along amber angel anger angle ankle ' +
  'apron arena argue armor arrow aside attic audio aunt autumn awake award badge baker balloon banana band bank basket ' +
  'beach beard beast begin being belly below bench berry bike birth black blade blank blend block blood bloom board ' +
  'boat body bones bonus books bored bottle bounce bowl boxes brain brave bread break brick bride bridge brief bright ' +
  'bring broad brown brush bucket buddy build bunch burst butter button cabin cable camel camera camp candy canoe ' +
  'canvas carpet castle catch cause cave cereal chain chalk champ charm chase cheap check cheek cheese cherry chess ' +
  'chest chick chief child chili chimney chin chips choir chop circle city class clean clear clever cliff climb cloak ' +
  'close cloth clown coach coast cocoa coffee color comb comic coral corner couch cough count cousin cover crab craft ' +
  'crane crash crayon crisp crowd crown crumb cube curl cycle daily dance danger dart dinner diner doctor dollar ' +
  'donkey door double dozen dragon drama drawer dress drift drink drive drum duck eagle early earth easel easy eight ' +
  'elbow elephant empty enjoy enter equal error event every exact extra fable face fairy false family fancy feast ' +
  'fever fifty final finger first fish five flag flame flash flour flower fluffy flute focus foggy forty fossil fourth ' +
  'fox frame fresh fridge friend fruit funny furry galaxy gift giant ginger glass globe glove gold gorilla grape ' +
  'gravy great green grill group grow guard guess guest guide guitar habit hammer hand happy harbor heart heavy hello ' +
  'helmet hero hidden hiking history hobby hockey holiday hollow honest hope hotel hound hour human humor hungry ' +
  'hurry igloo image index inside island jacket jelly jewel joke jolly juice jungle kettle kind king kitchen kite ' +
  'knee knife knock koala label ladder lady lemon letter level library lion little lizard lobster lucky lunch magic ' +
  'magnet mango marble market mask match meal medal melon metal middle mirror mitten model money monkey monster ' +
  'motor mountain mouth movie mud nature needle nephew never nickel noble noise noodle north number nurse ocean ' +
  'octopus office olive onion open orbit other outside owner oyster paddle paint palace panda paper parade parent ' +
  'park party pasta peach peanut pearl pebble pencil penguin people pepper person pet photo picnic pilot pizza ' +
  'planet plant plate plum pocket poem polar pony popcorn pretty prince prize puddle puppet purse puzzle queen quick ' +
  'quiet rabbit radio raft rain raisin ranch rapid reader ready recipe red riddle rider ring robin robot rocket ' +
  'rocky round royal ruler runner saddle sailor salad salt sand sandal scarf school science scooter seal season ' +
  'second secret seven shadow shark shell shelf shine ship shirt shoe short shovel shower silly simple singer sister ' +
  'skate sketch skirt sleeve slide slipper smile smoke snack snail snake sneeze soccer socks soda sofa soft soldier ' +
  'spider spoon sport spring square squash stage stairs stamp station stick sticky story strong student sugar summer ' +
  'super supper swamp swing table tablet teacher teapot teddy tent thank thick thumb thunder ticket tiger toast today ' +
  'tomato tongue tooth towel tower town toy track train travel treat truck trumpet turkey turtle twelve twin umbrella ' +
  'uncle under unicorn useful vacuum van vase video violin visit voice wagon waffle walrus water wave weather wheel ' +
  'whale whisker white window winter wizard woman wonder wood worry yogurt young zebra zero zipper'
).split(' ');

export const EVERYDAY: readonly string[] = [...new Set([...FENCE_WORDS, ...MORE])];
