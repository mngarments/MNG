import nodemailer, { type Transporter } from "nodemailer";

/** Thrown when Gmail SMTP credentials are missing or rejected. */
export class SmtpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmtpAuthError";
  }
}

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new SmtpAuthError(
      "SMTP is not configured. Set SMTP_USER and SMTP_PASS (a Gmail App Password) in your environment."
    );
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export async function sendMail({
  to,
  subject,
  html,
  attachments,
}: SendArgs): Promise<void> {
  const t = getTransporter();
  const fromName = process.env.FROM_NAME || "MN Garments";
  const fromEmail = process.env.SMTP_USER!;
  try {
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    });
  } catch (err: unknown) {
    const e = err as { code?: string; responseCode?: number; message?: string };
    // Gmail auth failures surface as EAUTH / 535.
    if (e.code === "EAUTH" || e.responseCode === 535) {
      throw new SmtpAuthError(
        "Gmail rejected the credentials. Verify SMTP_USER and that SMTP_PASS is a valid App Password (2-Step Verification must be on)."
      );
    }
    throw err;
  }
}
