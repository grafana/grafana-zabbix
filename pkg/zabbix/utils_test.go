package zabbix

import (
	"testing"

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
		expectNoError bool
		expectedError string
	}{
		{
			name:          "Simple regexp",
			filter:        "/.*/",
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Not a regex",
			filter:        "/var/lib/mysql: Total space",
			expectNoError: true,
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseFilter(tt.filter)
			if tt.expectNoError {
				assert.NoError(t, err)
			}
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError)
			}
		})
	}
}
