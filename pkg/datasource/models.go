package datasource

import (
	"encoding/json"
	"fmt"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/timeseries"
	"strconv"
	"time"

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

// ZabbixDatasourceSettingsDTO model
type ZabbixDatasourceSettingsDTO struct {
	Trends      bool   `json:"trends"`
	TrendsFrom  string `json:"trendsFrom"`
	TrendsRange string `json:"trendsRange"`
	CacheTTL    string `json:"cacheTTL"`
	Timeout     string `json:"timeout"`

	DisableDataAlignment    bool `json:"disableDataAlignment"`
	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

// ZabbixDatasourceSettings model
type ZabbixDatasourceSettings struct {
	Trends      bool
	TrendsFrom  time.Duration
	TrendsRange time.Duration
	CacheTTL    time.Duration
	Timeout     time.Duration

	DisableDataAlignment    bool `json:"disableDataAlignment"`
	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

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
	DatasourceId int64                  `json:"datasourceId"`
	Method       string                 `json:"method"`
	Params       map[string]interface{} `json:"params,omitempty"`
}

type ZabbixAPIResourceResponse struct {
	Result interface{} `json:"result,omitempty"`
}

// QueryModel model
type QueryModel struct {
	// Deprecated `mode` field, use QueryType instead
	Mode      int64  `json:"mode"`
	QueryType string `json:"queryType"`

	Group       QueryFilter `json:"group"`
	Host        QueryFilter `json:"host"`
	Application QueryFilter `json:"application"`
	ItemTag     QueryFilter `json:"itemTag"`
	Item        QueryFilter `json:"item"`

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
	ShowDisabledItems    bool `json:"showDisabledItems"`
	DisableDataAlignment bool `json:"disableDataAlignment"`
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
		return model, fmt.Errorf("could not read query: %w", err)
	}

	if model.QueryType == "" {
		queryJSON, err := simplejson.NewJson(query.JSON)
		if err != nil {
			return model, fmt.Errorf("could not read query JSON: %w", err)
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
