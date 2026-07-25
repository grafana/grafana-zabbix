package datasource

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const TokenTTL = 24 * time.Hour

// applyPerUserAuth resolves per-user authentication and returns a context carrying
// the resolved user token (via zabbixapi.WithPerUserToken). Callers MUST use the
// returned context for the subsequent query so the token is scoped to this request
// only — the shared datasource instance auth is never mutated, which keeps
// per-user auth safe under concurrent requests from different users.
//
// The context also carries a zabbixapi.TokenRefresher so the request layer can
// recover once from a token Zabbix rejects (e.g. regenerated externally) without
// ever falling back to the stored credentials.
//
// When per-user auth does not apply (disabled, excluded user, empty identity) the
// original context is returned unchanged, so the request falls back to the shared
// stored credentials.
func (ds *ZabbixDatasource) applyPerUserAuth(ctx context.Context, zabbixDS *ZabbixDatasourceInstance, datasourceUID string) (context.Context, error) {
	if !zabbixDS.Settings.PerUserAuth {
		ds.logger.Debug("Per-user authentication is disabled in datasource settings")
		return ctx, nil
	}

	user := backend.UserFromContext(ctx)
	if user == nil {
		ds.logger.Debug("No user in context (anonymous/guest access), skipping per-user auth")
		return ctx, errors.New("no Grafana user found in request context")
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
		return ctx, nil
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
		ds.logger.Info("User is excluded from per-user authentication, using stored credentials")
		return ctx, nil
	}

	token, err := ds.resolveUserToken(ctx, zabbixDS, datasourceUID, identity)
	if err != nil {
		return ctx, err
	}

	// The refresher lets the request layer recover once from a token Zabbix
	// rejects: evict it (only if still cached — a concurrent request may have
	// already replaced it) and resolve a fresh one through the same
	// singleflight. Bootstrap calls must authenticate with the stored
	// credentials, so the rejected per-user token is stripped from the context.
	refresher := func(rctx context.Context, rejected string) (string, error) {
		rctx = zabbixapi.WithPerUserToken(rctx, "")
		ds.tokenCache.CompareAndDelete(datasourceUID, identity, rejected)
		return ds.resolveUserToken(rctx, zabbixDS, datasourceUID, identity)
	}

	// Scope the user's token to this request only (do not mutate shared instance auth)
	ctx = zabbixapi.WithPerUserToken(ctx, token)
	ctx = zabbixapi.WithTokenRefresher(ctx, refresher)
	return ctx, nil
}

// resolveUserToken returns a Zabbix API token for the given identity, from the
// cache when possible. Cache misses generate a token through a singleflight
// keyed by (datasourceUID, identity): token.generate invalidates previous
// values of the same named token, so concurrent generation for one user must
// be deduplicated — only one request generates, the rest reuse its result.
func (ds *ZabbixDatasource) resolveUserToken(ctx context.Context, zabbixDS *ZabbixDatasourceInstance, datasourceUID string, identity string) (string, error) {
	if tokenInfo, ok := ds.tokenCache.Get(datasourceUID, identity); ok {
		ds.logger.Debug("Using cached token", "expiresIn", time.Until(tokenInfo.ExpiresAt).Round(time.Minute))
		return tokenInfo.Token, nil
	}

	flightKey := datasourceUID + ":" + identity
	result, err, _ := ds.tokenGroup.Do(flightKey, func() (interface{}, error) {
		// Re-check the cache: a concurrent request may have generated and
		// cached a token while this one was waiting on the flight.
		if tokenInfo, ok := ds.tokenCache.Get(datasourceUID, identity); ok {
			return tokenInfo.Token, nil
		}
		return ds.generateUserToken(ctx, zabbixDS, datasourceUID, identity)
	})
	if err != nil {
		return "", err
	}
	return result.(string), nil
}

// generateUserToken looks up the Zabbix user for identity using the stored
// credentials, generates an API token for it and caches the result. Callers
// must hold the per-identity singleflight (see resolveUserToken).
func (ds *ZabbixDatasource) generateUserToken(ctx context.Context, zabbixDS *ZabbixDatasourceInstance, datasourceUID string, identity string) (string, error) {
	ds.logger.Info("Authenticating user with Zabbix")

	// Ensure stored credentials are authenticated
	storedAuth := zabbixDS.zabbix.GetAPI().GetAuth()
	if storedAuth == "" {
		// Stored user not authenticated yet - authenticate now
		ds.logger.Debug("Stored user not authenticated, authenticating now")
		err := zabbixDS.zabbix.Authenticate(ctx)
		if err != nil {
			ds.logger.Error("Failed to authenticate with stored credentials", "error", err)
			return "", errors.New("failed to authenticate with stored credentials: " + err.Error())
		}
		storedAuth = zabbixDS.zabbix.GetAPI().GetAuth()
		if storedAuth == "" {
			ds.logger.Error("Stored auth still empty after authentication")
			return "", errors.New("failed to obtain stored user authentication")
		}
		ds.logger.Debug("Stored user authentication successful")
	}

	// Get Zabbix version
	zabbixVersion, err := zabbixDS.zabbix.GetVersion(ctx)
	if err != nil {
		ds.logger.Error("Failed to get Zabbix version", "error", err)
		return "", errors.New("error getting Zabbix version: " + err.Error())
	}

	ds.logger.Debug("Got Zabbix version", "version", zabbixVersion)

	// Validate field
	if zabbixDS.Settings.PerUserAuthField == "" {
		ds.logger.Error("PerUserAuthField is not configured")
		return "", errors.New("per-user auth field is not configured in datasource settings")
	}

	// Query Zabbix for the user (using stored credentials)
	ds.logger.Debug("Looking up Zabbix user", "field", zabbixDS.Settings.PerUserAuthField)
	zabbixUser, err := zabbixDS.zabbix.GetAPI().GetUserByIdentity(ctx, zabbixDS.Settings.PerUserAuthField, identity, zabbixVersion)
	if err != nil {
		ds.logger.Error("Failed to query Zabbix for user", "error", err)
		return "", errors.New("error querying Zabbix for user: " + err.Error())
	}
	if zabbixUser == nil || len(zabbixUser.MustArray()) == 0 {
		ds.logger.Error("User not found in Zabbix")
		return "", errors.New("user not found in Zabbix. Contact your administrator to provision access")
	}

	userId := zabbixUser.GetIndex(0).Get("userid").MustString()
	userName := zabbixUser.GetIndex(0).Get("username").MustString()

	ds.logger.Debug("Found Zabbix user")

	// Generate token
	ds.logger.Debug("Generating token for user")
	token, err := zabbixDS.zabbix.GetAPI().GenerateUserAPIToken(ctx, userId, userName, zabbixVersion)
	if err != nil {
		ds.logger.Error("Failed to generate token", "error", err)
		return "", errors.New("failed to generate Zabbix API token for user: " + err.Error())
	}

	ds.logger.Info("Per-user authentication successful", "tokenCached", true, "ttl", TokenTTL)

	// Cache the token
	ds.tokenCache.Set(datasourceUID, identity, userId, token, TokenTTL)

	return token, nil
}
