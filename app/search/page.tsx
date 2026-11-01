"use client";
// Semantic historical search. OWNER: Kushi
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { sevClass, type Me } from "@/components/incident/types";

interface Result {
  incident_id: number; title: string; status: string; severity: string; similarity_pct: number;
  root_cause: string | null; root_cause_category: string | null; resolution: string | null;
}

const EXAMPLE = "Payment requests failing after recent deployment because of database connection problems";

export default function SearchPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [q, setQ] = useState("");
  const [resolvedOnly, setResolvedOnly] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Me>("/api/auth/me").then(setMe).catch(() => null); }, []);

  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      const p = new URLSearchParams({ q, limit: "5" });
      if (resolvedOnly) p.set("resolvedOnly", "1");
      setResults(await api<Result[]>(`/api/search?${p.toString()}`));
    } catch (err) {
      setResults(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reindex() {
    setBusy(true); setError(null); setInfo(null);
    try {
      const r = await api<{ total: number; indexed: number; failed: number }>("/api/embeddings/backfill", { method: "POST" });
      setInfo(`Indexed ${r.indexed} of ${r.total} incidents that were missing an embedding (${r.failed} failed).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Semantic search</h1>
      <p className="muted">Describe a problem in your own words. TraceVault finds historical incidents with similar meaning, along with how they were resolved.</p>

      <form onSubmit={search} className="card" style={{ display: "grid", gap: 10 }}>
        <label>What is going wrong?
          <textarea rows={3} required minLength={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder={EXAMPLE} />
        </label>
        <div className="row">
          <button className="btn" disabled={busy}>{busy ? "Working..." : "Search"}</button>
          <button type="button" className="btn btn-blue btn-sm" onClick={() => setQ(EXAMPLE)}>Use example</button>
          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={resolvedOnly} onChange={(e) => setResolvedOnly(e.target.checked)} />
            Only resolved incidents
          </label>
          {me?.role === "ADMIN" && (
            <button type="button" className="btn btn-blue btn-sm" disabled={busy} onClick={reindex}>Index missing incidents</button>
          )}
        </div>
      </form>

      {error && <p role="alert" className="error">{error}</p>}
      {info && <p className="muted">{info}</p>}

      {results && results.length === 0 && <p className="muted">No indexed incidents yet. An admin can use "Index missing incidents".</p>}
      {results?.map((r) => (
        <section key={r.incident_id} className="card">
          <div className="row">
            <strong style={{ fontSize: 20 }}>{r.similarity_pct}% similarity</strong>
            <Link href={`/incidents/${r.incident_id}`}>Incident #{r.incident_id}: {r.title}</Link>
            <span className={sevClass(r.severity)}>{r.severity}</span>
            <span className="badge status">{r.status}</span>
          </div>
          {r.root_cause && <p><strong>Root cause{r.root_cause_category ? ` (${r.root_cause_category})` : ""}:</strong> {r.root_cause}</p>}
          {r.resolution && <p><strong>Resolution:</strong> {r.resolution}</p>}
          {!r.resolution && <p className="muted">Not resolved yet.</p>}
        </section>
      ))}
    </main>
  );
}
