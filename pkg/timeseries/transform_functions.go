package timeseries

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
