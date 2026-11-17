-- Trigger descriptions for the Problems panel description preview/modal e2e test
-- (problemDescription.spec.ts).
--
-- Must run after seed.sql, which creates the triggers: the loader runs files in
-- lexicographic order and "seed.sql" sorts before "seed_problem_descriptions.sql".
--
--   * trigger 9000001 (E2E problem 0) gets a long multi-line description that is
--     clipped in the expanded-row preview; its last line only shows in the modal,
--   * trigger 9000002 (E2E problem 1) gets a short description that fits.
--
-- Plain UPDATEs keep this idempotent.

BEGIN;

UPDATE triggers SET comments = E'E2E long description, line 1: the service on the fixture host could not bind to its network socket.\n'
  || E'Line 2: verify that the configured listen address belongs to this host. If it does not, remove it from the service configuration and restart the service.\n'
  || E'Line 3: if the address is valid, make sure no other process is already listening on the same port, then restart the service and watch its log for further errors.\n'
  || E'\n'
  || E'Line 5: the padding below keeps the preview in the expanded row cut off even on very wide panels, so the full text can only be read in the modal window.\n'
  -- ~3,000 characters: more than the 6rem-high preview can show at any realistic width.
  || repeat('Padding text for the description preview. ', 70) || E'\n'
  || E'E2E description end marker'
WHERE triggerid = 9000001;

UPDATE triggers SET comments = E'E2E short description.\nSecond line.'
WHERE triggerid = 9000002;

COMMIT;
