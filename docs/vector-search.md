# Semantic Historical Search (vector database component)

> Draft for the report section "SQL/NoSQL/vector database implementation". Replace the screenshot placeholders.

## Why a vector database here
Incident descriptions and resolutions are free text. Engineers rarely search with the same words that an earlier incident used
("payment requests failing after release" vs "checkout errors following deployment"). Keyword and `LIKE` matching miss those cases,
while embeddings place texts with similar meaning close together. Structured data (services, severity, deployments, timeline)
stays in relational tables, where constraints, joins and transactions matter.

## What is converted into embeddings
For every incident, one text document is built (`buildSourceText` in `lib/embeddings.ts`):

```
Title: <incident title>
Services: <affected services, primary first>
Description: <incident description>
Root cause (<category>): <root cause description>     (only once resolved)
Resolution: <resolution summary>                      (only once resolved)
```

The embedding is rebuilt when an incident is created and again when it is resolved, so resolution knowledge becomes searchable.

## Embedding model
`nomic-embed-text`, served locally by Ollama (`POST /api/embed`), 768 dimensions. No API key and no data leaves the machine.
The model is trained with task prefixes, so stored incidents use `search_document: ` and user queries use `search_query: `.

## How vectors are stored
Table `incident_embeddings` (PostgreSQL + pgvector extension):

| Column | Type | Purpose |
|---|---|---|
| embedding_id | SERIAL PK | |
| incident_id | INT FK, UNIQUE | one embedding per incident, `ON DELETE CASCADE` |
| source_text | TEXT | exact text that was embedded (auditable) |
| embedding | VECTOR(768) | the vector |
| embedding_model | VARCHAR(100) | which model produced it |
| created_at | TIMESTAMP | last (re)index time |

## Similarity metric
Cosine distance (`<=>` operator); similarity percentage = `(1 - distance) * 100`. Cosine compares direction, not length,
which suits text embeddings.

## Index
`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`. HNSW needs no training data. (IVFFlat clusters existing rows, so on a table with
a handful of incidents it can return too few results.)

## Retrieval strategy
1. Embed the user's query (or take the stored vector of the current incident).
2. `ORDER BY embedding <=> query_vector LIMIT k` (top-k nearest neighbours).
3. Join `incidents`, `incident_statuses`, `incident_severities` and `resolutions` to return the title, status, severity, root cause and resolution.
4. The current incident is excluded when searching "similar to this incident". An option limits results to resolved incidents.

## Limits (be honest in the report)
- It retrieves historical knowledge; it does not diagnose incidents automatically.
- Quality depends on the incident text. Very short descriptions embed poorly.
- If Ollama is unavailable, search is disabled with a clear message; the rest of the application is unaffected.

## Screenshots to add
- Search page with the example query and ranked results
- Incident page "Similar historical incidents" panel
- `sql/09` output: stored dimensions, HNSW index, SQL similarity query, `EXPLAIN` using the index
