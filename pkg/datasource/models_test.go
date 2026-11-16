package datasource

import (
	"regexp"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadQueryMigratesApplicationFilter(t *testing.T) {
	tests := []struct {
		name     string
		json     string
		expected string
	}{
		{
			name:     "application filter with an empty item tag filter",
			json:     `{"queryType":"0","application":{"filter":"CPU"},"itemTag":{"filter":""}}`,
			expected: "Application: CPU",
		},
		{
			name:     "application filter without an item tag filter",
			json:     `{"queryType":"0","application":{"filter":"CPU"}}`,
			expected: "Application: CPU",
		},
		{
			name:     "existing item tag filter wins",
			json:     `{"queryType":"0","application":{"filter":"CPU"},"itemTag":{"filter":"component: memory"}}`,
			expected: "component: memory",
		},
		{
			name:     "empty application filter",
			json:     `{"queryType":"0","application":{"filter":""},"itemTag":{"filter":""}}`,
			expected: "",
		},
		{
			name:     "no application at all",
			json:     `{"queryType":"0","itemTag":{"filter":""}}`,
			expected: "",
		},
		{
			name:     "match-all regex application filter is dropped",
			json:     `{"queryType":"0","application":{"filter":"/.*/"},"itemTag":{"filter":""}}`,
			expected: "",
		},
		{
			name:     "application filter with a template variable is dropped",
			json:     `{"queryType":"0","application":{"filter":"$app"},"itemTag":{"filter":""}}`,
			expected: "",
		},
		{
			name:     "regex application filter",
			json:     `{"queryType":"0","application":{"filter":"/^CPU/i"},"itemTag":{"filter":""}}`,
			expected: "/^Application: (?:CPU)/i",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model, err := ReadQuery(backend.DataQuery{JSON: []byte(tt.json)})
			require.NoError(t, err)
			assert.Equal(t, tt.expected, model.ItemTag.Filter)
		})
	}
}

func TestApplicationFilterToItemTagFilterRegex(t *testing.T) {
	matches := func(appFilter, appName string) bool {
		m := regexFilterPattern.FindStringSubmatch(applicationFilterToItemTagFilter(appFilter))
		require.NotNil(t, m, "expected a regex filter for %s", appFilter)
		return regexp.MustCompile(m[1]).MatchString("Application: " + appName)
	}

	assert.Equal(t, "/^Application: .*(?:CPU)/", applicationFilterToItemTagFilter("/CPU/"))

	assert.True(t, matches("/CPU/", "CPU"))
	assert.True(t, matches("/CPU/", "Linux CPU load"))
	assert.False(t, matches("/CPU/", "Memory"))
	assert.True(t, matches("/^CPU/", "CPU load"))
	assert.False(t, matches("/^CPU/", "Linux CPU"))
	assert.True(t, matches("/CPU|Memory/", "Memory"))
	assert.True(t, matches("/^(CPU|Memory)$/", "Memory"))
	assert.False(t, matches("/^(CPU|Memory)$/", "Memory usage"))

	// Never matches tags other than Application.
	m := regexFilterPattern.FindStringSubmatch(applicationFilterToItemTagFilter("/CPU/"))
	assert.False(t, regexp.MustCompile(m[1]).MatchString("component: CPU"))
}

func TestApplicationFilterToItemTagFilterDropped(t *testing.T) {
	dropped := []string{
		// Match-all regexes.
		"/.*/", "/^.*$/", "/^.*/", "/.*$/", "/.+/", "//", "/.*/i",
		// Template variables.
		"$app", "${app}", "${app:regex}", "[[app]]", "/$app/", "CPU $suffix", "/^(${app:pipe})$/",
	}
	for _, filter := range dropped {
		assert.Equal(t, "", applicationFilterToItemTagFilter(filter), "filter %q", filter)
	}

	// A trailing $ anchor alone is not a variable and not match-all.
	assert.Equal(t, "/^Application: (?:CPU$)/", applicationFilterToItemTagFilter("/^CPU$/"))
	assert.Equal(t, "Application: CPU", applicationFilterToItemTagFilter("CPU"))
}
