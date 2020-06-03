package cache

import (
	"testing"

	"github.com/grafana/grafana_plugin_model/go/datasource"
	"gotest.tools/assert"
)

func TestHashDatasourceInfo(t *testing.T) {
	tests := []struct {
		name   string
		dsInfo *datasource.DatasourceInfo
		want   string
	}{
		{
			name: "Normal Datasource Info",
			dsInfo: &datasource.DatasourceInfo{
				Id:       1,
				OrgId:    1,
				Name:     "Zabbix",
				Type:     "alexanderzobnin-zabbix-datasource",
				Url:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JsonData: "{}",
				DecryptedSecureJsonData: map[string]string{
					"username": "grafanaZabbixUser",
					"password": "$uper$ecr3t!!!",
				},
			},
			want: "ed161f89179c46d9a578e4d7e92ff95444222e0a",
		},
		// Can't find a case where the input causes the encoder to fail
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HashDatasourceInfo(tt.dsInfo)
			assert.Equal(t, tt.want, got)
		})
	}
}

func BenchmarkHashDatasourceInfo(b *testing.B) {
	benches := []struct {
		name   string
		dsInfo *datasource.DatasourceInfo
	}{
		{
			"Normal Datasource Info",
			&datasource.DatasourceInfo{
				Id:       4,
				OrgId:    6,
				Name:     "MyZabbixDatasource",
				Type:     "alexanderzobnin-zabbix-datasource",
				Url:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JsonData: `{ "addThresholds": true, "disableReadOnlyUsersAck": true }`,
				DecryptedSecureJsonData: map[string]string{
					"username": "grafanaZabbixUser",
					"password": "$uper$ecr3t!!!",
				},
			},
		},
	}
	for _, bt := range benches {
		b.Run(bt.name, func(b *testing.B) {
			HashDatasourceInfo(bt.dsInfo)
		})
	}
}
