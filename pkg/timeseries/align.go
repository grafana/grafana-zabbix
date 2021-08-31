package timeseries

import (
	"math"
	"sort"
	"time"
)

// Aligns point's time stamps according to provided interval.
func (ts TimeSeries) Align(interval time.Duration) TimeSeries {
	if interval <= 0 || ts.Len() < 2 {
		return ts
	}

	alignedTs := NewTimeSeries()
	var frameTs = ts[0].GetTimeFrame(interval)
	var pointFrameTs time.Time
	var point TimePoint

	for i := 0; i < ts.Len(); i++ {
		point = ts[i]
		pointFrameTs = point.GetTimeFrame(interval)

		if pointFrameTs.After(frameTs) {
			for frameTs.Before(pointFrameTs) {
				alignedTs = append(alignedTs, TimePoint{Time: frameTs, Value: nil})
				frameTs = frameTs.Add(interval)
			}
		}

		alignedTs = append(alignedTs, TimePoint{Time: pointFrameTs, Value: point.Value})
		frameTs = frameTs.Add(interval)
	}

	return alignedTs
}

// Fill missing points in trend by null values
func (ts TimeSeries) FillTrendWithNulls() TimeSeries {
	if ts.Len() < 2 {
		return ts
	}

	interval := time.Hour
	alignedTs := NewTimeSeries()
	var frameTs = ts[0].GetTimeFrame(interval)
	var pointFrameTs time.Time
	var point TimePoint

	for i := 0; i < ts.Len(); i++ {
		point = ts[i]
		pointFrameTs = point.GetTimeFrame(interval)

		if pointFrameTs.After(frameTs) {
			for frameTs.Before(pointFrameTs) {
				alignedTs = append(alignedTs, TimePoint{Time: frameTs, Value: nil})
				frameTs = frameTs.Add(interval)
			}
		}

		alignedTs = append(alignedTs, point)
		frameTs = frameTs.Add(interval)
	}

	return alignedTs
}

// Detects interval between data points in milliseconds based on median delta between points.
func (ts TimeSeries) DetectInterval() time.Duration {
	if ts.Len() < 2 {
		return 0
	}

	deltas := make([]int, 0)
	for i := 1; i < ts.Len(); i++ {
		delta := ts[i].Time.Sub(ts[i-1].Time)
		deltas = append(deltas, int(delta.Milliseconds()))
	}
	sort.Ints(deltas)
	midIndex := int(math.Floor(float64(len(deltas)) * 0.5))
	return time.Duration(deltas[midIndex]) * time.Millisecond
}

// AlignSeriesIntervals aligns series to the same time interval
func AlignSeriesIntervals(series []*TimeSeriesData) []*TimeSeriesData {
	if len(series) == 0 {
		return series
	}

	// Skip if interval not defined
	for _, s := range series {
		if s.Meta.Interval == nil {
			return series
		}
	}

	minInterval := *series[0].Meta.Interval
	for _, s := range series {
		if *s.Meta.Interval < minInterval {
			minInterval = *s.Meta.Interval
		}
	}

	// 0 interval means series is not aligned, so it's tricky to align multiple series
	if minInterval == 0 {
		return series
	}

	for _, s := range series {
		if s.Len() < 2 || *s.Meta.Interval == minInterval {
			continue
		}

		s.TS = s.TS.Interpolate(minInterval)
	}

	return series
}

func (ts TimeSeries) Interpolate(interval time.Duration) TimeSeries {
	if interval <= 0 || ts.Len() < 2 {
		return ts
	}

	alignedTs := NewTimeSeries()
	var frameTs = ts[0].Time
	var pointFrameTs time.Time
	var point TimePoint
	var nextPoint TimePoint

	for i := 0; i < ts.Len()-1; i++ {
		point = ts[i]
		nextPoint = ts[i+1]
		pointFrameTs = point.Time

		if point.Value != nil && nextPoint.Value != nil {
			frameTs = pointFrameTs.Add(interval)
			for frameTs.Before(nextPoint.Time) {
				pointValue := linearInterpolation(frameTs, point, nextPoint)
				alignedTs = append(alignedTs, TimePoint{Time: frameTs, Value: &pointValue})
				frameTs = frameTs.Add(interval)
			}
		}

		alignedTs = append(alignedTs, TimePoint{Time: pointFrameTs, Value: point.Value})
		frameTs = frameTs.Add(interval)
	}

	return alignedTs
}
