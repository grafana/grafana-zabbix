'use strict';

System.register(['../timeseries'], function (_export, _context) {
  "use strict";

  var ts;
  return {
    setters: [function (_timeseries) {
      ts = _timeseries.default;
    }],
    execute: function () {

      describe('timeseries processing functions', function () {

        describe('sumSeries()', function () {
          it('should properly sum series', function (done) {
            var series = [[[0, 1], [1, 2], [1, 3]], [[2, 1], [3, 2], [4, 3]]];

            var expected = [[2, 1], [4, 2], [5, 3]];

            var result = ts.sumSeries(series);
            expect(result).toEqual(expected);
            done();
          });

          it('should properly sum series with nulls', function (done) {
            // issue #286
            var series = [[[1, 1], [1, 2], [1, 3]], [[3, 2], [4, 3]]];

            var expected = [[1, 1], [4, 2], [5, 3]];

            var result = ts.sumSeries(series);
            expect(result).toEqual(expected);
            done();
          });
        });
      }); // import _ from 'lodash';
    }
  };
});
//# sourceMappingURL=timeseries.spec.js.map
