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
    border: "#e5e7eb",
    eyebrow: "#6b7280",
    text: "#111827",
  },
  success: {
    background: "#f0fdf4",
    border: "#bbf7d0",
    eyebrow: "#15803d",
    text: "#14532d",
  },
  warning: {
    background: "#fffbeb",
    border: "#fde68a",
    eyebrow: "#b45309",
    text: "#78350f",
  },
  danger: {
    background: "#fef2f2",
    border: "#fecaca",
    eyebrow: "#b91c1c",
    text: "#7f1d1d",
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
    <div style="background:${palette.background};border:1px solid ${palette.border};border-radius:12px;padding:18px 20px;margin:0 0 20px;">
      ${eyebrow ? `<p style="margin:0 0 6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${palette.eyebrow};">${escHtml(eyebrow)}</p>` : ""}
      <p style="margin:0;font-size:17px;font-weight:800;color:#0f172a;">${escHtml(title)}</p>
      ${bodyHtml ? `<div style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${palette.text};">${bodyHtml}</div>` : ""}
      ${!bodyHtml && body ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${palette.text};">${escHtml(body)}</p>` : ""}
    </div>
  `;
}

export function renderDetailCard(title: string, rows: DetailRow[]) {
  const content = rows
    .filter((row) => row.htmlValue || row.value !== undefined && row.value !== null && String(row.value).length > 0)
    .map((row) => `
      <tr>
        <td style="padding:7px 0;vertical-align:top;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:120px;">${escHtml(row.label)}</td>
        <td style="padding:7px 0;vertical-align:top;font-size:14px;line-height:1.5;color:#111827;">${row.htmlValue ?? escHtml(row.value)}</td>
      </tr>
    `)
    .join("");

  if (!content) return "";

  return `
    <div style="background:#f9f8f5;border:1px solid #ece7df;border-radius:12px;padding:18px 20px;margin:0 0 20px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${escHtml(title)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${content}</table>
    </div>
  `;
}

export function renderMessageCard(label: string, message: string) {
  return `
    <div style="margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${escHtml(label)}</p>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px 20px;font-size:14px;line-height:1.7;color:#374151;white-space:normal;">
        ${escHtmlWithBreaks(message)}
      </div>
    </div>
  `;
}

function renderAction(action: EmailAction) {
  const isPrimary = (action.variant ?? "primary") === "primary";
  const background = isPrimary ? "#f59e0b" : "#ffffff";
  const color = isPrimary ? "#0f1923" : "#374151";
  const border = isPrimary ? "none" : "1px solid #d1d5db";

  return `
    <a href="${action.href}" style="display:inline-block;background:${background};color:${color};border:${border};padding:14px 28px;border-radius:10px;font-weight:800;font-size:14px;text-decoration:none;">
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
  const safeCategory = escHtml(category);
  const safeTitle = escHtml(title);
  const safeGreeting = greeting ? escHtml(greeting) : "";
  const safeIntro = intro ? escHtml(intro) : "";
  const initial = safeTenantName.charAt(0).toUpperCase() || "F";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${previewText ? `<meta name="description" content="${escHtml(previewText)}">` : ""}
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  ${previewText ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escHtml(previewText)}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td style="background:#0f1923;border-radius:14px 14px 0 0;padding:24px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#f59e0b;border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle;">
                          <span style="font-size:18px;font-weight:900;color:#0f1923;line-height:38px;">${initial}</span>
                        </td>
                        <td style="padding-left:12px;">
                          <p style="margin:0;font-size:17px;font-weight:800;color:#ffffff;">${safeTenantName}</p>
                          <p style="margin:3px 0 0;font-size:12px;color:#9ca3af;letter-spacing:0.04em;">${safeCategory}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:30px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${safeGreeting ? `<p style="margin:0 0 8px;font-size:15px;color:#374151;">${safeGreeting}</p>` : ""}
              <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#0f172a;">${safeTitle}</h1>
              ${safeIntro ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#6b7280;">${safeIntro}</p>` : ""}
              ${sections.join("")}
              ${primaryAction || secondaryAction ? `
                <div style="padding-top:8px;text-align:left;">
                  ${primaryAction ? renderAction(primaryAction) : ""}
                  ${secondaryAction ? `<span style="display:inline-block;width:12px;"></span>${renderAction(secondaryAction)}` : ""}
                </div>
              ` : ""}
            </td>
          </tr>
          <tr>
            <td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:16px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">${escHtml(footerText || "Questions? Reply to this email and we will help.")}</p>
              <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">${escHtml(footerNote || "Powered by Foreman")}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
