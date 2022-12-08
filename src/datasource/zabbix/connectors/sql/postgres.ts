/**
 * Postgres queries
 */

const ITEMID_FORMAT = 'FM99999999999999999999';

function historyQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction) {
  const time_expression = `clock / ${intervalSec} * ${intervalSec}`;
  return `
      SELECT to_char(itemid, '${ITEMID_FORMAT}') AS metric, ${time_expression} AS time, ${aggFunction}(value) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock
          > ${timeFrom}
        AND clock
          < ${timeTill}
      GROUP BY 1, 2
      ORDER BY time ASC
  `;
}

function trendsQuery(itemids, table, timeFrom, timeTill, intervalSec, aggFunction, valueColumn) {
  const time_expression = `clock / ${intervalSec} * ${intervalSec}`;
  return `
      SELECT to_char(itemid, '${ITEMID_FORMAT}') AS metric, ${time_expression} AS time, ${aggFunction}(${valueColumn}) AS value
      FROM ${table}
      WHERE itemid IN (${itemids})
        AND clock
          > ${timeFrom}
        AND clock
          < ${timeTill}
      GROUP BY 1, 2
      ORDER BY time ASC
  `;
}

const TEST_QUERY = `
    SELECT to_char(itemid, '${ITEMID_FORMAT}') AS metric, clock AS time, value_avg AS value
    FROM trends_uint LIMIT 1
`;

function testQuery() {
  return TEST_QUERY;
}

const postgres = {
  historyQuery,
  trendsQuery,
  testQuery,
};

export default postgres;
