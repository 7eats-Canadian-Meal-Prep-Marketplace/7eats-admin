import { Resend } from "resend";
import {
  type EmailSenderProfile,
  formatEmailFrom,
  htmlEmail,
  paragraph,
} from "./emails/base";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Inbox sender label. Default `noreply`; use `team` for human onboarding mail. */
  sender?: EmailSenderProfile;
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  sender = "noreply",
}: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: formatEmailFrom(sender),
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });

  if (error) throw new Error(error.message);
}

export async function sendSetupEmail(
  to: string,
  kitchenName: string,
  rawToken: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://7eats.ca";
  const link = `${baseUrl}/business-auth/setup/create-password?token=${rawToken}`;

  if (process.env.NODE_ENV !== "production") {
    console.error(`[setup-email] magic link for ${to}:\n${link}`);
  } else {
    console.error(`[setup-email] sending setup link to ${to}`);
  }

  const subject = `Complete your 7eats setup, ${kitchenName}`;
  const html = htmlEmail({
    title: subject,
    preheader: "Create your password and complete your kitchen setup.",
    bodyHtml:
      paragraph("Hi,") +
      paragraph(
        "Your application has been approved. Click below to create your password and complete your kitchen setup. The link expires in 3 days.",
      ),
    ctaLabel: "Complete setup",
    ctaUrl: link,
  });

  await sendMail({
    to,
    subject,
    text: [
      "Hi,",
      "",
      "Your application has been approved. Use the link below to create your password and complete your kitchen setup.",
      "This link expires in 3 days.",
      "",
      link,
      "",
      "The 7eats team",
    ].join("\n"),
    html,
    sender: "team",
  });
}
