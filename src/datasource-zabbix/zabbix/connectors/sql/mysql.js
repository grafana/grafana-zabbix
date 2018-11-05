/**
 * MySQL queries
 */

function historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
  let time_expression = `clock DIV ${intervalSec} * ${intervalSec}`;
  let query = `
    SELECT CAST(itemid AS CHAR) AS metric, ${time_expression} AS time_sec, ${aggFunction}(value) AS value
    FROM ${table}
    WHERE itemid IN (${itemids})
      AND clock > ${timeFrom} AND clock < ${timeTill}
    GROUP BY ${time_expression}, metric
    ORDER BY time_sec ASC
  `;
  return query;
}

function trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
  let time_expression = `clock DIV ${intervalSec} * ${intervalSec}`;
  let query = `
    SELECT CAST(itemid AS CHAR) AS metric, ${time_expression} AS time_sec, ${aggFunction}(${valueColumn}) AS value
    FROM ${table}
    WHERE itemid IN (${itemids})
      AND clock > ${timeFrom} AND clock < ${timeTill}
    GROUP BY ${time_expression}, metric
    ORDER BY time_sec ASC
  `;
  return query;
}

const TEST_QUERY = `SELECT CAST(itemid AS CHAR) AS metric, clock AS time_sec, value_avg AS value FROM trends_uint LIMIT 1`;

function testQuery() {
  return TEST_QUERY;
}

const mysql = {
  historyQuery,
  trendsQuery,
  testQuery
};

export default mysql;
