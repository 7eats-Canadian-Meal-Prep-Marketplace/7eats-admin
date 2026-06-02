import { Resend } from "resend";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail({
  to,
  subject,
  text,
}: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@7eats.ca",
    to,
    subject,
    text,
  });

  if (error) throw new Error(error.message);
}
