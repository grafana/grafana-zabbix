-- Tags for the seeded e2e problems (see seed.sql), used by the problem tag
-- filter e2e tests (problemsTagFilter.spec.ts):
--   * problem 9000001 (recent):    environment:production, service:web
--   * problem 9000002 (backdated): environment:staging
--
-- problem_tag serves problem.get, event_tag serves event.get. High, fixed IDs
-- (9_000_00x) and ON CONFLICT DO NOTHING keep it collision-free and idempotent.

BEGIN;

INSERT INTO problem_tag (problemtagid, eventid, tag, value) VALUES
  (9000001, 9000001, 'environment', 'production'),
  (9000002, 9000001, 'service', 'web'),
  (9000003, 9000002, 'environment', 'staging')
ON CONFLICT DO NOTHING;

INSERT INTO event_tag (eventtagid, eventid, tag, value) VALUES
  (9000001, 9000001, 'environment', 'production'),
  (9000002, 9000001, 'service', 'web'),
  (9000003, 9000002, 'environment', 'staging')
ON CONFLICT DO NOTHING;

COMMIT;
