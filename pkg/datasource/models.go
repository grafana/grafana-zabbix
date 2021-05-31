package datasource

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
	Mode        int64           `json:"mode"`
	Group       QueryFilter     `json:"group"`
	Host        QueryFilter     `json:"host"`
	Application QueryFilter     `json:"application"`
	Item        QueryFilter     `json:"item"`
	Functions   []QueryFunction `json:"functions,omitempty"`
	Options     QueryOptions    `json:"options"`

	// Direct from the gRPC interfaces
	RefID         string            `json:"-"`
	QueryType     string            `json:"-"`
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

	return model, nil
}
