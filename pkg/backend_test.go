package main

import (
	"testing"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	cache "github.com/patrickmn/go-cache"
	"gotest.tools/assert"
	"gotest.tools/assert/cmp"
)

func TestZabbixBackend_getCachedDatasource(t *testing.T) {
	basicDatasourceInfo := &datasource.DatasourceInfo{
		Id:   1,
		Name: "TestDatasource",
		Url:  "http://zabbix.org/zabbix",
	}
	basicDatasourceInfoHash := HashDatasourceInfo(basicDatasourceInfo)
	basicDatasource, _ := NewZabbixDatasource(hclog.NewNullLogger(), basicDatasourceInfo)

	altDatasourceInfo := &datasource.DatasourceInfo{
		Id:   2,
		Name: "AnotherDatasource",
		Url:  "http://zabbix.org/zabbix",
	}
	altDatasourceInfoHash := HashDatasourceInfo(altDatasourceInfo)
	altDatasource, _ := NewZabbixDatasource(hclog.NewNullLogger(), altDatasourceInfo)

	badDatasourceInfo := &datasource.DatasourceInfo{
		Id:   3,
		Name: "NotValid",
		Url:  ":not a url",
	}

	tests := []struct {
		name      string
		cache     *cache.Cache
		request   *datasource.DatasourceRequest
		wantHash  string
		wantError string
	}{
		{
			name: "Uncached Datasource (nothing in cache)",
			request: &datasource.DatasourceRequest{
				Datasource: basicDatasourceInfo,
			},
			wantHash: HashDatasourceInfo(basicDatasourceInfo),
		},
		{
			name: "Uncached Datasource (cache miss)",
			cache: cache.NewFrom(cache.NoExpiration, cache.NoExpiration, map[string]cache.Item{
				basicDatasourceInfoHash: cache.Item{Object: altDatasource},
			}),
			request: &datasource.DatasourceRequest{
				Datasource: altDatasourceInfo,
			},
			wantHash: HashDatasourceInfo(altDatasourceInfo),
		},
		{
			name: "Cached Datasource",
			cache: cache.NewFrom(cache.NoExpiration, cache.NoExpiration, map[string]cache.Item{
				basicDatasourceInfoHash: cache.Item{Object: basicDatasource},
				altDatasourceInfoHash:   cache.Item{Object: altDatasource},
			}),
			request: &datasource.DatasourceRequest{
				Datasource: basicDatasourceInfo,
			},
			wantHash: basicDatasourceInfoHash,
		},
		{
			name: "Bad URL Error",
			request: &datasource.DatasourceRequest{
				Datasource: badDatasourceInfo,
			},
			wantError: "parse :not a url: missing protocol scheme",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.cache == nil {
				tt.cache = cache.New(cache.NoExpiration, cache.NoExpiration)
			}
			p := &ZabbixPlugin{
				logger: hclog.New(&hclog.LoggerOptions{
					Name:  "TestZabbixBackend_getCachedDatasource",
					Level: hclog.LevelFromString("DEBUG"),
				}),
				datasourceCache: &Cache{cache: tt.cache},
			}
			got, err := p.GetDatasource(tt.request)

			if tt.wantError != "" {
				assert.Error(t, err, tt.wantError)
				assert.Assert(t, cmp.Nil(got))
				return
			}

			assert.NilError(t, err)
			assert.Equal(t, tt.wantHash, got.hash)

			// Ensure the datasource is in the cache
			cacheds, ok := tt.cache.Get(HashDatasourceInfo(tt.request.GetDatasource()))
			assert.Equal(t, true, ok)
			assert.Equal(t, got, cacheds)
		})
	}
}

func TestBuildResponse(t *testing.T) {
	jsonData := simplejson.New()
	jsonData.Set("testing", []int{5, 12, 75})

	tests := []struct {
		name         string
		responseData interface{}
		want         *datasource.DatasourceResponse
		wantErr      string
	}{
		{
			name:         "simplejson Response",
			responseData: jsonData,
			want: &datasource.DatasourceResponse{
				Results: []*datasource.QueryResult{
					&datasource.QueryResult{
						RefId:    "zabbixAPI",
						MetaJson: `{"testing":[5,12,75]}`,
					},
				},
			},
		},
		{
			name: "Connetion Status Response",
			responseData: connectionTestResponse{
				ZabbixVersion: "2.4",
				DbConnectorStatus: &dbConnectionStatus{
					DsType: "mysql",
					DsName: "MyDatabase",
				},
			},
			want: &datasource.DatasourceResponse{
				Results: []*datasource.QueryResult{
					&datasource.QueryResult{
						RefId:    "zabbixAPI",
						MetaJson: `{"zabbixVersion":"2.4","dbConnectorStatus":{"dsType":"mysql","dsName":"MyDatabase"}}`,
					},
				},
			},
		},
		{
			name:         "Unmarshalable",
			responseData: 2i,
			wantErr:      "json: unsupported type: complex128",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := BuildResponse(tt.responseData)
			if tt.wantErr != "" {
				assert.Error(t, err, tt.wantErr)
				assert.Assert(t, cmp.Nil(got))
				return
			}
			assert.NilError(t, err)
			assert.DeepEqual(t, got, tt.want)
		})
	}
}

func TestQueryType(t *testing.T) {
	resp, err := GetQueryType(mockDataSourceRequest(`{"queryType":"sampleQueryType"}`))

	assert.NilError(t, err)
	assert.Equal(t, "sampleQueryType", resp)
}

func TestQueryTypeEmpty(t *testing.T) {
	resp, err := GetQueryType(mockDataSourceRequest("{}"))

	assert.NilError(t, err)
	assert.Equal(t, "query", resp)
}
