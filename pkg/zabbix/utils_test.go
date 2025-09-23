package zabbix

import (
	"reflect"
	"testing"

	"github.com/dlclark/regexp2"
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
		want          *regexp2.Regexp
		expectNoError bool
		expectedError string
	}{
		{
			name:          "Simple regexp",
			filter:        "/.*/",
			want:          regexp2.MustCompile(".*", regexp2.RE2),
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Not a regex",
			filter:        "/var/lib/mysql: Total space",
			want:          nil,
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Regexp with modifier",
			filter:        "/.*/i",
			want:          regexp2.MustCompile("(?i).*", regexp2.RE2),
			expectNoError: true,
			expectedError: "",
		},
		{
			name:          "Regexp with unsupported modifier",
			filter:        "/.*/1",
			want:          nil,
			expectNoError: false,
			expectedError: "",
		},
		{
			name:          "Pathological regex - nested quantifiers (a+)+",
			filter:        "/^(a+)+$/",
			want:          nil,
			expectNoError: false,
			expectedError: "error parsing regexp: potentially dangerous regex pattern detected",
		},
		{
			name:          "Pathological regex - (.*)* pattern",
			filter:        "/(.*)*/",
			want:          nil,
			expectNoError: false,
			expectedError: "error parsing regexp: potentially dangerous regex pattern detected",
		},
		{
			name:          "Pathological regex - overlapping alternation",
			filter:        "/(a|a)*/",
			want:          nil,
			expectNoError: false,
			expectedError: "error parsing regexp: potentially dangerous regex pattern detected",
		},
		{
			name:          "Pathological regex - consecutive quantifiers",
			filter:        "/a**/",
			want:          nil,
			expectNoError: false,
			expectedError: "error parsing regexp: potentially dangerous regex pattern detected",
		},
		{
			name:          "Safe complex regex",
			filter:        "/^[a-zA-Z0-9_-]+\\.[a-zA-Z]{2,}$/",
			want:          regexp2.MustCompile("^[a-zA-Z0-9_-]+\\.[a-zA-Z]{2,}$", regexp2.RE2),
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
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("parseFilter() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsPathologicalRegex(t *testing.T) {
	tests := []struct {
		name     string
		pattern  string
		expected bool
	}{
		{
			name:     "Safe pattern",
			pattern:  "^[a-zA-Z0-9]+$",
			expected: false,
		},
		{
			name:     "Nested quantifiers (a+)+",
			pattern:  "^(a+)+$",
			expected: true,
		},
		{
			name:     "Nested quantifiers (a*)*",
			pattern:  "(a*)*",
			expected: true,
		},
		{
			name:     "Overlapping alternation (a|a)*",
			pattern:  "(a|a)*",
			expected: true,
		},
		{
			name:     "Consecutive quantifiers **",
			pattern:  "a**",
			expected: true,
		},
		{
			name:     "Consecutive quantifiers ++",
			pattern:  "a++",
			expected: true,
		},
		{
			name:     "Catastrophic (.*)* pattern",
			pattern:  "(.*)*",
			expected: true,
		},
		{
			name:     "Catastrophic (.+)+ pattern",
			pattern:  "(.+)+",
			expected: true,
		},
		{
			name:     "Safe alternation with different patterns",
			pattern:  "(cat|dog)*",
			expected: false,
		},
		{
			name:     "Safe quantifier usage",
			pattern:  "[0-9]+\\.[0-9]*",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPathologicalRegex(tt.pattern)
			assert.Equal(t, tt.expected, result, "Pattern: %s", tt.pattern)
		})
	}
}
