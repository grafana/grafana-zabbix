-- Deterministic e2e fixture reproducing the support escalation where a trigger
-- with "PROBLEM event generation mode = Multiple" opens several problems within
-- the same second. Each problem's Description macro must resolve to the item
-- value that generated THAT problem, not the trigger's single most recent value.
--
-- Three trapper values land in the same clock second (9, 2, 6), each followed
-- shortly after (still within that second) by the problem/event it generated.
-- `ns` is what disambiguates them, since `clock` alone is identical for all three.
--
-- Self-contained and independent of seed.sql / description-macros.sql: its own
-- host group, host, item and trigger, in a separate 9_000_20x id range.
-- Fixtures load in lexicographic order, so this file must not depend on any other.
--
-- ON CONFLICT DO NOTHING keeps it idempotent.

BEGIN;

-- host group + host + membership
INSERT INTO hstgrp (groupid, name, type) VALUES (9000201, 'E2E Multi', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts (hostid, host, name, status) VALUES (9000201, 'e2e-multi-host', 'e2e-multi-host', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES (9000201, 9000201, 9000201) ON CONFLICT DO NOTHING;

-- trapper item (type 2), unsigned (value_type 3) -> history_uint
INSERT INTO items (itemid, hostid, type, key_, name, value_type, status, delay) VALUES
  (9000201, 9000201, 2, 'e2e.multi.item', 'E2E multi item', 3, 0, '0')
ON CONFLICT DO NOTHING;
INSERT INTO item_rtdata (itemid, state) VALUES (9000201, 0) ON CONFLICT DO NOTHING;

-- Trigger in PROBLEM state (value 1), enabled (status 0), High severity (priority 4),
-- "Multiple PROBLEM events" generation mode (type 1). `comments` is the field the
-- Problems panel shows as "Description", matching the customer's own trigger config.
INSERT INTO triggers (triggerid, description, expression, value, status, priority, flags, type, comments) VALUES
  (9000201, 'E2E multi-event trigger', '{9000201}=1', 1, 0, 4, 0, 1,
   'Value received: {ITEM.VALUE} / Last value received: {ITEM.LASTVALUE}')
ON CONFLICT DO NOTHING;

INSERT INTO functions (functionid, itemid, triggerid, name, parameter) VALUES
  (9000201, 9000201, 9000201, 'last', '$')
ON CONFLICT DO NOTHING;

-- Three trapper values landing in the same second, each a bit later than the last.
INSERT INTO history_uint (itemid, clock, value, ns) VALUES
  (9000201, EXTRACT(EPOCH FROM now())::int - 300, 9, 100000000),
  (9000201, EXTRACT(EPOCH FROM now())::int - 300, 2, 250000000),
  (9000201, EXTRACT(EPOCH FROM now())::int - 300, 6, 400000000)
ON CONFLICT DO NOTHING;

-- Three OPEN problems from the same trigger (source/object 0 = trigger, value 1 =
-- PROBLEM), one per trapper value above. Each event's ns lands shortly after the
-- history record that generated it, still within the same clock second.
INSERT INTO events (eventid, source, object, objectid, clock, value, acknowledged, ns, name, severity) VALUES
  (9000201, 0, 0, 9000201, EXTRACT(EPOCH FROM now())::int - 300, 1, 0, 150000000, 'E2E multi-event trigger', 4),
  (9000202, 0, 0, 9000201, EXTRACT(EPOCH FROM now())::int - 300, 1, 0, 300000000, 'E2E multi-event trigger', 4),
  (9000203, 0, 0, 9000201, EXTRACT(EPOCH FROM now())::int - 300, 1, 0, 450000000, 'E2E multi-event trigger', 4)
ON CONFLICT DO NOTHING;

-- r_eventid NULL => still open
INSERT INTO problem (eventid, source, object, objectid, clock, ns, r_eventid, r_clock, r_ns, name, acknowledged, severity) VALUES
  (9000201, 0, 0, 9000201, EXTRACT(EPOCH FROM now())::int - 300, 150000000, NULL, 0, 0, 'E2E multi-event trigger', 0, 4),
  (9000202, 0, 0, 9000201, EXTRACT(EPOCH FROM now())::int - 300, 300000000, NULL, 0, 0, 'E2E multi-event trigger', 0, 4),
  (9000203, 0, 0, 9000201, EXTRACT(EPOCH FROM now())::int - 300, 450000000, NULL, 0, 0, 'E2E multi-event trigger', 0, 4)
ON CONFLICT DO NOTHING;

COMMIT;
