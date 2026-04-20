import nodemailer from "nodemailer";

import { env } from "../../config/env";
import { logger } from "../../config/logger";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

void transporter
  .verify()
  .then(() => logger.info("SMTP transporter ready"))
  .catch((error: unknown) => logger.warn(`SMTP verification skipped: ${String(error)}`));

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendEmail = async (message: EmailMessage): Promise<void> => {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
};
