package zabbix

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/metrics"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/bitly/go-simplejson"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Zabbix is a wrapper for Zabbix API. It wraps Zabbix API queries and performs authentication, adds caching,
// deduplication and other performance optimizations.
type Zabbix struct {
	api          *zabbixapi.ZabbixAPI
	dsInfo       *backend.DataSourceInstanceSettings
	settings     *settings.ZabbixDatasourceSettings
	cache        *ZabbixCache
	versionCache *cache.Cache
	version      int
	logger       log.Logger
}

// New returns new instance of Zabbix client.
func New(dsInfo *backend.DataSourceInstanceSettings, zabbixSettings *settings.ZabbixDatasourceSettings, zabbixAPI *zabbixapi.ZabbixAPI) (*Zabbix, error) {
	logger := log.New()
	zabbixCache := NewZabbixCache(zabbixSettings.CacheTTL, 10*time.Minute)
	// Deliberately a separate cache instance from zabbixCache: that one is
	// keyed by ZabbixAPIRequest and stores *simplejson.Json API responses.
	// The cached version is a plain string - sharing the same keyspace would
	// mean a legitimate apiinfo.version call routed through Request() (it's
	// an allowed resource-endpoint method) could read this cache entry back
	// and fail its own type assertion, silently returning an empty result.
	versionCache := cache.NewCache(zabbixSettings.CacheTTL, 10*time.Minute)

	return &Zabbix{
		api:          zabbixAPI,
		dsInfo:       dsInfo,
		settings:     zabbixSettings,
		cache:        zabbixCache,
		versionCache: versionCache,
		logger:       logger,
	}, nil
}

func (zabbix *Zabbix) GetAPI() *zabbixapi.ZabbixAPI {
	return zabbix.api
}

// Request wraps request with cache
func (ds *Zabbix) Request(ctx context.Context, apiReq *ZabbixAPIRequest) (*simplejson.Json, error) {
	var resultJson *simplejson.Json
	var err error

	version, err := ds.GetVersion(ctx)
	if err != nil {
		ds.logger.Error("Error querying Zabbix version", "error", err)
		ds.version = -1
	} else {
		ds.version = version
	}

	// Partition the response cache by the per-user token so responses fetched
	// under one user's Zabbix permissions are never served to another user.
	// Shared-credential requests use an empty scope (single shared partition).
	cacheScope := zabbixapi.PerUserTokenFromContext(ctx)

	cachedResult, queryExistInCache := ds.cache.GetAPIRequest(cacheScope, apiReq)
	if !queryExistInCache {
		resultJson, err = ds.request(ctx, apiReq.Method, apiReq.Params)
		if err != nil {
			return nil, err
		}

		if IsCachedRequest(apiReq.Method) {
			ds.logger.Debug("Writing result to cache", "method", apiReq.Method, "version", ds.version)
			ds.cache.SetAPIRequest(cacheScope, apiReq, resultJson)
		}
	} else {
		metrics.CacheHitTotal.WithLabelValues(apiReq.Method).Inc()
		var ok bool
		resultJson, ok = cachedResult.(*simplejson.Json)
		if !ok {
			resultJson = simplejson.New()
		}
	}

	return resultJson, nil
}

// request checks authentication and makes a request to the Zabbix API.
func (zabbix *Zabbix) request(ctx context.Context, method string, params ZabbixAPIParams) (*simplejson.Json, error) {
	zabbix.logger.Debug("Zabbix request", "method", method, "version", zabbix.version)

	// Skip auth for methods that are not required it
	if method == "apiinfo.version" {
		return zabbix.api.RequestUnauthenticated(ctx, method, params, zabbix.version)
	}

	result, err := zabbix.api.Request(ctx, method, params, zabbix.version)
	notAuthorized := isNotAuthorized(err)
	isTokenAuth := zabbix.settings.AuthType == settings.AuthTypeToken
	// When the request carries a per-user token, never silently re-login with the
	// shared/stored credentials: doing so would run the query as the stored user
	// (a privilege escalation). Instead, if the auth layer provided a refresher,
	// evict/regenerate the token through it and retry once; otherwise fail.
	perUserToken := zabbixapi.PerUserTokenFromContext(ctx)
	if perUserToken != "" && notAuthorized {
		refresher := zabbixapi.TokenRefresherFromContext(ctx)
		if refresher == nil {
			zabbix.logger.Debug("Per-user token rejected by Zabbix, not falling back to stored credentials")
			return nil, err
		}

		zabbix.logger.Info("Per-user token rejected by Zabbix, regenerating and retrying once")
		newToken, refreshErr := refresher(ctx, perUserToken)
		if refreshErr != nil {
			zabbix.logger.Error("Failed to regenerate per-user token", "error", refreshErr)
			return nil, err
		}

		// Retry with the fresh token. The refresher is cleared so a second
		// rejection fails instead of looping.
		retryCtx := zabbixapi.WithTokenRefresher(zabbixapi.WithPerUserToken(ctx, newToken), nil)
		return zabbix.api.Request(retryCtx, method, params, zabbix.version)
	}
	if err == backend.DownstreamError(zabbixapi.ErrNotAuthenticated) || (notAuthorized && !isTokenAuth) {
		if notAuthorized {
			zabbix.logger.Debug("Authentication token expired, performing re-login")
		}
		err = zabbix.Authenticate(ctx)
		if err != nil {
			return nil, err
		}
		return zabbix.request(ctx, method, params)
	} else if err != nil {
		return nil, err
	}

	return result, err
}

func (zabbix *Zabbix) Authenticate(ctx context.Context) error {
	jsonData, err := simplejson.NewJson(zabbix.dsInfo.JSONData)
	if err != nil {
		return err
	}

	authType := zabbix.settings.AuthType
	if authType == settings.AuthTypeToken {
		token, exists := zabbix.dsInfo.DecryptedSecureJSONData["apiToken"]
		if !exists {
			return backend.DownstreamError(errors.New("cannot find Zabbix API token"))
		}
		err = zabbix.api.AuthenticateWithToken(ctx, token)
		if err != nil {
			zabbix.logger.Error("Zabbix authentication token error", "error", err)
			return err
		}
		zabbix.logger.Debug("Using API token for authentication")
		return nil
	}

	zabbixLogin := jsonData.Get("username").MustString()
	var zabbixPassword string
	if securePassword, exists := zabbix.dsInfo.DecryptedSecureJSONData["password"]; exists {
		zabbixPassword = securePassword
	} else {
		// Fallback
		zabbixPassword = jsonData.Get("password").MustString()
	}

	err = zabbix.api.Authenticate(ctx, zabbixLogin, zabbixPassword, zabbix.version)
	if err != nil {
		zabbix.logger.Error("Zabbix authentication error", "error", err)
		return err
	}
	zabbix.logger.Debug("Successfully authenticated", "url", zabbix.api.GetUrl().String(), "user", zabbixLogin)

	return nil
}

func isNotAuthorized(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	return strings.Contains(message, "Session terminated, re-login, please.") ||
		strings.Contains(message, "Not authorised.") ||
		strings.Contains(message, "Not authorized.")
}
