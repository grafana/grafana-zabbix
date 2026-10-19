-- Deterministic e2e fixture for trigger Description macro expansion.
--
-- The Problems panel renders the Zabbix trigger `comments` field as
-- "Description". This fixture creates a trigger whose comments hold a literal
-- {ITEM.VALUE} macro plus one open problem, so a test can assert the panel
-- shows the item value and not the raw macro text.
--
-- Self-contained and independent of seed.sql: its own host group, host, item
-- and trigger, in a separate 9_000_10x id range. Fixtures load in lexicographic
-- order, so this file must not depend on any other.
--
-- ON CONFLICT DO NOTHING keeps it idempotent.

BEGIN;

-- host group + host + membership
INSERT INTO hstgrp (groupid, name, type) VALUES (9000101, 'E2E Macros', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts (hostid, host, name, status) VALUES (9000101, 'e2e-macro-host', 'e2e-macro-host', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES (9000101, 9000101, 9000101) ON CONFLICT DO NOTHING;

-- trapper item (type 2), unsigned (value_type 3) -> history_uint
INSERT INTO items (itemid, hostid, type, key_, name, value_type, status, delay) VALUES
  (9000101, 9000101, 2, 'e2e.macro.item', 'E2E macro item', 3, 0, '0')
ON CONFLICT DO NOTHING;
INSERT INTO item_rtdata (itemid, state) VALUES (9000101, 0) ON CONFLICT DO NOTHING;

-- Trigger in PROBLEM state (value 1), enabled (status 0), High severity (priority 4).
-- `comments` is the field the Problems panel shows as "Description".
INSERT INTO triggers (triggerid, description, expression, value, status, priority, flags, comments) VALUES
  (9000101, 'E2E macro trigger', '{9000101}=1', 1, 0, 4, 0, 'Current value: {ITEM.VALUE}')
ON CONFLICT DO NOTHING;

INSERT INTO functions (functionid, itemid, triggerid, name, parameter) VALUES
  (9000101, 9000101, 9000101, 'last', '$')
ON CONFLICT DO NOTHING;

-- one open problem (source/object 0 = trigger, value 1 = PROBLEM)
INSERT INTO events (eventid, source, object, objectid, clock, value, acknowledged, ns, name, severity) VALUES
  (9000101, 0, 0, 9000101, EXTRACT(EPOCH FROM now())::int - 300, 1, 0, 0, 'E2E macro trigger', 4)
ON CONFLICT DO NOTHING;

-- r_eventid NULL => still open
INSERT INTO problem (eventid, source, object, objectid, clock, ns, r_eventid, r_clock, r_ns, name, acknowledged, severity) VALUES
  (9000101, 0, 0, 9000101, EXTRACT(EPOCH FROM now())::int - 300, 0, NULL, 0, 0, 'E2E macro trigger', 0, 4)
ON CONFLICT DO NOTHING;

-- History for the item. A single fixed value keeps the expanded Description
-- deterministic, so the test can assert on the exact rendered string.
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT 9000101, gs, 42, 0
FROM generate_series(EXTRACT(EPOCH FROM now())::int - 3600, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

COMMIT;
