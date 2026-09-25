-- Deterministic e2e fixture for the Multi-metric Table query type.
--
-- Creates a self-contained dataset in the Zabbix database covering every row
-- mode and column type the query type supports. Id range 9_000_2xx (seed.sql
-- uses 9_000_00x, description-macros.sql 9_000_10x). Fixtures load in
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
INSERT INTO hstgrp (groupid, name, type) VALUES (9000201, 'E2E Multi-metric', 0) ON CONFLICT DO NOTHING;
INSERT INTO hosts (hostid, host, name, status) VALUES
  (9000201, 'e2e-mm-router-a', 'e2e-mm-router-a', 0),
  (9000202, 'e2e-mm-router-b', 'e2e-mm-router-b', 0),
  (9000203, 'e2e-mm-vm-c',     'e2e-mm-vm-c',     0)
ON CONFLICT DO NOTHING;
INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES
  (9000201, 9000201, 9000201),
  (9000202, 9000202, 9000201),
  (9000203, 9000203, 9000201)
ON CONFLICT DO NOTHING;

-- trapper items (type 2)
INSERT INTO items (itemid, hostid, type, key_, name, value_type, status, delay, units) VALUES
  -- router-a eth0(WAN)
  (9000211, 9000201, 2, 'net.if.in[eth0]',     'Interface eth0(WAN): Bits received',      3, 0, '0', 'bps'),
  (9000212, 9000201, 2, 'net.if.out[eth0]',    'Interface eth0(WAN): Bits sent',          3, 0, '0', 'bps'),
  (9000213, 9000201, 2, 'net.if.status[eth0]', 'Interface eth0(WAN): Operational status', 3, 0, '0', ''),
  (9000214, 9000201, 2, 'net.if.speed[eth0]',  'Interface eth0(WAN): Speed',              3, 0, '0', 'bps'),
  (9000215, 9000201, 2, 'net.if.descr[eth0]',  'Interface eth0(WAN): Description',        1, 0, '0', ''),
  -- router-a eth1(LAN)
  (9000221, 9000201, 2, 'net.if.in[eth1]',     'Interface eth1(LAN): Bits received',      3, 0, '0', 'bps'),
  (9000222, 9000201, 2, 'net.if.out[eth1]',    'Interface eth1(LAN): Bits sent',          3, 0, '0', 'bps'),
  (9000223, 9000201, 2, 'net.if.status[eth1]', 'Interface eth1(LAN): Operational status', 3, 0, '0', ''),
  (9000224, 9000201, 2, 'net.if.speed[eth1]',  'Interface eth1(LAN): Speed',              3, 0, '0', 'bps'),
  (9000225, 9000201, 2, 'net.if.descr[eth1]',  'Interface eth1(LAN): Description',        1, 0, '0', ''),
  -- router-a eth2(DMZ): interface is down (status 0, 0 bps)
  (9000231, 9000201, 2, 'net.if.in[eth2]',     'Interface eth2(DMZ): Bits received',      3, 0, '0', 'bps'),
  (9000232, 9000201, 2, 'net.if.out[eth2]',    'Interface eth2(DMZ): Bits sent',          3, 0, '0', 'bps'),
  (9000233, 9000201, 2, 'net.if.status[eth2]', 'Interface eth2(DMZ): Operational status', 3, 0, '0', ''),
  (9000234, 9000201, 2, 'net.if.speed[eth2]',  'Interface eth2(DMZ): Speed',              3, 0, '0', 'bps'),
  (9000235, 9000201, 2, 'net.if.descr[eth2]',  'Interface eth2(DMZ): Description',        1, 0, '0', ''),
  -- router-b eth0(WAN)
  (9000241, 9000202, 2, 'net.if.in[eth0]',     'Interface eth0(WAN): Bits received',      3, 0, '0', 'bps'),
  (9000242, 9000202, 2, 'net.if.out[eth0]',    'Interface eth0(WAN): Bits sent',          3, 0, '0', 'bps'),
  (9000243, 9000202, 2, 'net.if.status[eth0]', 'Interface eth0(WAN): Operational status', 3, 0, '0', ''),
  (9000244, 9000202, 2, 'net.if.speed[eth0]',  'Interface eth0(WAN): Speed',              3, 0, '0', 'bps'),
  (9000245, 9000202, 2, 'net.if.descr[eth0]',  'Interface eth0(WAN): Description',        1, 0, '0', ''),
  -- router-b eth1(LAN): Speed (9000254) never receives a value
  (9000251, 9000202, 2, 'net.if.in[eth1]',     'Interface eth1(LAN): Bits received',      3, 0, '0', 'bps'),
  (9000252, 9000202, 2, 'net.if.out[eth1]',    'Interface eth1(LAN): Bits sent',          3, 0, '0', 'bps'),
  (9000253, 9000202, 2, 'net.if.status[eth1]', 'Interface eth1(LAN): Operational status', 3, 0, '0', ''),
  (9000254, 9000202, 2, 'net.if.speed[eth1]',  'Interface eth1(LAN): Speed',              3, 0, '0', 'bps'),
  (9000255, 9000202, 2, 'net.if.descr[eth1]',  'Interface eth1(LAN): Description',        1, 0, '0', ''),
  -- host-level items: router-a (incl. the substring trap)
  (9000261, 9000201, 2, 'system.cpu.util',              'CPU utilization',                        0, 0, '0', '%'),
  (9000262, 9000201, 2, 'vm.memory.util',               'Memory utilization',                     0, 0, '0', '%'),
  (9000263, 9000201, 2, 'system.uptime',                'Uptime',                                 3, 0, '0', 'uptime'),
  (9000264, 9000201, 2, 'system.sw.os',                 'OS name',                                1, 0, '0', ''),
  (9000265, 9000201, 2, 'proc.cpu.util[zabbix_server]', 'Process zabbix_server: CPU utilization', 0, 0, '0', '%'),
  -- host-level items: router-b
  (9000271, 9000202, 2, 'system.cpu.util', 'CPU utilization',    0, 0, '0', '%'),
  (9000272, 9000202, 2, 'vm.memory.util',  'Memory utilization', 0, 0, '0', '%'),
  (9000273, 9000202, 2, 'system.uptime',   'Uptime',             3, 0, '0', 'uptime'),
  (9000274, 9000202, 2, 'system.sw.os',    'OS name',            1, 0, '0', ''),
  -- host-level items: vm-c (no interfaces); Swap utilization (9000285) never receives a value
  (9000281, 9000203, 2, 'system.cpu.util',  'CPU utilization',    0, 0, '0', '%'),
  (9000282, 9000203, 2, 'vm.memory.util',   'Memory utilization', 0, 0, '0', '%'),
  (9000283, 9000203, 2, 'system.uptime',    'Uptime',             3, 0, '0', 'uptime'),
  (9000284, 9000203, 2, 'system.sw.os',     'OS name',            1, 0, '0', ''),
  (9000285, 9000203, 2, 'system.swap.util', 'Swap utilization',   0, 0, '0', '%')
ON CONFLICT DO NOTHING;

INSERT INTO item_rtdata (itemid, state)
SELECT itemid, 0 FROM items WHERE itemid BETWEEN 9000201 AND 9000299
ON CONFLICT DO NOTHING;

-- item tags: interface items carry component:network + interface:<ifname>,
-- host-level items carry component:<cpu|memory|os|system>
INSERT INTO item_tag (itemtagid, itemid, tag, value)
SELECT 9000200 + row_number() OVER (ORDER BY t.itemid, t.tag), t.itemid, t.tag, t.value
FROM (
  SELECT itemid, 'component' AS tag, 'network' AS value
    FROM items WHERE itemid BETWEEN 9000211 AND 9000255
  UNION ALL
  SELECT itemid, 'interface', substring(key_ from '\[(.*)\]')
    FROM items WHERE itemid BETWEEN 9000211 AND 9000255
  UNION ALL
  SELECT itemid, 'component',
         CASE WHEN key_ LIKE 'system.cpu%' OR key_ LIKE 'proc.cpu%' THEN 'cpu'
              WHEN key_ LIKE 'vm.memory%'  OR key_ LIKE 'system.swap%' THEN 'memory'
              WHEN key_ = 'system.sw.os' THEN 'os'
              ELSE 'system' END
    FROM items WHERE itemid BETWEEN 9000261 AND 9000299
) AS t
ON CONFLICT DO NOTHING;

-- history: 7 days, one sample every 5 minutes, relative to now()
DELETE FROM history      WHERE itemid BETWEEN 9000201 AND 9000299;
DELETE FROM history_uint WHERE itemid BETWEEN 9000201 AND 9000299;
DELETE FROM history_str  WHERE itemid BETWEEN 9000201 AND 9000299;

-- interface counters (bps): base + sawtooth over 60 samples; eth2(DMZ) is a genuine constant 0
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT s.itemid, gs, s.base + (gs / 300 % 60) * s.step, 0
FROM (VALUES
  (9000211, 5000000, 50000), (9000212, 2000000, 20000),
  (9000221, 1000000, 10000), (9000222,  800000,  8000),
  (9000231,       0,     0), (9000232,       0,     0),
  (9000241, 4000000, 40000), (9000242, 1500000, 15000),
  (9000251,  900000,  9000), (9000252,  700000,  7000)
) AS s(itemid, base, step)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- operational status (1 up, eth2 down) and link speed; 9000254 (router-b eth1 Speed) has no history on purpose
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT s.itemid, gs, s.value, 0
FROM (VALUES
  (9000213, 1), (9000223, 1), (9000233, 0), (9000243, 1), (9000253, 1),
  (9000214, 1000000000), (9000224, 1000000000), (9000234, 100000000), (9000244, 1000000000)
) AS s(itemid, value)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- uptime: seconds since a boot ~30 days ago, strictly increasing
INSERT INTO history_uint (itemid, clock, value, ns)
SELECT it, gs, gs - (EXTRACT(EPOCH FROM now())::int - 2592000), 0
FROM unnest(ARRAY[9000263, 9000273, 9000283]::bigint[]) AS it
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- float utilization (%): base + sawtooth; 9000285 (vm-c Swap utilization) has no history on purpose
INSERT INTO history (itemid, clock, value, ns)
SELECT s.itemid, gs, (s.base + (gs / 300 % s.period) * s.step)::double precision, 0
FROM (VALUES
  (9000261, 10.0, 1.0,  40),
  (9000262, 40.0, 0.5,  20),
  (9000265,  2.5, 0.0,   1),
  (9000271, 30.0, 0.5,  20),
  (9000272, 55.0, 0.25, 20),
  (9000281, 60.0, 1.0,  10),
  (9000282, 75.0, 0.5,  10)
) AS s(itemid, base, step, period)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 300) AS gs
ON CONFLICT DO NOTHING;

-- character items (interface descriptions, OS names): hourly, constant values
INSERT INTO history_str (itemid, clock, value, ns)
SELECT s.itemid, gs, s.value, 0
FROM (VALUES
  (9000215, 'Uplink to ISP'), (9000225, 'Office LAN'), (9000235, 'DMZ segment'),
  (9000245, 'Uplink to ISP (backup)'), (9000255, 'Office LAN'),
  (9000264, 'Linux 6.8.0 router-a'), (9000274, 'Linux 6.8.0 router-b'), (9000284, 'Ubuntu 24.04 LTS')
) AS s(itemid, value)
CROSS JOIN generate_series(EXTRACT(EPOCH FROM now())::int - 604800, EXTRACT(EPOCH FROM now())::int, 3600) AS gs
ON CONFLICT DO NOTHING;

COMMIT;
