-- =====================================================================
-- Seed incidents, services links, events, resolutions
-- OWNER: Jaanhavi
-- =====================================================================

-- PART 3: SEED INCIDENTS (run after Part 2 so triggers log events)
-- ---------------------------------------------------------------------

INSERT INTO incidents (title, description, status_id, severity_id, reporter_id, assigned_engineer_id, created_at) VALUES
 ('Payment requests failing after release',
  'Payment API returning 500 errors after v4.8.0 deployment. Logs show database connection timeouts.',
  4, 4, 2, 3, '2026-09-10 11:30'),
 ('Checkout failures due to DB resource exhaustion',
  'Checkout requests timing out. Database CPU and connection count at maximum.',
  4, 3, 3, 4, '2026-09-18 18:00'),
 ('Login latency spike',
  'Users report slow login. Auth token issuing taking over 8 seconds.',
  4, 2, 4, 4, '2026-10-02 13:00'),
 ('Payment gateway timeouts',
  'Intermittent timeouts calling the external payment provider.',
  3, 3, 2, 2, '2026-10-15 09:20'),
 ('Notification emails delayed',
  'Order confirmation emails arriving 30+ minutes late.',
  4, 1, 3, 3, '2026-10-20 15:00'),
 ('Payment errors after v4.8.2 release',
  'Spike in payment failures right after the v4.8.2 deployment. Suspect connection pool misconfiguration.',
  2, 4, 2, 3, '2026-10-27 10:15'),
 ('Order creation intermittently failing',
  'Some orders not persisted. Database errors in Order Service logs.',
  1, 3, 4, NULL, '2026-10-28 17:40');

INSERT INTO incident_services (incident_id, service_id, is_primary) VALUES
 (1, 3, TRUE), (1, 2, FALSE), (1, 1, FALSE),
 (2, 1, TRUE), (2, 6, FALSE),
 (3, 5, TRUE), (3, 6, FALSE),
 (4, 4, TRUE), (4, 3, FALSE),
 (5, 7, TRUE),
 (6, 3, TRUE), (6, 2, FALSE),
 (7, 2, TRUE), (7, 6, FALSE);

INSERT INTO incident_deployments (incident_id, deployment_id) VALUES
 (1, 3), (2, 4), (3, 5), (6, 6);

-- Extra investigation events
INSERT INTO incident_events (incident_id, user_id, event_type, event_description, event_timestamp) VALUES
 (1, 3, 'NOTE',     'Database connection pool suspected', '2026-09-10 11:44'),
 (1, 3, 'ROLLBACK', 'Rolled back Payment Service to v4.7.2', '2026-09-10 11:52'),
 (6, 3, 'NOTE',     'Connection errors match incident #1 pattern', '2026-10-27 10:30');

-- Resolutions for resolved incidents (direct insert for seed history)
INSERT INTO resolutions (incident_id, root_cause_category, root_cause_description, resolution_summary, resolved_by, resolved_at) VALUES
 (1, 'DATABASE', 'Database connection pool exhaustion after release v4.8.0 reduced pool size',
     'Rolled back deployment and increased connection pool capacity.', 3, '2026-09-10 13:10'),
 (2, 'DATABASE', 'Slow unindexed query in Order Service saturated database connections',
     'Added missing index and restarted affected pods.', 4, '2026-09-18 20:25'),
 (3, 'CAPACITY', 'Token cache eviction caused repeated database lookups',
     'Increased cache size and TTL.', 4, '2026-10-02 14:30'),
 (5, 'QUEUE', 'Message queue consumer stalled',
     'Restarted consumer and added liveness probe.', 3, '2026-10-20 16:10');

-- ---------------------------------------------------------------------
