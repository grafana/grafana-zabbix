package datasource

import (
	"testing"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"

	sdatats "github.com/grafana/dataplane/sdata/timeseries"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSeriesToDataFrameDataplaneMeta(t *testing.T) {
	frame := seriesToDataFrame(newTestSeries("srv01: CPU load", "system.cpu.load", "srv01", 3), nil)

	require.NotNil(t, frame.Meta)
	assert.Equal(t, data.FrameTypeTimeSeriesMulti, frame.Meta.Type)
	assert.Equal(t, data.FrameTypeVersion{0, 1}, frame.Meta.TypeVersion)

	require.Len(t, frame.Fields, 2)
	assert.Equal(t, data.TimeSeriesTimeFieldName, frame.Fields[0].Name)
	// The data plane contract reads the series name from the value field name.
	assert.Equal(t, "srv01: CPU load", frame.Fields[1].Name)
	// Kept so that panels and dashboard field overrides keep resolving the same name.
	assert.Equal(t, "srv01: CPU load", frame.Fields[1].Config.DisplayNameFromDS)
}

// Falls back to the generic name so the value field is never left unnamed.
func TestSeriesToDataFrameUnnamedSeries(t *testing.T) {
	series := newTestSeries("", "", "", 1)
	series.Meta.Item = nil

	frame := seriesToDataFrame(series, nil)

	require.Len(t, frame.Fields, 2)
	assert.Equal(t, data.TimeSeriesValueFieldName, frame.Fields[1].Name)
}

// Validates the response against the same reader Grafana's server side expressions and
// alerting use, with strict data validation enabled.
func TestConvertTimeSeriesToDataFramesIsValidDataplaneResponse(t *testing.T) {
	series := []*timeseries.TimeSeriesData{
		newTestSeries("srv01: CPU load", "system.cpu.load", "srv01", 3),
		// Different length than the first series, which the multi format allows.
		newTestSeries("srv02: CPU load", "system.cpu.load", "srv02", 5),
	}

	frames := convertTimeSeriesToDataFrames(series, nil)
	require.Len(t, frames, 2)

	reader, err := sdatats.CollectionReaderFromFrames(frames)
	require.NoError(t, err)

	collection, err := reader.GetCollection(true)
	require.NoError(t, err)
	require.Len(t, collection.Refs, 2)

	assert.Equal(t, "srv01: CPU load", collection.Refs[0].ValueField.Name)
	assert.Equal(t, data.Labels{
		"host":     "srv01",
		"item":     "CPU load",
		"item_key": "system.cpu.load",
	}, collection.Refs[0].ValueField.Labels)
}

func newTestSeries(name, key, host string, points int) *timeseries.TimeSeriesData {
	ts := timeseries.NewTimeSeries()
	start := time.Unix(1700000000, 0)
	for i := 0; i < points; i++ {
		value := float64(i)
		ts = append(ts, timeseries.TimePoint{
			Time:  start.Add(time.Duration(i) * time.Minute),
			Value: &value,
		})
	}

	item := &zabbix.Item{
		Name:  "CPU load",
		Key:   key,
		Delay: "1m",
	}
	if host != "" {
		item.Hosts = []zabbix.ItemHost{{ID: "10084", Name: host}}
	}

	return &timeseries.TimeSeriesData{
		TS: ts,
		Meta: timeseries.TimeSeriesMeta{
			Name: name,
			Item: item,
		},
	}
}
