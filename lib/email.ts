type EmailAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type EmailLayoutOptions = {
  tenantName: string;
  category: string;
  title: string;
  greeting?: string;
  intro?: string;
  previewText?: string;
  sections?: string[];
  primaryAction?: EmailAction;
  secondaryAction?: EmailAction;
  footerText?: string;
  footerNote?: string;
};

type DetailRow = {
  label: string;
  value?: string | number | null;
  htmlValue?: string;
};

type NoticeTone = "neutral" | "success" | "warning" | "danger";

const NOTICE_TONES: Record<NoticeTone, { background: string; border: string; eyebrow: string; text: string }> = {
  neutral: {
    background: "#f9fafb",
    border:     "#e5e7eb",
    eyebrow:    "#6b7280",
    text:       "#111827",
  },
  success: {
    background: "#f0fdf4",
    border:     "#bbf7d0",
    eyebrow:    "#15803d",
    text:       "#14532d",
  },
  warning: {
    background: "#fffbeb",
    border:     "#fde68a",
    eyebrow:    "#b45309",
    text:       "#78350f",
  },
  danger: {
    background: "#fef2f2",
    border:     "#fecaca",
    eyebrow:    "#b91c1c",
    text:       "#7f1d1d",
  },
};

export function escHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escHtmlWithBreaks(value: unknown): string {
  return escHtml(value).replace(/\r?\n/g, "<br />");
}

/** Returns a branded from address: "Acme Construction via Foreman <noreply@...>" */
export function getFromAddress(tenantName?: string | null): string {
  const from = process.env.EMAIL_FROM ?? "noreply@getforeman.app";
  const name = tenantName ? `${tenantName} via Foreman` : "Foreman";
  return `${name} <${from}>`;
}

export function renderNoticeCard({
  tone = "neutral",
  eyebrow,
  title,
  body,
  bodyHtml,
}: {
  tone?: NoticeTone;
  eyebrow?: string;
  title: string;
  body?: string;
  bodyHtml?: string;
}) {
  const palette = NOTICE_TONES[tone];

  return `
    <div style="background:${palette.background};border:1px solid ${palette.border};border-radius:10px;padding:18px 20px;margin:0 0 20px;">
      ${eyebrow ? `<p style="margin:0 0 5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${palette.eyebrow};">${escHtml(eyebrow)}</p>` : ""}
      <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;line-height:1.4;">${escHtml(title)}</p>
      ${bodyHtml ? `<div style="margin:8px 0 0;font-size:14px;line-height:1.65;color:${palette.text};">${bodyHtml}</div>` : ""}
      ${!bodyHtml && body ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.65;color:${palette.text};">${escHtml(body)}</p>` : ""}
    </div>
  `;
}

export function renderDetailCard(title: string, rows: DetailRow[]) {
  const content = rows
    .filter((row) => row.htmlValue || (row.value !== undefined && row.value !== null && String(row.value).length > 0))
    .map((row) => `
      <tr>
        <td style="padding:8px 0;vertical-align:top;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:130px;white-space:nowrap;">${escHtml(row.label)}</td>
        <td style="padding:8px 0;vertical-align:top;font-size:14px;line-height:1.55;color:#1f2937;">${row.htmlValue ?? escHtml(row.value)}</td>
      </tr>
    `)
    .join("");

  if (!content) return "";

  return `
    <div style="background:#f9f8f5;border:1px solid #e8e3db;border-radius:10px;padding:18px 20px;margin:0 0 20px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${escHtml(title)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${content}</table>
    </div>
  `;
}

export function renderMessageCard(label: string, message: string) {
  return `
    <div style="margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${escHtml(label)}</p>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;font-size:15px;line-height:1.7;color:#374151;white-space:pre-line;">
        ${escHtmlWithBreaks(message)}
      </div>
    </div>
  `;
}

function renderAction(action: EmailAction) {
  const isPrimary = (action.variant ?? "primary") === "primary";
  const background = isPrimary ? "#f59e0b" : "#ffffff";
  const color      = isPrimary ? "#0f1923" : "#374151";
  const border     = isPrimary ? "2px solid #f59e0b" : "2px solid #d1d5db";

  return `
    <a href="${action.href}" style="display:inline-block;background:${background};color:${color};border:${border};padding:13px 28px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.01em;">
      ${escHtml(action.label)}
    </a>
  `;
}

export function renderEmailLayout({
  tenantName,
  category,
  title,
  greeting,
  intro,
  previewText,
  sections = [],
  primaryAction,
  secondaryAction,
  footerText,
  footerNote,
}: EmailLayoutOptions) {
  const safeTenantName = escHtml(tenantName || "Foreman");
  const safeCategory   = escHtml(category);
  const safeTitle      = escHtml(title);
  const safeGreeting   = greeting ? escHtml(greeting) : "";
  const safeIntro      = intro ? escHtml(intro) : "";
  const initial        = safeTenantName.charAt(0).toUpperCase() || "F";

  // Preheader spacer: prevents email clients from pulling in body text as preview
  const spacer = Array(90).fill("&nbsp;&zwnj;").join("");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f0ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  ${previewText ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escHtml(previewText)} ${spacer}</div>` : ""}

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f0ee;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;">

          <!-- Top accent bar -->
          <tr>
            <td style="background:#f59e0b;border-radius:12px 12px 0 0;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:#0f1923;padding:22px 28px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background:#f59e0b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="font-size:17px;font-weight:900;color:#0f1923;line-height:36px;display:block;">${initial}</span>
                        </td>
                        <td style="padding-left:11px;vertical-align:middle;">
                          <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:0.01em;">${safeTenantName}</p>
                          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;">${safeCategory}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 28px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${safeGreeting ? `<p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${safeGreeting}</p>` : ""}
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;line-height:1.3;color:#0f172a;">${safeTitle}</h1>
              ${safeIntro ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#4b5563;">${safeIntro}</p>` : ""}
              ${sections.join("")}
              ${primaryAction || secondaryAction ? `
                <div style="padding-top:4px;">
                  ${primaryAction ? renderAction(primaryAction) : ""}
                  ${secondaryAction ? `<span style="display:inline-block;width:10px;"></span>${renderAction(secondaryAction)}` : ""}
                </div>
              ` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:18px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">${escHtml(footerText || "Questions? Reply to this email and we'll help.")}</p>
              <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;text-align:center;">${escHtml(footerNote || `Sent via Foreman · ${tenantName || "Field Service Management"}`)}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
