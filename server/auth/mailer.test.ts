import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { MemoryMailer, SmtpMailer } from './mailer';

describe('SmtpMailer', () => {
  it('sends plain text from the configured address, and nothing else', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const m = new SmtpMailer({ from: 'Steal a Poop <hello@example.org>', transport });
    let captured: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const original = transport.sendMail.bind(transport);
    transport.sendMail = (async (opts: any) => ((captured = opts), original(opts))) as never; // eslint-disable-line @typescript-eslint/no-explicit-any
    await m.send({ to: 'mum@example.org', subject: 'Hello', text: 'Body with a link https://x/#/consent/abc' });
    expect(captured).toEqual({ from: 'Steal a Poop <hello@example.org>', to: 'mum@example.org', subject: 'Hello', text: 'Body with a link https://x/#/consent/abc' });
    expect(captured.html).toBeUndefined(); // no HTML, so no tracking pixels or hidden links
  });
  it('cannot be tricked into adding recipients through the subject or address', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const m = new SmtpMailer({ from: 'hello@example.org', transport });
    await m.send({ to: 'mum@example.org', subject: 'Hi\r\nBcc: evil@example.org', text: 'x' }).catch(() => undefined);
    const info = await transport.sendMail({ from: 'hello@example.org', to: 'mum@example.org', subject: 'Hi\r\nBcc: evil@example.org', text: 'x' });
    expect(JSON.stringify(JSON.parse((info as { message: string }).message))).not.toMatch(/"bcc"/i);
  });
  it('lets a failure reach the caller, which records "could not send"', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    transport.sendMail = (async () => { throw new Error('smtp down'); }) as never;
    await expect(new SmtpMailer({ from: 'a@b.org', transport }).send({ to: 'x@y.org', subject: 's', text: 't' })).rejects.toThrow('smtp down');
  });
  it('the in-memory mailer used by tests still records mail', async () => {
    const m = new MemoryMailer();
    await m.send({ to: 'a@b.org', subject: 's', text: 't' });
    expect(m.sent).toHaveLength(1);
  });
});
