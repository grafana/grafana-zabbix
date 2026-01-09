package settings

import "time"

const (
	AuthTypeUserLogin = "userLogin"
	AuthTypeToken     = "token"
)

// ZabbixDatasourceSettingsDTO model
type ZabbixDatasourceSettingsDTO struct {
	AuthType    string      `json:"authType"`
	Trends      bool        `json:"trends"`
	TrendsFrom  string      `json:"trendsFrom"`
	TrendsRange string      `json:"trendsRange"`
	CacheTTL    string      `json:"cacheTTL"`
	Timeout     interface{} `json:"timeout"`

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
	Timeout     time.Duration

	DisableDataAlignment    bool     `json:"disableDataAlignment"`
	DisableReadOnlyUsersAck bool     `json:"disableReadOnlyUsersAck"`
	PerUserAuth             bool     `json:"perUserAuth"`
	PerUserAuthField        string   `json:"perUserAuthField"`
	PerUserAuthExcludeUsers []string `json:"perUserAuthExcludeUsers"`
}
