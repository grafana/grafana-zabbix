package timeseries

import (
	"errors"
	"math"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func NewTimeSeriesData() *TimeSeriesData {
	return &TimeSeriesData{
		TS:   NewTimeSeries(),
		Meta: TimeSeriesMeta{},
	}
}

func (tsd TimeSeriesData) Len() int {
	return len(tsd.TS)
}

func (tsd *TimeSeriesData) Add(point TimePoint) *TimeSeriesData {
	if tsd.TS == nil {
		tsd.TS = NewTimeSeries()
	}

	tsd.TS = append(tsd.TS, point)
	return tsd
}

// GroupBy groups points in given interval by applying provided `aggFunc`. Source time series should be sorted by time.
func (ts TimeSeries) GroupBy(interval time.Duration, aggFunc AggFunc) TimeSeries {
	if ts.Len() == 0 {
		return ts
	}

	groupedSeries := NewTimeSeries()
	frame := make([]TimePoint, 0)
	frameTS := ts[0].GetTimeFrame(interval)
	var pointFrameTs time.Time

	for _, point := range ts {
		pointFrameTs = point.GetTimeFrame(interval)

		// Iterate over points and push it into the frame if point time stamp fit the frame
		if pointFrameTs == frameTS {
			frame = append(frame, point)
		} else if pointFrameTs.After(frameTS) {
			// If point outside frame, then we've done with current frame
			groupedSeries = append(groupedSeries, TimePoint{
				Time:  frameTS,
				Value: aggFunc(frame),
			})

			// Move frame window to next non-empty interval and fill empty by null
			frameTS = frameTS.Add(interval)
			for frameTS.Before(pointFrameTs) {
				groupedSeries = append(groupedSeries, TimePoint{
					Time:  frameTS,
					Value: nil,
				})
				frameTS = frameTS.Add(interval)
			}
			frame = []TimePoint{point}
		}
	}

	groupedSeries = append(groupedSeries, TimePoint{
		Time:  frameTS,
		Value: aggFunc(frame),
	})

	return groupedSeries
}

func (ts TimeSeries) GroupByRange(aggFunc AggFunc) TimeSeries {
	if ts.Len() == 0 {
		return ts
	}

	value := aggFunc(ts)
	return []TimePoint{
		{Time: ts[0].Time, Value: value},
		{Time: ts[ts.Len()-1].Time, Value: value},
	}
}

func (ts TimeSeries) Transform(transformFunc TransformFunc) TimeSeries {
	for i, p := range ts {
		ts[i] = transformFunc(p)
	}
	return ts
}

func Filter(series []*TimeSeriesData, n int, order string, aggFunc AggFunc) []*TimeSeriesData {
	SortBy(series, "asc", aggFunc)

	filteredSeries := make([]*TimeSeriesData, n)
	for i := 0; i < n; i++ {
		if order == "top" {
			filteredSeries[i] = series[len(series)-1-i]
		} else if order == "bottom" {
			filteredSeries[i] = series[i]
		}
	}

	return filteredSeries
}

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

func AggregateBy(series []*TimeSeriesData, interval time.Duration, aggFunc AggFunc) *TimeSeriesData {
	aggregatedSeries := NewTimeSeries()

	// Combine all points into one time series
	for _, s := range series {
		aggregatedSeries = append(aggregatedSeries, s.TS...)
	}

	// GroupBy works correctly only with sorted time series
	aggregatedSeries.Sort()

	aggregatedSeries = aggregatedSeries.GroupBy(interval, aggFunc)
	aggregatedSeriesData := NewTimeSeriesData()
	aggregatedSeriesData.TS = aggregatedSeries
	return aggregatedSeriesData
}

func (ts TimeSeries) Sort() {
	sorted := sort.SliceIsSorted(ts, ts.less())
	if !sorted {
		sort.Slice(ts, ts.less())
	}
}

// Implements less() function for sorting slice
func (ts TimeSeries) less() func(i, j int) bool {
	return func(i, j int) bool {
		return ts[i].Time.Before(ts[j].Time)
	}
}

func SumSeries(series []*TimeSeriesData) *TimeSeriesData {
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

	interpolatedSeries := make([]TimeSeries, 0)

	for _, s := range series {
		if s.Len() == 0 {
			continue
		}

		pointsToInterpolate := make([]TimePoint, 0)

		currentPointIndex := 0
		for _, its := range interpolatedTimeStamps {
			currentPoint := s.TS[currentPointIndex]
			if its.Equal(currentPoint.Time) {
				if currentPointIndex < s.Len()-1 {
					currentPointIndex++
				}
			} else {
				pointsToInterpolate = append(pointsToInterpolate, TimePoint{Time: its, Value: nil})
			}
		}

		s.TS = append(s.TS, pointsToInterpolate...)
		s.TS.Sort()
		s.TS = interpolateSeries(s.TS)
		interpolatedSeries = append(interpolatedSeries, s.TS)
	}

	sumSeries := NewTimeSeriesData()
	for i := 0; i < len(interpolatedTimeStamps); i++ {
		var sum float64 = 0
		for _, s := range interpolatedSeries {
			if s[i].Value != nil {
				sum += *s[i].Value
			}
		}
		sumSeries.TS = append(sumSeries.TS, TimePoint{Time: interpolatedTimeStamps[i], Value: &sum})
	}

	return sumSeries
}

func interpolateSeries(series TimeSeries) TimeSeries {
	for i := series.Len() - 1; i >= 0; i-- {
		point := series[i]
		if point.Value == nil {
			left := findNearestLeft(series, i)
			right := findNearestRight(series, i)

			if left == nil && right == nil {
				continue
			}
			if left == nil {
				left = right
			}
			if right == nil {
				right = left
			}

			pointValue := linearInterpolation(point.Time, *left, *right)
			point.Value = &pointValue
			series[i] = point
		}
	}
	return series
}

func linearInterpolation(ts time.Time, left, right TimePoint) float64 {
	if left.Time.Equal(right.Time) {
		return (*left.Value + *right.Value) / 2
	} else {
		return *left.Value + (*right.Value-*left.Value)/float64((right.Time.UnixNano()-left.Time.UnixNano()))*float64((ts.UnixNano()-left.Time.UnixNano()))
	}
}

func findNearestRight(series TimeSeries, pointIndex int) *TimePoint {
	for i := pointIndex; i < series.Len(); i++ {
		if series[i].Value != nil {
			return &series[i]
		}
	}
	return nil
}

func findNearestLeft(series TimeSeries, pointIndex int) *TimePoint {
	for i := pointIndex; i > 0; i-- {
		if series[i].Value != nil {
			return &series[i]
		}
	}
	return nil
}

// Aligns point's time stamps according to provided interval.
func (ts TimeSeries) Align(interval time.Duration) TimeSeries {
	if interval <= 0 || ts.Len() < 2 {
		return ts
	}

	alignedTs := NewTimeSeries()
	var frameTs = ts[0].GetTimeFrame(interval)
	var pointFrameTs time.Time
	var point TimePoint

	for i := 1; i < ts.Len(); i++ {
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

// Gets point timestamp rounded according to provided interval.
func (p *TimePoint) GetTimeFrame(interval time.Duration) time.Time {
	return p.Time.Truncate(interval)
}

func alignDataPoints(frame *data.Frame, interval time.Duration) *data.Frame {
	if interval <= 0 || frame.Rows() < 2 {
		return frame
	}

	timeFieldIdx := getTimeFieldIndex(frame)
	if timeFieldIdx < 0 {
		return frame
	}
	var frameTs = getPointTimeFrame(getTimestampAt(frame, 0), interval)
	var pointFrameTs *time.Time
	var pointsInserted = 0

	for i := 1; i < frame.Rows(); i++ {
		pointFrameTs = getPointTimeFrame(getTimestampAt(frame, i), interval)
		if pointFrameTs == nil || frameTs == nil {
			continue
		}

		if pointFrameTs.After(*frameTs) {
			for frameTs.Before(*pointFrameTs) {
				insertAt := i + pointsInserted
				err := insertNullPointAt(frame, *frameTs, insertAt)
				if err != nil {
					backend.Logger.Debug("Error inserting null point", "error", err)
				}
				*frameTs = frameTs.Add(interval)
				pointsInserted++
			}
		}

		setTimeAt(frame, *pointFrameTs, i+pointsInserted)
		*frameTs = frameTs.Add(interval)
	}

	return frame
}

func getPointTimeFrame(ts *time.Time, interval time.Duration) *time.Time {
	if ts == nil {
		return nil
	}
	timeFrame := ts.Truncate(interval)
	return &timeFrame
}

func getTimeFieldIndex(frame *data.Frame) int {
	for i := 0; i < len(frame.Fields); i++ {
		if frame.Fields[i].Type() == data.FieldTypeTime {
			return i
		}
	}

	return -1
}

func getTimestampAt(frame *data.Frame, index int) *time.Time {
	timeFieldIdx := getTimeFieldIndex(frame)
	if timeFieldIdx < 0 {
		return nil
	}

	tsValue := frame.Fields[timeFieldIdx].At(index)
	ts, ok := tsValue.(time.Time)
	if !ok {
		return nil
	}

	return &ts
}

func insertNullPointAt(frame *data.Frame, frameTs time.Time, index int) error {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime {
			field.Insert(index, frameTs)
		} else if field.Type().Nullable() {
			field.Insert(index, nil)
		} else {
			return errors.New("field is not nullable")
		}
	}
	return nil
}

func setTimeAt(frame *data.Frame, frameTs time.Time, index int) {
	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime {
			field.Insert(index, frameTs)
		}
	}
}
