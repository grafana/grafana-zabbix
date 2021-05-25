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

func AggAvg(points []TimePoint) *float64 {
	var sum float64 = 0
	for _, p := range points {
		if p.Value != nil {
			sum += *p.Value
		}
	}
	avg := sum / float64(len(points))
	return &avg
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

func AggFirst(points []TimePoint) *float64 {
	return points[0].Value
}

func AggLast(points []TimePoint) *float64 {
	return points[len(points)-1].Value
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
