import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "./lib/mongodb";
import { checkWebhookSecret, methodNotAllowed } from "./lib/http";

async function telegram(method: string, body: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json() as { ok?: boolean; description?: string };
  if (!r.ok || !data.ok) throw new Error(data.description || "Telegram API request failed");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!checkWebhookSecret(req)) return res.status(401).json({ error: "Invalid webhook secret" });
  const update = req.body as any;
  const query = update?.callback_query;
  if (!query?.id || !query?.data) return res.status(200).json({ ok: true });
  const adminId = String(process.env.TELEGRAM_ADMIN_ID || "");
  if (!adminId || String(query.from?.id) !== adminId) {
    await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Only the configured administrator can review requests.", show_alert: true });
    return res.status(200).json({ ok: true });
  }
  const [action, id] = String(query.data).split(":");
  if (!ObjectId.isValid(id) || !["tested", "approve", "changes", "reject"].includes(action)) {
    await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Invalid action." });
    return res.status(200).json({ ok: true });
  }
  try {
    const db = await getDb();
    const requests = db.collection("botRequests");
    const request = await requests.findOne({ _id: new ObjectId(id) });
    if (!request) {
      await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Request not found.", show_alert: true });
      return res.status(200).json({ ok: true });
    }
    const now = new Date();
    if (action === "tested") {
      await requests.updateOne({ _id: request._id }, { $set: { status: "tested", testedAt: now, updatedAt: now } });
      await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Marked as tested. Approve when ready." });
      await telegram("sendMessage", { chat_id: query.message?.chat?.id, text: `🧪 ${request.name} marked as tested. Use Approve & Publish when you are satisfied with the checks.` });
    } else if (action === "approve") {
      if (request.status !== "tested") {
        await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Mark this bot as tested first.", show_alert: true });
        return res.status(200).json({ ok: true });
      }
      await db.collection("bots").updateOne({ githubRepo: request.githubRepo }, { $set: { name: request.name, description: request.description, githubRepo: request.githubRepo, pairSiteUrl: request.pairSiteUrl, requestId: id, isActive: true, approvedAt: now, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
      await requests.updateOne({ _id: request._id }, { $set: { status: "approved", approvedAt: now, updatedAt: now } });
      await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Approved and published." });
      await telegram("sendMessage", { chat_id: query.message?.chat?.id, text: `✅ ${request.name} is now published in the approved bot catalogue.` });
    } else if (action === "changes") {
      await requests.updateOne({ _id: request._id }, { $set: { status: "changes_requested", updatedAt: now } });
      await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Marked as changes requested." });
      await telegram("sendMessage", { chat_id: query.message?.chat?.id, text: `✏️ Changes requested for ${request.name}. Contact the submitter through your normal support process.` });
    } else {
      await requests.updateOne({ _id: request._id }, { $set: { status: "rejected", rejectedAt: now, updatedAt: now } });
      await telegram("answerCallbackQuery", { callback_query_id: query.id, text: "Request rejected." });
      await telegram("sendMessage", { chat_id: query.message?.chat?.id, text: `❌ ${request.name} was rejected and will not appear in the public catalogue.` });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Could not process approval" });
  }
}
