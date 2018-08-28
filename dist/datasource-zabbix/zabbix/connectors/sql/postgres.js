'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var ITEMID_FORMAT, TEST_QUERY, postgres;


  function historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
    var time_expression = 'clock / ' + intervalSec + ' * ' + intervalSec;
    var query = '\n    SELECT to_char(itemid, \'' + ITEMID_FORMAT + '\') AS metric, ' + time_expression + ' AS time, ' + aggFunction + '(value) AS value\n    FROM ' + table + '\n    WHERE itemid IN (' + itemids + ')\n      AND clock > ' + timeFrom + ' AND clock < ' + timeTill + '\n    GROUP BY 1, 2\n    ORDER BY time ASC\n  ';
    return query;
  }

  function trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
    var time_expression = 'clock / ' + intervalSec + ' * ' + intervalSec;
    var query = '\n    SELECT to_char(itemid, \'' + ITEMID_FORMAT + '\') AS metric, ' + time_expression + ' AS time, ' + aggFunction + '(' + valueColumn + ') AS value\n    FROM ' + table + '\n    WHERE itemid IN (' + itemids + ')\n      AND clock > ' + timeFrom + ' AND clock < ' + timeTill + '\n    GROUP BY 1, 2\n    ORDER BY time ASC\n  ';
    return query;
  }

  function testQuery() {
    return TEST_QUERY;
  }

  return {
    setters: [],
    execute: function () {
      ITEMID_FORMAT = 'FM99999999999999999999';
      TEST_QUERY = '\n  SELECT to_char(itemid, \'' + ITEMID_FORMAT + '\') AS metric, clock AS time, value_avg AS value\n  FROM trends_uint LIMIT 1\n';
      postgres = {
        historyQuery: historyQuery,
        trendsQuery: trendsQuery,
        testQuery: testQuery
      };

      _export('default', postgres);
    }
  };
});
//# sourceMappingURL=postgres.js.map
