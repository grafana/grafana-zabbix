package datasource

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
)

// ErrUnsupportedResourcePath is returned for a CallResource path this
// datasource doesn't serve.
var ErrUnsupportedResourcePath = errors.New("the requested resource path is not supported by this datasource")

// allowedResourcePaths are the only (method, path) calls the frontend issues.
var allowedResourcePaths = []struct {
	method  string
	pattern *regexp.Regexp
}{
	{http.MethodPost, regexp.MustCompile(`^zabbix-api$`)},
	{http.MethodPost, regexp.MustCompile(`^db-connection-post$`)},
}

// isAllowedResourcePath reports whether method+path matches an allowed call.
func isAllowedResourcePath(method, path string) bool {
	trimmed := strings.TrimPrefix(path, "/")

	// Reject a surviving "%" (already decoded once) and dot-segments.
	if strings.Contains(trimmed, "%") {
		return false
	}

	for segment := range strings.SplitSeq(trimmed, "/") {
		if segment == "." || segment == ".." {
			return false
		}
	}

	for _, allowed := range allowedResourcePaths {
		if allowed.method == method && allowed.pattern.MatchString(trimmed) {
			return true
		}
	}
	return false
}
