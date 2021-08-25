package timeseries

import (
	"sort"
	"strconv"
)

// SortBy sorts series by value calculated with provided aggFunc in given order
func SortBy(series []*TimeSeriesData, order string, aggFunc AggFunc) []*TimeSeriesData {
	aggregatedSeries := make([]TimeSeries, len(series))
	for i, s := range series {
		aggregatedSeries[i] = s.TS.GroupByRange(aggFunc)
	}

	// Sort by aggregated value
	sort.Slice(series, func(i, j int) bool {
		if len(aggregatedSeries[i]) > 0 && len(aggregatedSeries[j]) > 0 {
			return *aggregatedSeries[i][0].Value < *aggregatedSeries[j][0].Value
		} else if len(aggregatedSeries[j]) > 0 {
			return true
		}
		return false
	})

	if order == "desc" {
		reverseSeries := make([]*TimeSeriesData, len(series))
		for i := 0; i < len(series); i++ {
			reverseSeries[i] = series[len(series)-1-i]
		}
		series = reverseSeries
	}

	return series
}

func SortByItem(series []*TimeSeriesData) []*TimeSeriesData {
	sort.Slice(series, func(i, j int) bool {
		itemIDi, err := strconv.Atoi(series[i].Meta.Item.ID)
		if err != nil {
			return false
		}

		itemIDj, err := strconv.Atoi(series[j].Meta.Item.ID)
		if err != nil {
			return false
		}

		return itemIDi < itemIDj
	})

	return series
}

func SortByName(series []*TimeSeriesData, order string) []*TimeSeriesData {
	sort.Slice(series, func(i, j int) bool {
		if order == "desc" {
			return series[i].Meta.Name > series[j].Meta.Name
		} else {
			return series[i].Meta.Name < series[j].Meta.Name
		}
	})

	return series
}
