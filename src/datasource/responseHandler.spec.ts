import { FieldType, MutableDataFrame, TIME_SERIES_TIME_FIELD_NAME } from '@grafana/data';
import { convertToWide } from './responseHandler';

describe('convertToWide', () => {
  it('merge multiple SLI frames correctly', () => {
    let frames = convertToWide([
      new MutableDataFrame({
        name: 'SLI',
        fields: [
          { name: TIME_SERIES_TIME_FIELD_NAME, values: [1], type: FieldType.time },
          { name: TIME_SERIES_TIME_FIELD_NAME, values: [1.1], type: FieldType.number },
        ],
      }),
      new MutableDataFrame({
        name: 'SLI',
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
  });
});
