package timeseries

import (
	"math"
	"sort"
)

type AggregationFunc = func(points []TimePoint) *float64

func AggAvg(points []TimePoint) *float64 {
	sum := AggSum(points)
	// Do not include nulls in the average
	nonNullLength := 0
	for _, p := range points {
		if p.Value != nil {
			nonNullLength++
		}
	}
	if sum == nil || nonNullLength == 0 {
		return nil
	}
	avg := *sum / float64(nonNullLength)
	return &avg
}

func AggSum(points []TimePoint) *float64 {
	var sum float64 = 0
	isNil := true
	for _, p := range points {
		if p.Value != nil {
			isNil = false
			sum += *p.Value
		}
	}
	// Skip empty frames
	if isNil {
		return nil
	}
	return &sum
}

func AggMax(points []TimePoint) *float64 {
	var max *float64 = nil
	for _, p := range points {
		if p.Value != nil {
			if max == nil {
				max = p.Value
			} else if *p.Value > *max {
				max = p.Value
			}
		}
	}
	return max
}

func AggMin(points []TimePoint) *float64 {
	var min *float64 = nil
	for _, p := range points {
		if p.Value != nil {
			if min == nil {
				min = p.Value
			} else if *p.Value < *min {
				min = p.Value
			}
		}
	}
	return min
}

func AggCount(points []TimePoint) *float64 {
	count := float64(len(points))
	return &count
}

func AggFirst(points []TimePoint) *float64 {
	return points[0].Value
}

func AggLast(points []TimePoint) *float64 {
	return points[len(points)-1].Value
}

func AggMedian(points []TimePoint) *float64 {
	return AggPercentile(50)(points)
}

func AggPercentile(n float64) AggregationFunc {
	return func(points []TimePoint) *float64 {
		values := make([]float64, 0)
		for _, p := range points {
			if p.Value != nil {
				values = append(values, *p.Value)
			}
		}
		if len(values) == 0 {
			return nil
		}

		sort.Sort(sort.Float64Slice(values))
		percentileIndex := int(math.Floor(float64(len(values)) * n / 100))
		percentile := values[percentileIndex]
		return &percentile
	}
}
