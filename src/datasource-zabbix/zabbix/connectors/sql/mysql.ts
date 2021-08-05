/**
 * MySQL queries
 */

function historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
  return `
      SELECT CAST(itemid AS CHAR) AS metric, MIN(clock) AS time_sec, ${aggFunction}(value) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock
          > ${timeFrom}
        AND clock
          < ${timeTill}
      GROUP BY (clock-${timeFrom}) DIV ${intervalSec}, metric
      ORDER BY time_sec ASC
  `;
}

function trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
  return `
      SELECT CAST(itemid AS CHAR) AS metric, MIN(clock) AS time_sec, ${aggFunction}(${valueColumn}) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock
          > ${timeFrom}
        AND clock
          < ${timeTill}
      GROUP BY (clock-${timeFrom}) DIV ${intervalSec}, metric
      ORDER BY time_sec ASC
  `;
}

function testQuery() {
  return `SELECT CAST(itemid AS CHAR) AS metric, clock AS time_sec, value_avg AS value
          FROM trends_uint LIMIT 1`;
}

const mysql = {
  historyQuery,
  trendsQuery,
  testQuery
};

export default mysql;
