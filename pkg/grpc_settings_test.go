package main

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
)

func envFrom(vars map[string]string) lookupEnvFunc {
	return func(key string) (string, bool) {
		v, ok := vars[key]
		return v, ok
	}
}

func TestGRPCMsgSizeMB(t *testing.T) {
	logger := log.NewNullLogger()

	tests := []struct {
		name   string
		env    map[string]string
		wantMB int
	}{
		{name: "unset uses default", env: nil, wantMB: 32},
		{name: "empty uses default", env: map[string]string{grpcMaxReceiveMsgSizeEnv: ""}, wantMB: 32},
		{name: "whitespace only uses default", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "   "}, wantMB: 32},
		{name: "valid value", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "64"}, wantMB: 64},
		{name: "valid value is trimmed", env: map[string]string{grpcMaxReceiveMsgSizeEnv: " 64 "}, wantMB: 64},
		{name: "minimum value", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "1"}, wantMB: 1},
		{name: "maximum value", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "512"}, wantMB: 512},
		{name: "above maximum is clamped", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "2048"}, wantMB: 512},
		{name: "zero uses default", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "0"}, wantMB: 32},
		{name: "negative uses default", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "-5"}, wantMB: 32},
		{name: "non-numeric uses default", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "64MB"}, wantMB: 32},
		{name: "float uses default", env: map[string]string{grpcMaxReceiveMsgSizeEnv: "64.5"}, wantMB: 32},
		{name: "other key is ignored", env: map[string]string{grpcMaxSendMsgSizeEnv: "64"}, wantMB: 32},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := grpcMsgSizeMB(logger, envFrom(tt.env), grpcMaxReceiveMsgSizeEnv, defaultGRPCMaxReceiveMsgSizeMB)
			assert.Equal(t, tt.wantMB, got)
		})
	}
}

func TestGRPCSettings(t *testing.T) {
	logger := log.NewNullLogger()

	t.Run("defaults match the previously hard-coded limits", func(t *testing.T) {
		settings := grpcSettings(logger, envFrom(nil))
		assert.Equal(t, 32*1024*1024, settings.MaxReceiveMsgSize)
		assert.Equal(t, 100*1024*1024, settings.MaxSendMsgSize)
	})

	t.Run("overrides are applied independently and converted to bytes", func(t *testing.T) {
		settings := grpcSettings(logger, envFrom(map[string]string{
			grpcMaxReceiveMsgSizeEnv: "64",
			grpcMaxSendMsgSizeEnv:    "200",
		}))
		assert.Equal(t, 64*1024*1024, settings.MaxReceiveMsgSize)
		assert.Equal(t, 200*1024*1024, settings.MaxSendMsgSize)
	})

	t.Run("only one limit overridden", func(t *testing.T) {
		settings := grpcSettings(logger, envFrom(map[string]string{grpcMaxSendMsgSizeEnv: "300"}))
		assert.Equal(t, 32*1024*1024, settings.MaxReceiveMsgSize)
		assert.Equal(t, 300*1024*1024, settings.MaxSendMsgSize)
	})

	t.Run("limits never fall to zero or below so the SDK never falls back to MaxInt32", func(t *testing.T) {
		settings := grpcSettings(logger, envFrom(map[string]string{
			grpcMaxReceiveMsgSizeEnv: "-1",
			grpcMaxSendMsgSizeEnv:    "0",
		}))
		assert.Greater(t, settings.MaxReceiveMsgSize, 0)
		assert.Greater(t, settings.MaxSendMsgSize, 0)
		assert.LessOrEqual(t, settings.MaxReceiveMsgSize, maxGRPCMsgSizeMB*mebibyte)
		assert.LessOrEqual(t, settings.MaxSendMsgSize, maxGRPCMsgSizeMB*mebibyte)
	})
}
