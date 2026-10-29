import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { getDb } from "./lib/mongodb";
import { isGitHubRepo, isHttpsUrl, methodNotAllowed, safeText } from "./lib/http";

async function telegram(method: string, body: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await r.json() as { ok?: boolean; description?: string };
  if (!r.ok || !data.ok) throw new Error(data.description || "Telegram API request failed");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const auth = req.headers.authorization;
    const secret = process.env.SESSION_SECRET;
    if (!auth?.startsWith("Bearer ") || !secret || secret.length < 32) return res.status(401).json({ error: "Sign in to view your submissions." });
    let userId: string;
    try {
      const payload = jwt.verify(auth.slice(7), secret) as { userId?: string | number };
      if (payload.userId == null) throw new Error("Invalid token");
      userId = String(payload.userId);
    } catch { return res.status(401).json({ error: "Invalid or expired session." }); }
    try {
      const db = await getDb();
      const rows = await db.collection("botRequests").find({ submittedBy: userId }).sort({ createdAt: -1 }).limit(100).toArray();
      return res.status(200).json(rows.map(({ _id, ...r }) => ({ id: String(_id), ...r })));
    } catch (e) { return res.status(500).json({ error: e instanceof Error ? e.message : "Database error" }); }
  }
  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);

  // Submissions require the same signed bearer token used by the existing app.
  const auth = req.headers.authorization;
  const secret = process.env.SESSION_SECRET;
  if (!auth?.startsWith("Bearer ") || !secret || secret.length < 32) return res.status(401).json({ error: "Sign in before submitting a bot." });
  let userId: string;
  try {
    const payload = jwt.verify(auth.slice(7), secret) as { userId?: string | number };
    if (payload.userId == null) throw new Error("Invalid token");
    userId = String(payload.userId);
  } catch { return res.status(401).json({ error: "Invalid or expired session." }); }

  const name = safeText(req.body?.name, 80);
  const description = safeText(req.body?.description, 1000);
  const githubRepo = safeText(req.body?.githubRepo, 2048);
  const pairSiteUrl = safeText(req.body?.pairSiteUrl, 2048);
  if (!name || !description || !isGitHubRepo(githubRepo) || !isHttpsUrl(pairSiteUrl)) {
    return res.status(400).json({ error: "Provide a name, description, HTTPS GitHub repository URL, and HTTPS pairing-site URL." });
  }
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_ID;
  if (!adminChatId || !process.env.TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: "Telegram approval is not configured." });

  try {
    const db = await getDb();
    const duplicate = await db.collection("botRequests").findOne({ githubRepo: { $regex: `^${githubRepo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }, status: { $in: ["pending", "tested", "approved"] } });
    if (duplicate) return res.status(409).json({ error: "This repository has already been submitted or published." });
    const doc = { name, description, githubRepo, pairSiteUrl, submittedBy: userId, status: "pending", createdAt: new Date(), updatedAt: new Date() };
    const inserted = await db.collection("botRequests").insertOne(doc);
    const id = String(inserted.insertedId);
    const text = `🟡 TEDDY TECH BOT REVIEW\n\nName: ${name}\nDescription: ${description}\nRepository: ${githubRepo}\nPairing site: ${pairSiteUrl}\nSubmitted by user: ${userId}\nRequest ID: ${id}\n\nTest the repository and pairing site before publishing.`;
    try {
      await telegram("sendMessage", {
        chat_id: adminChatId, text, disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [
          [{ text: "🧪 Mark Tested", callback_data: `tested:${id}` }, { text: "✅ Approve & Publish", callback_data: `approve:${id}` }],
          [{ text: "✏️ Request Changes", callback_data: `changes:${id}` }, { text: "❌ Reject", callback_data: `reject:${id}` }],
        ] },
      });
    } catch (e) {
      await db.collection("botRequests").updateOne({ _id: inserted.insertedId }, { $set: { notificationError: true, updatedAt: new Date() } });
      return res.status(502).json({ error: "Request was saved but Telegram notification failed. Check Telegram configuration and retry notification from admin tools.", requestId: id });
    }
    return res.status(201).json({ id, status: "pending", message: "Submitted for Telegram review." });
  } catch (e) { return res.status(500).json({ error: e instanceof Error ? e.message : "Could not save request" }); }
}
