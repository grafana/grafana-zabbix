-- Deterministic e2e fixture for the Zabbix data source.
--
-- Creates a self-contained dataset directly in the Zabbix database so e2e tests
-- run against known data instead of organically-generated problems:
--   * a host (e2e-fixture-host) in group "E2E" with two trapper items
--     (unsigned -> history_uint) and one trigger per item,
--   * two OPEN problems: one recent and one deliberately backdated ~30 days,
--   * history_uint rows across the whole window.
--
-- The backdated problem is what makes the issue #2427 history.get window bound
-- observable (without the fix the enrichment query would span ~30 days).
--
-- High, fixed IDs (9_000_00x) avoid collisions with Zabbix's own id allocation.
-- ON CONFLICT DO NOTHING keeps it idempotent. Times are relative to now() so the
-- "recent" / "backdated" problems stay meaningful regardless of when it runs.

BEGIN;

-- host group + host + membership
INSERT INTO hstgrp (groupid, name, type) VALUES (9000001, 'E2E', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts (hostid, host, name, status) VALUES (9000001, 'e2e-fixture-host', 'e2e-fixture-host', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES (9000001, 9000001, 9000001) ON CONFLICT DO NOTHING;

-- trapper items (type 2), unsigned (value_type 3) -> history_uint
INSERT INTO items (itemid, hostid, type, key_, name, value_type, status, delay) VALUES
  (9000001, 9000001, 2, 'e2e.item.0', 'E2E item 0', 3, 0, '0'),
  (9000002, 9000001, 2, 'e2e.item.1', 'E2E item 1', 3, 0, '0')
ON CONFLICT DO NOTHING;
INSERT INTO item_rtdata (itemid, state) VALUES (9000001, 0), (9000002, 0) ON CONFLICT DO NOTHING;

-- triggers in PROBLEM state (value 1), enabled (status 0), High severity (priority 4)
INSERT INTO triggers (triggerid, description, expression, value, status, priority, flags) VALUES
  (9000001, 'E2E problem 0 on {HOST.NAME}', '{9000001}=1', 1, 0, 4, 0),
  (9000002, 'E2E problem 1 on {HOST.NAME}', '{9000002}=1', 1, 0, 4, 0)
ON CONFLICT DO NOTHING;

-- functions link each item to its trigger (trigger expression references the functionid)
INSERT INTO functions (functionid, itemid, triggerid, name, parameter) VALUES
  (9000001, 9000001, 9000001, 'last', '$'),
  (9000002, 9000002, 9000002, 'last', '$')
ON CONFLICT DO NOTHING;

-- open problems: one recent, one backdated ~30 days (source/object 0 = trigger, value 1 = PROBLEM)
INSERT INTO events (eventid, source, object, objectid, clock, value, acknowledged, ns, name, severity) VALUES
  (9000001, 0, 0, 9000001, EXTRACT(EPOCH FROM now())::int - 300,     1, 0, 0, 'E2E problem 0 on e2e-fixture-host', 4),
  (9000002, 0, 0, 9000002, EXTRACT(EPOCH FROM now())::int - 2592000, 1, 0, 0, 'E2E problem 1 on e2e-fixture-host', 4)
ON CONFLICT DO NOTHING;

-- r_eventid NULL => still open
INSERT INTO problem (eventid, source, object, objectid, clock, ns, r_eventid, r_clock, r_ns, name, acknowledged, severity) VALUES
  (9000001, 0, 0, 9000001, EXTRACT(EPOCH FROM now())::int - 300,     0, NULL, 0, 0, 'E2E problem 0 on e2e-fixture-host', 0, 4),
  (9000002, 0, 0, 9000002, EXTRACT(EPOCH FROM now())::int - 2592000, 0, NULL, 0, 0, 'E2E problem 1 on e2e-fixture-host', 0, 4)
ON CONFLICT DO NOTHING;

-- dense-ish history across the whole window (deterministic values)
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT it, gs, (gs % 100), 0
FROM unnest(ARRAY[9000001, 9000002]::bigint[]) AS it
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 2592000 - 3700, EXTRACT(EPOCH FROM now())::int, 600) AS gs
ON CONFLICT DO NOTHING;

COMMIT;
