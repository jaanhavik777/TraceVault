// Embedding generation + storage. OWNER: Kushi
// TODO(Kushi): implement. Jaanhavi's incident create/resolve routes call upsertIncidentEmbedding().

/** Turn text into an embedding vector (length must equal EMBEDDING_DIMENSIONS / VECTOR(n)). */
export async function embedText(_text: string): Promise<number[]> {
  throw new Error("Not implemented");
}

/**
 * Build source_text from the incident (title + description + resolution if any),
 * embed it, and INSERT ... ON CONFLICT (incident_id) DO UPDATE into incident_embeddings.
 * CONTRACT: safe to call repeatedly; must not throw if the embedding provider is down
 * (log and return false) so incident creation never fails because of search.
 */
export async function upsertIncidentEmbedding(_incidentId: number): Promise<boolean> {
  return false; // stub: does nothing until Kushi implements it
}

export interface SimilarIncident {
  incident_id: number;
  title: string;
  similarity_pct: number;
  root_cause: string | null;
  resolution: string | null;
}

/** Cosine-similarity search over incident_embeddings. */
export async function searchSimilar(_queryText: string, _limit = 5): Promise<SimilarIncident[]> {
  return [];
}
