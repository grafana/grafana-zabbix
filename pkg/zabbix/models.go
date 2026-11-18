package zabbix

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

type StringInt string

func (s *StringInt) UnmarshalJSON(data []byte) error {
	if string(data) == "null" || len(data) == 0 {
		return nil
	}
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		if str == "" {
			*s = ""
			return nil
		}
		if _, err := strconv.ParseInt(str, 10, 64); err != nil {
			return fmt.Errorf("invalid integer string %q: %w", str, err)
		}
		*s = StringInt(str)
		return nil
	}
	var num int64
	if err := json.Unmarshal(data, &num); err == nil {
		*s = StringInt(strconv.FormatInt(num, 10))
		return nil
	}
	var f float64
	if err := json.Unmarshal(data, &f); err == nil {
		if f == float64(int64(f)) {
			*s = StringInt(strconv.FormatInt(int64(f), 10))
			return nil
		}
		return fmt.Errorf("invalid integer value %v", f)
	}
	return fmt.Errorf("cannot unmarshal %s into StringInt: expected integer or numeric string", string(data))
}

func (s StringInt) Int() int {
	i, _ := strconv.Atoi(string(s))
	return i
}

func (s StringInt) String() string {
	return string(s)
}

type HostTagFilter struct {
	Tag      string    `json:"tag"`
	Value    string    `json:"value"`
	Operator StringInt `json:"operator"`
}

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
	Tags       []Tag  	  `json:"tags,omitempty"`
}

type ItemHost struct {
	ID   string `json:"hostid,omitempty"`
	Name string `json:"name,omitempty"`
}

type Tag struct {
	Tag   string `json:"tag,omitempty"`
	Value string `json:"value,omitempty"`
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

type Group struct {
	Name string `json:"name"`
	ID   string `json:"groupid"`
}

type Host struct {
	Name string    `json:"name"`
	Host string    `json:"host"`
	ID   string    `json:"hostid"`
	Tags []Tag 	   `json:"tags,omitempty"`
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
