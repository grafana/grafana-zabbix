package datasource

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/stretchr/testify/assert"
)

// TestStatusCodeFromError covers a bug flagged in review: ZabbixAPIHandler
// used to always report 500 to the browser regardless of the real upstream
// failure, so the frontend's retry-on-502/503/504 logic could never match
// anything. statusCodeFromError is what now extracts the real status.
func TestStatusCodeFromError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		fallback int
		want     int
	}{
		{
			name:     "extracts the upstream status from a StatusError",
			err:      &zabbixapi.StatusError{StatusCode: http.StatusServiceUnavailable},
			fallback: http.StatusInternalServerError,
			want:     http.StatusServiceUnavailable,
		},
		{
			name:     "extracts the upstream status even when wrapped by another error",
			err:      fmt.Errorf("zabbix API request error: %w", &zabbixapi.StatusError{StatusCode: http.StatusBadGateway}),
			fallback: http.StatusInternalServerError,
			want:     http.StatusBadGateway,
		},
		{
			name:     "falls back for a plain error with no StatusError in its chain",
			err:      errors.New("boom"),
			fallback: http.StatusInternalServerError,
			want:     http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := statusCodeFromError(tt.err, tt.fallback)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestRootHandler_RejectsNonRootPath guards the RootHandler-level check added
// alongside the resource allowlist: the mux's "/" catch-all must not serve
// anything other than the literal root path.
func TestRootHandler_RejectsNonRootPath(t *testing.T) {
	ds := NewZabbixDatasource()
	defer ds.Close()

	req := httptest.NewRequest(http.MethodGet, "/anything", nil)
	rw := httptest.NewRecorder()
	ds.RootHandler(rw, req)

	assert.Equal(t, http.StatusForbidden, rw.Code)
	assert.Contains(t, rw.Body.String(), ErrUnsupportedResourcePath.Error())
}

func TestRootHandler_ServesRoot(t *testing.T) {
	ds := NewZabbixDatasource()
	defer ds.Close()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rw := httptest.NewRecorder()
	ds.RootHandler(rw, req)

	assert.Equal(t, http.StatusOK, rw.Code)
	assert.Contains(t, rw.Body.String(), "Hello from Zabbix data source!")
}

// TestZabbixAPIHandler_RejectsDisallowedPathOrMethod ensures the handler
// itself enforces the allowlist and bails out before reading the request
// body or looking up the datasource instance.
func TestZabbixAPIHandler_RejectsDisallowedPathOrMethod(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"wrong method", http.MethodGet, "/zabbix-api"},
		{"wrong path", http.MethodPost, "/zabbix-api/extra"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := NewZabbixDatasource()
			defer ds.Close()

			req := httptest.NewRequest(tt.method, tt.path, nil)
			rw := httptest.NewRecorder()
			ds.ZabbixAPIHandler(rw, req)

			assert.Equal(t, http.StatusForbidden, rw.Code)
			assert.Contains(t, rw.Body.String(), ErrUnsupportedResourcePath.Error())
		})
	}
}

// TestDBConnectionPostProcessingHandler_RejectsDisallowedPathOrMethod mirrors
// the ZabbixAPIHandler coverage above for the other allowlisted route.
func TestDBConnectionPostProcessingHandler_RejectsDisallowedPathOrMethod(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"wrong method", http.MethodGet, "/db-connection-post"},
		{"wrong path", http.MethodPost, "/db-connection-post/extra"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := NewZabbixDatasource()
			defer ds.Close()

			req := httptest.NewRequest(tt.method, tt.path, nil)
			rw := httptest.NewRecorder()
			ds.DBConnectionPostProcessingHandler(rw, req)

			assert.Equal(t, http.StatusForbidden, rw.Code)
			assert.Contains(t, rw.Body.String(), ErrUnsupportedResourcePath.Error())
		})
	}
}
