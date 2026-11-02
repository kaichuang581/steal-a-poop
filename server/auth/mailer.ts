/** Sends the emails this server itself must send (parental consent). Sign-up and password-reset emails are sent by Supabase. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
}
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Keeps mail in memory. For tests. */
export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
}

/**
 * Development: prints the mail, including the consent link, to the console so a developer can click it.
 * Never use where real people's addresses are involved.
 */
export class ConsoleMailer implements Mailer {
  async send(mail: Mail) {
    console.log(`[dev mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
  }
}

/**
 * Sends real mail through any SMTP service (Resend, SendGrid, Mailgun, Postmark, Amazon SES and others all offer SMTP).
 * SMTP_URL looks like smtps://user:password@smtp.example.com:465 and is a secret. Plain text only, no tracking, no images.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export class SmtpMailer implements Mailer {
  private transport: Transporter;
  constructor(private opts: { url?: string; from: string; transport?: Transporter }) {
    this.transport = opts.transport ?? nodemailer.createTransport({ url: opts.url!, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  }
  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.opts.from, to: mail.to, subject: mail.subject, text: mail.text });
  }
}
