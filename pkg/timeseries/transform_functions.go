package timeseries

import "time"

func TransformScale(factor float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		if point.Value != nil {
			newValue := *point.Value * factor
			point.Value = &newValue
		}
		return point
	}
}

func TransformOffset(offset float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		if point.Value != nil {
			newValue := *point.Value + offset
			point.Value = &newValue
		}
		return point
	}
}

func TransformNull(nullValue float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		if point.Value == nil {
			point.Value = &nullValue
		}
		return point
	}
}

func TransformRemoveAboveValue(threshold float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		if point.Value != nil && *point.Value > threshold {
			point.Value = nil
		}
		return point
	}
}

func TransformRemoveBelowValue(threshold float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		if point.Value != nil && *point.Value < threshold {
			point.Value = nil
		}
		return point
	}
}

func TransformShiftTime(interval time.Duration) TransformFunc {
	return func(point TimePoint) TimePoint {
		shiftedTime := point.Time.Add(interval)
		point.Time = shiftedTime
		return point
	}
}
