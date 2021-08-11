package settings

import "time"

// ZabbixDatasourceSettingsDTO model
type ZabbixDatasourceSettingsDTO struct {
	Trends      bool        `json:"trends"`
	TrendsFrom  string      `json:"trendsFrom"`
	TrendsRange string      `json:"trendsRange"`
	CacheTTL    string      `json:"cacheTTL"`
	Timeout     interface{} `json:"timeout"`

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
