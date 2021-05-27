package timeseries

import "math"

func (ts TimeSeries) SimpleMovingAverage(n int) TimeSeries {
	if ts.Len() == 0 {
		return ts
	}

	sma := NewTimeSeries()

	// It's not possible to calculate MA if n greater than number of points
	n = int(math.Min(float64(ts.Len()), float64(n)))

	for i := n; i < ts.Len(); i++ {
		windowEdgeRight := i
		windowCount := 0
		var windowSum float64 = 0
		for j := 0; j < n; j++ {
			point := ts[i-j]
			if point.Value != nil {
				windowSum += *point.Value
				windowCount++
			}
		}
		if windowCount > 0 {
			windowAvg := windowSum / float64(windowCount)
			sma = append(sma, TimePoint{Time: ts[windowEdgeRight].Time, Value: &windowAvg})
		} else {
			sma = append(sma, TimePoint{Time: ts[windowEdgeRight].Time, Value: nil})
		}
	}

	return sma
}
