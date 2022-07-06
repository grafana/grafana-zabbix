package settings

import (
	"encoding/json"
	"errors"
	"github.com/leleobhz/grafana-zabbix/pkg/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"strconv"
	"time"
)

func ReadZabbixSettings(dsInstanceSettings *backend.DataSourceInstanceSettings) (*ZabbixDatasourceSettings, error) {
	zabbixSettingsDTO := &ZabbixDatasourceSettingsDTO{}

	err := json.Unmarshal(dsInstanceSettings.JSONData, &zabbixSettingsDTO)
	if err != nil {
		return nil, err
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

	//if zabbixSettingsDTO.Timeout == 0 {
	//	zabbixSettingsDTO.Timeout = 30
	//}

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

	var timeout int64
	switch t := zabbixSettingsDTO.Timeout.(type) {
	case string:
		if t == "" {
			timeout = 30
			break
		}
		timeoutInt, err := strconv.Atoi(t)
		if err != nil {
			return nil, errors.New("failed to parse timeout: " + err.Error())
		}
		timeout = int64(timeoutInt)
	case float64:
		timeout = int64(t)
	default:
		timeout = 30
	}

	zabbixSettings := &ZabbixDatasourceSettings{
		Trends:                  zabbixSettingsDTO.Trends,
		TrendsFrom:              trendsFrom,
		TrendsRange:             trendsRange,
		CacheTTL:                cacheTTL,
		Timeout:                 time.Duration(timeout) * time.Second,
		DisableDataAlignment:    zabbixSettingsDTO.DisableDataAlignment,
		DisableReadOnlyUsersAck: zabbixSettingsDTO.DisableReadOnlyUsersAck,
	}

	return zabbixSettings, nil
}
