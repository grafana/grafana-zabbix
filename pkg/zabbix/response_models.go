package zabbix

type Applications []Application
type Application struct {
	ID          string   `json:"applicationid,omitempty"`
	HostID      string   `json:"hostid,omitempty"`
	Name        string   `json:"name,omitempty"`
	TemplateIDs []string `json:"templateids,omitempty"`
}

type Hosts []Host
type Host struct {
	ID   string `json:"hostid,omitempty"`
	Name string `json:"name,omitempty"`
	Host string `json:"host,omitempty"`
}

type Groups []Group
type Group struct {
	ID   string `json:"groupid,omitempty"`
	Name string `json:"name,omitempty"`
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
	ItemID   string  `json:"itemid,omitempty"`
	Clock    int64   `json:"clock,omitempty,string"`
	Num      string  `json:"num,omitempty"`
	ValueMin float64 `json:"value_min,omitempty,string"`
	ValueAvg float64 `json:"value_avg,omitempty,string"`
	ValueMax float64 `json:"value_max,omitempty,string"`
}

type History []HistoryPoint
type HistoryPoint struct {
	ItemID string  `json:"itemid,omitempty"`
	Clock  int64   `json:"clock,omitempty,string"`
	Value  float64 `json:"value,omitempty,string"`
	NS     int64   `json:"ns,omitempty,string"`
}
