package settings

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseTimeoutValue(t *testing.T) {
	tests := []struct {
		name         string
		value        interface{}
		defaultValue int64
		fieldName    string
		want         int64
		wantErr      bool
	}{
		{
			name:         "valid string",
			value:        "45",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         45,
			wantErr:      false,
		},
		{
			name:         "empty string returns default",
			value:        "",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         30,
			wantErr:      false,
		},
		{
			name:         "invalid string returns error",
			value:        "not-a-number",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         0,
			wantErr:      true,
		},
		{
			name:         "float64 value",
			value:        float64(60),
			defaultValue: 30,
			fieldName:    "timeout",
			want:         60,
			wantErr:      false,
		},
		{
			name:         "int64 value",
			value:        int64(90),
			defaultValue: 30,
			fieldName:    "timeout",
			want:         90,
			wantErr:      false,
		},
		{
			name:         "int value",
			value:        int(120),
			defaultValue: 30,
			fieldName:    "timeout",
			want:         120,
			wantErr:      false,
		},
		{
			name:         "nil returns default",
			value:        nil,
			defaultValue: 30,
			fieldName:    "timeout",
			want:         30,
			wantErr:      false,
		},
		{
			name:         "unknown type returns default",
			value:        []string{"invalid"},
			defaultValue: 60,
			fieldName:    "queryTimeout",
			want:         60,
			wantErr:      false,
		},
		{
			name:         "zero string value",
			value:        "0",
			defaultValue: 30,
			fieldName:    "timeout",
			want:         0,
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseTimeoutValue(tt.value, tt.defaultValue, tt.fieldName)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.fieldName)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}
