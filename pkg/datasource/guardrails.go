package datasource

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// Guardrail errors
var (
	ErrEmptyItemIDs        = errors.New("itemids cannot be empty for item ID query mode")
	ErrInvalidItemID       = errors.New("itemid must be a valid numeric value")
	ErrInvalidTimeRange    = errors.New("invalid time range: 'from' must be before 'to'")
	ErrTimeRangeTooLarge   = errors.New("time range exceeds maximum allowed duration")
	ErrTooManyItems        = errors.New("query would return too many items")
	ErrAPIMethodNotAllowed = errors.New("API method is not allowed")
)

// Default guardrail limits
const (
	DefaultMaxTimeRangeDays = 365 // 1 year
	DefaultMaxItems         = 500
)

// ValidateItemIDs validates that itemids string is not empty and contains valid numeric IDs
func ValidateItemIDs(itemids string) error {
	trimmed := strings.TrimSpace(itemids)
	if trimmed == "" {
		return backend.DownstreamError(ErrEmptyItemIDs)
	}

	// Split and validate each ID
	ids := strings.Split(trimmed, ",")
	numericPattern := regexp.MustCompile(`^\d+$`)

	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue // Skip empty entries from trailing commas
		}
		if !numericPattern.MatchString(id) {
			return backend.DownstreamError(ErrInvalidItemID)
		}
	}

	// Check if we have at least one valid ID
	hasValidID := false
	for _, id := range ids {
		if strings.TrimSpace(id) != "" {
			hasValidID = true
			break
		}
	}
	if !hasValidID {
		return backend.DownstreamError(ErrEmptyItemIDs)
	}

	return nil
}

// ValidateTimeRange validates that the time range is valid (from < to)
func ValidateTimeRange(timeRange backend.TimeRange) error {
	if !timeRange.From.Before(timeRange.To) {
		return backend.DownstreamError(ErrInvalidTimeRange)
	}
	return nil
}

// ValidateTimeRangeDuration validates that the time range doesn't exceed the maximum allowed duration
func ValidateTimeRangeDuration(timeRange backend.TimeRange, maxDays int) error {
	if maxDays <= 0 {
		maxDays = DefaultMaxTimeRangeDays
	}

	duration := timeRange.To.Sub(timeRange.From)
	maxDuration := time.Duration(maxDays) * 24 * time.Hour

	if duration > maxDuration {
		return backend.DownstreamError(ErrTimeRangeTooLarge)
	}
	return nil
}

// ValidateItemCount validates that the number of items doesn't exceed the maximum allowed
func ValidateItemCount(count int, maxItems int) error {
	if maxItems <= 0 {
		maxItems = DefaultMaxItems
	}

	if count > maxItems {
		return backend.DownstreamError(ErrTooManyItems)
	}
	return nil
}

// AllowedAPIMethods defines the Zabbix API methods that are allowed to be called.
// This list should be kept in sync with src/datasource/zabbix/types.ts (zabbixMethodName type)
var AllowedAPIMethods = map[string]bool{
	"alert.get":         true,
	"apiinfo.version":   true,
	"application.get":   true,
	"event.acknowledge": true,
	"event.get":         true,
	"history.get":       true,
	"host.get":          true,
	"hostgroup.get":     true,
	"item.get":          true,
	"problem.get":       true,
	"proxy.get":         true,
	"script.execute":    true,
	"script.get":        true,
	"service.get":       true,
	"service.getsla":    true,
	"sla.get":           true,
	"sla.getsli":        true,
	"trend.get":         true,
	"trigger.get":       true,
	"user.get":          true,
	"usermacro.get":     true,
	"valuemap.get":      true,
}

// ValidateAPIMethod checks if the API method is in the allowed list
func ValidateAPIMethod(method string) error {
	if _, allowed := AllowedAPIMethods[method]; !allowed {
		return backend.DownstreamError(ErrAPIMethodNotAllowed)
	}
	return nil
}
