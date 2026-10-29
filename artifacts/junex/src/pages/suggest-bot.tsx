import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, Send, Clock3 } from "lucide-react";

type Submission = { id: string; name: string; githubRepo: string; pairSiteUrl: string; status: string; createdAt: string; description?: string };
const statusLabel: Record<string, string> = { pending: "Awaiting review", tested: "Tested — awaiting approval", approved: "Approved and published", rejected: "Rejected", changes_requested: "Changes requested" };

export default function SuggestBotPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [pairSiteUrl, setPairSiteUrl] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSubmissions() {
    const token = localStorage.getItem("junex_token");
    if (!token) return;
    try {
      const r = await fetch("/api/bot-requests", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setSubmissions(await r.json());
    } catch { /* the form remains usable; show status on the next visit */ }
  }
  useEffect(() => { void loadSubmissions(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    const token = localStorage.getItem("junex_token");
    if (!token) { setError("Please sign in again before submitting."); setLoading(false); return; }
    try {
      const r = await fetch("/api/bot-requests", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, description, githubRepo, pairSiteUrl }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Submission failed");
      setMessage("Your bot was submitted. Check your submission status below while the Teddy Tech admin reviews it in Telegram.");
      setName(""); setDescription(""); setGithubRepo(""); setPairSiteUrl("");
      await loadSubmissions();
    } catch (e) { setError(e instanceof Error ? e.message : "Submission failed"); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-4xl space-y-8">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/> Back to dashboard</Link>
    <header className="space-y-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400"><Bot size={26}/></div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-500">Community catalogue</p><h1 className="text-3xl font-bold">Suggest a bot</h1><p className="max-w-2xl text-muted-foreground">Submit a GitHub repository and its pairing website. Your bot stays private until it has been reviewed, tested, and approved by Teddy Tech.</p></header>
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-border bg-card p-5 md:p-7">
      <label className="grid gap-2 text-sm font-medium">Bot name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My WhatsApp Bot" className="rounded-lg border border-border bg-background px-3 py-3 outline-none focus:border-amber-500"/></label>
      <label className="grid gap-2 text-sm font-medium">Description<textarea required maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What does your bot do?" rows={3} className="rounded-lg border border-border bg-background px-3 py-3 outline-none focus:border-amber-500"/></label>
      <label className="grid gap-2 text-sm font-medium">GitHub repository URL<input required type="url" value={githubRepo} onChange={e=>setGithubRepo(e.target.value)} placeholder="https://github.com/owner/repository" className="rounded-lg border border-border bg-background px-3 py-3 outline-none focus:border-amber-500"/></label>
      <label className="grid gap-2 text-sm font-medium">Pairing website URL<input required type="url" value={pairSiteUrl} onChange={e=>setPairSiteUrl(e.target.value)} placeholder="https://your-pairing-site.example" className="rounded-lg border border-border bg-background px-3 py-3 outline-none focus:border-amber-500"/></label>
      {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">{message}</p>}
      <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-semibold text-black disabled:opacity-50"><Send size={17}/>{loading ? "Submitting…" : "Submit for review"}</button>
      <p className="text-xs text-muted-foreground">Only HTTPS GitHub repository links and HTTPS pairing URLs are accepted. Do not submit secrets, session IDs, or API keys.</p>
    </form>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Your submissions</h2>{submissions.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No submissions yet.</p> : submissions.map(s => <article key={s.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 space-y-1"><h3 className="font-semibold">{s.name}</h3><p className="break-all text-xs text-muted-foreground">{s.githubRepo}</p><p className="break-all text-xs text-muted-foreground">{s.pairSiteUrl}</p><p className="text-xs text-muted-foreground">Submitted {s.createdAt ? new Date(s.createdAt).toLocaleString() : "recently"}</p></div><span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-500"><Clock3 size={14}/>{statusLabel[s.status] || s.status}</span></article>)}</section>
    <div className="text-xs text-muted-foreground">Approval is not automatic. The administrator tests each submission before publishing it to the public catalogue.</div>
  </div></main>;
}
