@'
# TraceVault System Architecture

## 1. Overview

TraceVault is an Incident Causality and Resolution Intelligence Platform designed to help engineering teams investigate incidents, understand service dependencies, identify related deployments, and retrieve similar historical incidents.

## 2. System Architecture

The application follows a layered architecture:

1. **User Interface (UI):** The Next.js frontend provides incident dashboards, incident details, administrative pages, and semantic search.
2. **Route Handlers:** Next.js API route handlers process HTTP requests, validate input, enforce authentication and authorization, and coordinate application logic.
3. **Application and Data Access Layer:** TypeScript modules handle business logic, database queries, embedding generation, and similarity search.
4. **SQL and PostgreSQL:** PostgreSQL stores structured application data, including incidents, users, services, deployments, dependencies, resolutions, and incident events.
5. **pgvector:** The PostgreSQL pgvector extension stores incident embeddings and supports vector similarity queries.

## 3. Request Flow

A typical request follows this flow:

1. A user performs an action in the frontend.
2. The UI sends an HTTP request to a Next.js API route handler.
3. The route handler authenticates the user and validates the request.
4. Application logic executes the required SQL query or invokes the embedding module.
5. PostgreSQL retrieves or updates structured records.
6. For semantic search, pgvector compares stored embeddings using cosine distance.
7. The API returns the result to the frontend.
8. The UI displays the response to the user.

## 4. Architecture Diagram

```text
+-----------------------------+
|       User Interface        |
|       Next.js Frontend      |
+--------------+--------------+
               |
               v
+-----------------------------+
|      API Route Handlers     |
| Authentication / Validation |
+--------------+--------------+
               |
               v
+-----------------------------+
| Application Logic           |
| TypeScript / SQL Queries    |
| Embedding Module            |
+--------------+--------------+
               |
               v
+-----------------------------+
|         PostgreSQL          |
|                             |
| Structured Relational Data  |
|                             |
| +-------------------------+ |
| |       pgvector          | |
| | Incident Embeddings     | |
| | Cosine Similarity       | |
| +-------------------------+ |
+-----------------------------+