package settings

import (
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// parseTimeoutValue parses a timeout value from various types (string, float64, int64, int)
// and returns it as int64. If the value is empty or invalid, it returns the default value.
// The fieldName parameter is used for error messages.
func parseTimeoutValue(value interface{}, defaultValue int64, fieldName string) (int64, error) {
	switch t := value.(type) {
	case string:
		if t == "" {
			return defaultValue, nil
		}
		timeoutInt, err := strconv.Atoi(t)
		if err != nil {
			return 0, errors.New("failed to parse " + fieldName + ": " + err.Error())
		}
		return int64(timeoutInt), nil
	case float64:
		return int64(t), nil
	case int64:
		return t, nil
	case int:
		return int64(t), nil
	default:
		return defaultValue, nil
	}
}

func ReadZabbixSettings(dsInstanceSettings *backend.DataSourceInstanceSettings) (*ZabbixDatasourceSettings, error) {
	zabbixSettingsDTO := &ZabbixDatasourceSettingsDTO{}

	err := json.Unmarshal(dsInstanceSettings.JSONData, &zabbixSettingsDTO)
	if err != nil {
		return nil, err
	}

	if zabbixSettingsDTO.AuthType == "" {
		zabbixSettingsDTO.AuthType = AuthTypeUserLogin
	}

	if zabbixSettingsDTO.TrendsFrom == "" {
		zabbixSettingsDTO.TrendsFrom = "7d"
	}
	if zabbixSettingsDTO.TrendsRange == "" {
		zabbixSettingsDTO.TrendsRange = "4d"
	}
	if zabbixSettingsDTO.CacheTTL == "" {
		zabbixSettingsDTO.CacheTTL = "1h"
	}
	if zabbixSettingsDTO.PerUserAuth && zabbixSettingsDTO.PerUserAuthField == "" {
		zabbixSettingsDTO.PerUserAuthField = "username"
	}

	trendsFrom, err := gtime.ParseInterval(zabbixSettingsDTO.TrendsFrom)
	if err != nil {
		return nil, err
	}

	trendsRange, err := gtime.ParseInterval(zabbixSettingsDTO.TrendsRange)
	if err != nil {
		return nil, err
	}

	cacheTTL, err := gtime.ParseInterval(zabbixSettingsDTO.CacheTTL)
	if err != nil {
		return nil, err
	}

	timeout, err := parseTimeoutValue(zabbixSettingsDTO.Timeout, 30, "timeout")
	if err != nil {
		return nil, err
	}

	queryTimeout, err := parseTimeoutValue(zabbixSettingsDTO.QueryTimeout, 60, "queryTimeout")
	if err != nil {
		return nil, err
	}

	// Default to 60 seconds if queryTimeout is 0 or negative
	if queryTimeout <= 0 {
		queryTimeout = 60
	}

	zabbixSettings := &ZabbixDatasourceSettings{
		AuthType:                zabbixSettingsDTO.AuthType,
		Trends:                  zabbixSettingsDTO.Trends,
		TrendsFrom:              trendsFrom,
		TrendsRange:             trendsRange,
		CacheTTL:                cacheTTL,
		Timeout:                 time.Duration(timeout) * time.Second,
		QueryTimeout:            time.Duration(queryTimeout) * time.Second,
		DisableDataAlignment:    zabbixSettingsDTO.DisableDataAlignment,
		DisableReadOnlyUsersAck: zabbixSettingsDTO.DisableReadOnlyUsersAck,
		PerUserAuth:             zabbixSettingsDTO.PerUserAuth,
		PerUserAuthField:        zabbixSettingsDTO.PerUserAuthField,
	}

	return zabbixSettings, nil
}
