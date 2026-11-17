import { getAckModalActionProps } from './utils';
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

  it('offers unsuppress and not suppress for a suppressed problem', () => {
    const props = getAckModalActionProps(createProblem({ suppressed: '1' }));
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
