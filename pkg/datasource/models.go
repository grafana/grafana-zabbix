package datasource

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const (
	MODE_METRICS   = "0"
	MODE_ITSERVICE = "1"
	MODE_TEXT      = "2"
	MODE_ITEMID    = "3"
	MODE_TRIGGERS  = "4"
	MODE_PROBLEMS  = "5"
)

type DBConnectionPostProcessingRequest struct {
	Query     QueryModel                     `json:"query"`
	TimeRange TimeRangePostProcessingRequest `json:"timeRange"`
	Series    []*timeseries.TimeSeriesData   `json:"series"`
}

type TimeRangePostProcessingRequest struct {
	From int64
	To   int64
}

type ZabbixAPIResourceRequest struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params,omitempty"`
}

type ZabbixAPIResourceResponse struct {
	Result interface{} `json:"result,omitempty"`
}

// QueryModel model
type QueryModel struct {
	// Deprecated `mode` field, use QueryType instead
	Mode      int64  `json:"mode"`
	QueryType string `json:"-"`

	Group   QueryFilter `json:"group"`
	Host    QueryFilter `json:"host"`
	ItemTag QueryFilter `json:"itemTag"`
	Item    QueryFilter `json:"item"`

	// Item ID mode
	ItemIDs string `json:"itemids,omitempty"`

	Functions []QueryFunction `json:"functions,omitempty"`
	Options   QueryOptions    `json:"options"`

	// Direct from the gRPC interfaces
	RefID         string            `json:"-"`
	TimeRange     backend.TimeRange `json:"-"`
	MaxDataPoints int64             `json:"-"`
	Interval      time.Duration     `json:"-"`
}

// QueryOptions model
type QueryFilter struct {
	Filter string `json:"filter"`
}

// QueryOptions model
type QueryOptions struct {
	ShowDisabledItems     bool   `json:"showDisabledItems"`
	DisableDataAlignment  bool   `json:"disableDataAlignment"`
	UseZabbixValueMapping bool   `json:"useZabbixValueMapping"`
	UseTrends             string `json:"useTrends"`
}

// QueryOptions model
type QueryFunction struct {
	Def    QueryFunctionDef     `json:"def"`
	Params []QueryFunctionParam `json:"params"`
	Text   string               `json:"text"`
}

// QueryOptions model
type QueryFunctionDef struct {
	Name          string                  `json:"name"`
	Category      string                  `json:"category"`
	Params        []QueryFunctionParamDef `json:"params"`
	DefaultParams []QueryFunctionParam    `json:"defaultParams"`
}

type QueryFunctionParamDef struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type QueryFunctionParam = interface{}

type ScopedVar struct {
	Text  string `json:"text"`
	Value string `json:"value"`
}

// ReadQuery will read and validate Settings from the DataSourceConfg
func ReadQuery(query backend.DataQuery) (QueryModel, error) {
	model := QueryModel{
		RefID:         query.RefID,
		QueryType:     query.QueryType,
		TimeRange:     query.TimeRange,
		MaxDataPoints: query.MaxDataPoints,
		Interval:      query.Interval,
	}
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return model, backend.DownstreamError(fmt.Errorf("could not read query: %w", err))
	}

	migrateApplicationFilter(query.JSON, &model)

	if model.QueryType == "" {
		queryJSON, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return model, backend.DownstreamError(fmt.Errorf("could not read query JSON: %w", err))
		}

		queryType, err := queryJSON.Get("queryType").Int64()
		if err != nil {
			log.DefaultLogger.Warn("could not read query type", "error", err)
			log.DefaultLogger.Debug("setting query type to default value")
			model.QueryType = "0"
		} else {
			model.QueryType = strconv.FormatInt(queryType, 10)
		}
	}

	return model, nil
}

var regexFilterPattern = regexp.MustCompile(`^/(.+)/([a-z]*)$`)

// applicationFilterToItemTagFilter converts an application filter to the equivalent item
// tag filter. Zabbix turns each application into an "Application: <name>" item tag when
// upgrading to 5.4. A regex filter becomes a regex over the whole tag string; a leading
// "^" keeps anchoring the application name. Mirrors the frontend query migration.
func applicationFilterToItemTagFilter(appFilter string) string {
	matches := regexFilterPattern.FindStringSubmatch(appFilter)
	if matches == nil {
		return "Application: " + appFilter
	}
	pattern, flags := matches[1], matches[2]
	name := ".*(?:" + pattern + ")"
	if strings.HasPrefix(pattern, "^") {
		name = "(?:" + pattern[1:] + ")"
	}
	return "/^Application: " + name + "/" + flags
}

// migrateApplicationFilter carries a saved application filter over to the item tag filter
// when the query has none. Queries evaluated without going through the query editor (alert
// rules, for example) still hold the application filter they were saved with.
func migrateApplicationFilter(queryJSON []byte, model *QueryModel) {
	if model.ItemTag.Filter != "" {
		return
	}
	var legacy struct {
		Application QueryFilter `json:"application"`
	}
	if err := json.Unmarshal(queryJSON, &legacy); err != nil || legacy.Application.Filter == "" {
		return
	}
	model.ItemTag.Filter = applicationFilterToItemTagFilter(legacy.Application.Filter)
}
