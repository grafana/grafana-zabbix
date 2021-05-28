package timeseries

import "math"

func (ts TimeSeries) SimpleMovingAverage(n int) TimeSeries {
	if ts.Len() == 0 {
		return ts
	}

	sma := NewTimeSeries()

	// It's not possible to calculate MA if n greater than number of points
	n = int(math.Min(float64(ts.Len()), float64(n)))

	// It's not a most performant way to caclulate MA, but since it's most straightforward, it's easy to read.
	// Should work fine on relatively small n, which is 90% of cases. Another way is caclulate window average, then add
	// next point ( (window sum + point value) / (count + 1) ) and remove the first one.
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

func (ts TimeSeries) ExponentialMovingAverage(an float64) TimeSeries {
	if ts.Len() == 0 {
		return ts
	}

	// It's not possible to calculate MA if n greater than number of points
	an = math.Min(float64(ts.Len()), an)

	// alpha coefficient should be between 0 and 1. If provided n <= 1, then use it as alpha directly. Otherwise, it's a
	// number of points in the window and alpha calculted from this information.
	var a float64
	var n int
	ema := []TimePoint{ts[0]}
	emaPrev := *ts[0].Value
	var emaCurrent float64

	if an > 1 {
		// Calculate a from window size
		a = 2 / (an + 1)
		n = int(an)

		// Initial window, use simple moving average
		windowCount := 0
		var windowSum float64 = 0
		for i := n; i > 0; i-- {
			point := ts[n-i]
			if point.Value != nil {
				windowSum += *point.Value
				windowCount++
			}
		}
		if windowCount > 0 {
			windowAvg := windowSum / float64(windowCount)
			// Actually, we should set timestamp from datapoints[n-1] and start calculation of EMA from n.
			// But in order to start EMA from first point (not from Nth) we should expand time range and request N additional
			// points outside left side of range. We can't do that, so this trick is used for pretty view of first N points.
			// We calculate AVG for first N points, but then start from 2nd point, not from Nth. In general, it means we
			// assume that previous N values (0-N, 0-(N-1), ..., 0-1) have the same average value as a first N values.
			ema[0] = TimePoint{Time: ts[0].Time, Value: &windowAvg}
			emaPrev = windowAvg
			n = 1
		}
	} else {
		// Use predefined a and start from 1st point (use it as initial EMA value)
		a = an
		n = 1
	}

	for i := n; i < ts.Len(); i++ {
		point := ts[i]
		if point.Value != nil {
			emaCurrent = a*(*point.Value) + (1-a)*emaPrev
			emaPrev = emaCurrent
			value := emaCurrent
			ema = append(ema, TimePoint{Time: point.Time, Value: &value})
		} else {
			ema = append(ema, TimePoint{Time: point.Time, Value: nil})
		}
	}

	return ema
}
