package zabbix

type Items []Item
type Item struct {
	ID        string     `json:"itemid,omitempty"`
	Key       string     `json:"key_,omitempty"`
	Name      string     `json:"name,omitempty"`
	ValueType int        `json:"value_type,omitempty"`
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
