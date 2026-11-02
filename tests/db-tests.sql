-- =====================================================================
-- TraceVault database tests (constraints, triggers, functions, views, indexes, vector column)
-- Runs inside ONE transaction that is rolled back at the end, so it leaves no data behind.
-- Expects the freshly seeded database (npm run db:setup). Machine-readable rows start with "T-DB-".
-- Human run:   docker exec -i tracevault-db psql -U tracevault -d tracevault < tests/db-tests.sql
-- =====================================================================
\set QUIET on
BEGIN;
CREATE TEMP TABLE t_results (id text, description text, expected text, actual text, result text);
CREATE TEMP TABLE t_snap (c bigint);
\o /dev/null

-- run a statement that MUST fail with the given SQLSTATE
CREATE FUNCTION pg_temp.expect_error(p_id text, p_desc text, p_sql text, p_state text) RETURNS void AS $$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    INSERT INTO t_results VALUES (p_id, p_desc, 'error ' || p_state, 'no error', 'FAIL');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    INSERT INTO t_results VALUES (p_id, p_desc, 'error ' || p_state,
      v_state || ': ' || replace(left(v_msg, 70), '|', '/'), CASE WHEN v_state = p_state THEN 'PASS' ELSE 'FAIL' END);
  END;
END $$ LANGUAGE plpgsql;

-- compare an actual value with an expected one
CREATE FUNCTION pg_temp.expect_value(p_id text, p_desc text, p_expected text, p_actual text) RETURNS void AS $$
BEGIN
  INSERT INTO t_results VALUES (p_id, p_desc, p_expected, p_actual,
    CASE WHEN p_expected IS NOT DISTINCT FROM p_actual THEN 'PASS' ELSE 'FAIL' END);
END $$ LANGUAGE plpgsql;

-- ---------- structure ----------
SELECT pg_temp.expect_value('T-DB-01', 'schema has 14 tables', '14',
  (SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'));
SELECT pg_temp.expect_value('T-DB-02', 'two roles exist: ADMIN and ENGINEER', 'ADMIN,ENGINEER',
  (SELECT string_agg(role_name, ',' ORDER BY role_name) FROM roles));
SELECT pg_temp.expect_value('T-DB-03', 'pgvector extension is installed', 'vector',
  (SELECT extname FROM pg_extension WHERE extname = 'vector'));
SELECT pg_temp.expect_value('T-DB-04', 'at least 8 b-tree indexes (idx_*) exist', 'true',
  (SELECT (count(*) >= 8)::text FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx\_%'));
SELECT pg_temp.expect_value('T-DB-05', 'embedding column is VECTOR(768)', 'vector(768)',
  (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
    WHERE a.attrelid = 'incident_embeddings'::regclass AND a.attname = 'embedding'));

-- ---------- views (on untouched seed data) ----------
SELECT pg_temp.expect_value('T-DB-06', 'service_incident_summary has one row per service (7)', '7',
  (SELECT count(*)::text FROM service_incident_summary));
SELECT pg_temp.expect_value('T-DB-07', 'Payment Service: 3 incidents, 2 critical', '3/2',
  (SELECT incident_count || '/' || critical_count FROM service_incident_summary WHERE service_name = 'Payment Service'));
SELECT pg_temp.expect_value('T-DB-08', 'deployment correlation links incident 6 to Payment v4.8.2', 'v4.8.2',
  (SELECT version FROM incident_deployment_correlation WHERE incident_id = 6));

-- ---------- constraints ----------
SELECT pg_temp.expect_error('T-DB-09', 'NOT NULL: incident without a title is rejected',
  $q$INSERT INTO incidents (title, description, status_id, severity_id, reporter_id) VALUES (NULL, 'd', 1, 1, 2)$q$, '23502');
SELECT pg_temp.expect_error('T-DB-10', 'CHECK: service criticality must be LOW/MEDIUM/HIGH/CRITICAL',
  $q$INSERT INTO services (service_name, criticality, service_status) VALUES ('X', 'URGENT', 'ACTIVE')$q$, '23514');
SELECT pg_temp.expect_error('T-DB-11', 'CHECK: priority_score above 100 is rejected',
  $q$UPDATE incidents SET priority_score = 150 WHERE incident_id = 1$q$, '23514');
SELECT pg_temp.expect_error('T-DB-12', 'CHECK: deployment status must be SUCCESS/FAILED/ROLLED_BACK',
  $q$INSERT INTO deployments (service_id, version, environment, deployment_status) VALUES (3, 'v9', 'prod', 'BROKEN')$q$, '23514');
SELECT pg_temp.expect_error('T-DB-13', 'CHECK: a service cannot depend on itself',
  $q$INSERT INTO service_dependencies (service_id, depends_on_service_id) VALUES (1, 1)$q$, '23514');
SELECT pg_temp.expect_error('T-DB-14', 'UNIQUE: duplicate service dependency is rejected',
  $q$INSERT INTO service_dependencies (service_id, depends_on_service_id) VALUES (1, 2)$q$, '23505');
SELECT pg_temp.expect_error('T-DB-15', 'UNIQUE: duplicate user email is rejected',
  $q$INSERT INTO users (role_id, full_name, email, password_hash) VALUES (2, 'Dup', 'admin@tracevault.io', 'x')$q$, '23505');
SELECT pg_temp.expect_error('T-DB-16', 'UNIQUE: only one resolution per incident',
  $q$INSERT INTO resolutions (incident_id, root_cause_category, root_cause_description, resolution_summary) VALUES (1, 'X', 'x', 'x')$q$, '23505');
SELECT pg_temp.expect_error('T-DB-17', 'FOREIGN KEY: incident with unknown severity is rejected',
  $q$INSERT INTO incidents (title, description, status_id, severity_id, reporter_id) VALUES ('t', 'd', 1, 99, 2)$q$, '23503');

-- ---------- vector column ----------
INSERT INTO incident_embeddings (incident_id, source_text, embedding, embedding_model)
VALUES (1, 'test', array_fill(0.1::real, ARRAY[768])::vector, 'test');
SELECT pg_temp.expect_error('T-DB-18', 'UNIQUE: one embedding per incident',
  $q$INSERT INTO incident_embeddings (incident_id, source_text, embedding, embedding_model) VALUES (1, 't', array_fill(0.2::real, ARRAY[768])::vector, 'test')$q$, '23505');
SELECT pg_temp.expect_error('T-DB-19', 'VECTOR(768): a vector with the wrong number of dimensions is rejected',
  $q$INSERT INTO incident_embeddings (incident_id, source_text, embedding, embedding_model) VALUES (2, 't', '[1,2,3]'::vector, 'test')$q$, '22000');
SELECT pg_temp.expect_value('T-DB-20', 'cosine distance of a vector with itself is 0', '0.000000',
  (SELECT round((embedding <=> embedding)::numeric, 6)::text FROM incident_embeddings WHERE incident_id = 1));

-- ---------- triggers ----------
INSERT INTO incidents (title, description, status_id, severity_id, reporter_id) VALUES ('Trigger test incident', 'd', 1, 1, 2);
SELECT pg_temp.expect_value('T-DB-21', 'trigger: a new incident automatically gets a CREATED timeline event', '1',
  (SELECT count(*)::text FROM incident_events WHERE incident_id = currval('incidents_incident_id_seq') AND event_type = 'CREATED'));
UPDATE incidents SET status_id = 2 WHERE incident_id = currval('incidents_incident_id_seq');
SELECT pg_temp.expect_value('T-DB-22', 'trigger: a status change writes a STATUS_CHANGE event', 'Status changed from OPEN to INVESTIGATING',
  (SELECT event_description FROM incident_events WHERE incident_id = currval('incidents_incident_id_seq') AND event_type = 'STATUS_CHANGE'));
SELECT pg_temp.expect_value('T-DB-23', 'trigger: a status change writes an audit_logs row', '1',
  (SELECT count(*)::text FROM audit_logs WHERE entity_name = 'incidents' AND entity_id = currval('incidents_incident_id_seq') AND action = 'STATUS_CHANGE'));
SELECT pg_temp.expect_value('T-DB-24', 'trigger: updated_at moves forward on update', 'true',
  (SELECT (updated_at >= created_at)::text FROM incidents WHERE incident_id = currval('incidents_incident_id_seq')));

-- ---------- stored functions + atomicity ----------
INSERT INTO t_snap SELECT count(*) FROM incident_events WHERE incident_id = 7;
SELECT pg_temp.expect_error('T-DB-25', 'function: assign_incident rejects a user who is not an engineer',
  $q$SELECT assign_incident(7, 1, 1)$q$, 'P0001');
SELECT pg_temp.expect_value('T-DB-26', 'atomicity: the failed assignment changed nothing (no assignee, same event count)', 'null/' || (SELECT c FROM t_snap),
  (SELECT coalesce(assigned_engineer_id::text, 'null') || '/' || (SELECT count(*) FROM incident_events WHERE incident_id = 7) FROM incidents WHERE incident_id = 7));
SELECT assign_incident(7, 4, 1);
SELECT pg_temp.expect_value('T-DB-27', 'function: assign_incident assigns the engineer and moves OPEN to INVESTIGATING', '4/INVESTIGATING',
  (SELECT i.assigned_engineer_id || '/' || s.status_name FROM incidents i JOIN incident_statuses s ON s.status_id = i.status_id WHERE i.incident_id = 7));
SELECT pg_temp.expect_value('T-DB-28', 'function: assign_incident writes ASSIGNED event and audit row', '1/1',
  (SELECT (SELECT count(*) FROM incident_events WHERE incident_id = 7 AND event_type = 'ASSIGNED') || '/' ||
          (SELECT count(*) FROM audit_logs WHERE entity_id = 7 AND action = 'ASSIGN')));
SELECT resolve_incident(7, 4, 'DATABASE', 'Test cause', 'Test fix');
SELECT pg_temp.expect_value('T-DB-29', 'function: resolve_incident stores the resolution and sets status RESOLVED', 'RESOLVED/1',
  (SELECT s.status_name || '/' || (SELECT count(*) FROM resolutions WHERE incident_id = 7) FROM incidents i JOIN incident_statuses s ON s.status_id = i.status_id WHERE i.incident_id = 7));

-- ---------- cascade ----------
DELETE FROM incidents WHERE incident_id = 7;
SELECT pg_temp.expect_value('T-DB-30', 'ON DELETE CASCADE removes the incident''s events, service links and resolution', '0/0/0',
  (SELECT (SELECT count(*) FROM incident_events WHERE incident_id = 7) || '/' ||
          (SELECT count(*) FROM incident_services WHERE incident_id = 7) || '/' ||
          (SELECT count(*) FROM resolutions WHERE incident_id = 7)));

\o
\set QUIET off
SELECT id, description, expected, actual, result FROM t_results ORDER BY id;
SELECT count(*) FILTER (WHERE result = 'PASS') || ' passed, ' || count(*) FILTER (WHERE result <> 'PASS') || ' failed' AS summary FROM t_results;
ROLLBACK;
