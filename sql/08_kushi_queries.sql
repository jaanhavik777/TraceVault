-- =====================================================================
-- Important queries: Q2, Q3, Q4, Q6-Q10, Q12
-- OWNER: Kushi
-- =====================================================================

\echo
\echo '=== Q2 (GROUP BY, HAVING, COUNT): services with more than one incident ==='
-- Q2 (GROUP BY, HAVING, COUNT): services with more than one incident
SELECT s.service_name, COUNT(*) AS incident_count
FROM incident_services isv
JOIN services s ON s.service_id = isv.service_id
GROUP BY s.service_name
HAVING COUNT(*) > 1
ORDER BY incident_count DESC;

\echo
\echo '=== Q3 (AVG, MIN, MAX, SUM): resolution time statistics in minutes ==='
-- Q3 (AVG, MIN, MAX, SUM): resolution time statistics in minutes
SELECT COUNT(*) AS resolved_count,
       ROUND(AVG(EXTRACT(EPOCH FROM (r.resolved_at - i.created_at)) / 60)::NUMERIC, 1) AS avg_min,
       ROUND(MIN(EXTRACT(EPOCH FROM (r.resolved_at - i.created_at)) / 60)::NUMERIC, 1) AS min_min,
       ROUND(MAX(EXTRACT(EPOCH FROM (r.resolved_at - i.created_at)) / 60)::NUMERIC, 1) AS max_min,
       ROUND(SUM(EXTRACT(EPOCH FROM (r.resolved_at - i.created_at)) / 60)::NUMERIC, 1) AS total_min
FROM resolutions r
JOIN incidents i ON i.incident_id = r.incident_id;

\echo
\echo '=== Q4 (subquery): services with more incidents than the average service ==='
-- Q4 (subquery): services with more incidents than the average service
SELECT service_name, incident_count
FROM service_incident_summary
WHERE incident_count > (SELECT AVG(incident_count) FROM service_incident_summary)
ORDER BY incident_count DESC;

\echo
\echo '=== Q6 (recursive CTE): every service impacted if a given service fails ==='
-- Q6 (recursive CTE): every service impacted if a given service fails
-- (all services that directly or transitively depend on 'Database Cluster')
WITH RECURSIVE impacted AS (
    SELECT sd.service_id, 1 AS depth
    FROM service_dependencies sd
    JOIN services s ON s.service_id = sd.depends_on_service_id
    WHERE s.service_name = 'Database Cluster'
    UNION
    SELECT sd.service_id, im.depth + 1
    FROM service_dependencies sd
    JOIN impacted im ON sd.depends_on_service_id = im.service_id
)
SELECT s.service_name, MIN(im.depth) AS hops_from_failure
FROM impacted im
JOIN services s ON s.service_id = im.service_id
GROUP BY s.service_name
ORDER BY hops_from_failure, s.service_name;

\echo
\echo '=== Q7: downstream dependencies for a given service (what Payment relies on) ==='
-- Q7: downstream dependencies for a given service (what Payment relies on)
SELECT s1.service_name AS service, s2.service_name AS depends_on
FROM service_dependencies sd
JOIN services s1 ON s1.service_id = sd.service_id
JOIN services s2 ON s2.service_id = sd.depends_on_service_id
WHERE s1.service_name = 'Payment Service';

\echo
\echo '=== Q8: incidents occurring shortly after deployments (uses the view) ==='
-- Q8: incidents occurring shortly after deployments (uses the view)
SELECT * FROM incident_deployment_correlation ORDER BY hours_after_deploy;

\echo
\echo '=== Q9 (GROUP BY on date): weekly incident trend ==='
-- Q9 (GROUP BY on date): weekly incident trend
SELECT DATE_TRUNC('week', created_at)::DATE AS week_start, COUNT(*) AS incidents
FROM incidents
GROUP BY week_start
ORDER BY week_start;

\echo
\echo '=== Q10: dashboard KPIs ==='
-- Q10: dashboard KPIs
SELECT
  (SELECT COUNT(*) FROM incidents i JOIN incident_statuses s USING (status_id)
    WHERE s.status_name IN ('OPEN','INVESTIGATING','MITIGATED')) AS open_incidents,
  (SELECT COUNT(*) FROM incidents i JOIN incident_severities v USING (severity_id)
    WHERE v.severity_name = 'CRITICAL') AS critical_incidents,
  (SELECT COUNT(*) FROM resolutions) AS resolved_incidents;

\echo
\echo '=== Q12: service summary view ==='
-- Q12: service summary view
SELECT * FROM service_incident_summary ORDER BY incident_count DESC;

-- ---------------------------------------------------------------------
