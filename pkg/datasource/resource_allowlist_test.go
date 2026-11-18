package datasource

import (
	"net/http"
	"testing"
)

func TestIsAllowedResourcePath(t *testing.T) {
	allowed := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "zabbix-api"},
		{http.MethodPost, "/zabbix-api"},
		{http.MethodPost, "db-connection-post"},
		{http.MethodPost, "/db-connection-post"},
	}
	for _, tt := range allowed {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			if !isAllowedResourcePath(tt.method, tt.path) {
				t.Errorf("expected %s %q to be allowed", tt.method, tt.path)
			}
		})
	}

	rejected := []struct {
		name   string
		method string
		path   string
	}{
		{"empty path", http.MethodPost, ""},
		{"bare root", http.MethodPost, "/"},
		{"unknown path", http.MethodPost, "/anything"},
		{"unregistered nested path", http.MethodPost, "/zabbix-api/extra"},
		{"path traversal to zabbix-api", http.MethodPost, "/../zabbix-api"},
		{"dot segment inside path", http.MethodPost, "/zabbix-api/../db-connection-post"},
		{"bare dot segment", http.MethodPost, "/./zabbix-api"},
		{"percent-encoded traversal", http.MethodPost, "/zabbix-api%2F..%2Fdb-connection-post"},
		{"literal percent sign", http.MethodPost, "/zabbix%2Dapi"},
		// method confusion: right path, wrong verb.
		{"GET on zabbix-api", http.MethodGet, "/zabbix-api"},
		{"GET on db-connection-post", http.MethodGet, "/db-connection-post"},
		{"PUT on zabbix-api", http.MethodPut, "/zabbix-api"},
		{"DELETE on db-connection-post", http.MethodDelete, "/db-connection-post"},
	}
	for _, tt := range rejected {
		t.Run(tt.name, func(t *testing.T) {
			if isAllowedResourcePath(tt.method, tt.path) {
				t.Errorf("expected %s %q to be rejected", tt.method, tt.path)
			}
		})
	}
}
