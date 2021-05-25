package datasource

import (
	"fmt"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
)

var errFunctionNotSupported = func(name string) error {
	return fmt.Errorf("function not supported: %s", name)
}

type DataProcessingFunc = func(series timeseries.TimeSeries, params ...string) (timeseries.TimeSeries, error)

var funcMap map[string]DataProcessingFunc

func init() {
	funcMap = map[string]DataProcessingFunc{
		"groupBy": applyGroupBy,
	}

}

func applyFunctions(series []*timeseries.TimeSeriesData, functions []QueryFunction) ([]*timeseries.TimeSeriesData, error) {
	for _, f := range functions {
		if applyFunc, ok := funcMap[f.Def.Name]; ok {
			for _, s := range series {
				result, err := applyFunc(s.TS, f.Params...)
				if err != nil {
					return nil, err
				}
				s.TS = result
			}
		} else {
			err := errFunctionNotSupported(f.Def.Name)
			return series, err
		}
	}
	return series, nil
}

func applyGroupBy(series timeseries.TimeSeries, params ...string) (timeseries.TimeSeries, error) {
	pInterval := params[0]
	pAgg := params[1]
	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, err
	}

	aggFunc := getAggFunc(pAgg)
	s := series.GroupBy(interval, aggFunc)
	return s, nil
}

func getAggFunc(agg string) timeseries.AggFunc {
	switch agg {
	case "avg":
		return timeseries.AggAvg
	case "max":
		return timeseries.AggMax
	case "min":
		return timeseries.AggMin
	case "sum":
		return timeseries.AggSum
	case "median":
		return timeseries.AggMedian
	case "count":
		return timeseries.AggCount
	case "first":
		return timeseries.AggFirst
	case "last":
		return timeseries.AggLast
	default:
		return timeseries.AggAvg
	}
}
