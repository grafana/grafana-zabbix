// import _ from 'lodash';
import ts from '../timeseries';

describe('timeseries processing functions', () => {

  describe('sumSeries()', () => {
    it('should properly sum series', (done) => {
      let series = [
        [[0, 1], [1, 2], [1, 3]],
        [[2, 1], [3, 2], [4, 3]]
      ];

      let expected = [[2, 1], [4, 2], [5, 3]];

      let result = ts.sumSeries(series);
      expect(result).toEqual(expected);
      done();
    });

    it('should properly sum series with nulls', (done) => {
      // issue #286
      let series = [
        [[1, 1], [1, 2], [1, 3]],
        [[3, 2], [4, 3]]
      ];

      let expected = [[1, 1], [4, 2], [5, 3]];

      let result = ts.sumSeries(series);
      expect(result).toEqual(expected);
      done();
    });

    it('should properly offset metric', (done) => {
      let points = [[1, 1], [-4, 2], [2, 3]];

      let expected = [[101, 1], [96, 2], [102, 3]];

      let result = ts.offset(points, 100);
      expect(result).toEqual(expected);
      done();
    });
  });
});
