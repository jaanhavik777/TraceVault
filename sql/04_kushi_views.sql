-- =====================================================================
-- Views (service_incident_summary, incident_deployment_correlation)
-- OWNER: Kushi
-- =====================================================================

-- ===== Feature: VIEWS =====

CREATE OR REPLACE VIEW service_incident_summary AS
SELECT s.service_id,
       s.service_name,
       s.criticality,
       COUNT(DISTINCT i.incident_id) AS incident_count,
       COUNT(DISTINCT i.incident_id) FILTER (WHERE sv.severity_name = 'CRITICAL') AS critical_count,
       ROUND(AVG(EXTRACT(EPOCH FROM (r.resolved_at - i.created_at)) / 60)::NUMERIC, 1)
            AS avg_resolution_minutes,
       MAX(i.created_at) AS last_incident
FROM services s
LEFT JOIN incident_services isv ON isv.service_id = s.service_id
LEFT JOIN incidents i           ON i.incident_id = isv.incident_id
LEFT JOIN incident_severities sv ON sv.severity_id = i.severity_id
LEFT JOIN resolutions r         ON r.incident_id = i.incident_id
GROUP BY s.service_id, s.service_name, s.criticality;

-- Incidents that began within 24h after a deployment of the same service
CREATE OR REPLACE VIEW incident_deployment_correlation AS
SELECT i.incident_id,
       i.title,
       s.service_name,
       d.deployment_id,
       d.version,
       d.deployed_at,
       i.created_at AS incident_at,
       ROUND(EXTRACT(EPOCH FROM (i.created_at - d.deployed_at)) / 3600, 1) AS hours_after_deploy
FROM incidents i
JOIN incident_services isv ON isv.incident_id = i.incident_id AND isv.is_primary
JOIN services s            ON s.service_id = isv.service_id
JOIN deployments d         ON d.service_id = s.service_id
                          AND d.deployed_at <= i.created_at
                          AND i.created_at - d.deployed_at <= INTERVAL '24 hours';

-- ---------------------------------------------------------------------
