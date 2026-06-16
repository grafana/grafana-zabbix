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
			nullPointsToAdd := make([]TimePoint, 0)
			for frameTs.Before(pointFrameTs) {
				nullPointsToAdd = append(nullPointsToAdd, TimePoint{Time: frameTs, Value: nil})
				frameTs = frameTs.Add(interval)
			}
			if len(nullPointsToAdd) > 1 {
				alignedTs = append(alignedTs, nullPointsToAdd...)
			} else if len(nullPointsToAdd) == 1 && i < ts.Len()-1 {
				// In case of 1 point gap, insert interpolated value to prevent unnecessary gaps
				interpolatedPoint := nullPointsToAdd[0]
				left := alignedTs[len(alignedTs)-1]
				right := TimePoint{Time: pointFrameTs, Value: point.Value}
				pointValue := linearInterpolation(interpolatedPoint.Time, left, right)
				interpolatedPoint.Value = &pointValue
				alignedTs = append(alignedTs, interpolatedPoint)
			}
		}

		if len(alignedTs) > 0 && alignedTs[len(alignedTs)-1].Time.Equal(pointFrameTs) {
			// Do not append points with the same timestamp
			alignedTs[len(alignedTs)-1] = TimePoint{Time: pointFrameTs, Value: point.Value}
		} else {
			alignedTs = append(alignedTs, TimePoint{Time: pointFrameTs, Value: point.Value})
		}
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

// PrepareForStack performs series interpolation to make series consist of the points with same time stamps
func PrepareForStack(series []*TimeSeriesData) []*TimeSeriesData {
	if len(series) == 0 {
		return series
	}

	// Build unique set of time stamps from all series
	interpolatedTimeStampsMap := make(map[time.Time]time.Time)
	for _, s := range series {
		for _, p := range s.TS {
			interpolatedTimeStampsMap[p.Time] = p.Time
		}
	}

	// Convert to slice and sort
	interpolatedTimeStamps := make([]time.Time, 0)
	for _, ts := range interpolatedTimeStampsMap {
		interpolatedTimeStamps = append(interpolatedTimeStamps, ts)
	}
	sort.Slice(interpolatedTimeStamps, func(i, j int) bool {
		return interpolatedTimeStamps[i].Before(interpolatedTimeStamps[j])
	})

	for _, s := range series {
		if s.Len() < 2 {
			continue
		}

		p := s.TS[0]
		pNext := s.TS[1]
		interpolatedSeries := make([]TimePoint, 0)
		interpolatedTSIdx := 0

		// Insert nulls before the first point
		for i := 0; i < len(interpolatedTimeStamps); i++ {
			interpolatedTS := interpolatedTimeStamps[i]
			if interpolatedTS.Before(p.Time) {
				interpolatedSeries = append(interpolatedSeries, TimePoint{Time: interpolatedTS, Value: nil})
			} else {
				interpolatedTSIdx = i
				break
			}
		}

		for i := 0; i < s.Len()-1; i++ {
			p = s.TS[i]
			pNext = s.TS[i+1]

			interpolatedSeries = append(interpolatedSeries, p)

			// Insert interpolated points between existing
			for interpolatedTimeStamps[interpolatedTSIdx].Before(pNext.Time) && interpolatedTSIdx < len(interpolatedTimeStamps) {
				if interpolatedTimeStamps[interpolatedTSIdx].Equal(p.Time) {
					interpolatedTSIdx++
					continue
				}

				frameTs := interpolatedTimeStamps[interpolatedTSIdx]
				if p.Value != nil && pNext.Value != nil {
					pointValue := linearInterpolation(frameTs, p, pNext)
					interpolatedSeries = append(interpolatedSeries, TimePoint{Time: frameTs, Value: &pointValue})
				} else {
					// Next or current point is null means we're currently in a gap between 2 points,
					// so put nulls instead of interpolating values.
					interpolatedSeries = append(interpolatedSeries, TimePoint{Time: frameTs, Value: nil})
				}
				interpolatedTSIdx++
			}
		}

		interpolatedSeries = append(interpolatedSeries, pNext)
		s.TS = interpolatedSeries
	}

	return series
}
