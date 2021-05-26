package datasource

import (
	"fmt"
	"strconv"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
)

var errFunctionNotSupported = func(name string) error {
	return fmt.Errorf("function not supported: %s", name)
}

var errParsingFunctionParam = func(err error) error {
	return fmt.Errorf("failed to parse function param: %s", err)
}

type DataProcessingFunc = func(series timeseries.TimeSeries, params ...string) (timeseries.TimeSeries, error)

type AggDataProcessingFunc = func(series []*timeseries.TimeSeriesData, params ...string) ([]*timeseries.TimeSeriesData, error)

var seriesFuncMap map[string]DataProcessingFunc

var aggFuncMap map[string]AggDataProcessingFunc

var frontendFuncMap map[string]bool

func init() {
	seriesFuncMap = map[string]DataProcessingFunc{
		"groupBy": applyGroupBy,
		"scale":   applyScale,
		"offset":  applyOffset,
	}

	aggFuncMap = map[string]AggDataProcessingFunc{
		"aggregateBy": applyAggregateBy,
		"sumSeries":   applySumSeries,
	}

	// Functions processing on the frontend
	frontendFuncMap = map[string]bool{
		"setAlias":        true,
		"replaceAlias":    true,
		"setAliasByRegex": true,
	}
}

func applyFunctions(series []*timeseries.TimeSeriesData, functions []QueryFunction) ([]*timeseries.TimeSeriesData, error) {
	for _, f := range functions {
		if applyFunc, ok := seriesFuncMap[f.Def.Name]; ok {
			for _, s := range series {
				result, err := applyFunc(s.TS, f.Params...)
				if err != nil {
					return nil, err
				}
				s.TS = result
			}
		} else if applyAggFunc, ok := aggFuncMap[f.Def.Name]; ok {
			result, err := applyAggFunc(series, f.Params...)
			if err != nil {
				return nil, err
			}
			series = result
		} else if _, ok := frontendFuncMap[f.Def.Name]; ok {
			continue
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
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := getAggFunc(pAgg)
	s := series.GroupBy(interval, aggFunc)
	return s, nil
}

func applyScale(series timeseries.TimeSeries, params ...string) (timeseries.TimeSeries, error) {
	pFactor := params[0]
	factor, err := strconv.ParseFloat(pFactor, 64)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformScale(factor)
	return series.Transform(transformFunc), nil
}

func applyOffset(series timeseries.TimeSeries, params ...string) (timeseries.TimeSeries, error) {
	pOffset := params[0]
	offset, err := strconv.ParseFloat(pOffset, 64)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformOffset(offset)
	return series.Transform(transformFunc), nil
}

func applyAggregateBy(series []*timeseries.TimeSeriesData, params ...string) ([]*timeseries.TimeSeriesData, error) {
	pInterval := params[0]
	pAgg := params[1]
	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := getAggFunc(pAgg)
	aggregatedSeries := timeseries.AggregateBy(series, interval, aggFunc)
	aggregatedSeries.Meta.Name = fmt.Sprintf("aggregateBy(%s, %s)", pInterval, pAgg)

	return []*timeseries.TimeSeriesData{aggregatedSeries}, nil
}

func applySumSeries(series []*timeseries.TimeSeriesData, params ...string) ([]*timeseries.TimeSeriesData, error) {
	sum := timeseries.SumSeries(series)
	sum.Meta.Name = "sumSeries()"
	return []*timeseries.TimeSeriesData{sum}, nil
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
