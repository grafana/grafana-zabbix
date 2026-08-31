import { getAckModalActionProps, getCauseEventOptions, isSymptomEvent } from './utils';
import { ProblemDTO } from '../datasource/types';

const createProblem = (overrides: Partial<ProblemDTO> = {}): ProblemDTO => ({
  eventid: '10',
  name: 'Test problem',
  timestamp: 1700000000,
  acknowledged: '0',
  suppressed: '0',
  cause_eventid: '0',
  manual_close: '1',
  actionCapabilities: { unacknowledge: true, suppress: true, rank: true },
  ...overrides,
});

describe('isSymptomEvent', () => {
  it('is false for a cause problem (cause_eventid is 0)', () => {
    expect(isSymptomEvent(createProblem({ cause_eventid: '0' }))).toBe(false);
  });

  it('is false when cause_eventid is missing (Zabbix < 6.4)', () => {
    expect(isSymptomEvent(createProblem({ cause_eventid: undefined }))).toBe(false);
  });

  it('is true when the problem points to a cause event', () => {
    expect(isSymptomEvent(createProblem({ cause_eventid: '42' }))).toBe(true);
  });
});

describe('getCauseEventOptions', () => {
  it('offers other cause problems but not the problem itself or symptoms', () => {
    const problem = createProblem();
    const panelProblems = [
      problem,
      createProblem({ eventid: '20', name: 'Other cause', host: 'host-b' }),
      createProblem({ eventid: '30', name: 'A symptom', cause_eventid: '20' }),
    ];

    expect(getCauseEventOptions(panelProblems, problem)).toEqual([{ value: '20', label: 'host-b: Other cause' }]);
  });

  it('returns an empty list when panel problems are not provided', () => {
    expect(getCauseEventOptions(undefined, createProblem())).toEqual([]);
  });
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

  it('offers rank as symptom and not rank as cause for a cause problem', () => {
    const props = getAckModalActionProps(createProblem({ cause_eventid: '0' }));
    expect(props.canRankAsSymptom).toBe(true);
    expect(props.canRankAsCause).toBe(false);
  });

  it('offers rank as cause and not rank as symptom for a symptom problem', () => {
    const props = getAckModalActionProps(createProblem({ cause_eventid: '42' }));
    expect(props.canRankAsCause).toBe(true);
    expect(props.canRankAsSymptom).toBe(false);
  });

  it('disables version-gated actions when the server does not support them', () => {
    const props = getAckModalActionProps(
      createProblem({
        acknowledged: '1',
        suppressed: '1',
        actionCapabilities: { unacknowledge: false, suppress: false, rank: false },
      })
    );
    expect(props.canUnack).toBe(false);
    expect(props.canSuppress).toBe(false);
    expect(props.canUnsuppress).toBe(false);
    expect(props.canRankAsCause).toBe(false);
    expect(props.canRankAsSymptom).toBe(false);
  });

  it('disables version-gated actions when capabilities are missing entirely', () => {
    const props = getAckModalActionProps(createProblem({ acknowledged: '1', actionCapabilities: undefined }));
    expect(props.canUnack).toBe(false);
    expect(props.canSuppress).toBe(false);
    expect(props.canRankAsSymptom).toBe(false);
  });

  it('maps manual_close to canClose', () => {
    expect(getAckModalActionProps(createProblem({ manual_close: '1' })).canClose).toBe(true);
    expect(getAckModalActionProps(createProblem({ manual_close: '0' })).canClose).toBe(false);
  });
});
