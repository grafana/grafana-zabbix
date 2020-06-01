package main

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

	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

// ZabbixDatasourceSettings model
type ZabbixDatasourceSettings struct {
	Trends      bool
	TrendsFrom  time.Duration
	TrendsRange time.Duration
	CacheTTL    time.Duration

	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

type ZabbixAPIResourceRequest struct {
	DatasourceId int64                  `json:"datasourceId"`
	Method       string                 `json:"method"`
	Params       map[string]interface{} `json:"params,omitempty"`
}

type ZabbixAPIRequest struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params,omitempty"`
}

type ZabbixAPIResourceResponse struct {
	Result interface{} `json:"result,omitempty"`
}

func (r *ZabbixAPIRequest) String() string {
	jsonRequest, _ := json.Marshal(r.Params)
	return r.Method + string(jsonRequest)
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
	TimeRange backend.TimeRange `json:"-"`
}

// QueryOptions model
type QueryFilter struct {
	Filter string `json:"filter"`
}

// QueryOptions model
type QueryOptions struct {
	ShowDisabledItems bool `json:"showDisabledItems"`
}

// QueryOptions model
type QueryFunction struct {
	Def    QueryFunctionDef `json:"def"`
	Params []string         `json:"params"`
	Text   string           `json:"text"`
}

// QueryOptions model
type QueryFunctionDef struct {
	Name     string `json:"name"`
	Category string `json:"category"`
}

// ReadQuery will read and validate Settings from the DataSourceConfg
func ReadQuery(query backend.DataQuery) (QueryModel, error) {
	model := QueryModel{}
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return model, fmt.Errorf("could not read query: %w", err)
	}

	model.TimeRange = query.TimeRange
	return model, nil
}

// Old models

type connectionTestResponse struct {
	ZabbixVersion     string              `json:"zabbixVersion"`
	DbConnectorStatus *dbConnectionStatus `json:"dbConnectorStatus"`
}

type dbConnectionStatus struct {
	DsType string `json:"dsType"`
	DsName string `json:"dsName"`
}

type requestModel struct {
	Target queryRequest `json:"target,omitempty"`
}

type queryRequest struct {
	Method string          `json:"method,omitempty"`
	Params ZabbixAPIParams `json:"params,omitempty"`
}

type zabbixParamOutput struct {
	Mode   string
	Fields []string
}

func (p *zabbixParamOutput) MarshalJSON() ([]byte, error) {
	if p.Mode != "" {
		return json.Marshal(p.Mode)
	}

	return json.Marshal(p.Fields)
}

func (p *zabbixParamOutput) UnmarshalJSON(data []byte) error {
	if p == nil {
		return fmt.Errorf("zabbixParamOutput: UnmarshalJSON on nil pointer")
	}

	var strArray []string
	err := json.Unmarshal(data, &strArray)
	if err == nil {
		p.Fields = strArray
		return nil
	}

	var str string
	err = json.Unmarshal(data, &str)
	if err == nil {
		p.Mode = str
		return nil
	}

	return fmt.Errorf("Unsupported type: %w", err)

}

type ZabbixAPIParams = map[string]interface{}

type ZabbixAPIParamsLegacy struct {
	Output    *zabbixParamOutput     `json:"output,omitempty"`
	SortField string                 `json:"sortfield,omitempty"`
	SortOrder string                 `json:"sortorder,omitempty"`
	Filter    map[string]interface{} `json:"filter,omitempty"`

	// Login
	User     string `json:"user,omitempty"`
	Password string `json:"password,omitempty"`

	// Item GET
	WebItems    bool        `json:"webitems,omitempty"`
	SelectHosts interface{} `json:"selectHosts,omitempty"`
	ItemIDs     []string    `json:"itemids,omitempty"`
	GroupIDs    []string    `json:"groupids,omitempty"`
	HostIDs     []string    `json:"hostids,omitempty"`
	AppIDs      []string    `json:"applicationids,omitempty"`

	// event.get
	SelectAcknowledges interface{} `json:"select_acknowledges,omitempty"`
	ObjectIDs          []string    `json:"objectids,omitempty"`
	Value              interface{} `json:"value,omitempty"`

	// trigger.get
	ExpandDescription bool        `json:"expandDescription,omitempty"`
	ExpandData        bool        `json:"expandData,omitempty"`
	ExpandComment     bool        `json:"expandComment,omitempty"`
	Monitored         bool        `json:"monitored,omitempty"`
	SkipDependent     bool        `json:"skipDependent,omitempty"`
	SelectLastEvent   interface{} `json:"selectLastEvent,omitempty"`

	// Host Group GET
	RealHosts bool `json:"real_hosts,omitempty"`

	// History GET
	History *int `json:"history,omitempty,string"`

	// History/Trends GET
	TimeFrom int64 `json:"time_from,omitempty"`
	TimeTill int64 `json:"time_till,omitempty"`
}
