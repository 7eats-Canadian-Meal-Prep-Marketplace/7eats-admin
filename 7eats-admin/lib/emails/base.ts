// 7eats transactional email system.
//
// Every HTML email in the app is composed from the helpers below so the look
// stays consistent and on-brand. The visual language mirrors the marketing
// site (app/globals.css): Plus Jakarta Sans, a white card on a soft grey
// canvas, the brand red (#d64045) as the single accent, hairline dividers,
// pill buttons, and generous editorial spacing.
//
// Everything is table-based with inline styles so it renders the same across
// Gmail, Apple Mail, Outlook, and mobile clients. Web fonts are loaded for the
// clients that support them and degrade to a clean sans-serif everywhere else.

// Font names are wrapped in SINGLE quotes on purpose: these strings land inside
// double-quoted inline `style="..."` attributes, so double-quoted font names
// (e.g. "Plus Jakarta Sans") would terminate the attribute early and silently
// drop every declaration after font-family. Single quotes are valid there.
const FONT_STACK =
  "'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

// Brand palette — kept in lockstep with the CSS custom properties in
// app/globals.css so emails and the site never drift apart.
const COLOR = {
  red: "#d64045",
  redDeep: "#b6353a",
  redTint: "#fbeced",
  ink: "#0f0f0f",
  grey700: "#6b6b6b",
  grey500: "#9a9a9a",
  grey300: "#dadada",
  grey200: "#ececec",
  grey100: "#f4f4f4",
  white: "#ffffff",
} as const;

export const CONTACT_EMAIL = "contact@7eats.ca";
export const NOREPLY_FROM = "noreply@7eats.ca";
export const TEAM_FROM = "team@7eats.ca";

/**
 * Resend From header profiles. Each profile pairs a human-friendly display
 * name with its own mailbox so inboxes show a recognizable sender, e.g.
 * `7eats NoReply <noreply@7eats.ca>`, never a bare address.
 */
export type EmailSenderProfile = "noreply" | "team";

const SENDER_PROFILES: Record<
  EmailSenderProfile,
  { name: string; email: string }
> = {
  noreply: { name: "7eats NoReply", email: NOREPLY_FROM },
  team: { name: "7eats Team", email: TEAM_FROM },
};

/**
 * Builds a Resend-compatible From value, e.g. `7eats NoReply
 * <noreply@7eats.ca>`. RESEND_FROM_EMAIL overrides the no-reply mailbox only
 * (the deployment's sending domain). The team profile always sends from its
 * monitored mailbox so replies reach a person.
 */
export function formatEmailFrom(
  profile: EmailSenderProfile = "noreply",
): string {
  const { name, email } = SENDER_PROFILES[profile];
  const mailbox =
    profile === "noreply"
      ? process.env.RESEND_FROM_EMAIL?.trim() || email
      : email;
  return `${name} <${mailbox}>`;
}

// The brand wordmark, served as a PNG (email clients don't render SVG). Built
// from public/7eats-logo.svg via scripts/make-email-logo.mjs; intrinsic 113x64.
// Email clients must fetch images from the public internet, so local app URLs
// fall back to the production domain.
const DEFAULT_EMAIL_ASSET_ORIGIN = "https://www.7eats.ca";

function emailAssetOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredOrigin) return DEFAULT_EMAIL_ASSET_ORIGIN;

  try {
    const url = new URL(configuredOrigin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return DEFAULT_EMAIL_ASSET_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_EMAIL_ASSET_ORIGIN;
  }
}

const LOGO_URL = `${emailAssetOrigin()}/7eats-logo-email.png`;

// Minimal HTML escaping for untrusted, plain-text values (names, dish titles)
// that get dropped into a markup context such as the headline.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function contactParagraph(): string {
  return paragraph(
    `Questions? Email us at <a href="mailto:${CONTACT_EMAIL}" style="color:${COLOR.red};font-weight:600;text-decoration:none;">${CONTACT_EMAIL}</a>.`,
  );
}

export function contactTextLine(): string {
  return `Questions? Email us at ${CONTACT_EMAIL}.`;
}

type HtmlEmailOptions = {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function htmlEmail({
  title,
  preheader,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: HtmlEmailOptions): string {
  const cta =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
<tr>
<td align="left" style="border-radius:999px;background-color:${COLOR.red};">
<a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 30px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${COLOR.white};text-decoration:none;border-radius:999px;letter-spacing:-0.01em;">${escapeHtml(ctaLabel)}&nbsp;&rarr;</a>
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
<tr>
<td style="padding:16px 18px;background-color:${COLOR.white};border:1px solid ${COLOR.grey200};border-left:3px solid ${COLOR.red};border-radius:12px;">
<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLOR.grey700};">Button not working? Paste this link into your browser:</p>
<a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="font-family:${FONT_STACK};font-size:12px;line-height:1.55;color:${COLOR.red};word-break:break-all;text-decoration:underline;text-underline-offset:2px;">${ctaUrl}</a>
</td>
</tr>
</table>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
a { text-decoration: none; }
@media (max-width: 620px) {
  .email-card { border-radius: 0 !important; }
  .email-pad { padding: 32px 24px !important; }
  .email-head-pad { padding: 24px 24px 20px !important; }
  .email-foot-pad { padding: 28px 24px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.grey100};-webkit-font-smoothing:antialiased;">
<div style="display:none;overflow:hidden;line-height:1px;max-height:0;max-width:0;opacity:0;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.grey100};">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:600px;width:100%;background-color:${COLOR.white};border:1px solid ${COLOR.grey200};border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(15,15,15,0.04), 0 12px 32px rgba(15,15,15,0.05);">
<tr>
<td class="email-head-pad" style="padding:26px 40px 22px;border-bottom:1px solid ${COLOR.grey200};">
<img src="${LOGO_URL}" width="56" height="32" alt="7eats" style="display:block;width:56px;height:32px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
</td>
</tr>
<tr>
<td class="email-pad" style="padding:40px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLOR.ink};">
<h1 style="margin:0 0 22px;font-family:${FONT_STACK};font-size:26px;font-weight:700;letter-spacing:-0.025em;line-height:1.15;color:${COLOR.ink};">${escapeHtml(title)}</h1>
${bodyHtml}
${cta}
</td>
</tr>
<tr>
<td class="email-foot-pad" style="padding:28px 40px;border-top:1px solid ${COLOR.grey200};background-color:${COLOR.white};">
<img src="${LOGO_URL}" width="39" height="22" alt="7eats" style="display:block;width:39px;height:22px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;margin:0 0 8px;" />
<p style="margin:0;font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;color:${COLOR.grey500};">Homemade food from cooks near you &middot; Toronto<br />&copy; 7eats &middot; <a href="mailto:${CONTACT_EMAIL}" style="color:${COLOR.grey500};text-decoration:underline;">${CONTACT_EMAIL}</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function orderDetailsTable(
  rows: Array<{ label: string; value: string }>,
): string {
  const cells = rows
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${COLOR.grey200};`;
      return `<tr>
<td style="${border}padding:13px 18px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.grey700};">${r.label}</td>
<td style="${border}padding:13px 18px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.ink};font-weight:600;text-align:right;">${r.value}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;border:1px solid ${COLOR.grey200};border-radius:14px;overflow:hidden;background-color:${COLOR.white};">${cells}</table>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${COLOR.ink};">${text}</p>`;
}

export function pickupCodeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr>
<td align="center" style="padding:24px;background-color:${COLOR.redTint};border:1px solid ${COLOR.red};border-radius:16px;">
<p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.red};">Pickup code</p>
<div style="font-family:${FONT_STACK};font-size:38px;font-weight:700;line-height:1;letter-spacing:8px;color:${COLOR.ink};">${escapeHtml(code)}</div>
</td>
</tr>
</table>`;
}
