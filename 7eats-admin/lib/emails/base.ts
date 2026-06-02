const FONT_STACK =
  '"Plus Jakarta Sans","Helvetica Neue",Helvetica,Arial,sans-serif';

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
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td align="center" style="border-radius:6px;background-color:#d64045;"><a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${ctaLabel}</a></td></tr></table>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
<tr>
<td style="background-color:#d64045;padding:24px 32px;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:#ffffff;">7eats</td>
</tr>
<tr>
<td style="background-color:#ffffff;padding:32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#0f0f0f;">
<span style="display:none;overflow:hidden;max-height:0px;color:#f4f4f4;">${preheader}</span>
${bodyHtml}
${cta}
</td>
</tr>
<tr>
<td align="center" style="background-color:#f4f4f4;padding:20px 32px;font-family:${FONT_STACK};font-size:13px;color:#6b6b6b;">© 7eats · hello@7eats.ca</td>
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
    .map(
      (r) =>
        `<tr><td style="padding:6px 0;font-family:${FONT_STACK};font-size:14px;color:#6b6b6b;">${r.label}</td><td style="padding:6px 0;font-family:${FONT_STACK};font-size:14px;color:#0f0f0f;font-weight:600;text-align:right;">${r.value}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid #f4f4f4;border-bottom:1px solid #f4f4f4;">${cells}</table>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#0f0f0f;">${text}</p>`;
}

export function pickupCodeBlock(code: string): string {
  return `<div style="margin:24px 0;text-align:center;font-family:${FONT_STACK};font-size:32px;font-weight:700;color:#d64045;letter-spacing:6px;">${code}</div>`;
}
