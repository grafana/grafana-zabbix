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
	ID        string     `json:"itemid,omitempty"`
	Key       string     `json:"key_,omitempty"`
	Name      string     `json:"name,omitempty"`
	ValueType int        `json:"value_type,omitempty,string"`
	HostID    string     `json:"hostid,omitempty"`
	Hosts     []ItemHost `json:"hosts,omitempty"`
	Status    string     `json:"status,omitempty"`
	State     string     `json:"state,omitempty"`
}

type ItemHost struct {
	ID   string `json:"hostid,omitempty"`
	Name string `json:"name,omitempty"`
}

type Trend []TrendPoint

type TrendPoint struct {
	ItemID   string `json:"itemid,omitempty"`
	Clock    int64  `json:"clock,omitempty,string"`
	Num      string `json:"num,omitempty"`
	ValueMin string `json:"value_min,omitempty"`
	ValueAvg string `json:"value_avg,omitempty"`
	ValueMax string `json:"value_max,omitempty"`
}

type History []HistoryPoint

type HistoryPoint struct {
	ItemID string  `json:"itemid,omitempty"`
	Clock  int64   `json:"clock,omitempty,string"`
	Value  float64 `json:"value,omitempty,string"`
	NS     int64   `json:"ns,omitempty,string"`
}
