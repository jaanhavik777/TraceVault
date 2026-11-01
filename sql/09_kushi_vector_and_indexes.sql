-- =====================================================================
-- pgvector index + similarity search, and index justification (EXPLAIN ANALYZE)
-- OWNER: Kushi
-- Run AFTER embeddings exist (the app builds them: Search page > "Index missing incidents",
-- or POST /api/embeddings/backfill as admin). Needs Ollama running at least once.
-- =====================================================================

\echo
\echo '=== V1. Stored embeddings: model, vector size, source text ==='
SELECT incident_id, embedding_model, vector_dims(embedding) AS dimensions, left(source_text, 60) AS source_text_start
FROM incident_embeddings ORDER BY incident_id;

-- HNSW needs no training data (IVFFlat on a few rows would miss results) and gives good recall on small tables.
\echo
\echo '=== V2. Vector index (HNSW, cosine) ==='
CREATE INDEX IF NOT EXISTS idx_incident_embeddings_vector
ON incident_embeddings USING hnsw (embedding vector_cosine_ops);
\di idx_incident_embeddings_vector

-- <=> is cosine DISTANCE; similarity = 1 - distance.
\echo
\echo '=== V3. Similarity search in pure SQL: incidents most similar to incident #6 ==='
SELECT i.incident_id, i.title,
       ROUND(((1 - (e.embedding <=> (SELECT embedding FROM incident_embeddings WHERE incident_id = 6))) * 100)::numeric, 1) AS similarity_pct,
       r.root_cause_description, r.resolution_summary
FROM incident_embeddings e
JOIN incidents i        ON i.incident_id = e.incident_id
LEFT JOIN resolutions r ON r.incident_id = i.incident_id
WHERE e.incident_id <> 6
ORDER BY e.embedding <=> (SELECT embedding FROM incident_embeddings WHERE incident_id = 6)
LIMIT 5;

\echo
\echo '=== V4. The planner uses the vector index (seq scan disabled because the table is tiny) ==='
SET enable_seqscan = off;
EXPLAIN SELECT incident_id FROM incident_embeddings
ORDER BY embedding <=> (SELECT embedding FROM incident_embeddings WHERE incident_id = 6) LIMIT 5;

\echo
\echo '=== I1-I3. B-tree index justification (seq scan disabled for the demo) ==='
EXPLAIN ANALYZE SELECT * FROM incidents WHERE status_id = 1;
EXPLAIN ANALYZE SELECT * FROM incident_events WHERE incident_id = 1 ORDER BY event_timestamp;
EXPLAIN ANALYZE SELECT * FROM deployments WHERE service_id = 3 ORDER BY deployed_at DESC;
RESET enable_seqscan;
