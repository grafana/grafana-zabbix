---
title: Zabbix functions reference
menuTitle: Functions
description: Reference for all data processing functions available in the Zabbix data source query editor.
aliases:
  - reference/functions/
keywords:
  - grafana
  - zabbix
  - functions
  - transform
  - aggregate
  - alias
labels:
  products:
    - oss
    - enterprise
    - cloud
weight: 350
last_reviewed: 2026-02-18
---

# Zabbix functions reference

Functions let you transform, aggregate, and manipulate time series data returned by Zabbix queries. Add functions to a query by clicking the **+** button next to the query row in the query editor.

## Built-in variables

The following built-in variables are available for use as function parameters:

| Variable | Description |
|----------|-------------|
| `$__range_ms` | Panel time range in milliseconds. |
| `$__range_s` | Panel time range in seconds. |
| `$__range` | Panel time range as a string (`30s`, `1m`, `1h`). |
| `$__range_series` | Invokes the function over all series values. |

```
groupBy($__range, avg)
percentile($__range_series, 95)
```

## Transform functions

Transform functions operate on each individual time series.

### groupBy

```
groupBy(interval, function)
```

Consolidates points within each `interval` into a single point using the specified `function`. Supported functions: `avg`, `min`, `max`, `median`.

```
groupBy(10m, avg)
groupBy(1h, median)
```

### scale

```
scale(factor)
```

Multiplies each data point by `factor`.

```
scale(100)
scale(0.01)
```

### offset

```
offset(value)
```

Adds `value` to each data point.

### delta

```
delta()
```

Calculates the difference between consecutive values. For per-second rate calculations, use `rate()` instead.

### rate

```
rate()
```

Calculates the per-second rate of increase. Resistant to counter resets, making it suitable for converting growing counters into per-second rates.

### movingAverage

```
movingAverage(windowSize)
```

Calculates a moving average over a fixed number of past points specified by `windowSize`.

```
movingAverage(60)
```

If the metric has 1-second resolution, a window size of 60 corresponds to a 1-minute window.

### exponentialMovingAverage

```
exponentialMovingAverage(windowSize)
```

Calculates an exponential moving average (EMA) using the formula:

\[ \text{ema}(current) = constant \times currentValue + (1 - constant) \times \text{ema}(previous) \]

Where `constant = 2 / (windowSize + 1)`.

If `windowSize` is less than 1 (for example, `0.1`), the constant is set directly to `windowSize` rather than being calculated.

{{< admonition type="note" >}}
The first N points (where N equals the window size) use an approximation. The plugin assumes previous N points have the same average as the first N points rather than fetching additional historical data. Don't rely on the accuracy of the first N data points.
{{< /admonition >}}

```
exponentialMovingAverage(60)
```

### percentile

```
percentile(interval, N)
```

Consolidates points within each `interval` into a single point at the Nth percentile.

```
percentile(1h, 99)
percentile($__range_series, 95)
```

### removeAboveValue

```
removeAboveValue(N)
```

Replaces data points with `null` if the value is greater than `N`.

```
removeAboveValue(100)
```

### removeBelowValue

```
removeBelowValue(N)
```

Replaces data points with `null` if the value is less than `N`.

```
removeBelowValue(0)
```

### transformNull

```
transformNull(N)
```

Replaces `null` values with `N`.

```
transformNull(0)
```

## Aggregate functions

Aggregate functions combine multiple time series into one.

### aggregateBy

```
aggregateBy(interval, function)
```

Combines all time series by consolidating points within each `interval` using the specified `function`. Supported functions: `avg`, `min`, `max`, `median`.

```
aggregateBy(10m, avg)
aggregateBy(1h, median)
```

### sumSeries

```
sumSeries()
```

Adds all time series together, returning the sum at each data point. This function requires interpolation of each time series, which may cause high CPU load. Combine with `groupBy()` to reduce load.

### percentileAgg

```
percentileAgg(interval, N)
```

Combines all time series by consolidating points within each `interval` at the Nth percentile.

```
percentileAgg(1h, 99)
percentileAgg($__range_series, 95)
```

### average (deprecated)

```
average(interval)
```

{{< admonition type="caution" >}}
Deprecated. Use `aggregateBy(interval, avg)` instead.
{{< /admonition >}}

### min (deprecated)

```
min(interval)
```

{{< admonition type="caution" >}}
Deprecated. Use `aggregateBy(interval, min)` instead.
{{< /admonition >}}

### max (deprecated)

```
max(interval)
```

{{< admonition type="caution" >}}
Deprecated. Use `aggregateBy(interval, max)` instead.
{{< /admonition >}}

## Filter functions

Filter functions reduce the number of time series returned.

### top

```
top(N, value)
```

Returns the top N series sorted by `value`. Supported values: `avg`, `min`, `max`, `median`.

```
top(10, avg)
top(5, max)
```

### bottom

```
bottom(N, value)
```

Returns the bottom N series sorted by `value`. Supported values: `avg`, `min`, `max`, `median`.

```
bottom(5, avg)
```

## Trend functions

Trend functions control how trend data is returned.

### trendValue

```
trendValue(valueType)
```

Specifies which trend value Zabbix returns when querying trends data. Supported values: `avg`, `min`, `max`.

## Time functions

Time functions shift data along the time axis.

### timeShift

```
timeShift(interval)
```

Shifts the time series by the specified `interval`. Without a sign or with a minus sign, the data shifts backward in time. With a plus sign, it shifts forward.

```
timeShift(24h)   -- shift back 24 hours
timeShift(-24h)  -- same as timeShift(24h)
timeShift(+1d)   -- shift forward 1 day
```

## Alias functions

Alias functions change the display names of time series. The following template variables are available in `setAlias()` and `replaceAlias()`:

| Variable | Description |
|----------|-------------|
| `$__zbx_item`, `$__zbx_item_name` | Item name. |
| `$__zbx_item_key` | Item key. |
| `$__zbx_host_name` | Visible name of the host. |
| `$__zbx_host` | Technical name of the host. |
| `$__zbx_host_id` | ID of the host. |

```
setAlias($__zbx_host_name: $__zbx_item)       -- backend01: CPU user time
setAlias(Item key: $__zbx_item_key)            -- Item key: system.cpu.load[percpu,avg1]
```

### setAlias

```
setAlias(alias)
```

Replaces the metric name with the given `alias`.

```
setAlias(load)
```

### setAliasByRegex

```
setAliasByRegex(regex)
```

Returns the part of the metric name that matches the `regex`.

```
setAliasByRegex(Zabbix busy [a-zA-Z]+)
```

### replaceAlias

```
replaceAlias(pattern, newAlias)
```

Replaces parts of the metric name using `pattern` (a regex or plain string). When using regex, the following replacement patterns are supported:

| Pattern | Inserts |
|---------|---------|
| `$$` | A literal `$`. |
| `$&` | The matched substring. |
| `` $` `` | The portion of the string before the match. |
| `$'` | The portion of the string after the match. |
| `$n` | The nth parenthesized capture group (where n is 0-99). |

For more details, refer to [String.prototype.replace()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace).

```
-- Given: "CPU system time"
replaceAlias(/CPU (.*) time/, $1)                    -- system

-- Given: "backend01: CPU system time"
replaceAlias(/CPU (.*) time/, $1)                    -- backend01: system
replaceAlias(/.*CPU (.*) time/, $1)                  -- system
replaceAlias(/(.*): CPU (.*) time/, $1 - $2)         -- backend01 - system
```

{{< admonition type="note" >}}
Grafana dashboard transforms such as "Join by label" are applied to raw query data and override alias functions. If this causes issues, use [Rename by regex](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#rename-by-regex) or [Value mappings with regex](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-value-mappings/#regex) instead.
{{< /admonition >}}

## Special functions

### consolidateBy

```
consolidateBy(consolidationFunc)
```

Changes the consolidation function used when the number of data points exceeds the graph width in pixels. By default, the plugin uses `avg`. Valid values: `sum`, `avg`, `min`, `max`, `count`.

When using [Direct DB Connection](https://grafana.com/docs/plugins/alexanderzobnin-zabbix-app/latest/configure/#configure-direct-db-connection), this function directly controls the SQL aggregation function. Pair it with `groupBy` for accurate results:

```
consolidateBy(max) | groupBy(1h, max)
```
