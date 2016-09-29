Functions reference
===================

Transform
---------

### groupBy

```
groupBy(interval, function)
```

Takes each timeseries and consolidate its points falled in given _interval_ into one point using _function_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:
```
groupBy(10m, avg)
groupBy(1h, median)
```

### scale
```
scale(factor)
```
Takes timeseries and multiplies each point by the given _factor_.

Examples:
```
scale(100)
scale(0.01)
```

### delta
```
delta()
```
Convert absolute values to delta, for example, bits to bits/sec.


Aggregate
---------

### aggregateBy
```
aggregateBy(interval, function)
```

Takes all timeseries and consolidate all its points falled in given _interval_ into one point using _function_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:
```
aggregateBy(10m, avg)
aggregateBy(1h, median)
```

### sumSeries
```
sumSeries()
```

This will add metrics together and return the sum at each datapoint. This method required interpolation of each timeseries so it may cause high CPU load. Try to combine it with _groupBy()_ function to reduce load.

### average
```
average(interval)
```
**Deprecated**, use `aggregateBy(interval, avg)` instead.

### min
```
min(interval)
```
**Deprecated**, use `aggregateBy(interval, min)` instead.

### max
```
max(interval)
```
**Deprecated**, use `aggregateBy(interval, max)` instead.


Filter
---------

### top

```
top(N, value)
```

Returns top N series, sorted by _value_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:
```
top(10, avg)
top(5, max)
```

### bottom

```
bottom(N, value)
```

Returns bottom N series, sorted by _value_, which can be one of: _avg_, _min_, _max_, _median_.

Examples:
```
bottom(5, avg)
```


## Trends

### trendValue
```
trendValue(valueType)
```

Specifying type of trend value returned by Zabbix when trends are used (avg, min or max).

## Alias

### setAlias
```
setAlias(alias)
```

Returns given alias instead of the metric name.

Examples:
```
setAlias(load)
```
