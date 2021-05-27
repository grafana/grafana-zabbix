package timeseries

import "time"

func TransformScale(factor float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		return transformScale(point, factor)
	}
}

func TransformOffset(offset float64) TransformFunc {
	return func(point TimePoint) TimePoint {
		return transformOffset(point, offset)
	}
}

func TransformShiftTime(interval time.Duration) TransformFunc {
	return func(point TimePoint) TimePoint {
		return transformShiftTime(point, interval)
	}
}

func transformScale(point TimePoint, factor float64) TimePoint {
	if point.Value != nil {
		newValue := *point.Value * factor
		point.Value = &newValue
	}
	return point
}

func transformOffset(point TimePoint, offset float64) TimePoint {
	if point.Value != nil {
		newValue := *point.Value + offset
		point.Value = &newValue
	}
	return point
}

func transformShiftTime(point TimePoint, interval time.Duration) TimePoint {
	shiftedTime := point.Time.Add(interval)
	point.Time = shiftedTime
	return point
}
