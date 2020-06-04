package datasource

import (
	"fmt"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"gotest.tools/assert"
)

func TestZabbixBackend_getCachedDatasource(t *testing.T) {
	basicDsSettings := &backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://zabbix.org/zabbix",
		JSONData: []byte("{}"),
	}

	modifiedDatasourceSettings := &backend.DataSourceInstanceSettings{
		ID:       1,
		Name:     "TestDatasource",
		URL:      "http://another.zabbix.org/zabbix",
		JSONData: []byte("{}"),
	}
	modifiedDatasource, _ := NewZabbixDatasourceInstance(modifiedDatasourceSettings)

	basicDS, _ := NewZabbixDatasourceInstance(basicDsSettings)
	dsCache := cache.NewCache(cache.NoExpiration, cache.NoExpiration)
	dsCache.Set("1-1", basicDS)

	tests := []struct {
		name          string
		cache         *cache.Cache
		pluginContext backend.PluginContext
		want          *ZabbixDatasourceInstance
	}{
		{
			name: "Uncached Datasource (nothing in cache)",
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: basicDsSettings,
			},
			want: basicDS,
		},
		{
			name:  "Cached Datasource",
			cache: dsCache,
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: basicDsSettings,
			},
			want: basicDS,
		},
		{
			name:  "Cached then modified",
			cache: dsCache,
			pluginContext: backend.PluginContext{
				OrgID:                      1,
				DataSourceInstanceSettings: modifiedDatasourceSettings,
			},
			want: modifiedDatasource,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.cache == nil {
				tt.cache = cache.NewCache(cache.NoExpiration, cache.NoExpiration)
			}
			ds := &ZabbixDatasource{
				datasourceCache: tt.cache,
				logger:          log.New(),
			}
			got, _ := ds.GetDatasource(tt.pluginContext)

			// Only checking the URL, being the easiest value to, and guarantee equality for
			assert.Equal(t, tt.want.zabbixAPI.GetUrl().String(), got.zabbixAPI.GetUrl().String())

			// Ensure the datasource is in the cache
			cacheds, ok := tt.cache.Get(fmt.Sprint("1-", tt.pluginContext.DataSourceInstanceSettings.ID))
			assert.Equal(t, true, ok)
			assert.Equal(t, got, cacheds)
		})
	}
}
