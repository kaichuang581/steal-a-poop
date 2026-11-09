/** Pixel icons drawn from a character grid; they take the colour of the surrounding text. '#' is solid, 'o' is half-tone. */
const grid = (rows: string[], name: string) =>
  function PixelIcon({ size = 20 }: { size?: number }) {
    const w = rows[0].length;
    return (
      <svg viewBox={`0 0 ${w} ${rows.length}`} width={size} height={(size * rows.length) / w} aria-hidden="true" shapeRendering="crispEdges" data-icon={name} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        {rows.flatMap((r, y) => [...r].map((ch, x) => (ch === ' ' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" opacity={ch === 'o' ? 0.55 : 1} />)))}
      </svg>
    );
  };

export const RulesIcon = grid([
  '  ########  ',
  ' #oooooooo# ',
  ' # ###### # ',
  ' #oooooooo# ',
  ' # ###### # ',
  ' #oooooooo# ',
  ' # ####   # ',
  ' #oooooooo# ',
  '  ########  ',
], 'rules');

export const ChainIcon = grid([
  ' ####  #### ',
  '#    ##    #',
  '#    ##    #',
  '#    ##    #',
  '#    ##    #',
  ' ####  #### ',
], 'chain');

export const ChatIcon = grid([
  ' ########## ',
  '#          #',
  '# ## ## ## #',
  '#          #',
  ' ####  #### ',
  '    # #     ',
  '     #      ',
], 'chat');

export const ScoresIcon = grid([
  '    ####    ',
  '    #  #    ',
  '#####  #####',
  '#   #  #   #',
  '#   #  #   #',
  '#   #  #   #',
  '############',
], 'scores');

export const HintIcon = grid([
  '   ####   ',
  '  ######  ',
  ' ##    ## ',
  ' ##    ## ',
  ' ##    ## ',
  '  ######  ',
  '   ####   ',
  '   ####   ',
  '  ######  ',
  '          ',
], 'hint');

export const AvatarButtonIcon = grid([
  '   ####   ',
  '  ######  ',
  '  ######  ',
  '   ####   ',
  '    ##    ',
  '  ######  ',
  ' ######## ',
  ' ######## ',
  ' ######## ',
  '          ',
], 'avatar');

export const FireIcon = grid([
  '    #     ',
  '   ##     ',
  '   ###  # ',
  '  ####### ',
  ' ######## ',
  ' ##oo#### ',
  ' #oooo### ',
  ' #oooooo# ',
  '  #oooo#  ',
  '   ####   ',
], 'fire');

export const SoundIcon = ({ size = 20, muted = false }: { size?: number; muted?: boolean }) => {
  const rows = muted
    ? ['    #       ', '   ##       ', '###### #  # ', '######  ##  ', '######  ##  ', '###### #  # ', '   ##       ', '    #       ']
    : ['    #    #  ', '   ##  #  # ', '######  # # ', '######  # # ', '######  # # ', '######  # # ', '   ##  #  # ', '    #    #  '];
  const I = grid(rows, muted ? 'muted' : 'sound');
  return <I size={size} />;
};

const CoinIcon = grid(['  ####  ', ' #oooo# ', '#oo##oo#', '#o#oo#o#', '#o#oo#o#', '#oo##oo#', ' #oooo# ', '  ####  '], 'coin');
const FriendsIcon = grid([
  ' ##    ## ',
  '#  #  #  #',
  '#  #  #  #',
  ' ##    ## ',
  '          ',
  '  #    #  ',
  ' ###  ### ',
  '#  #  #  #',
  '##########',
  '          ',
], 'friends');
const ShopIcon = grid(['  ####  ', ' #    # ', '########', '#oooooo#', '#oooooo#', '#oooooo#', '########'], 'shop');
const WarnIcon = grid(['    #    ', '   ###   ', '   # #   ', '  ## ##  ', '  ## ##  ', ' ###### # '.slice(0, 9), ' ###  ### '.slice(0, 9), '#########'].map((r) => r.padEnd(9)), 'warn');
const BanIcon = grid(['  ####  ', ' #   ## ', '#   # ##', '#  #  ##', '# #   ##'.replace('##', '# '), ' ##   # ', '  ####  '], 'ban');
const CloseIcon = grid(['##    ##', ' ##  ## ', '  ####  ', '   ##   ', '  ####  ', ' ##  ## ', '##    ##'], 'close');
const BoltIcon = grid(['    ##', '   ## ', '  ##  ', ' #### ', '  ##  ', ' ##   ', '##    '], 'bolt');
const PoopIcon = grid(['    ##    ', '   ###    ', '  ######  ', ' ######## ', '  ######  ', ' ######## ', '##########'], 'poop');
const Medal = (n: string) => grid([
  ' #      # ',
  '  #    #  ',
  '   #  #   ',
  '    ##    ',
  '  ######  ',
  ' #      # ',
  '#  oooo  #',
  '#  oooo  #',
  ' #      # ',
  '  ######  ',
], n);
const WindIcon = grid(['  ####   ', '      #  ', '########', '        #', ' #######', '       # ', '  ####   '].map((r) => r.padEnd(9)), 'wind');
const SproutIcon = grid(['## ##', ' ###', '  # ', '  # ', '  # '], 'sprout');
const LeafSmall = grid([
  '     #    ',
  '    ###   ',
  '   ##o##  ',
  '  ## o ## ',
  ' ### o ###',
  ' ### o ###',
  '  ## o ## ',
  '   ##o##  ',
  '    ###   ',
  '   #      ',
], 'leaf');
const AcornSmall = grid([' #### ', '######', ' #### ', ' #### ', '  ##  '], 'acorn');
const RulerIcon = grid(['#########', '# # # # #', '#########'], 'ruler');
const TwinsIcon = grid([
  '# #    # #',
  '###    ###',
  ' #      # ',
  '          ',
  '  #    #  ',
  ' ###  ### ',
  '#  #  #  #',
  '##########',
  '          ',
  '          ',
], 'twins');
const SparkIcon = grid([
  '    #    ',
  '   # #   ',
  '  #   #  ',
  ' ### ### ',
  '#########',
  ' ### ### ',
  '  #   #  ',
  '   # #   ',
  '    #    ',
  '         ',
], 'spark');
const PepperIcon = grid(['   ##', '  #  ', ' ### ', '#### ', '###  '], 'pepper');
const GearPx = grid(['  # #  ', ' ##### ', '### ###', ' ##### ', '### ###', ' ##### ', '  # #  '], 'gear');
const CheckIcon = grid(['      #', '     ##', '#   ## ', '## ##  ', ' ###   ', '  #    '], 'check');
const ResetIcon = grid([' #### ', '#    #', '#   ##', '    # ', '#    #', ' #### '], 'reset');

const MAP: Record<string, (p: { size?: number }) => React.ReactElement> = {
  '🪙': CoinIcon, '👥': FriendsIcon, '🏆': ScoresIcon, '🛍': ShopIcon, '⚠': WarnIcon, '🚫': BanIcon, '✕': CloseIcon, '⚡': BoltIcon,
  '💩': PoopIcon, '🥇': Medal('gold'), '🥈': Medal('silver'), '🥉': Medal('bronze'), '🌬': WindIcon, '🌱': SproutIcon, '🍃': LeafSmall,
  '🌰': AcornSmall, '📏': RulerIcon, '👯': TwinsIcon, '✨': SparkIcon, '🌶': PepperIcon, '⚙': GearPx, '✓': CheckIcon, '↺': ResetIcon, '💡': HintIcon, '🔥': FireIcon,
};

/** Any former emoji, as a pixel icon. Pass `title` to show its name on hover. */
export function Px({ e, size = 16, title }: { e: string; size?: number; title?: string }) {
  const I = MAP[e.replace(/️/g, '')];
  if (!I) return null;
  return <span title={title} style={{ display: 'inline-flex' }}><I size={size} /></span>;
}

/** A bomb with an arrow: hand the bomb to the next sheep. */
export const PassIcon = grid([
  '       #   ',
  '      #    ',
  '   ####  # ',
  '  ###### ##',
  ' ########  ',
  ' ######### ',
  ' ######### ',
  '  #######  ',
  '   #####   ',
], 'pass');

/** A head and shoulders: the account button. */
export const PersonIcon = grid([
  '   ####   ',
  '  ######  ',
  '  ######  ',
  '   ####   ',
  '  ######  ',
  ' ######## ',
  '##########',
  '##########',
], 'person');
