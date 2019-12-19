package main

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_zabbixParamOutput(t *testing.T) {
	tests := []struct {
		name  string
		input zabbixParams
		want  string
	}{
		{
			name: "Mode extend",
			input: zabbixParams{
				Output: zabbixParamOutput{
					Mode: "extend",
				},
				GroupIDs: []string{"test1", "test2"},
			},
			want: `{ "output": "extend", "groupids": ["test1", "test2"] }`,
		},
		{
			name: "Fields",
			input: zabbixParams{
				Output: zabbixParamOutput{
					Fields: []string{"name", "key_", "hostid"},
				},
				GroupIDs: []string{"test1", "test2"},
			},
			want: `{ "output": ["name", "key_", "hostid"], "groupids": ["test1", "test2"] }`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			out, err := json.Marshal(tt.input)
			assert.NoError(t, err)
			assert.JSONEq(t, tt.want, string(out))
		})
	}
}
