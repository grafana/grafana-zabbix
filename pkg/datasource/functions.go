package datasource

import (
	"fmt"
	"strconv"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
)

const RANGE_VARIABLE_VALUE = "range_series"

var (
	errFunctionNotSupported = func(name string) error {
		return fmt.Errorf("function not supported: %s", name)
	}
	errParsingFunctionParam = func(err error) error {
		return fmt.Errorf("failed to parse function param: %s", err)
	}
)

func MustString(p QueryFunctionParam) (string, error) {
	if pStr, ok := p.(string); ok {
		return pStr, nil
	}
	return "", fmt.Errorf("failed to convert value to string: %v", p)
}

func MustFloat64(p QueryFunctionParam) (float64, error) {
	if pFloat, ok := p.(float64); ok {
		return pFloat, nil
	} else if pStr, ok := p.(string); ok {
		if pFloat, err := strconv.ParseFloat(pStr, 64); err == nil {
			return pFloat, nil
		}
	}
	return 0, fmt.Errorf("failed to convert value to float: %v", p)
}

type DataProcessingFunc = func(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error)

type AggDataProcessingFunc = func(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error)

var seriesFuncMap map[string]DataProcessingFunc

var aggFuncMap map[string]AggDataProcessingFunc

var frontendFuncMap map[string]bool

func init() {
	seriesFuncMap = map[string]DataProcessingFunc{
		"groupBy":    applyGroupBy,
		"scale":      applyScale,
		"offset":     applyOffset,
		"percentile": applyPercentile,
	}

	aggFuncMap = map[string]AggDataProcessingFunc{
		"aggregateBy":   applyAggregateBy,
		"sumSeries":     applySumSeries,
		"percentileAgg": applyPercentileAgg,
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

func applyGroupBy(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	pInterval, err := MustString(params[0])
	pAgg, err := MustString(params[1])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := getAggFunc(pAgg)
	if pInterval == RANGE_VARIABLE_VALUE {
		s := series.GroupByRange(aggFunc)
		return s, nil
	}

	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	s := series.GroupBy(interval, aggFunc)
	return s, nil
}

func applyPercentile(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	pInterval, err := MustString(params[0])
	percentile, err := MustFloat64(params[1])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := timeseries.AggPercentile(percentile)
	if pInterval == RANGE_VARIABLE_VALUE {
		s := series.GroupByRange(aggFunc)
		return s, nil
	}

	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	s := series.GroupBy(interval, aggFunc)
	return s, nil
}

func applyScale(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	pFactor, err := MustString(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}
	factor, err := strconv.ParseFloat(pFactor, 64)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformScale(factor)
	return series.Transform(transformFunc), nil
}

func applyOffset(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	offset, err := MustFloat64(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformOffset(offset)
	return series.Transform(transformFunc), nil
}

func applyAggregateBy(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error) {
	pInterval, err := MustString(params[0])
	pAgg, err := MustString(params[1])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := getAggFunc(pAgg)
	aggregatedSeries := timeseries.AggregateBy(series, interval, aggFunc)
	aggregatedSeries.Meta.Name = fmt.Sprintf("aggregateBy(%s, %s)", pInterval, pAgg)

	return []*timeseries.TimeSeriesData{aggregatedSeries}, nil
}

func applySumSeries(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error) {
	sum := timeseries.SumSeries(series)
	sum.Meta.Name = "sumSeries()"
	return []*timeseries.TimeSeriesData{sum}, nil
}

func applyPercentileAgg(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error) {
	pInterval, err := MustString(params[0])
	percentile, err := MustFloat64(params[1])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := timeseries.AggPercentile(percentile)
	aggregatedSeries := timeseries.AggregateBy(series, interval, aggFunc)
	aggregatedSeries.Meta.Name = fmt.Sprintf("percentileAgg(%s, %v)", pInterval, percentile)

	return []*timeseries.TimeSeriesData{aggregatedSeries}, nil
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
