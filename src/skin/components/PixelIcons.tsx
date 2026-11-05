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
  ' ####      ',
  '#    #     ',
  '#  ##### ##',
  '#  #   ##  ',
  ' ####  #  #',
  '    #  ####',
  '    #     #',
  '     ######',
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
  '  ######  ',
  ' #      # ',
  '#  #  #  #',
  '#   ##   #',
  '#   ##   #',
  ' #  ##  # ',
  '  ######  ',
  '   ####   ',
  '   ####   ',
  '    ##    ',
], 'hint');

export const AvatarButtonIcon = grid([
  '  #      #  ',
  ' ###    ### ',
  ' ########## ',
  ' #        # ',
  ' # #    # # ',
  ' #        # ',
  ' #  #  #  # ',
  ' #  ####  # ',
  '  ########  ',
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
