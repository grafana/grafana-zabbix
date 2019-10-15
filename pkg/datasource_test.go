package main

import (
	"testing"

	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	cache "github.com/patrickmn/go-cache"
	"gotest.tools/assert"
)

func TestZabbixBackend_getCachedDatasource(t *testing.T) {
	basicDatasourceInfo := &datasource.DatasourceInfo{
		Id:   1,
		Name: "TestDatasource",
	}
	basicDatasourceInfoHash := HashDatasourceInfo(basicDatasourceInfo)

	modifiedDatasource := NewZabbixDatasource()
	modifiedDatasource.authToken = "AB404F1234"

	altDatasourceInfo := &datasource.DatasourceInfo{
		Id:   2,
		Name: "AnotherDatasource",
	}
	altDatasourceInfoHash := HashDatasourceInfo(altDatasourceInfo)

	tests := []struct {
		name    string
		cache   *cache.Cache
		request *datasource.DatasourceRequest
		want    *ZabbixDatasource
	}{
		{
			name: "Uncached Datasource (nothing in cache)",
			request: &datasource.DatasourceRequest{
				Datasource: basicDatasourceInfo,
			},
			want: NewZabbixDatasource(),
		},
		{
			name: "Uncached Datasource (cache miss)",
			cache: cache.NewFrom(cache.NoExpiration, cache.NoExpiration, map[string]cache.Item{
				basicDatasourceInfoHash: cache.Item{Object: modifiedDatasource},
			}),
			request: &datasource.DatasourceRequest{
				Datasource: altDatasourceInfo,
			},
			want: NewZabbixDatasource(),
		},
		{
			name: "Cached Datasource",
			cache: cache.NewFrom(cache.NoExpiration, cache.NoExpiration, map[string]cache.Item{
				altDatasourceInfoHash:   cache.Item{Object: NewZabbixDatasource()},
				basicDatasourceInfoHash: cache.Item{Object: modifiedDatasource},
			}),
			request: &datasource.DatasourceRequest{
				Datasource: basicDatasourceInfo,
			},
			want: modifiedDatasource,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.cache == nil {
				tt.cache = cache.New(cache.NoExpiration, cache.NoExpiration)
			}
			b := &ZabbixBackend{
				logger: hclog.New(&hclog.LoggerOptions{
					Name:  "TestZabbixBackend_getCachedDatasource",
					Level: hclog.LevelFromString("DEBUG"),
				}),
				datasourceCache: &Cache{cache: tt.cache},
			}
			got := b.getCachedDatasource(tt.request)

			// Only checking the authToken, being the easiest value to, and guarantee equality for
			assert.Equal(t, tt.want.authToken, got.authToken)
		})
	}
}
