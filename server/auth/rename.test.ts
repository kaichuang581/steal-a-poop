import { describe, expect, it } from 'vitest';
import type { SessionClaims } from '../contracts';
import { BlockList } from '../blocks';
import { MemoryMailer } from './mailer';
import { DEFAULT_AGE_POLICY } from './policy';
import { RevocationBus } from './revocations';
import { AccountService } from './service';
import { MemoryAccountStore } from './store';
import { createAccountRoutes } from '../routes/accounts';

const NOW = Date.UTC(2026, 10, 12, 12);
const claims = (userId: string, email: string): SessionClaims => ({
  userId, email, sessionId: `s-${userId}`, issuedAt: NOW - 1000, expiresAt: NOW + 3600_000, authenticatedAt: NOW - 1000,
});

async function setup() {
  const store = new MemoryAccountStore();
  const svc = new AccountService({
    store, now: () => NOW, mailer: new MemoryMailer(), agePolicy: DEFAULT_AGE_POLICY, nicknameAllowed: (n) => !/blorf/i.test(n),
    blocks: new BlockList(), bus: new RevocationBus(), authAdmin: { deleteUser: async () => undefined }, appUrl: 'https://game.example/',
  });
  await svc.createUsernameProfile(claims('u1', 'a@example.org'), 'Ana');
  await svc.createUsernameProfile(claims('u2', 'b@example.org'), 'Bea');
  return { svc, store };
}

describe('changing your nickname', () => {
  it('saves a new allowed name', async () => {
    const { svc, store } = await setup();
    expect(await svc.renameProfile('u1', '  Annie ')).toMatchObject({ ok: true, profile: { nickname: 'Annie' } });
    expect((await store.getProfile('u1'))?.nickname).toBe('Annie');
    expect(await store.nicknameTaken('Ana')).toBe(false);
  });
  it('refuses a name someone else has, in any capitals', async () => {
    const { svc } = await setup();
    expect(await svc.renameProfile('u1', 'bea')).toEqual({ ok: false, reason: 'nickname_taken' });
  });
  it('lets you change the capitals of your own name', async () => {
    const { svc } = await setup();
    expect(await svc.renameProfile('u1', 'ANA')).toMatchObject({ ok: true, profile: { nickname: 'ANA' } });
  });
  it('refuses rude or empty names with the sign-up rule', async () => {
    const { svc } = await setup();
    expect(await svc.renameProfile('u1', 'blorfy')).toEqual({ ok: false, reason: 'bad_nickname' });
    expect(await svc.renameProfile('u1', '   ')).toEqual({ ok: false, reason: 'bad_nickname' });
  });
  it('has nothing to rename without a profile', async () => {
    const { svc } = await setup();
    expect(await svc.renameProfile('nobody', 'Cleo')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('says a name is taken only when it is: any other failure to save is an error, not "taken"', async () => {
    const { svc, store } = await setup();
    store.updateProfile = async () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); };
    expect(await svc.renameProfile('u1', 'Cleo')).toEqual({ ok: false, reason: 'nickname_taken' });
    store.updateProfile = async () => { throw new Error('connection lost'); };
    await expect(svc.renameProfile('u1', 'Cleo')).rejects.toThrow('connection lost');
  });

  it('tells a real change from a save that changed nothing', async () => {
    const { svc } = await setup();
    expect(await svc.renameProfile('u1', 'Ana')).toMatchObject({ ok: true, changed: false });
    expect(await svc.renameProfile('u1', 'Annie')).toMatchObject({ ok: true, changed: true });
  });
});

describe('the rename route', () => {
  it('counts five changes a day, and a try at a taken name is not one of them', async () => {
    const { svc } = await setup();
    const routes = createAccountRoutes({ service: svc, captcha: { verify: async () => true }, now: () => NOW } as Parameters<typeof createAccountRoutes>[0]);
    const route = routes.find((r) => r.path === '/api/account/nickname')!;
    const rename = (nickname: string) => route.handler({ user: { userId: 'u1' }, body: { nickname }, ip: '1.2.3.4' } as never);
    for (let i = 0; i < 8; i++) expect((await rename('Bea')).status).toBe(409); // taken, eight times over
    for (const name of ['Ana1', 'Ana2', 'Ana3', 'Ana4', 'Ana5']) expect((await rename(name)).status).toBe(200);
    expect((await rename('Ana6')).status).toBe(429);
  });
});

