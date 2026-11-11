package main

import (
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// gRPC message size limits, in mebibytes (MiB).
//
// The limits are configurable through the [plugin.alexanderzobnin-zabbix-datasource]
// section of grafana.ini:
//
//	[plugin.alexanderzobnin-zabbix-datasource]
//	grpc_max_receive_msg_size_mb = 64
//	grpc_max_send_msg_size_mb = 200
//
// Grafana forwards every key of that section to the plugin process as a
// GF_PLUGIN_<UPPERCASE_KEY> environment variable, which is the only supported
// way to pass instance-level configuration to a backend plugin (and the only one
// that also works on Grafana Cloud). Host environment variables are not forwarded
// to plugin processes.
const (
	grpcMaxReceiveMsgSizeEnv = "GF_PLUGIN_GRPC_MAX_RECEIVE_MSG_SIZE_MB"
	grpcMaxSendMsgSizeEnv    = "GF_PLUGIN_GRPC_MAX_SEND_MSG_SIZE_MB"

	defaultGRPCMaxReceiveMsgSizeMB = 32
	defaultGRPCMaxSendMsgSizeMB    = 100

	// minGRPCMsgSizeMB is the smallest accepted value. Anything lower would break
	// even trivial requests.
	minGRPCMsgSizeMB = 1
	// maxGRPCMsgSizeMB bounds the configurable values so a misconfiguration cannot
	// reintroduce the ~2 GB gRPC default that the explicit limits were added to avoid.
	maxGRPCMsgSizeMB = 512

	mebibyte = 1024 * 1024
)

// lookupEnvFunc mirrors os.LookupEnv so the environment can be substituted in tests.
type lookupEnvFunc func(key string) (string, bool)

// grpcSettings builds the gRPC server settings for the plugin, applying any
// overrides passed by Grafana from the plugin's grafana.ini section.
func grpcSettings(logger log.Logger, lookupEnv lookupEnvFunc) backend.GRPCSettings {
	receiveMB := grpcMsgSizeMB(logger, lookupEnv, grpcMaxReceiveMsgSizeEnv, defaultGRPCMaxReceiveMsgSizeMB)
	sendMB := grpcMsgSizeMB(logger, lookupEnv, grpcMaxSendMsgSizeEnv, defaultGRPCMaxSendMsgSizeMB)

	logger.Debug("gRPC message size limits", "maxReceiveMsgSizeMB", receiveMB, "maxSendMsgSizeMB", sendMB)

	return backend.GRPCSettings{
		MaxReceiveMsgSize: receiveMB * mebibyte,
		MaxSendMsgSize:    sendMB * mebibyte,
	}
}

// grpcMsgSizeMB reads a message size limit (in MiB) from the environment.
// Unset or invalid values fall back to defaultMB; values above maxGRPCMsgSizeMB
// are clamped.
func grpcMsgSizeMB(logger log.Logger, lookupEnv lookupEnvFunc, key string, defaultMB int) int {
	raw, ok := lookupEnv(key)
	if !ok {
		return defaultMB
	}

	value := strings.TrimSpace(raw)
	if value == "" {
		return defaultMB
	}

	mb, err := strconv.Atoi(value)
	if err != nil || mb < minGRPCMsgSizeMB {
		logger.Warn("Ignoring invalid gRPC message size limit, using default",
			"setting", key, "value", raw, "defaultMB", defaultMB, "minMB", minGRPCMsgSizeMB, "maxMB", maxGRPCMsgSizeMB)
		return defaultMB
	}

	if mb > maxGRPCMsgSizeMB {
		logger.Warn("gRPC message size limit exceeds the maximum, clamping",
			"setting", key, "value", mb, "maxMB", maxGRPCMsgSizeMB)
		return maxGRPCMsgSizeMB
	}

	return mb
}
