import { DataFrameType, FieldType, MutableDataFrame } from '@grafana/data';
import responseHandler, { alignFrames, handleSLIResponse } from './responseHandler';
import { ZabbixMetricsQuery } from './types/query';

describe('data plane type declarations', () => {
  it('declares SLI frames as timeseries-wide with a value field per service', () => {
    const frame = handleSLIResponse(
      {
        periods: [{ period_from: 1 }, { period_from: 2 }],
        sli: [
          [{ sli: 99.9 }, { sli: 98 }],
          [{ sli: 99.8 }, { sli: 97 }],
        ],
        serviceids: ['1', '2'],
      },
      [
        { serviceid: '1', name: 'Service A' },
        { serviceid: '2', name: 'Service B' },
      ],
      { refId: 'A', slaProperty: 'sli' } as ZabbixMetricsQuery
    );

    expect(frame.meta?.type).toStrictEqual(DataFrameType.TimeSeriesWide);
    expect(frame.meta?.typeVersion).toStrictEqual([0, 1]);
    expect(frame.fields.map((f) => f.name)).toStrictEqual(['Time', 'Service A', 'Service B']);
    expect(frame.fields[1].values.toArray()).toStrictEqual([99.9, 99.8]);
  });

  it('declares the trigger count frame as timeseries-multi and names the value field', () => {
    const frame = responseHandler.handleTriggersResponse(5 as any, [], [0, 1700000000], { refId: 'A' });

    expect(frame.meta?.type).toStrictEqual(DataFrameType.TimeSeriesMulti);
    expect(frame.meta?.typeVersion).toStrictEqual([0, 1]);
    expect(frame.fields.map((f) => f.name)).toStrictEqual(['Time', 'Count A']);
    // Keeps the name that the frame name used to resolve to.
    expect(frame.fields[1].config.displayNameFromDS).toStrictEqual('Count A');
  });
});

describe('alignFrames', () => {
  it('pads every field of a shifted frame so field lengths stay equal', () => {
    const frames = alignFrames([
      new MutableDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000] },
          { name: 'Service A', type: FieldType.number, values: [1, 2, 3] },
        ],
      }),
      new MutableDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, config: { custom: { itemInterval: 1000 } }, values: [3000] },
          { name: 'Service B', type: FieldType.number, values: [30] },
          { name: 'Service C', type: FieldType.number, values: [300] },
        ],
      }),
    ]);

    expect(frames[1].fields[0].values.toArray()).toStrictEqual([1000, 2000, 3000]);
    expect(frames[1].fields[1].values.toArray()).toStrictEqual([null, null, 30]);
    expect(frames[1].fields[2].values.toArray()).toStrictEqual([null, null, 300]);
    expect(frames[1].length).toStrictEqual(3);
  });
});
