package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Test_resourceMux_rejectsArbitraryPaths guards against the resource
// CallResource route accepting any path the caller sends it. Before the
// allowlist, an unregistered path fell through net/http.ServeMux's "/"
// catch-all straight to RootHandler and got served with 200 OK.
func Test_resourceMux_rejectsArbitraryPaths(t *testing.T) {
	mux := http.NewServeMux()
	Init(log.NewNullLogger(), mux)

	paths := []string{
		"/anything",
		"/etc/passwd",
		"/zabbix-api-typo",
		"/zabbix-api/extra",
		"/db-connection-post/extra",
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, path, nil)
			rw := httptest.NewRecorder()
			mux.ServeHTTP(rw, req)

			if rw.Code != http.StatusForbidden {
				t.Errorf("POST %s: expected 403, got %d (body: %s)", path, rw.Code, rw.Body.String())
			}
		})
	}
}

// Test_resourceMux_rootPathStillWorks makes sure the (harmless) root
// health-check response the plugin scaffold has always returned is
// unaffected by the allowlist.
func Test_resourceMux_rootPathStillWorks(t *testing.T) {
	mux := http.NewServeMux()
	Init(log.NewNullLogger(), mux)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rw := httptest.NewRecorder()
	mux.ServeHTTP(rw, req)

	if rw.Code != http.StatusOK {
		t.Errorf("expected 200, got %d (body: %s)", rw.Code, rw.Body.String())
	}
}

// Test_resourceMux_rejectsWrongMethodOnKnownPaths ensures the known routes
// can't be reached with a method the frontend never uses.
func Test_resourceMux_rejectsWrongMethodOnKnownPaths(t *testing.T) {
	mux := http.NewServeMux()
	Init(log.NewNullLogger(), mux)

	knownPaths := []string{"/zabbix-api", "/db-connection-post"}
	for _, path := range knownPaths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rw := httptest.NewRecorder()
			mux.ServeHTTP(rw, req)

			if rw.Code != http.StatusForbidden {
				t.Errorf("GET %s: expected 403, got %d (body: %s)", path, rw.Code, rw.Body.String())
			}
		})
	}
}
