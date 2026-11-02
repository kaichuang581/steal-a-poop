import type { Cosmetics } from '../../net/protocol';

/** A player's name with what they wear: a color, a badge before the name, a title after it. All three come from the shop's fixed list. */
export function NameTag({ name, cosmetics, you }: { name: string; cosmetics?: Cosmetics; you?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      {cosmetics?.badge && <span aria-hidden="true">{cosmetics.badge}</span>}
      <b className="truncate" style={cosmetics?.color ? { color: cosmetics.color } : undefined}>{name}</b>
      {you && <span className="text-white/60">(you)</span>}
      {cosmetics?.title && <i className="truncate text-xs text-white/60">{cosmetics.title}</i>}
    </span>
  );
}
