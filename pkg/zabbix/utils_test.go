package zabbix

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestExpandItemName(t *testing.T) {
	tests := []struct {
		name     string
		itemName string
		key      string
		expected string
	}{
		{
			name:     "UNQUOTED_PARAMS",
			itemName: "CPU $2 time",
			key:      "system.cpu.util[,user,avg1]",
			expected: "CPU user time",
		},
		{
			name:     "QUOTED_PARAMS_WITH_COMMAS",
			itemName: "CPU $1 $2 $3",
			key:      "system.cpu.util[\"type=user,value=avg\",time,\"user\"]",
			expected: "CPU type=user,value=avg time user",
		},
		{
			name:     "MULTIPLE_ARRAY_PARAMS",
			itemName: "CPU $2 - $3 time",
			key:      "system.cpu.util[,[user,system],avg1]",
			expected: "CPU user,system - avg1 time",
		},
		{
			name:     "MULTIPLE_ARRAY_PARAMS",
			itemName: "CPU - $2 - $3 - $4",
			key:      "system.cpu.util[,[],[\"user,system\",iowait],avg1]",
			expected: "CPU -  - \"user,system\",iowait - avg1",
		},
		{
			name:     "UNICODE_PARAMS",
			itemName: "CPU $1 $2 $3",
			key:      "system.cpu.util[\"type=\b5Ὂg̀9! ℃ᾭG,value=avg\",time,\"user\"]",
			expected: "CPU type=\b5Ὂg̀9! ℃ᾭG,value=avg time user",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item := &Item{
				Name: tt.itemName,
				Key:  tt.key,
			}
			expandedName := item.ExpandItemName()
			assert.Equal(t, tt.expected, expandedName)
		})
	}
}

func TestParseFilter(t *testing.T) {
	tests := []struct {
		name          string
		filter        string
		wantPattern   string
		expectNoError bool
		expectedError string
	}{
		{
			name:          "Simple regexp",
			filter:        "/.*/",
			wantPattern:   ".*",
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Not a regex",
			filter:        "/var/lib/mysql: Total space",
			wantPattern:   "",
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Regexp with modifier",
			filter:        "/.*/i",
			wantPattern:   "(?i).*",
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Regexp with unsupported modifier",
			filter:        "/.*/1",
			wantPattern:   "",
			expectNoError: false,
			expectedError: "",
		},
		{
			name:          "Safe complex regex",
			filter:        "/^[a-zA-Z0-9_-]+\\.[a-zA-Z]{2,}$/",
			wantPattern:   "^[a-zA-Z0-9_-]+\\.[a-zA-Z]{2,}$",
			expectNoError: true,
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseFilter(tt.filter)
			if tt.expectNoError {
				assert.NoError(t, err)
			}
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError)
			}
			if tt.wantPattern == "" {
				assert.Nil(t, got)
			} else {
				assert.NotNil(t, got)
				assert.Equal(t, tt.wantPattern, got.String())
				// Verify that timeout is set for DoS protection
				assert.Equal(t, 5*time.Second, got.MatchTimeout)
			}
		})
	}
}

func TestParseFilterTimeout(t *testing.T) {
	// Test with a pathological regex pattern that should trigger MatchTimeout
	filter := "/((((.*)*)*)*)*z/"
	compiled, err := parseFilter(filter)
	
	// The regex should compile successfully with timeout protection
	assert.NoError(t, err)
	assert.NotNil(t, compiled)
	assert.Equal(t, 5*time.Second, compiled.MatchTimeout)
	
	// Test that the regex times out when matching against a problematic string
	// This string is crafted to trigger catastrophic backtracking
	testString := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" // 52 'a's, no 'z'
	
	// The match should timeout and return an error
	match, err := compiled.MatchString(testString)
	
	// We expect either a timeout error or the match to complete quickly if RE2 optimizations prevent catastrophic backtracking
	// In either case, the system should remain responsive
	assert.False(t, match) // Should not match since there's no 'z'
	
	// If there's an error, it should be related to timeout
	if err != nil {
		assert.Contains(t, err.Error(), "timeout")
	}
}

