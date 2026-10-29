import type { VercelRequest, VercelResponse } from "@vercel/node";

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({ error: "Method not allowed" });
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function isGitHubRepo(value: unknown): value is string {
  if (!isHttpsUrl(value)) return false;
  try {
    const u = new URL(value as string);
    return u.hostname.toLowerCase() === "github.com" && u.pathname.split("/").filter(Boolean).length >= 2;
  } catch { return false; }
}

export function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function checkWebhookSecret(req: VercelRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const actual = req.headers["x-telegram-bot-api-secret-token"];
  return Boolean(expected && typeof actual === "string" && actual === expected);
}
