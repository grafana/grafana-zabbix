'use strict';

System.register(['lodash', '../dataProcessor'], function (_export, _context) {
  "use strict";

  var _, dataProcessor;

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_dataProcessor) {
      dataProcessor = _dataProcessor.default;
    }],
    execute: function () {

      describe('dataProcessor', function () {
        var ctx = {};

        beforeEach(function () {
          ctx.datapoints = [[[10, 1500000000000], [2, 1500000001000], [7, 1500000002000], [1, 1500000003000]], [[9, 1500000000000], [3, 1500000001000], [4, 1500000002000], [8, 1500000003000]]];
        });

        describe('When apply groupBy() functions', function () {
          it('should return series average', function () {
            var aggregateBy = dataProcessor.metricFunctions['groupBy'];
            var avg2s = _.map(ctx.datapoints, function (dp) {
              return aggregateBy('2s', 'avg', dp);
            });
            expect(avg2s).toEqual([[[6, 1500000000000], [4, 1500000002000]], [[6, 1500000000000], [6, 1500000002000]]]);

            var avg10s = _.map(ctx.datapoints, function (dp) {
              return aggregateBy('10s', 'avg', dp);
            });
            expect(avg10s).toEqual([[[5, 1500000000000]], [[6, 1500000000000]]]);

            // not aligned
            var dp = [[10, 1500000001000], [2, 1500000002000], [7, 1500000003000], [1, 1500000004000]];
            expect(aggregateBy('2s', 'avg', dp)).toEqual([[10, 1500000000000], [4.5, 1500000002000], [1, 1500000004000]]);
          });
        });

        describe('When apply aggregateBy() functions', function () {
          it('should return series average', function () {
            var aggregateBy = dataProcessor.metricFunctions['aggregateBy'];
            var avg1s = aggregateBy('1s', 'avg', ctx.datapoints);
            expect(avg1s).toEqual([[9.5, 1500000000000], [2.5, 1500000001000], [5.5, 1500000002000], [4.5, 1500000003000]]);

            var avg10s = aggregateBy('10s', 'avg', ctx.datapoints);
            expect(avg10s).toEqual([[5.5, 1500000000000]]);
          });
        });
      });
    }
  };
});
//# sourceMappingURL=dataProcessor.spec.js.map
