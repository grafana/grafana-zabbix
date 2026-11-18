import { getAckModalActionProps, isManuallySuppressed } from './utils';
import { ProblemDTO } from '../datasource/types';

const createProblem = (overrides: Partial<ProblemDTO> = {}): ProblemDTO => ({
  eventid: '10',
  name: 'Test problem',
  timestamp: 1700000000,
  acknowledged: '0',
  suppressed: '0',
  manual_close: '1',
  actionCapabilities: { unacknowledge: true, suppress: true },
  ...overrides,
});

describe('getAckModalActionProps', () => {
  it('offers acknowledge and not unacknowledge for an unacknowledged problem', () => {
    const props = getAckModalActionProps(createProblem({ acknowledged: '0' }));
    expect(props.canAck).toBe(true);
    expect(props.canUnack).toBe(false);
  });

  it('offers unacknowledge and not acknowledge for an acknowledged problem', () => {
    const props = getAckModalActionProps(createProblem({ acknowledged: '1' }));
    expect(props.canAck).toBe(false);
    expect(props.canUnack).toBe(true);
  });

  it('offers suppress and not unsuppress for a problem which is not suppressed', () => {
    const props = getAckModalActionProps(createProblem({ suppressed: '0' }));
    expect(props.canSuppress).toBe(true);
    expect(props.canUnsuppress).toBe(false);
  });

  it('offers unsuppress and not suppress for a manually suppressed problem', () => {
    const props = getAckModalActionProps(
      createProblem({ suppressed: '1', suppression_data: [{ maintenanceid: '0', userid: '1', suppress_until: '0' }] })
    );
    expect(props.canSuppress).toBe(false);
    expect(props.canUnsuppress).toBe(true);
  });

  it('offers suppress and not unsuppress for a problem suppressed only by maintenance', () => {
    // Unsuppress can't end a maintenance, so it must not be offered
    const props = getAckModalActionProps(
      createProblem({
        suppressed: '1',
        suppression_data: [{ maintenanceid: '5', userid: '0', suppress_until: '1800000000' }],
      })
    );
    expect(props.canSuppress).toBe(true);
    expect(props.canUnsuppress).toBe(false);
  });

  it('offers unsuppress for a problem suppressed both by maintenance and manually', () => {
    const props = getAckModalActionProps(
      createProblem({
        suppressed: '1',
        suppression_data: [
          { maintenanceid: '5', userid: '0', suppress_until: '1800000000' },
          { maintenanceid: '0', userid: '1', suppress_until: '0' },
        ],
      })
    );
    expect(props.canSuppress).toBe(false);
    expect(props.canUnsuppress).toBe(true);
  });

  it('disables version-gated actions when the server does not support them', () => {
    const props = getAckModalActionProps(
      createProblem({
        acknowledged: '1',
        suppressed: '1',
        actionCapabilities: { unacknowledge: false, suppress: false },
      })
    );
    expect(props.canUnack).toBe(false);
    expect(props.canSuppress).toBe(false);
    expect(props.canUnsuppress).toBe(false);
  });

  it('disables version-gated actions when capabilities are missing entirely', () => {
    const props = getAckModalActionProps(createProblem({ acknowledged: '1', actionCapabilities: undefined }));
    expect(props.canUnack).toBe(false);
    expect(props.canSuppress).toBe(false);
  });

  it('maps manual_close to canClose', () => {
    expect(getAckModalActionProps(createProblem({ manual_close: '1' })).canClose).toBe(true);
    expect(getAckModalActionProps(createProblem({ manual_close: '0' })).canClose).toBe(false);
  });
});

describe('isManuallySuppressed', () => {
  it('is true when a suppression entry has a user', () => {
    expect(
      isManuallySuppressed(
        createProblem({ suppression_data: [{ maintenanceid: '0', userid: '1', suppress_until: '0' }] })
      )
    ).toBe(true);
  });

  it('is false for a maintenance suppression (userid 0)', () => {
    expect(
      isManuallySuppressed(
        createProblem({
          suppressed: '1',
          suppression_data: [{ maintenanceid: '5', userid: '0', suppress_until: '1800000000' }],
        })
      )
    ).toBe(false);
  });

  it('is false when suppression data is missing, even if suppressed is set', () => {
    expect(isManuallySuppressed(createProblem({ suppressed: '1', suppression_data: undefined }))).toBe(false);
    expect(isManuallySuppressed(createProblem({ suppressed: '1', suppression_data: [] }))).toBe(false);
  });
});
