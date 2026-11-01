// Embedding generation, storage and similarity search. OWNER: Kushi
//
// Model:    nomic-embed-text served by a local Ollama (768 dimensions, no API key)
// Storage:  incident_embeddings.embedding  VECTOR(768)  (pgvector), one row per incident
// Metric:   cosine distance (<=>); similarity % = (1 - distance) * 100
// Index:    HNSW (vector_cosine_ops)
import { query } from "@/lib/db";

const ollamaUrl = () => (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
const modelName = () => process.env.EMBEDDING_MODEL ?? "nomic-embed-text";
const dimensions = () => Number(process.env.EMBEDDING_DIMENSIONS ?? 768);

/** Problems with the embedding service (Ollama down, model missing, wrong vector size). */
export class EmbeddingError extends Error {}

/**
 * Turn text into an embedding vector.
 * nomic-embed-text is trained with task prefixes, so documents and search queries get different ones.
 */
export async function embedText(text: string, kind: "document" | "query" = "document"): Promise<number[]> {
  const input = `${kind === "query" ? "search_query" : "search_document"}: ${text.slice(0, 6000)}`;

  let res: Response;
  try {
    res = await fetch(`${ollamaUrl()}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName(), input }),
      signal: AbortSignal.timeout(60_000), // the first call after idle loads the model, so allow time
    });
  } catch {
    throw new EmbeddingError(
      `Cannot reach Ollama at ${ollamaUrl()}. Start it ("ollama serve") and install the model ("ollama pull ${modelName()}").`
    );
  }
  if (res.status === 404) {
    throw new EmbeddingError(`Ollama does not have the model "${modelName()}". Run: ollama pull ${modelName()}`);
  }
  if (!res.ok) {
    throw new EmbeddingError(`Ollama returned HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const data = (await res.json()) as { embeddings?: number[][]; embedding?: number[] };
  const vec = data.embeddings?.[0] ?? data.embedding;
  if (!vec || vec.length !== dimensions()) {
    throw new EmbeddingError(
      `Expected a ${dimensions()}-dimension vector but got ${vec?.length ?? 0}. ` +
        `Check EMBEDDING_MODEL / EMBEDDING_DIMENSIONS and the VECTOR(n) size in sql/01_ddl.sql.`
    );
  }
  return vec;
}

/** pgvector text format: [0.1,0.2,...] */
const toVectorText = (v: number[]) => `[${v.join(",")}]`;

/** The text that represents an incident: what happened, where, and (once resolved) why and how it was fixed. */
async function buildSourceText(incidentId: number): Promise<string | null> {
  const rows = await query<{
    title: string; description: string; services: string | null;
    root_cause_category: string | null; root_cause_description: string | null; resolution_summary: string | null;
  }>(
    `SELECT i.title, i.description,
            (SELECT string_agg(s.service_name, ', ' ORDER BY isv.is_primary DESC, s.service_name)
               FROM incident_services isv JOIN services s ON s.service_id = isv.service_id
              WHERE isv.incident_id = i.incident_id) AS services,
            r.root_cause_category, r.root_cause_description, r.resolution_summary
     FROM incidents i LEFT JOIN resolutions r ON r.incident_id = i.incident_id
     WHERE i.incident_id = $1`,
    [incidentId]
  );
  const r = rows[0];
  if (!r) return null;
  const parts = [`Title: ${r.title}`];
  if (r.services) parts.push(`Services: ${r.services}`);
  parts.push(`Description: ${r.description}`);
  if (r.root_cause_description) parts.push(`Root cause (${r.root_cause_category}): ${r.root_cause_description}`);
  if (r.resolution_summary) parts.push(`Resolution: ${r.resolution_summary}`);
  return parts.join("\n");
}

/**
 * (Re)build and store the embedding for one incident. Safe to call repeatedly.
 * CONTRACT: never throws, so creating or resolving an incident cannot fail because of search.
 * Returns true when an embedding was stored.
 */
export async function upsertIncidentEmbedding(incidentId: number): Promise<boolean> {
  try {
    const text = await buildSourceText(incidentId);
    if (!text) return false;
    const vec = await embedText(text, "document");
    await query(
      `INSERT INTO incident_embeddings (incident_id, source_text, embedding, embedding_model)
       VALUES ($1, $2, $3::vector, $4)
       ON CONFLICT (incident_id) DO UPDATE
         SET source_text = EXCLUDED.source_text, embedding = EXCLUDED.embedding,
             embedding_model = EXCLUDED.embedding_model, created_at = CURRENT_TIMESTAMP`,
      [incidentId, text, toVectorText(vec), modelName()]
    );
    return true;
  } catch (e) {
    console.error(`embedding for incident ${incidentId} failed:`, e instanceof Error ? e.message : e);
    return false;
  }
}

export interface SimilarIncident {
  incident_id: number;
  title: string;
  status: string;
  severity: string;
  similarity_pct: number;
  root_cause: string | null;
  root_cause_category: string | null;
  resolution: string | null;
}

// $1 = query vector, $2 = incident to exclude (or NULL), $3 = limit, $4 = only incidents that have a resolution
const SIMILAR_SQL = `
  SELECT i.incident_id, i.title, st.status_name AS status, sv.severity_name AS severity,
         GREATEST(0, ROUND(((1 - (e.embedding <=> $1::vector)) * 100)::numeric, 1))::float8 AS similarity_pct,
         r.root_cause_description AS root_cause, r.root_cause_category, r.resolution_summary AS resolution
  FROM incident_embeddings e
  JOIN incidents i            ON i.incident_id = e.incident_id
  JOIN incident_statuses st   ON st.status_id = i.status_id
  JOIN incident_severities sv ON sv.severity_id = i.severity_id
  LEFT JOIN resolutions r     ON r.incident_id = i.incident_id
  WHERE ($2::int IS NULL OR e.incident_id <> $2::int)
    AND (NOT $4::boolean OR r.resolution_id IS NOT NULL)
  ORDER BY e.embedding <=> $1::vector
  LIMIT $3::int`;

/** Semantic search over historical incidents and their resolutions. */
export async function searchSimilar(queryText: string, limit = 5, resolvedOnly = false): Promise<SimilarIncident[]> {
  const vec = await embedText(queryText, "query");
  return query<SimilarIncident>(SIMILAR_SQL, [toVectorText(vec), null, limit, resolvedOnly]);
}

/** Incidents most similar to an existing incident (uses its stored embedding; creates it if missing). */
export async function similarToIncident(incidentId: number, limit = 5, resolvedOnly = false): Promise<SimilarIncident[]> {
  const fetchVec = () =>
    query<{ v: string }>("SELECT embedding::text AS v FROM incident_embeddings WHERE incident_id = $1", [incidentId]);

  let rows = await fetchVec();
  if (rows.length === 0) {
    await embedText("ping", "query"); // surfaces a clear EmbeddingError if Ollama is unavailable
    if (!(await upsertIncidentEmbedding(incidentId))) {
      throw new EmbeddingError("Could not create an embedding for this incident.");
    }
    rows = await fetchVec();
  }
  return query<SimilarIncident>(SIMILAR_SQL, [rows[0].v, incidentId, limit, resolvedOnly]);
}

/** Embed every incident that has no embedding yet (or all of them). Used by the admin "index" action. */
export async function backfillEmbeddings(all = false): Promise<{ total: number; indexed: number; failed: number }> {
  const ids = await query<{ incident_id: number }>(
    all
      ? "SELECT incident_id FROM incidents ORDER BY incident_id"
      : `SELECT i.incident_id FROM incidents i
         WHERE NOT EXISTS (SELECT 1 FROM incident_embeddings e WHERE e.incident_id = i.incident_id)
         ORDER BY i.incident_id`
  );
  await embedText("ping", "query"); // fail fast with a clear message if Ollama is not available
  let indexed = 0;
  for (const { incident_id } of ids) {
    if (await upsertIncidentEmbedding(incident_id)) indexed++;
  }
  return { total: ids.length, indexed, failed: ids.length - indexed };
}
