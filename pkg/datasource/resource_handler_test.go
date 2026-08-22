package datasource

import (
	"errors"
	"fmt"
	"net/http"
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
