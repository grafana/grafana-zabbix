package cache

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"gotest.tools/assert"
)

func TestHashDatasourceInfo(t *testing.T) {
	tests := []struct {
		name         string
		dsInfoBefore *backend.DataSourceInstanceSettings
		dsInfoAfter  *backend.DataSourceInstanceSettings
		equal        bool
	}{
		{
			name: "Same datasource settings",
			dsInfoBefore: &backend.DataSourceInstanceSettings{
				ID:       1,
				Name:     "Zabbix",
				URL:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JSONData: []byte("{}"),
				DecryptedSecureJSONData: map[string]string{
					"username": "grafanaZabbixUser",
					"password": "$uper$ecr3t!!!",
				},
			},
			dsInfoAfter: &backend.DataSourceInstanceSettings{
				ID:       1,
				Name:     "Zabbix",
				URL:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JSONData: []byte("{}"),
				DecryptedSecureJSONData: map[string]string{
					"username": "grafanaZabbixUser",
					"password": "$uper$ecr3t!!!",
				},
			},
			equal: true,
		},
		{
			name: "Password changed",
			dsInfoBefore: &backend.DataSourceInstanceSettings{
				ID:       1,
				Name:     "Zabbix",
				URL:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JSONData: []byte("{}"),
				DecryptedSecureJSONData: map[string]string{
					"username": "grafanaZabbixUser",
					"password": "$uper$ecr3t!!!",
				},
			},
			dsInfoAfter: &backend.DataSourceInstanceSettings{
				ID:       1,
				Name:     "Zabbix",
				URL:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JSONData: []byte("{}"),
				DecryptedSecureJSONData: map[string]string{
					"username": "grafanaZabbixUser",
					"password": "new$uper$ecr3t!!!",
				},
			},
			equal: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before := HashDatasourceInfo(tt.dsInfoBefore)
			after := HashDatasourceInfo(tt.dsInfoAfter)
			got := before == after
			assert.Equal(t, tt.equal, got)
		})
	}
}

func BenchmarkHashDatasourceInfo(b *testing.B) {
	benches := []struct {
		name   string
		dsInfo *backend.DataSourceInstanceSettings
	}{
		{
			"Normal Datasource Info",
			&backend.DataSourceInstanceSettings{
				ID:       4,
				Name:     "MyZabbixDatasource",
				URL:      "https://localhost:3306/zabbix/api_jsonrpc.php",
				JSONData: []byte(`{ "addThresholds": true, "disableReadOnlyUsersAck": true }`),
				DecryptedSecureJSONData: map[string]string{
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
