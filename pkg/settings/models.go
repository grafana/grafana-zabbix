package settings

import "time"

const (
	AuthTypeUserLogin = "userLogin"
	AuthTypeToken     = "token"
)

// ZabbixDatasourceSettingsDTO model
type ZabbixDatasourceSettingsDTO struct {
	AuthType    string `json:"authType"`
	Trends      bool   `json:"trends"`
	TrendsFrom  string `json:"trendsFrom"`
	TrendsRange string `json:"trendsRange"`
	CacheTTL    string `json:"cacheTTL"`
	// Timeout is the HTTP client connection timeout in seconds for individual API requests to Zabbix.
	// This controls how long to wait for a single HTTP request/response cycle. Default is 30 seconds.
	Timeout interface{} `json:"timeout"`
	// QueryTimeout is the maximum execution time in seconds for entire database queries initiated by the plugin.
	// This controls the total time allowed for a complete query execution (which may involve multiple API calls).
	// Queries exceeding this limit will be automatically terminated. Default is 60 seconds.
	QueryTimeout interface{} `json:"queryTimeout"`

	DisableDataAlignment    bool     `json:"disableDataAlignment"`
	DisableReadOnlyUsersAck bool     `json:"disableReadOnlyUsersAck"`
	PerUserAuth             bool     `json:"perUserAuth"`
	PerUserAuthField        string   `json:"perUserAuthField"`
	PerUserAuthExcludeUsers []string `json:"perUserAuthExcludeUsers"`
}

// ZabbixDatasourceSettings model
type ZabbixDatasourceSettings struct {
	AuthType    string
	Trends      bool
	TrendsFrom  time.Duration
	TrendsRange time.Duration
	CacheTTL    time.Duration
	// Timeout is the HTTP client connection timeout for individual API requests to Zabbix.
	// This controls how long to wait for a single HTTP request/response cycle. Default is 30 seconds.
	Timeout time.Duration
	// QueryTimeout is the maximum execution time for entire database queries initiated by the plugin.
	// This controls the total time allowed for a complete query execution (which may involve multiple API calls).
	// Queries exceeding this limit will be automatically terminated. Default is 60 seconds.
	QueryTimeout time.Duration

	DisableDataAlignment    bool     `json:"disableDataAlignment"`
	DisableReadOnlyUsersAck bool     `json:"disableReadOnlyUsersAck"`
	PerUserAuth             bool     `json:"perUserAuth"`
	PerUserAuthField        string   `json:"perUserAuthField"`
	PerUserAuthExcludeUsers []string `json:"perUserAuthExcludeUsers"`
}
