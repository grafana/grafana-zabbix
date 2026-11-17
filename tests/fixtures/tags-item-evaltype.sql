-- Item tags for the item tag AND/OR e2e test (itemTagEvalType.spec.ts), issue #1286:
--   * item 9000001 (E2E item 0): e2e_a:x, e2e_b:x
--   * item 9000002 (E2E item 1): e2e_a:x
-- With "e2e_a: x, e2e_b: x", OR returns both items and AND/OR only E2E item 0.
--
-- Sorts after seed.sql, which creates the items. High, fixed IDs (9_000_00x)
-- and ON CONFLICT DO NOTHING keep it collision-free and idempotent.

BEGIN;

INSERT INTO item_tag (itemtagid, itemid, tag, value) VALUES
  (9000001, 9000001, 'e2e_a', 'x'),
  (9000002, 9000001, 'e2e_b', 'x'),
  (9000003, 9000002, 'e2e_a', 'x')
ON CONFLICT DO NOTHING;

COMMIT;
