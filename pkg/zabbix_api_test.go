package main

import (
	"testing"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	"gotest.tools/assert"
	"gotest.tools/assert/cmp"
)

func TestZabbixDatasource_BuildResponse(t *testing.T) {
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
			ds := NewZabbixDatasource()
			got, err := ds.BuildResponse(tt.responseData)
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
