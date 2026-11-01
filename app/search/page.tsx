
"use client";

import { useState } from "react";

interface SearchResult {
  incident_id: number;
  title: string;
  similarity_pct: number;
  root_cause: string | null;
  resolution: string | null;
}

export default function Page() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!searchQuery.trim()) {
      setError("Please enter a search query.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setHasSearched(true);
      setResults([]);

      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery.trim())}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search incidents.");
      }

      setResults(data.results ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="card">
        <h1>Semantic Search</h1>
        <p className="muted">
          Search historical incidents using their meaning, symptoms,
          root causes, and resolutions.
        </p>

        <form onSubmit={handleSearch} className="mt-4 space-y-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Describe the incident you're looking for..."
            className="w-full rounded-lg border p-3"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-5 py-2 font-semibold disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search incidents"}
          </button>
        </form>
      </section>

      {loading && (
        <p className="muted">Finding semantically similar incidents...</p>
      )}

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      {!loading && hasSearched && !error && results.length === 0 && (
        <section className="card">
          <p>No similar incidents found. Try a different description.</p>
        </section>
      )}

      {!loading && results.length > 0 && (
        <section className="card space-y-4">
          <h2>Search results ({results.length})</h2>

          {results.map((incident) => (
            <article
              key={incident.incident_id}
              className="border-b py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                  <a
                    href={`/incidents/${incident.incident_id}`}
                    className="underline"
                  >
                    {incident.title}
                  </a>
                </h3>

                <span className="rounded-full border px-3 py-1 text-sm font-semibold">
                  {incident.similarity_pct}% match
                </span>
              </div>

              <p className="muted mt-1 text-sm">
                Incident #{incident.incident_id}
              </p>

              <div className="mt-3 space-y-2">
                <div>
                  <p className="font-semibold text-sm">Root cause</p>
                  <p className="muted text-sm">
                    {incident.root_cause || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-sm">Resolution</p>
                  <p className="muted text-sm">
                    {incident.resolution || "Not available"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
