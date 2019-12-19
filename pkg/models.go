package main

type connectionTestResponse struct {
	ZabbixVersion     string              `json:"zabbixVersion"`
	DbConnectorStatus *dbConnectionStatus `json:"dbConnectorStatus"`
}

type dbConnectionStatus struct {
	DsType string `json:"dsType"`
	DsName string `json:"dsName"`
}

type zabbixParams struct {
	Output    []string            `json:"output,omitempty"`
	SortField string              `json:"sortfield,omitempty"`
	SortOrder string              `json:"sortorder,omitempty"`
	Filter    map[string][]string `json:"filter,omitempty"`

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
