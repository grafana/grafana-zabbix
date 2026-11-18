-- Deterministic e2e fixture for the Multi-metric Table query type.
--
-- Creates a self-contained dataset in the Zabbix database covering every row
-- mode and column type the query type supports. Id range 9_000_3xx (seed.sql
-- uses 9_000_00x, description-macros.sql 9_000_10x, host-tag.sql 9_000_20x). Fixtures load in
-- lexicographic order and this file depends on none of the others.
--
-- Host group "E2E Multi-metric" with three hosts:
--   * e2e-mm-router-a: LLD-style interface items for eth0(WAN), eth1(LAN),
--     eth2(DMZ) plus host-level CPU / Memory / Uptime / OS items and a
--     "Process zabbix_server: CPU utilization" item (a substring trap: an exact
--     "CPU utilization" pattern must NOT match it).
--   * e2e-mm-router-b: interface items for eth0(WAN), eth1(LAN); the eth1 Speed
--     item exists but never received a value (null cell in Item pattern mode).
--   * e2e-mm-vm-c: host-level items only (no interfaces), plus a "Swap
--     utilization" item that never received a value (null cell in Hosts mode:
--     Zabbix reports lastvalue "0" / lastclock 0 for such items).
--
-- Interface item names follow the Zabbix network template convention
-- "Interface <ifname>(<ifalias>): <metric>", keys "net.if.<metric>[<ifname>]",
-- so both name-based and key-based extraction can be exercised. eth2(DMZ) is
-- down: status 0 and 0 bps, a genuine zero that must render as 0, not null.
--
-- Value types: 3 (unsigned) -> history_uint, 0 (float) -> history,
-- 1 (character) -> history_str. Zabbix 7.0 derives item.get lastvalue /
-- lastclock from these tables, so no item_rtdata values are needed.
--
-- History covers the last 7 days at one sample every 5 minutes (text items
-- hourly), relative to now(). History rows for this id range are deleted and
-- re-inserted so re-loading keeps the dataset deterministic; the dimension
-- tables use ON CONFLICT DO NOTHING. The datasource switches to trends for
-- ranges older than 7d / wider than 4d, and no trends are seeded: keep panels
-- within the last few hours.

BEGIN;

-- host group + hosts + membership
INSERT INTO hstgrp (groupid, name, type) VALUES (9000301, 'E2E Multi-metric', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts (hostid, host, name, status) VALUES
  (9000301, 'e2e-mm-router-a', 'e2e-mm-router-a', 0),
  (9000302, 'e2e-mm-router-b', 'e2e-mm-router-b', 0),
  (9000303, 'e2e-mm-vm-c',     'e2e-mm-vm-c',     0)
ON CONFLICT DO NOTHING;
INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES
  (9000301, 9000301, 9000301),
  (9000302, 9000302, 9000301),
  (9000303, 9000303, 9000301)
ON CONFLICT DO NOTHING;

-- trapper items (type 2)
INSERT INTO items (itemid, hostid, type, key_, name, value_type, status, delay, units) VALUES
  -- router-a eth0(WAN)
  (9000311, 9000301, 2, 'net.if.in[eth0]',     'Interface eth0(WAN): Bits received',      3, 0, '0', 'bps'),
  (9000312, 9000301, 2, 'net.if.out[eth0]',    'Interface eth0(WAN): Bits sent',          3, 0, '0', 'bps'),
  (9000313, 9000301, 2, 'net.if.status[eth0]', 'Interface eth0(WAN): Operational status', 3, 0, '0', ''),
  (9000314, 9000301, 2, 'net.if.speed[eth0]',  'Interface eth0(WAN): Speed',              3, 0, '0', 'bps'),
  (9000315, 9000301, 2, 'net.if.descr[eth0]',  'Interface eth0(WAN): Description',        1, 0, '0', ''),
  -- router-a eth1(LAN)
  (9000321, 9000301, 2, 'net.if.in[eth1]',     'Interface eth1(LAN): Bits received',      3, 0, '0', 'bps'),
  (9000322, 9000301, 2, 'net.if.out[eth1]',    'Interface eth1(LAN): Bits sent',          3, 0, '0', 'bps'),
  (9000323, 9000301, 2, 'net.if.status[eth1]', 'Interface eth1(LAN): Operational status', 3, 0, '0', ''),
  (9000324, 9000301, 2, 'net.if.speed[eth1]',  'Interface eth1(LAN): Speed',              3, 0, '0', 'bps'),
  (9000325, 9000301, 2, 'net.if.descr[eth1]',  'Interface eth1(LAN): Description',        1, 0, '0', ''),
  -- router-a eth2(DMZ): interface is down (status 0, 0 bps)
  (9000331, 9000301, 2, 'net.if.in[eth2]',     'Interface eth2(DMZ): Bits received',      3, 0, '0', 'bps'),
  (9000332, 9000301, 2, 'net.if.out[eth2]',    'Interface eth2(DMZ): Bits sent',          3, 0, '0', 'bps'),
  (9000333, 9000301, 2, 'net.if.status[eth2]', 'Interface eth2(DMZ): Operational status', 3, 0, '0', ''),
  (9000334, 9000301, 2, 'net.if.speed[eth2]',  'Interface eth2(DMZ): Speed',              3, 0, '0', 'bps'),
  (9000335, 9000301, 2, 'net.if.descr[eth2]',  'Interface eth2(DMZ): Description',        1, 0, '0', ''),
  -- router-b eth0(WAN)
  (9000341, 9000302, 2, 'net.if.in[eth0]',     'Interface eth0(WAN): Bits received',      3, 0, '0', 'bps'),
  (9000342, 9000302, 2, 'net.if.out[eth0]',    'Interface eth0(WAN): Bits sent',          3, 0, '0', 'bps'),
  (9000343, 9000302, 2, 'net.if.status[eth0]', 'Interface eth0(WAN): Operational status', 3, 0, '0', ''),
  (9000344, 9000302, 2, 'net.if.speed[eth0]',  'Interface eth0(WAN): Speed',              3, 0, '0', 'bps'),
  (9000345, 9000302, 2, 'net.if.descr[eth0]',  'Interface eth0(WAN): Description',        1, 0, '0', ''),
  -- router-b eth1(LAN): Speed (9000354) never receives a value
  (9000351, 9000302, 2, 'net.if.in[eth1]',     'Interface eth1(LAN): Bits received',      3, 0, '0', 'bps'),
  (9000352, 9000302, 2, 'net.if.out[eth1]',    'Interface eth1(LAN): Bits sent',          3, 0, '0', 'bps'),
  (9000353, 9000302, 2, 'net.if.status[eth1]', 'Interface eth1(LAN): Operational status', 3, 0, '0', ''),
  (9000354, 9000302, 2, 'net.if.speed[eth1]',  'Interface eth1(LAN): Speed',              3, 0, '0', 'bps'),
  (9000355, 9000302, 2, 'net.if.descr[eth1]',  'Interface eth1(LAN): Description',        1, 0, '0', ''),
  -- host-level items: router-a (incl. the substring trap)
  (9000361, 9000301, 2, 'system.cpu.util',              'CPU utilization',                        0, 0, '0', '%'),
  (9000362, 9000301, 2, 'vm.memory.util',               'Memory utilization',                     0, 0, '0', '%'),
  (9000363, 9000301, 2, 'system.uptime',                'Uptime',                                 3, 0, '0', 'uptime'),
  (9000364, 9000301, 2, 'system.sw.os',                 'OS name',                                1, 0, '0', ''),
  (9000365, 9000301, 2, 'proc.cpu.util[zabbix_server]', 'Process zabbix_server: CPU utilization', 0, 0, '0', '%'),
  -- host-level items: router-b
  (9000371, 9000302, 2, 'system.cpu.util', 'CPU utilization',    0, 0, '0', '%'),
  (9000372, 9000302, 2, 'vm.memory.util',  'Memory utilization', 0, 0, '0', '%'),
  (9000373, 9000302, 2, 'system.uptime',   'Uptime',             3, 0, '0', 'uptime'),
  (9000374, 9000302, 2, 'system.sw.os',    'OS name',            1, 0, '0', ''),
  -- host-level items: vm-c (no interfaces); Swap utilization (9000385) never receives a value
  (9000381, 9000303, 2, 'system.cpu.util',  'CPU utilization',    0, 0, '0', '%'),
  (9000382, 9000303, 2, 'vm.memory.util',   'Memory utilization', 0, 0, '0', '%'),
  (9000383, 9000303, 2, 'system.uptime',    'Uptime',             3, 0, '0', 'uptime'),
  (9000384, 9000303, 2, 'system.sw.os',     'OS name',            1, 0, '0', ''),
  (9000385, 9000303, 2, 'system.swap.util', 'Swap utilization',   0, 0, '0', '%')
ON CONFLICT DO NOTHING;

INSERT INTO item_rtdata (itemid, state)
SELECT itemid, 0 FROM items WHERE itemid BETWEEN 9000301 AND 9000399
ON CONFLICT DO NOTHING;

-- item tags: interface items carry component:network + interface:<ifname>,
-- host-level items carry component:<cpu|memory|os|system>
INSERT INTO item_tag (itemtagid, itemid, tag, value)
SELECT 9000300 + row_number() OVER (ORDER BY t.itemid, t.tag), t.itemid, t.tag, t.value
FROM (
  SELECT itemid, 'component' AS tag, 'network' AS value
    FROM items WHERE itemid BETWEEN 9000311 AND 9000355
  UNION ALL
  SELECT itemid, 'interface', substring(key_ from '\[(.*)\]')
    FROM items WHERE itemid BETWEEN 9000311 AND 9000355
  UNION ALL
  SELECT itemid, 'component',
         CASE WHEN key_ LIKE 'system.cpu%' OR key_ LIKE 'proc.cpu%' THEN 'cpu'
              WHEN key_ LIKE 'vm.memory%'  OR key_ LIKE 'system.swap%' THEN 'memory'
              WHEN key_ = 'system.sw.os' THEN 'os'
              ELSE 'system' END
    FROM items WHERE itemid BETWEEN 9000361 AND 9000399
) AS t
ON CONFLICT DO NOTHING;

-- history: 7 days, one sample every 5 minutes, relative to now()
DELETE FROM history      WHERE itemid BETWEEN 9000301 AND 9000399;
DELETE FROM history_uint WHERE itemid BETWEEN 9000301 AND 9000399;
DELETE FROM history_str  WHERE itemid BETWEEN 9000301 AND 9000399;

-- interface counters (bps): base + sawtooth over 60 samples; eth2(DMZ) is a genuine constant 0.
-- The sawtooth phase is counted back from the newest sample (not taken from the absolute clock),
-- so the newest value, which is what the "last" aggregation returns, is always exactly `base`
-- no matter when the fixture is loaded.
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT s.itemid, gs, s.base + ((EXTRACT(EPOCH FROM now())::int - gs) / 300 % 60) * s.step, 0
FROM (VALUES
  (9000311, 5000000, 50000), (9000312, 2000000, 20000),
  (9000321, 1000000, 10000), (9000322,  800000,  8000),
  (9000331,       0,     0), (9000332,       0,     0),
  (9000341, 4000000, 40000), (9000342, 1500000, 15000),
  (9000351,  900000,  9000), (9000352,  700000,  7000)
) AS s(itemid, base, step)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- operational status (1 up, eth2 down) and link speed; 9000354 (router-b eth1 Speed) has no history on purpose
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT s.itemid, gs, s.value, 0
FROM (VALUES
  (9000313, 1), (9000323, 1), (9000333, 0), (9000343, 1), (9000353, 1),
  (9000314, 1000000000), (9000324, 1000000000), (9000334, 100000000), (9000344, 1000000000)
) AS s(itemid, value)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- uptime: seconds since a boot ~30 days ago, strictly increasing
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT it, gs, gs - (EXTRACT(EPOCH FROM now())::int - 2592000), 0
FROM unnest(ARRAY[9000363, 9000373, 9000383]::bigint[]) AS it
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- float utilization (%): base + sawtooth (newest value = base, see above); 9000385 (vm-c Swap
-- utilization) has no history on purpose
INSERT INTO history (itemid, clock, value, ns)
SELECT s.itemid, gs, (s.base + ((EXTRACT(EPOCH FROM now())::int - gs) / 300 % s.period) * s.step)::double precision, 0
FROM (VALUES
  (9000361, 10.0, 1.0,  40),
  (9000362, 40.0, 0.5,  20),
  (9000365,  2.5, 0.0,   1),
  (9000371, 30.0, 0.5,  20),
  (9000372, 55.0, 0.25, 20),
  (9000381, 60.0, 1.0,  10),
  (9000382, 75.0, 0.5,  10)
) AS s(itemid, base, step, period)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- character items (interface descriptions, OS names): hourly, constant values
INSERT INTO history_str (itemid, clock, value, ns)
SELECT s.itemid, gs, s.value, 0
FROM (VALUES
  (9000315, 'Uplink to ISP'), (9000325, 'Office LAN'), (9000335, 'DMZ segment'),
  (9000345, 'Uplink to ISP (backup)'), (9000355, 'Office LAN'),
  (9000364, 'Linux 6.8.0 router-a'), (9000374, 'Linux 6.8.0 router-b'), (9000384, 'Ubuntu 24.04 LTS')
) AS s(itemid, value)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 3600) AS gs
ON CONFLICT DO NOTHING;

COMMIT;
