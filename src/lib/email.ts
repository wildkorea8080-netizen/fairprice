import "server-only";

export type TransactionalEmail = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  return {
    apiKey,
    from,
    isConfigured: Boolean(apiKey && from),
  };
}

export function getMaskedEmailStatus() {
  const config = getEmailConfig();

  return {
    from: config.from ? config.from.replace(/^(.{2}).*(@.*)$/, "$1***$2") : null,
    isConfigured: config.isConfigured,
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendTransactionalEmail({
  html,
  subject,
  text,
  to,
}: TransactionalEmail) {
  const config = getEmailConfig();

  if (!config.apiKey || !config.from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: config.from,
      html,
      subject,
      text,
      to,
    }),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Resend API returned ${response.status}: ${errorBody.slice(0, 500)}`,
    );
  }
}
