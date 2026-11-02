import { useRoomStore } from '../../state/roomStore';

/** A friend's invitation, wherever the player is in the app. */
export function InviteToast() {
  const invites = useRoomStore((s) => s.invites);
  const room = useRoomStore((s) => s.room);
  const { acceptInvite, dismissInvite } = useRoomStore.getState();
  if (!invites.length || room) return null; // already in a room: the invite waits quietly in the friends list
  return (
    <div className="fixed inset-x-0 top-2 z-[80] mx-auto flex max-w-sm flex-col gap-2 px-3" aria-live="polite">
      {invites.map((i) => (
        <div key={`${i.from.userId}-${i.code}`} role="alert" className="rounded-2xl border-2 border-sky-300 bg-[#10204a] p-3 text-white shadow-xl">
          <p className="text-sm"><b>{i.from.name}</b> invites you to <b>{i.roomName}</b>.</p>
          <div className="mt-2 flex gap-2">
            <button className="min-h-11 flex-1 rounded-lg bg-emerald-500 font-black text-emerald-950" onClick={() => acceptInvite(i.code)}>Join</button>
            <button className="min-h-11 flex-1 rounded-lg bg-white/15 font-bold" onClick={() => dismissInvite(i.code)}>No thanks</button>
          </div>
        </div>
      ))}
    </div>
  );
}
