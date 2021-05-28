package datasource

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
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

type PreProcessingFunc = func(query *QueryModel, items []*zabbix.Item, params ...interface{}) error

var seriesFuncMap map[string]DataProcessingFunc

var aggFuncMap map[string]AggDataProcessingFunc

var filterFuncMap map[string]AggDataProcessingFunc

var timeFuncMap map[string]PreProcessingFunc

var frontendFuncMap map[string]bool

func init() {
	seriesFuncMap = map[string]DataProcessingFunc{
		"groupBy":                  applyGroupBy,
		"scale":                    applyScale,
		"offset":                   applyOffset,
		"delta":                    applyDelta,
		"rate":                     applyRate,
		"movingAverage":            applyMovingAverage,
		"exponentialMovingAverage": applyExponentialMovingAverage,
		"removeAboveValue":         applyRemoveAboveValue,
		"removeBelowValue":         applyRemoveBelowValue,
		"transformNull":            applyTransformNull,
		"percentile":               applyPercentile,
		"timeShift":                applyTimeShiftPost,
	}

	aggFuncMap = map[string]AggDataProcessingFunc{
		"aggregateBy":   applyAggregateBy,
		"sumSeries":     applySumSeries,
		"percentileAgg": applyPercentileAgg,
	}

	filterFuncMap = map[string]AggDataProcessingFunc{
		"top":        applyTop,
		"bottom":     applyBottom,
		"sortSeries": applySortSeries,
	}

	timeFuncMap = map[string]PreProcessingFunc{
		"timeShift": applyTimeShiftPre,
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
		} else if applyFilterFunc, ok := filterFuncMap[f.Def.Name]; ok {
			result, err := applyFilterFunc(series, f.Params...)
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

// applyFunctionsPre applies functions requires pre-processing, like timeShift() (it needs to change original time range)
func applyFunctionsPre(query *QueryModel, items []*zabbix.Item) error {
	for _, f := range query.Functions {
		if applyFunc, ok := timeFuncMap[f.Def.Name]; ok {
			err := applyFunc(query, items, f.Params...)
			if err != nil {
				return err
			}
		}
	}

	return nil
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

func applyDelta(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	return series.Delta(), nil
}

func applyRate(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	return series.Rate(), nil
}

func applyRemoveAboveValue(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	threshold, err := MustFloat64(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformRemoveAboveValue(threshold)
	return series.Transform(transformFunc), nil
}

func applyRemoveBelowValue(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	threshold, err := MustFloat64(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformRemoveBelowValue(threshold)
	return series.Transform(transformFunc), nil
}

func applyTransformNull(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	nullValue, err := MustFloat64(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	transformFunc := timeseries.TransformNull(nullValue)
	return series.Transform(transformFunc), nil
}

func applyMovingAverage(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	nFloat, err := MustFloat64(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}
	n := int(nFloat)

	return series.SimpleMovingAverage(n), nil
}

func applyExponentialMovingAverage(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	n, err := MustFloat64(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	return series.ExponentialMovingAverage(n), nil
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

func applyTop(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error) {
	n, err := MustFloat64(params[0])
	pAgg, err := MustString(params[1])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := getAggFunc(pAgg)
	filteredSeries := timeseries.Filter(series, int(n), "top", aggFunc)
	return filteredSeries, nil
}

func applyBottom(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error) {
	n, err := MustFloat64(params[0])
	pAgg, err := MustString(params[1])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := getAggFunc(pAgg)
	filteredSeries := timeseries.Filter(series, int(n), "bottom", aggFunc)
	return filteredSeries, nil
}

func applySortSeries(series []*timeseries.TimeSeriesData, params ...interface{}) ([]*timeseries.TimeSeriesData, error) {
	order, err := MustString(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}

	aggFunc := timeseries.AggAvg
	sorted := timeseries.SortBy(series, order, aggFunc)
	return sorted, nil
}

func applyTimeShiftPre(query *QueryModel, items []*zabbix.Item, params ...interface{}) error {
	pInterval, err := MustString(params[0])
	if err != nil {
		return errParsingFunctionParam(err)
	}
	shiftForward := false
	pInterval = strings.TrimPrefix(pInterval, "-")
	if strings.Index(pInterval, "+") == 0 {
		pInterval = strings.TrimPrefix(pInterval, "+")
		shiftForward = true
	}

	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return errParsingFunctionParam(err)
	}

	if shiftForward {
		query.TimeRange.From = query.TimeRange.From.Add(interval)
		query.TimeRange.To = query.TimeRange.To.Add(interval)
	} else {
		query.TimeRange.From = query.TimeRange.From.Add(-interval)
		query.TimeRange.To = query.TimeRange.To.Add(-interval)
	}

	return nil
}

func applyTimeShiftPost(series timeseries.TimeSeries, params ...interface{}) (timeseries.TimeSeries, error) {
	pInterval, err := MustString(params[0])
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}
	shiftForward := false
	pInterval = strings.TrimPrefix(pInterval, "-")
	if strings.Index(pInterval, "+") == 0 {
		pInterval = strings.TrimPrefix(pInterval, "+")
		shiftForward = true
	}

	interval, err := gtime.ParseInterval(pInterval)
	if err != nil {
		return nil, errParsingFunctionParam(err)
	}
	if shiftForward == true {
		interval = -interval
	}

	transformFunc := timeseries.TransformShiftTime(interval)
	return series.Transform(transformFunc), nil
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

func sortSeriesPoints(series []*timeseries.TimeSeriesData) {
	for _, s := range series {
		s.TS.Sort()
	}
}
