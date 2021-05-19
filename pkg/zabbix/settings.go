package zabbix

import (
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func readZabbixSettings(dsInstanceSettings *backend.DataSourceInstanceSettings) (*ZabbixDatasourceSettings, error) {
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

	if zabbixSettingsDTO.Timeout == "" {
		zabbixSettingsDTO.Timeout = "30"
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

	timeout, err := strconv.Atoi(zabbixSettingsDTO.Timeout)
	if err != nil {
		return nil, errors.New("failed to parse timeout: " + err.Error())
	}

	zabbixSettings := &ZabbixDatasourceSettings{
		Trends:      zabbixSettingsDTO.Trends,
		TrendsFrom:  trendsFrom,
		TrendsRange: trendsRange,
		CacheTTL:    cacheTTL,
		Timeout:     time.Duration(timeout) * time.Second,
	}

	return zabbixSettings, nil
}
