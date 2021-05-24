package datasource

import (
	"fmt"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
)

var errFunctionNotSupported = func(name string) error {
	return fmt.Errorf("function not supported: %s", name)
}

type DataProcessingFunc = func(series timeseries.TimeSeries, params ...string) timeseries.TimeSeries

var funcMap map[string]DataProcessingFunc

func init() {
	funcMap = make(map[string]DataProcessingFunc)
	funcMap["groupBy"] = applyGroupBy
}

func applyFunctions(series []*timeseries.TimeSeriesData, functions []QueryFunction) ([]*timeseries.TimeSeriesData, error) {
	for _, f := range functions {
		if applyFunc, ok := funcMap[f.Def.Name]; ok {
			for _, s := range series {
				s.TS = applyFunc(s.TS, f.Params...)
			}
		} else {
			err := errFunctionNotSupported(f.Def.Name)
			return series, err
		}
	}
	return series, nil
}

func applyGroupBy(series timeseries.TimeSeries, params ...string) timeseries.TimeSeries {
	s := series.GroupBy(time.Minute, "avg")
	return s
}
