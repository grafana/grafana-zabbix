"use strict";

System.register([], function (_export, _context) {
  "use strict";

  var TEST_QUERY, mysql;
  /**
   * MySQL queries
   */

  function historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
    var time_expression = "clock DIV " + intervalSec + " * " + intervalSec;
    var query = "\n    SELECT CAST(itemid AS CHAR) AS metric, " + time_expression + " AS time_sec, " + aggFunction + "(value) AS value\n    FROM " + table + "\n    WHERE itemid IN (" + itemids + ")\n      AND clock > " + timeFrom + " AND clock < " + timeTill + "\n    GROUP BY " + time_expression + ", metric\n    ORDER BY time_sec ASC\n  ";
    return query;
  }

  function trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
    var time_expression = "clock DIV " + intervalSec + " * " + intervalSec;
    var query = "\n    SELECT CAST(itemid AS CHAR) AS metric, " + time_expression + " AS time_sec, " + aggFunction + "(" + valueColumn + ") AS value\n    FROM " + table + "\n    WHERE itemid IN (" + itemids + ")\n      AND clock > " + timeFrom + " AND clock < " + timeTill + "\n    GROUP BY " + time_expression + ", metric\n    ORDER BY time_sec ASC\n  ";
    return query;
  }

  function testQuery() {
    return TEST_QUERY;
  }

  return {
    setters: [],
    execute: function () {
      TEST_QUERY = "SELECT CAST(itemid AS CHAR) AS metric, clock AS time_sec, value_avg AS value FROM trends_uint LIMIT 1";
      mysql = {
        historyQuery: historyQuery,
        trendsQuery: trendsQuery,
        testQuery: testQuery
      };

      _export("default", mysql);
    }
  };
});
//# sourceMappingURL=mysql.js.map
