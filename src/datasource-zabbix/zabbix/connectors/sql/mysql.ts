/**
 * MySQL queries
 */

function historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
  const time_expression = `clock DIV ${intervalSec} * ${intervalSec}`;
  return `
      SELECT CAST(itemid AS CHAR) AS metric, ${time_expression} AS time_sec, ${aggFunction}(value) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock
          > ${timeFrom}
        AND clock
          < ${timeTill}
      GROUP BY ${time_expression}, metric
      ORDER BY time_sec ASC
  `;
}

function trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
  const time_expression = `clock DIV ${intervalSec} * ${intervalSec}`;
  return `
      SELECT CAST(itemid AS CHAR) AS metric, ${time_expression} AS time_sec, ${aggFunction}(${valueColumn}) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock
          > ${timeFrom}
        AND clock
          < ${timeTill}
      GROUP BY ${time_expression}, metric
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
