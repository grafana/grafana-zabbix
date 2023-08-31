package zabbix

import (
	"encoding/json"
	"time"
)

type ZabbixDatasourceSettingsDTO struct {
	Trends      bool   `json:"trends"`
	TrendsFrom  string `json:"trendsFrom"`
	TrendsRange string `json:"trendsRange"`
	CacheTTL    string `json:"cacheTTL"`
	Timeout     string `json:"timeout"`

	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

type ZabbixDatasourceSettings struct {
	Trends      bool
	TrendsFrom  time.Duration
	TrendsRange time.Duration
	CacheTTL    time.Duration
	Timeout     time.Duration

	DisableReadOnlyUsersAck bool `json:"disableReadOnlyUsersAck"`
}

type ZabbixAPIParams = map[string]interface{}

type ZabbixAPIRequest struct {
	Method string          `json:"method"`
	Params ZabbixAPIParams `json:"params,omitempty"`
}

func (r *ZabbixAPIRequest) String() string {
	jsonRequest, _ := json.Marshal(r.Params)
	return r.Method + string(jsonRequest)
}

type Items []Item

type Item struct {
	ID         string     `json:"itemid,omitempty"`
	Key        string     `json:"key_,omitempty"`
	Name       string     `json:"name,omitempty"`
	ValueType  int        `json:"value_type,omitempty,string"`
	HostID     string     `json:"hostid,omitempty"`
	Hosts      []ItemHost `json:"hosts,omitempty"`
	Status     string     `json:"status,omitempty"`
	State      string     `json:"state,omitempty"`
	Delay      string     `json:"delay,omitempty"`
	Units      string     `json:"units,omitempty"`
	ValueMapID string     `json:"valuemapid,omitempty"`
	Tags       []ItemTag  `json:"tags,omitempty"`
}

type ItemHost struct {
	ID   string `json:"hostid,omitempty"`
	Name string `json:"name,omitempty"`
}

type ItemTag struct {
	Tag   string `json:"tag,omitempty"`
	Value string `json:"value,omitempty"`
}

type Trend []TrendPoint

type TrendPoint struct {
	ItemID   int64 `json:"itemid,omitempty"`
	Clock    int64  `json:"clock,omitempty"`
	Num      string `json:"num,omitempty"`
	ValueMin string `json:"value_min,omitempty"`
	ValueAvg string `json:"value_avg,omitempty"`
	ValueMax string `json:"value_max,omitempty"`
}

type History []HistoryPoint

type HistoryPoint struct {
	ItemID int64  `json:"itemid,omitempty"`
	Clock  int64   `json:"clock,omitempty"`
	Value  float64 `json:"value,omitempty,string"`
	NS     int64   `json:"ns,omitempty"`
}

type Group struct {
	Name string `json:"name"`
	ID   string `json:"groupid"`
}

type Host struct {
	Name string `json:"name"`
	Host string `json:"host"`
	ID   string `json:"hostid"`
}

type Application struct {
	Name string `json:"name"`
	ID   string `json:"applicationid"`
}

type ValueMap struct {
	ID       string         `json:"valuemapid"`
	Name     string         `json:"name"`
	Mappings []ValueMapping `json:"mappings"`
}

type ValueMapping struct {
	Value    string `json:"value"`
	NewValue string `json:"newvalue"`
}
