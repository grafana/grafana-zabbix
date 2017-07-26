'use strict';

var _timeseries = require('../timeseries');

var _timeseries2 = _interopRequireDefault(_timeseries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('timeseries processing functions', function () {

  describe('sumSeries()', function () {
    it('should properly sum series', function (done) {
      var series = [[[0, 1], [1, 2], [1, 3]], [[2, 1], [3, 2], [4, 3]]];

      var expected = [[2, 1], [4, 2], [5, 3]];

      var result = _timeseries2.default.sumSeries(series);
      expect(result).to.eql(expected);
      done();
    });

    it('should properly sum series with nulls', function (done) {
      // issue #286
      var series = [[[1, 1], [1, 2], [1, 3]], [[3, 2], [4, 3]]];

      var expected = [[1, 1], [4, 2], [5, 3]];

      var result = _timeseries2.default.sumSeries(series);
      expect(result).to.eql(expected);
      done();
    });
  });
}); // import _ from 'lodash';
