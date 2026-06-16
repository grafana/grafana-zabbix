package datasource

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func TestValidateItemIDs(t *testing.T) {
	tests := []struct {
		name    string
		itemids string
		wantErr bool
		errType error
	}{
		{
			name:    "valid single itemid",
			itemids: "12345",
			wantErr: false,
		},
		{
			name:    "valid multiple itemids",
			itemids: "12345,67890,11111",
			wantErr: false,
		},
		{
			name:    "valid itemids with spaces",
			itemids: "12345, 67890, 11111",
			wantErr: false,
		},
		{
			name:    "valid itemids with trailing comma",
			itemids: "12345,67890,",
			wantErr: false,
		},
		{
			name:    "empty string",
			itemids: "",
			wantErr: true,
			errType: ErrEmptyItemIDs,
		},
		{
			name:    "only whitespace",
			itemids: "   ",
			wantErr: true,
			errType: ErrEmptyItemIDs,
		},
		{
			name:    "non-numeric itemid",
			itemids: "abc123",
			wantErr: true,
			errType: ErrInvalidItemID,
		},
		{
			name:    "mixed valid and invalid itemids",
			itemids: "12345,abc,67890",
			wantErr: true,
			errType: ErrInvalidItemID,
		},
		{
			name:    "itemid with special characters",
			itemids: "123-45",
			wantErr: true,
			errType: ErrInvalidItemID,
		},
		{
			name:    "only commas",
			itemids: ",,,",
			wantErr: true,
			errType: ErrEmptyItemIDs,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateItemIDs(tt.itemids)
			if tt.wantErr {
				assert.Error(t, err)
				// Check that the underlying error matches
				if tt.errType != nil {
					assert.ErrorIs(t, err, tt.errType)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateTimeRange(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name      string
		timeRange backend.TimeRange
		wantErr   bool
	}{
		{
			name: "valid time range",
			timeRange: backend.TimeRange{
				From: now.Add(-1 * time.Hour),
				To:   now,
			},
			wantErr: false,
		},
		{
			name: "from equals to",
			timeRange: backend.TimeRange{
				From: now,
				To:   now,
			},
			wantErr: true,
		},
		{
			name: "from after to",
			timeRange: backend.TimeRange{
				From: now,
				To:   now.Add(-1 * time.Hour),
			},
			wantErr: true,
		},
		{
			name: "large valid range",
			timeRange: backend.TimeRange{
				From: now.Add(-365 * 24 * time.Hour),
				To:   now,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateTimeRange(tt.timeRange)
			if tt.wantErr {
				assert.Error(t, err)
				assert.ErrorIs(t, err, ErrInvalidTimeRange)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateTimeRangeDuration(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name      string
		timeRange backend.TimeRange
		maxDays   int
		wantErr   bool
	}{
		{
			name: "within limit",
			timeRange: backend.TimeRange{
				From: now.Add(-7 * 24 * time.Hour),
				To:   now,
			},
			maxDays: 30,
			wantErr: false,
		},
		{
			name: "exactly at limit",
			timeRange: backend.TimeRange{
				From: now.Add(-30 * 24 * time.Hour),
				To:   now,
			},
			maxDays: 30,
			wantErr: false,
		},
		{
			name: "exceeds limit",
			timeRange: backend.TimeRange{
				From: now.Add(-31 * 24 * time.Hour),
				To:   now,
			},
			maxDays: 30,
			wantErr: true,
		},
		{
			name: "uses default limit when maxDays is 0",
			timeRange: backend.TimeRange{
				From: now.Add(-30 * 24 * time.Hour),
				To:   now,
			},
			maxDays: 0, // Should use DefaultMaxTimeRangeDays (365)
			wantErr: false,
		},
		{
			name: "exceeds default limit",
			timeRange: backend.TimeRange{
				From: now.Add(-400 * 24 * time.Hour),
				To:   now,
			},
			maxDays: 0, // Should use DefaultMaxTimeRangeDays (365)
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateTimeRangeDuration(tt.timeRange, tt.maxDays)
			if tt.wantErr {
				assert.Error(t, err)
				assert.ErrorIs(t, err, ErrTimeRangeTooLarge)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateItemCount(t *testing.T) {
	tests := []struct {
		name     string
		count    int
		maxItems int
		wantErr  bool
	}{
		{
			name:     "within limit",
			count:    100,
			maxItems: 500,
			wantErr:  false,
		},
		{
			name:     "exactly at limit",
			count:    500,
			maxItems: 500,
			wantErr:  false,
		},
		{
			name:     "exceeds limit",
			count:    501,
			maxItems: 500,
			wantErr:  true,
		},
		{
			name:     "uses default limit when maxItems is 0",
			count:    100,
			maxItems: 0, // Should use DefaultMaxItems (500)
			wantErr:  false,
		},
		{
			name:     "exceeds default limit",
			count:    501,
			maxItems: 0, // Should use DefaultMaxItems (500)
			wantErr:  true,
		},
		{
			name:     "zero items",
			count:    0,
			maxItems: 500,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateItemCount(tt.count, tt.maxItems)
			if tt.wantErr {
				assert.Error(t, err)
				assert.ErrorIs(t, err, ErrTooManyItems)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateAPIMethod(t *testing.T) {
	// Test a few allowed methods (matching src/datasource/zabbix/types.ts)
	allowedMethods := []string{
		"host.get",
		"history.get",
		"item.get",
		"event.acknowledge",
		"script.execute",
	}
	for _, method := range allowedMethods {
		t.Run("allowed_"+method, func(t *testing.T) {
			err := ValidateAPIMethod(method)
			assert.NoError(t, err)
		})
	}

	// Test blocked methods (not in the allowlist)
	blockedMethods := []string{
		"host.create",
		"host.delete",
		"host.update",
		"user.create",
		"item.delete",
		"unknown.method",
		"",
	}
	for _, method := range blockedMethods {
		t.Run("blocked_"+method, func(t *testing.T) {
			err := ValidateAPIMethod(method)
			assert.Error(t, err)
			assert.ErrorIs(t, err, ErrAPIMethodNotAllowed)
		})
	}
}
