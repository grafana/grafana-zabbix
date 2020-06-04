package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/gtime"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ZabbixDatasource struct {
	datasourceCache *cache.Cache
	logger          log.Logger
}

// ZabbixDatasourceInstance stores state about a specific datasource
// and provides methods to make requests to the Zabbix API
type ZabbixDatasourceInstance struct {
	zabbixAPI  *zabbixapi.ZabbixAPI
	dsInfo     *backend.DataSourceInstanceSettings
	Settings   *ZabbixDatasourceSettings
	queryCache *cache.Cache
	logger     log.Logger
}

func NewZabbixDatasource() *ZabbixDatasource {
	return &ZabbixDatasource{
		datasourceCache: cache.NewCache(10*time.Minute, 10*time.Minute),
		logger:          log.New(),
	}
}

// NewZabbixDatasourceInstance returns an initialized zabbix datasource instance
func NewZabbixDatasourceInstance(dsInfo *backend.DataSourceInstanceSettings) (*ZabbixDatasourceInstance, error) {
	zabbixAPI, err := zabbixapi.New(dsInfo.URL)
	if err != nil {
		return nil, err
	}

	zabbixSettings, err := readZabbixSettings(dsInfo)
	if err != nil {
		return nil, err
	}

	return &ZabbixDatasourceInstance{
		dsInfo:     dsInfo,
		zabbixAPI:  zabbixAPI,
		Settings:   zabbixSettings,
		queryCache: cache.NewCache(zabbixSettings.CacheTTL, 10*time.Minute),
		logger:     log.New(),
	}, nil
}

// CheckHealth checks if the plugin is running properly
func (ds *ZabbixDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}

	dsInstance, err := ds.GetDatasource(req.PluginContext)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Error getting datasource instance"
		ds.logger.Error("Error getting datasource instance", "err", err)
		return res, nil
	}

	message, err := dsInstance.TestConnection(ctx)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = err.Error()
		ds.logger.Error("Error connecting zabbix", "err", err)
		return res, nil
	}

	res.Status = backend.HealthStatusOk
	res.Message = message
	return res, nil
}

func (ds *ZabbixDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	qdr := backend.NewQueryDataResponse()

	zabbixDS, err := ds.GetDatasource(req.PluginContext)
	if err != nil {
		return nil, err
	}

	for _, q := range req.Queries {
		res := backend.DataResponse{}
		query, err := ReadQuery(q)
		ds.logger.Debug("DS query", "query", q)
		if err != nil {
			res.Error = err
		} else if len(query.Functions) > 0 {
			res.Error = errors.New("Zabbix queries with functions are not supported")
		} else if query.Mode != 0 {
			res.Error = errors.New("Non-metrics queries are not supported")
		} else {
			frame, err := zabbixDS.queryNumericItems(ctx, &query)
			if err != nil {
				res.Error = err
			} else {
				res.Frames = []*data.Frame{frame}
			}
		}
		qdr.Responses[q.RefID] = res
	}

	return qdr, nil
}

// GetDatasource Returns cached datasource or creates new one
func (ds *ZabbixDatasource) GetDatasource(pluginContext backend.PluginContext) (*ZabbixDatasourceInstance, error) {
	dsSettings := pluginContext.DataSourceInstanceSettings
	dsKey := fmt.Sprintf("%d-%d", pluginContext.OrgID, dsSettings.ID)
	// Get hash to check if settings changed
	dsInfoHash := cache.HashDatasourceInfo(dsSettings)

	if cachedData, ok := ds.datasourceCache.Get(dsKey); ok {
		if cachedDS, ok := cachedData.(*ZabbixDatasourceInstance); ok {
			cachedDSHash := cache.HashDatasourceInfo(cachedDS.dsInfo)
			if cachedDSHash == dsInfoHash {
				return cachedDS, nil
			}
			ds.logger.Debug("Data source settings changed", "org", pluginContext.OrgID, "id", dsSettings.ID, "name", dsSettings.Name)
		}
	}

	ds.logger.Debug("Initializing data source", "org", pluginContext.OrgID, "id", dsSettings.ID, "name", dsSettings.Name)
	dsInstance, err := NewZabbixDatasourceInstance(pluginContext.DataSourceInstanceSettings)
	if err != nil {
		ds.logger.Error("Error initializing datasource", "error", err)
		return nil, err
	}

	ds.datasourceCache.Set(dsKey, dsInstance)
	return dsInstance, nil
}

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

	zabbixSettings := &ZabbixDatasourceSettings{
		Trends:      zabbixSettingsDTO.Trends,
		TrendsFrom:  trendsFrom,
		TrendsRange: trendsRange,
		CacheTTL:    cacheTTL,
	}

	return zabbixSettings, nil
}
