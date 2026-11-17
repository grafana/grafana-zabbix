-- Deterministic e2e fixture for host tag filtering in metrics queries.
--
-- Self-contained and independent of other fixtures: creates its own host group,
-- two hosts sharing an item name (one tagged environment:production, one untagged),
-- and history_uint data, in a separate 9_000_20x id range.
--
-- Lexicographic loading order: this file runs before seed.sql, so it must not
-- depend on any other fixture.
--
-- ON CONFLICT DO NOTHING keeps it idempotent.

BEGIN;

-- host group + hosts + membership
INSERT INTO hstgrp (groupid, name, type) VALUES (9000201, 'E2E Host Tags', 0) ON CONFLICT DO NOTHING;

INSERT INTO hosts (hostid, host, name, status) VALUES
  (9000201, 'e2e-tagged-host', 'e2e-tagged-host', 0),
  (9000202, 'e2e-untagged-host', 'e2e-untagged-host', 0)
ON CONFLICT DO NOTHING;

INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES
  (9000201, 9000201, 9000201),
  (9000202, 9000202, 9000201)
ON CONFLICT DO NOTHING;

-- tag only on host 9000201
INSERT INTO host_tag (hosttagid, hostid, tag, value) VALUES
  (9000201, 9000201, 'environment', 'production')
ON CONFLICT DO NOTHING;

-- identical item on both hosts
INSERT INTO items (itemid, hostid, type, key_, name, value_type, status, delay) VALUES
  (9000201, 9000201, 2, 'e2e.host.tag.item', 'E2E host tag item', 3, 0, '0'),
  (9000202, 9000202, 2, 'e2e.host.tag.item', 'E2E host tag item', 3, 0, '0')
ON CONFLICT DO NOTHING;

INSERT INTO item_rtdata (itemid, state) VALUES
  (9000201, 0),
  (9000202, 0)
ON CONFLICT DO NOTHING;

-- history for both items across 30 days
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT it, gs, 42, 0
FROM unnest(ARRAY[9000201, 9000202]::bigint[]) AS it
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 2592000, EXTRACT(EPOCH FROM now())::int, 600) AS gs
ON CONFLICT DO NOTHING;

COMMIT;
