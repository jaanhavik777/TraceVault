-- =====================================================================
-- Important queries: Q1, Q5, Q11
-- OWNER: Jaanhavi
-- =====================================================================

-- Q1 (JOIN, ORDER BY): active incidents, most severe first
SELECT i.incident_id, i.title, st.status_name, sv.severity_name,
       rep.full_name AS reporter, eng.full_name AS assigned_to, i.created_at
FROM incidents i
JOIN incident_statuses st   ON st.status_id = i.status_id
JOIN incident_severities sv ON sv.severity_id = i.severity_id
JOIN users rep              ON rep.user_id = i.reporter_id
LEFT JOIN users eng         ON eng.user_id = i.assigned_engineer_id
WHERE st.status_name IN ('OPEN', 'INVESTIGATING', 'MITIGATED')
ORDER BY sv.severity_id DESC, i.created_at;

-- Q5 (subquery, NOT EXISTS): unresolved incidents older than 1 day with no assignee
SELECT incident_id, title, created_at
FROM incidents i
WHERE assigned_engineer_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM resolutions r WHERE r.incident_id = i.incident_id)
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';

-- Q11: full timeline of one incident
SELECT e.event_timestamp, e.event_type, e.event_description, u.full_name
FROM incident_events e
LEFT JOIN users u ON u.user_id = e.user_id
WHERE e.incident_id = 1
ORDER BY e.event_timestamp;

