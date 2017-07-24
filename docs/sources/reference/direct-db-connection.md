# Direct DB Connection

Since version 4.3 Grafana has MySQL data source, Grafana-Zabbix plugin can use it for querying data directly from
Zabbix database.

One of the most hard queries for Zabbix API is history queries. For long time intervals `history.get`
returns huge amount of data. In order to display it, plugin should adjust time series resolution
by using [consolidateBy](/reference/functions/#consolidateby) function. Ultimately, Grafana displays this reduced
time series, but that data should be loaded and processed on the client side first. Direct DB Connection solves this
two problems by moving consolidation to the server side. Thus, client get ready-to-use dataset which has much smaller
size. Data loads faster and client doesn't spend time for data processing.

Also, many users point better performance of direct database queries versus API calls. This caused by several reasons,
such as additional PHP layer and additional SQL queries (user permissions checks).

## Query structure

Grafana-Zabbix uses queries like this for getting history:

```sql
SELECT itemid AS metric, clock AS time_sec, {aggFunc}(value) as value
  FROM {historyTable}
  WHERE itemid IN ({itemids})
    AND clock > {timeFrom} AND clock < {timeTill}
  GROUP BY time_sec DIV {intervalSec}, metric
```

where `{aggFunc}` is one of `[AVG, MIN, MAX, SUM, COUNT]` aggregation function, `{historyTable}` is a history table,
`{intervalSec}` - consolidation interval in seconds.

When getting trends, plugin additionally queries particular value column (`value_avg`, `value_min` or `value_max`)
depends on `consolidateBy` function value:

```sql
SELECT itemid AS metric, clock AS time_sec, {aggFunc}({valueColumn}) as value
  FROM {trendsTable}
  WHERE itemid IN ({itemids})
    AND clock > {timeFrom} AND clock < {timeTill}
  GROUP BY time_sec DIV {intervalSec}, metric
```

As you can see, plugin uses aggregation by given time interval. This interval is provided by Grafana and depends on the
panel with in pixels. Thus, Grafana always gets data in necessary resolution.
