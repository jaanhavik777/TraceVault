
// Embedding generation + storage. OWNER: Kushi
// Uses local Ollama model: nomic-embed-text

import { query } from "@/lib/db";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "nomic-embed-text";

const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS || 768
);

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/+$/, "");

/**
 * Generate an embedding vector using local Ollama.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Embedding input cannot be empty");
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama embedding error: ${error}`);
  }

  const result: { embeddings?: number[][] } = await response.json();

  const embedding = result.embeddings?.[0];

  if (
    !Array.isArray(embedding) ||
    embedding.length !== EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions but received ${
        embedding?.length ?? 0
      }`
    );
  }

  return embedding;
}

/**
 * Build source_text from an incident, generate its embedding,
 * and insert/update the incident_embeddings table.
 *
 * Safe to call repeatedly. Returns false instead of throwing
 * when the embedding provider or database operation fails.
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
 */
export async function searchSimilar(
  queryText: string,
  limit = 5
): Promise<SimilarIncident[]> {
  try {
    if (!queryText.trim()) {
      return [];
    }

    const safeLimit = Math.min(
      20,
      Math.max(1, Math.floor(limit))
    );

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
  } catch (error) {
    console.error("Similar incident search failed:", error);
    return [];
  }
}
