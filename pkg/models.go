package main

import (
	"encoding/json"
	"fmt"
)

type connectionTestResponse struct {
	ZabbixVersion     string              `json:"zabbixVersion"`
	DbConnectorStatus *dbConnectionStatus `json:"dbConnectorStatus"`
}

type dbConnectionStatus struct {
	DsType string `json:"dsType"`
	DsName string `json:"dsName"`
}

type TargetFunction struct {
	Added  bool                     `json:"added,omitempty"`
	Def    TargetFunctionDefinition `json:"def,omitempty"`
	Params []string                 `json:"params,omitempty"`
	Text   string                   `json:"text,omitempty"`
}

type TargetFunctionDefinition struct {
	Category      string                          `json:"category,omitempty"`
	DefaultParams []string                        `json:"defaultParams,omitempty"`
	Name          string                          `json:"name,omitempty"`
	Params        []TargetFunctionDefinitionParam `json:"params,omitempty"`
}

type TargetFunctionDefinitionParam struct {
	Name    string   `json:"name,omitempty"`
	Options []string `json:"options,omitempty"`
	Type    string   `json:"type,omitempty"`
}

type TargetFilter struct {
	Filter string `json:"filter,omitempty"`
}

type TargetOptions struct {
	ShowDisabledItems bool `json:"showDisabledItems,omitempty"`
	SkipEmptyValues   bool `json:"skipEmptyValues,omitempty"`
}

type TargetModel struct {
	RefID       string           `json:"refId,omitempty"`
	Mode        int              `json:"mode,omitempty"`
	Options     TargetOptions    `json:"options,omitempty"`
	Functions   []TargetFunction `json:"functions,omitempty"`
	Application TargetFilter     `json:"application,omitempty"`
	Group       TargetFilter     `json:"group,omitempty"`
	Host        TargetFilter     `json:"host,omitempty"`
	Item        TargetFilter     `json:"item,omitempty"`
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

type ZabbixAPIParams struct {
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

type zabbixResponse struct {
	ID         int                  `json:"id,omitempty"`
	Result     json.RawMessage      `json:"result,omitempty"`
	Error      *zabbixResponseError `json:"error,omitempty"`
	RPCVersion string               `json:"jsonrpc,omitempty"`
}

type zabbixResponseError struct {
	Code    int    `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	Data    string `json:"data,omitempty"`
}
