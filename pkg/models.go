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

type requestModel struct {
	Target queryRequest `json:"target,omitempty"`
}

type queryRequest struct {
	Method string       `json:"method,omitempty"`
	Params zabbixParams `json:"params,omitempty"`
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
	var obj interface{}
	err := json.Unmarshal(data, &obj)
	if err != nil {
		return err
	}

	switch t := obj.(type) {
	case string:
		p.Mode = obj.(string)
		return nil
	case []string:
		p.Fields = obj.([]string)
		return nil
	default:
		return fmt.Errorf("Unsupported type: %+v", t)
	}
}

type zabbixParams struct {
	Output    *zabbixParamOutput `json:"output,omitempty"`
	SortField string             `json:"sortfield,omitempty"`
	SortOrder string             `json:"sortorder,omitempty"`
	Filter    map[string][]int   `json:"filter,omitempty"`

	// Login
	User     string `json:"user,omitempty"`
	Password string `json:"password,omitempty"`

	// Item GET
	WebItems    bool     `json:"webitems,omitempty"`
	SelectHosts []string `json:"selectHosts,omitempty"`
	ItemIDs     []string `json:"itemids,omitempty"`
	GroupIDs    []string `json:"groupids,omitempty"`
	HostIDs     []string `json:"hostids,omitempty"`
	AppIDs      []string `json:"applicationids,omitempty"`

	// Host Group GET
	RealHosts bool `json:"real_hosts,omitempty"`

	// History GET
	History int `json:"history,omitempty"`

	// History/Trends GET
	TimeFrom string `json:"time_from,omitempty"`
	TimeTill string `json:"time_till,omitempty"`
}
