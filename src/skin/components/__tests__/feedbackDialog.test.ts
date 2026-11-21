import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The feedback form files its issue through the game server and never opens another page.
const source = readFileSync(new URL('../FeedbackDialog.tsx', import.meta.url), 'utf8');

describe('feedback form', () => {
  it('never sends the player to GitHub', () => {
    expect(source).not.toMatch(/window\.open/);
    expect(source).not.toMatch(/github\.com/);
    expect(source).not.toMatch(/toGithub/);
  });

  it('says it was sent once the server takes it', () => {
    expect(source).toContain('Sent. Your issue will be looked after.');
  });
});
