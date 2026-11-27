import { FieldType, MutableDataFrame, TIME_SERIES_TIME_FIELD_NAME } from '@grafana/data';
import { convertToWide, isConvertibleToWide } from './responseHandler';

describe('isConvertibleToWide', () => {
  const timeSeries = (refId: string) =>
    new MutableDataFrame({
      refId,
      fields: [
        { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2], type: FieldType.time },
        { name: 'value', values: [1.1, 1.2], type: FieldType.number },
      ],
    });

  it('returns false instead of throwing when a later frame has no time field', () => {
    const table = new MutableDataFrame({
      refId: 'B',
      fields: [
        { name: 'Host', values: ['web01'], type: FieldType.string },
        { name: 'CPU', values: ['12.5'], type: FieldType.string },
      ],
    });

    expect(isConvertibleToWide([timeSeries('A'), table])).toBe(false);
  });

  it('returns true for aligned time series', () => {
    expect(isConvertibleToWide([timeSeries('A'), timeSeries('B')])).toBe(true);
  });
});

describe('convertToWide', () => {
  it('merge multiple SLI frames correctly', () => {
    let frames = convertToWide([
      new MutableDataFrame({
        name: 'SLI',
        refId: 'A',
        fields: [
          { name: TIME_SERIES_TIME_FIELD_NAME, values: [1], type: FieldType.time },
          { name: TIME_SERIES_TIME_FIELD_NAME, values: [1.1], type: FieldType.number },
        ],
      }),
      new MutableDataFrame({
        name: 'SLI',
        refId: 'B',
        fields: [
          { name: TIME_SERIES_TIME_FIELD_NAME, values: [1], type: FieldType.time },
          { name: TIME_SERIES_TIME_FIELD_NAME, values: [1.2], type: FieldType.number },
        ],
      }),
    ]);
    expect(frames.length).toStrictEqual(1);
    expect(frames[0].fields.length).toStrictEqual(3);
    expect(frames[0].fields[0].values.at(0)).toStrictEqual(1);
    expect(frames[0].fields[1].values.at(0)).toStrictEqual(1.1);
    expect(frames[0].fields[2].values.at(0)).toStrictEqual(1.2);
    expect(frames[0].refId).toStrictEqual('A');
  });
});
