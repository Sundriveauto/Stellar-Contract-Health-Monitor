import nodemailer from 'nodemailer';
import type { WorkerConfig } from './config';
import type { Mailer } from './delivery';

export function createMailer(config: WorkerConfig): Mailer | null {
  if (!config.SMTP_HOST) return null;
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });
  return {
    async send({ to, subject, text }) {
      await transport.sendMail({ from: config.SMTP_FROM, to: to.join(', '), subject, text });
    },
  };
}
