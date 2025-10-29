package datasource

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const TokenTTL = 24 * time.Hour

// applyPerUserAuth applies per-user authentication with token caching
func (ds *ZabbixDatasource) applyPerUserAuth(ctx context.Context, zabbixDS *ZabbixDatasourceInstance, datasourceUID string) error {
	if !zabbixDS.Settings.PerUserAuth {
		ds.logger.Debug("Per-user authentication is disabled in datasource settings")
		return nil
	}

	user := backend.UserFromContext(ctx)
	if user == nil {
		ds.logger.Debug("No user in context (anonymous/guest access), skipping per-user auth")
		return errors.New("no Grafana user found in request context")
	}

	var identity string
	switch zabbixDS.Settings.PerUserAuthField {
	case "email":
		identity = user.Email
	default:
		identity = user.Login
	}

	// If identity is empty, skip per-user auth
	if identity == "" {
		ds.logger.Debug("User identity is empty, skipping per-user auth")
		return nil
	}

	// Check if the user is excluded from per-user auth
	excluded := false
	exclusionList := zabbixDS.Settings.PerUserAuthExcludeUsers
	if exclusionList == nil {
		exclusionList = []string{"admin"}
	}
	for _, excludedUser := range exclusionList {
		if strings.EqualFold(identity, excludedUser) {
			excluded = true
			break
		}
	}

	if excluded {
		ds.logger.Info("User is excluded from per-user authentication, using stored credentials", "user", identity)
		return nil
	}

	// Check token cache first
	if tokenInfo, ok := ds.tokenCache.Get(datasourceUID, identity, identity); ok {
		ds.logger.Debug("Using cached token", "user", identity, "expiresIn", time.Until(tokenInfo.ExpiresAt).Round(time.Minute))
		zabbixDS.zabbix.GetAPI().SetAuth(tokenInfo.Token)
		return nil
	}

	// Staring token generation
	ds.logger.Info("Authenticating user with Zabbix", "user", identity)

	// Ensure stored credentials are authenticated
	storedAuth := zabbixDS.zabbix.GetAPI().GetAuth()
	if storedAuth == "" {
		// Stored user not authenticated yet - authenticate now
		ds.logger.Debug("Stored user not authenticated, authenticating now")
		err := zabbixDS.zabbix.Authenticate(ctx)
		if err != nil {
			ds.logger.Error("Failed to authenticate with stored credentials", "error", err)
			return errors.New("failed to authenticate with stored credentials: " + err.Error())
		}
		storedAuth = zabbixDS.zabbix.GetAPI().GetAuth()
		if storedAuth == "" {
			ds.logger.Error("Stored auth still empty after authentication")
			return errors.New("failed to obtain stored user authentication")
		}
		ds.logger.Debug("Stored user authentication successful")
	}

	// Get Zabbix version
	zabbixVersion, err := zabbixDS.zabbix.GetVersion(ctx)
	if err != nil {
		ds.logger.Error("Failed to get Zabbix version", "error", err)
		return errors.New("error getting Zabbix version: " + err.Error())
	}

	ds.logger.Debug("Got Zabbix version", "version", zabbixVersion)

	// Validate field
	if zabbixDS.Settings.PerUserAuthField == "" {
		ds.logger.Error("PerUserAuthField is not configured")
		return errors.New("per-user auth field is not configured in datasource settings")
	}

	// Query Zabbix for the user (using stored credentials)
	ds.logger.Debug("Looking up Zabbix user", "identity", identity, "field", zabbixDS.Settings.PerUserAuthField)
	zabbixUser, err := zabbixDS.zabbix.GetAPI().GetUserByIdentity(ctx, zabbixDS.Settings.PerUserAuthField, identity, zabbixVersion)
	if err != nil {
		ds.logger.Error("Failed to query Zabbix for user", "identity", identity, "error", err)
		return errors.New("error querying Zabbix for user: " + err.Error())
	}
	if zabbixUser == nil || len(zabbixUser.MustArray()) == 0 {
		ds.logger.Error("User not found in Zabbix", "identity", identity)
		return errors.New("user " + identity + " not found in Zabbix. Contact your administrator to provision access")
	}

	userId := zabbixUser.GetIndex(0).Get("userid").MustString()
	userName := zabbixUser.GetIndex(0).Get("username").MustString()

	ds.logger.Debug("Found Zabbix user", "identity", identity, "userId", userId, "userName", userName)

	// Generate token
	ds.logger.Debug("Generating token for user", "zabbixUserId", userId, "userName", userName)
	token, err := zabbixDS.zabbix.GetAPI().GenerateUserAPIToken(ctx, userId, userName, zabbixVersion)
	if err != nil {
		ds.logger.Error("Failed to generate token", "userId", userId, "error", err)
		return errors.New("failed to generate Zabbix API token for user: " + err.Error())
	}

	ds.logger.Info("Per-user authentication successful", "user", identity, "zabbixUser", userName, "tokenCached", true, "ttl", TokenTTL)

	// Cache the token
	ds.tokenCache.Set(datasourceUID, identity, identity, token, TokenTTL)

	// Now switch to the user's token
	zabbixDS.zabbix.GetAPI().SetAuth(token)

	return nil
}
