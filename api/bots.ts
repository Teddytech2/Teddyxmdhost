import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./lib/mongodb";
import { methodNotAllowed } from "./lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const db = await getDb();
    const bots = await db.collection("bots").find({ isActive: true }).project({ _id: 1, name: 1, description: 1, githubRepo: 1, pairSiteUrl: 1, category: 1, price: 1, createdAt: 1 }).sort({ name: 1 }).limit(200).toArray();
    return res.status(200).json(bots.map(({ _id, ...bot }) => ({ id: String(_id), ...bot })));
  } catch (e) { return res.status(500).json({ error: e instanceof Error ? e.message : "Could not load catalogue" }); }
}
