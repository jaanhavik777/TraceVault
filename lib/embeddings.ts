// Embedding generation + storage. OWNER: Kushi
// Uses the local Ollama model configured through OLLAMA_BASE_URL and EMBEDDING_MODEL.

import { query } from "@/lib/db";
import { HttpError } from "@/lib/auth";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "nomic-embed-text";

const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS || 768
);

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/+$/, "");

const configuredTimeout = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);
const OLLAMA_TIMEOUT_MS = Number.isFinite(configuredTimeout)
  ? Math.max(1000, configuredTimeout)
  : 30000;

/**
 * Generate an embedding vector using local Ollama.
 * Provider/network/model failures are surfaced as HTTP 503 errors so callers
 * can distinguish an unavailable embedding service from a valid empty result.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new HttpError(400, "Embedding input cannot be empty");
  }

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
  } catch (error) {
    const detail =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
        ? `Ollama did not respond within ${OLLAMA_TIMEOUT_MS} ms`
        : "Ollama could not be reached";
    console.error(`${detail}:`, error);
    throw new HttpError(
      503,
      `Semantic search is unavailable. ${detail}. Start Ollama and ensure ${EMBEDDING_MODEL} is installed.`
    );
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    console.error(`Ollama embedding request failed (${response.status}): ${body}`);
    throw new HttpError(
      503,
      response.status === 404
        ? `Semantic search is unavailable. Ollama model "${EMBEDDING_MODEL}" is not installed. Run: ollama pull ${EMBEDDING_MODEL}`
        : `Semantic search is unavailable. Ollama returned HTTP ${response.status}.`
    );
  }

  let result: { embeddings?: number[][] };
  try {
    result = await response.json();
  } catch {
    throw new HttpError(503, "Semantic search is unavailable. Ollama returned an invalid response.");
  }

  const embedding = result.embeddings?.[0];

  if (
    !Array.isArray(embedding) ||
    embedding.length !== EMBEDDING_DIMENSIONS ||
    !embedding.every((value) => Number.isFinite(value))
  ) {
    throw new HttpError(
      503,
      `Semantic search is unavailable. Expected a valid ${EMBEDDING_DIMENSIONS}-dimension embedding from "${EMBEDDING_MODEL}".`
    );
  }

  return embedding;
}

/**
 * Build source_text from an incident, generate its embedding,
 * and insert/update the incident_embeddings table.
 *
 * Safe to call repeatedly. Returns false instead of throwing when the
 * embedding provider or database operation fails. Incident operations must
 * continue even when the optional embedding service is unavailable.
 */
export async function upsertIncidentEmbedding(
  incidentId: number
): Promise<boolean> {
  try {
    const rows = await query(
      `SELECT
         i.incident_id,
         i.title,
         i.description,
         r.root_cause_description,
         r.resolution_summary
       FROM incidents i
       LEFT JOIN resolutions r
         ON r.incident_id = i.incident_id
       WHERE i.incident_id = $1`,
      [incidentId]
    );

    if (rows.length === 0) {
      console.error(`Incident ${incidentId} not found`);
      return false;
    }

    const incident = rows[0];

    const sourceText = [
      `Title: ${incident.title}`,
      `Description: ${incident.description}`,
      incident.root_cause_description
        ? `Root cause: ${incident.root_cause_description}`
        : "",
      incident.resolution_summary
        ? `Resolution: ${incident.resolution_summary}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const embedding = await embedText(sourceText);
    const vector = `[${embedding.join(",")}]`;

    await query(
      `INSERT INTO incident_embeddings
         (incident_id, source_text, embedding, embedding_model)
       VALUES ($1, $2, $3::vector, $4)
       ON CONFLICT (incident_id)
       DO UPDATE SET
         source_text = EXCLUDED.source_text,
         embedding = EXCLUDED.embedding,
         embedding_model = EXCLUDED.embedding_model,
         created_at = CURRENT_TIMESTAMP`,
      [incidentId, sourceText, vector, EMBEDDING_MODEL]
    );

    return true;
  } catch (error) {
    console.error(
      `Failed to create embedding for incident ${incidentId}:`,
      error
    );
    return false;
  }
}

export interface SimilarIncident {
  incident_id: number;
  title: string;
  similarity_pct: number;
  root_cause: string | null;
  resolution: string | null;
}

/**
 * Search for historical incidents using cosine similarity.
 * Provider errors intentionally propagate so API routes return 503 instead
 * of disguising an outage as a successful search with zero matches.
 */
export async function searchSimilar(
  queryText: string,
  limit = 5
): Promise<SimilarIncident[]> {
  if (!queryText.trim()) {
    return [];
  }

  const safeLimit = Math.min(20, Math.max(1, Math.floor(limit)));
  const embedding = await embedText(queryText);
  const vector = `[${embedding.join(",")}]`;

  const results = await query(
    `SELECT
       i.incident_id,
       i.title,
       ROUND(
         ((1 - (e.embedding <=> $1::vector)) * 100)::NUMERIC,
         1
       )::FLOAT AS similarity_pct,
       r.root_cause_description AS root_cause,
       r.resolution_summary AS resolution
     FROM incident_embeddings e
     JOIN incidents i
       ON i.incident_id = e.incident_id
     LEFT JOIN resolutions r
       ON r.incident_id = i.incident_id
     ORDER BY e.embedding <=> $1::vector
     LIMIT $2`,
    [vector, safeLimit]
  );

  return results as SimilarIncident[];
}
