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
