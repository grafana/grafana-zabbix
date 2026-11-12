-- Host tags for the seeded e2e host (see seed.sql), used by host tag filtering e2e tests:
--   * host 9000001 (e2e-fixture-host): environment:production, service:web
--
-- High, fixed IDs (9_000_00x) and ON CONFLICT DO NOTHING keep it collision-free and idempotent.

BEGIN;

INSERT INTO host_tag (hosttagid, hostid, tag, value) VALUES
  (9000001, 9000001, 'environment', 'production'),
  (9000002, 9000001, 'service', 'web')
ON CONFLICT DO NOTHING;

COMMIT;
