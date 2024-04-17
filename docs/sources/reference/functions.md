---
title: Functions reference
menuTitle: Functions reference
description: Functions reference
aliases:
keywords:
  - data source
  - zabbix
labels:
  products:
    - oss
    - grafana cloud
weight: 510
---

## Functions Variables

There are some built-in template variables available for using in functions:

- `$__range_ms` - panel time range in ms
- `$__range_s` - panel time range in seconds
- `$__range` - panel time range, string representation (`30s`, `1m`, `1h`)
- `$__range_series` - invoke function over all series values

Examples:

```sh
groupBy($__range, avg)
percentile($__range_series, 95) - 95th percentile over all values
```

---

## Transform

### _groupBy_

```sh
groupBy(interval, function)
```

Takes each timeseries and consolidate its points fallen in the given _interval_ into one point using _function_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:

```sh
groupBy(10m, avg)
groupBy(1h, median)
```

---

### _scale_

```sh
scale(factor)
```

Takes timeseries and multiplies each point by the given _factor_.

Examples:

```sh
scale(100)
scale(0.01)
```

---

### _delta_

```sh
delta()
```

Converts absolute values to delta. This function just calculate difference between values. For the per-second
calculation use `rate()`.

---

### _rate_

```sh
rate()
```

Calculates the per-second rate of increase of the time series. Resistant to counter reset. Suitable for converting of
growing counters into the per-second rate.

---

### _movingAverage_

```sh
movingAverage(windowSize)
```

Graphs the moving average of a metric over a fixed number of past points, specified by `windowSize` param.

Examples:

```sh
movingAverage(60)
calculates moving average over 60 points (if metric has 1 second resolution it matches 1 minute window)
```

---

### _exponentialMovingAverage_

```sh
exponentialMovingAverage(windowSize)
```

Takes a series of values and a window size and produces an exponential moving average utilizing the following formula:  
`ema(current) = constant * (Current Value) + (1 - constant) * ema(previous)`

The Constant is calculated as:  
`constant = 2 / (windowSize + 1)`

If windowSize < 1 (0.1, for instance), Constant wouldn't be calculated and will be taken directly from windowSize
(Constant = windowSize).

It's a bit tricky to graph EMA from the first point of series (not from Nth = windowSize). In order to do it,
plugin should fetch previous N points first and calculate simple moving average for it. To avoid it, plugin uses this
hack: assume, previous N points have the same average values as first N (windowSize). So you should keep this fact
in mind and don't rely on first N points interval.

Examples:

```sh
movingAverage(60)
calculates moving average over 60 points (if metric has 1 second resolution it matches 1 minute window)
```

---

### _percentile_

```sh
percentile(interval, N)
```

Takes a series of values and a window size and consolidate all its points fallen in the given _interval_ into one point by Nth percentile.

Examples:

```sh
percentile(1h, 99)
percentile($__range_series, 95) - 95th percentile over all series values
```

---

### _removeAboveValue_

```sh
removeAboveValue(N)
```

Replaces series values with `null` if value > N

Examples:

```sh
removeAboveValue(1)
```

---

### _removeBelowValue_

```sh
removeBelowValue(N)
```

Replaces series values with `null` if value < N

---

### _transformNull_

```sh
transformNull(N)
```

Replaces `null` values with N

---

## Aggregate

### _aggregateBy_

```sh
aggregateBy(interval, function)
```

Takes all timeseries and consolidate all its points fallen in the given _interval_ into one point using _function_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:

```sh
aggregateBy(10m, avg)
aggregateBy(1h, median)
```

---

### _sumSeries_

```sh
sumSeries()
```

This will add metrics together and return the sum at each datapoint. This method required interpolation of each timeseries so it may cause high CPU load. Try to combine it with _groupBy()_ function to reduce load.

---

### _percentileAgg_

```sh
percentileAgg(interval, N)
```

Takes all timeseries and consolidate all its points fallen in the given _interval_ into one point by Nth percentile.

Examples:

```sh
percentileAgg(1h, 99)
percentileAgg($__range_series, 95) - 95th percentile over all values
```

---

### _average_

```sh
average(interval)
```

**Deprecated**, use `aggregateBy(interval, avg)` instead.

---

### _min_

```sh
min(interval)
```

**Deprecated**, use `aggregateBy(interval, min)` instead.

---

### _max_

```sh
max(interval)
```

**Deprecated**, use `aggregateBy(interval, max)` instead.

---

## Filter

### _top_

```sh
top(N, value)
```

Returns top N series, sorted by _value_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:

```sh
top(10, avg)
top(5, max)
```

---

### _bottom_

```sh
bottom(N, value)
```

Returns bottom N series, sorted by _value_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:

```sh
bottom(5, avg)
```

---

## Trends

### _trendValue_

```sh
trendValue(valueType)
```

Specifying type of trend value returned by Zabbix when trends are used (avg, min or max).

---

## Time

### _timeShift_

```sh
timeShift(interval)
```

Draws the selected metrics shifted in time. If no sign is given, a minus sign ( - ) is implied which will shift the metric back in time. If a plus sign ( + ) is given, the metric will be shifted forward in time.
Examples:

```sh
timeShift(24h)  - shift metric back in 24h hours
timeShift(-24h) - the same result as for timeShift(24h)
timeShift(+1d)  - shift metric forward in 1 day
```

---

## Alias

Following template variables available for using in `setAlias()` and `replaceAlias()` functions:

- `$__zbx_item`, `$__zbx_item_name` - item name
- `$__zbx_item_key` - item key
- `$__zbx_host_name` - visible name of the host
- `$__zbx_host` - technical name of the host

Examples:

```sh
setAlias($__zbx_host_name: $__zbx_item) -> backend01: CPU user time
setAlias(Item key: $__zbx_item_key) -> Item key: system.cpu.load[percpu,avg1]
setAlias($__zbx_host_name) -> backend01
```

### _setAlias_

```sh
setAlias(alias)
```

Returns given alias instead of the metric name.

Examples:

```sh
setAlias(load)
```

---

### _setAliasByRegex_

```sh
setAliasByRegex(regex)
```

Returns part of the metric name matched by regex.

Examples:

```sh
setAlias(Zabbix busy [a-zA-Z]+)
```

---

### _replaceAlias_

```sh
replaceAlias(pattern, newAlias)
```

Replace metric name using pattern. Pattern is regex or regular string. If regex is used, following special replacement patterns are supported:

| Pattern | Inserts                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| $$      | Inserts a "$".                                                                                                                                   |
| $&      | Inserts the matched substring.                                                                                                                   |
| $`      | Inserts the portion of the string that precedes the matched substring.                                                                           |
| $'      | Inserts the portion of the string that follows the matched substring.                                                                            |
| $n      | Where n is a non-negative integer less than 100, inserts the nth parenthesized submatch string, provided the first argument was a RegExp object. |

For more details see [String.prototype.replace()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace) function.

Examples:

```sh
CPU system time
replaceAlias(/CPU (.*) time/, $1) -> system

backend01: CPU system time
replaceAlias(/CPU (.*) time/, $1) -> backend01: system

backend01: CPU system time
replaceAlias(/.*CPU (.*) time/, $1) -> system

backend01: CPU system time
replaceAlias(/(.*): CPU (.*) time/, $1 - $2) -> backend01 - system
```

---

## Special

### _consolidateBy_

```sh
consolidateBy(consolidationFunc)
```

When a graph is drawn where width of the graph size in pixels is smaller than the number of datapoints to be graphed, plugin consolidates the values to prevent line overlap. The consolidateBy() function changes the consolidation function from the default of average to one of `sum`, `min`, `max` or `count`.

Valid function names are `sum`, `avg`, `min`, `max` and `count`.

---
