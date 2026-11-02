# TraceVault Vector Search and Semantic Retrieval

## 1. Introduction

TraceVault uses vector search to identify historical incidents that are semantically similar to a user's search query.

Unlike traditional keyword matching, semantic search understands the contextual meaning of text. It can identify related incidents even when they use different words to describe similar problems.

## 2. Embedding Generation

TraceVault uses the local Ollama model `nomic-embed-text` to generate text embeddings.

An embedding is a numerical representation of text in a multidimensional vector space.

The incident embedding generation process uses incident information, including its descriptive content and resolution information, to create a representation of the incident.

### Model Configuration

| Property | Value |
|---|---|
| Embedding model | nomic-embed-text |
| Model runtime | Ollama |
| Embedding dimensions | 768 |
| Storage | PostgreSQL with pgvector |
| Distance metric | Cosine distance |

## 3. Vector Storage

Generated embeddings are stored in the `incident_embeddings` table in PostgreSQL.

The embedding column uses the pgvector data type:

```sql
embedding VECTOR(768)
```

Each vector represents an incident in a 768-dimensional numerical space.

The `incident_id` associates an embedding with its corresponding incident. A unique constraint ensures that an incident has at most one stored embedding.

## 4. Semantic Search Workflow

The vector search process follows these steps:

1. A user enters a natural-language search query in the TraceVault search interface.
2. The frontend sends the query to the `/api/search` endpoint.
3. The API validates the query and checks user authorization.
4. The search query is converted into a 768-dimensional embedding using `nomic-embed-text`.
5. PostgreSQL compares the query embedding with stored incident embeddings.
6. Cosine distance is calculated using the pgvector `<=>` operator.
7. The most similar incidents are retrieved.
8. The API returns the top five matching incidents with similarity information.
9. The frontend displays the matching incidents, including their titles, root causes, and resolutions where available.

## 5. Cosine Distance

TraceVault uses cosine distance to compare embeddings.

The pgvector operator `<=>` calculates cosine distance between two vectors.

A smaller cosine distance indicates greater similarity between the vectors.

The distance can be converted into a similarity score for presentation:

```text
Similarity = (1 - Cosine Distance) * 100
```

This provides an easy-to-understand percentage-style similarity value.

## 6. Top-K Retrieval

TraceVault uses top-K retrieval to return a limited number of the most similar incidents.

The semantic search API requests the top five matching incidents.

This reduces unnecessary results and allows users to focus on the most relevant historical incidents.

The current implementation excludes the incident itself when displaying similar incidents in the incident detail panel.

## 7. IVFFlat Indexing

TraceVault uses an IVFFlat index to support vector similarity searches.

The index is created using:

```sql
CREATE INDEX idx_incident_embeddings_vector
ON incident_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);
```

IVFFlat divides vectors into lists of clusters to help narrow down the search space.

The `vector_cosine_ops` operator class supports cosine-distance queries.

The `lists = 10` setting configures the number of clusters used by the index.

For small datasets, PostgreSQL may still choose a sequential scan because it can be more efficient than using an index.

## 8. Advantages of Vector Search

- Identifies semantically related incidents.
- Reduces dependence on exact keyword matches.
- Helps engineers discover previously resolved problems.
- Reuses historical incident knowledge.
- Integrates vector retrieval directly into PostgreSQL through pgvector.
- Supports future enhancements such as incident recommendations and automated root-cause assistance.

## 9. Conclusion

Vector search extends TraceVault beyond traditional relational queries by enabling semantic retrieval of historical incident information.

The combination of Ollama embeddings, PostgreSQL, and pgvector provides a locally generated and stored semantic search pipeline. It helps engineers find relevant incidents and resolutions more effectively.