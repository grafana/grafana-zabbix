-- Host inventory fixture for the Inventory query type (issue #280).
-- Group "E2E Inventory" holds three hosts:
--   * e2e-inv-santiago: inventory with dot-decimal coordinates,
--   * e2e-inv-madrid:   coordinates written with a decimal comma,
--   * e2e-inv-disabled: no host_inventory row (inventory disabled).
-- Separate group so the existing "E2E" host/problem fixtures are unaffected.

BEGIN;

INSERT INTO hstgrp (groupid, name, type) VALUES (9000201, 'E2E Inventory', 0) ON CONFLICT DO NOTHING;

INSERT INTO hosts (hostid, host, name, status) VALUES
  (9000201, 'e2e-inv-santiago', 'e2e-inv-santiago', 0),
  (9000202, 'e2e-inv-madrid', 'e2e-inv-madrid', 0),
  (9000203, 'e2e-inv-disabled', 'e2e-inv-disabled', 0)
ON CONFLICT DO NOTHING;

INSERT INTO hosts_groups (hostgroupid, hostid, groupid) VALUES
  (9000201, 9000201, 9000201),
  (9000202, 9000202, 9000201),
  (9000203, 9000203, 9000201)
ON CONFLICT DO NOTHING;

-- inventory_mode 0 = manual
INSERT INTO host_inventory (hostid, inventory_mode, location_lat, location_lon, os, site_city) VALUES
  (9000201, 0, '-33.4489', '-70.6693', 'Linux', 'Santiago'),
  (9000202, 0, '40,4168', '-3,7038', 'Windows', 'Madrid')
ON CONFLICT DO NOTHING;

COMMIT;
