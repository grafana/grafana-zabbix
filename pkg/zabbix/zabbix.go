package zabbix

import (
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/metrics"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/settings"
	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbixapi"
	"github.com/bitly/go-simplejson"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const AUTH_RATE_LIMIT = time.Duration(5 * time.Second)

// Zabbix is a wrapper for Zabbix API. It wraps Zabbix API queries and performs authentication, adds caching,
// deduplication and other performance optimizations.
type Zabbix struct {
	api      *zabbixapi.ZabbixAPI
	dsInfo   *backend.DataSourceInstanceSettings
	settings *settings.ZabbixDatasourceSettings
	cache    *ZabbixCache
	version  atomic.Int32
	logger   log.Logger
	authLock sync.RWMutex
	lastAuth time.Time
}

// New returns new instance of Zabbix client.
func New(dsInfo *backend.DataSourceInstanceSettings, zabbixSettings *settings.ZabbixDatasourceSettings, zabbixAPI *zabbixapi.ZabbixAPI) (*Zabbix, error) {
	logger := log.New()
	zabbixCache := NewZabbixCache(zabbixSettings.CacheTTL, 10*time.Minute)

	return &Zabbix{
		api:      zabbixAPI,
		dsInfo:   dsInfo,
		settings: zabbixSettings,
		cache:    zabbixCache,
		logger:   logger,
	}, nil
}

func (zabbix *Zabbix) GetAPI() *zabbixapi.ZabbixAPI {
	return zabbix.api
}

// Request wraps request with cache
func (ds *Zabbix) Request(ctx context.Context, apiReq *ZabbixAPIRequest) (*simplejson.Json, error) {
	var resultJson *simplejson.Json
	var err error

	if ds.version.Load() == 0 {
		version, err := ds.GetVersion(ctx)
		if err != nil {
			ds.logger.Error("Error querying Zabbix version", "error", err)
			ds.version.Store(-1)
		} else {
			ds.logger.Debug("Got Zabbix version", "version", version)
			ds.version.Store(int32(version))
		}
	}

	cachedResult, queryExistInCache := ds.cache.GetAPIRequest(apiReq)
	if !queryExistInCache {
		resultJson, err = ds.request(ctx, apiReq.Method, apiReq.Params)
		if err != nil {
			return nil, err
		}

		if IsCachedRequest(apiReq.Method) {
			ds.logger.Debug("Writing result to cache", "method", apiReq.Method)
			ds.cache.SetAPIRequest(apiReq, resultJson)
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
	zabbix.logger.Debug("Zabbix request", "method", method)

	// Skip auth for methods that are not required it
	if method == "apiinfo.version" {
		return zabbix.api.RequestUnauthenticated(ctx, method, params)
	}

	zabbix.authLock.RLock()
	result, err := zabbix.api.Request(ctx, method, params)
	zabbix.authLock.RUnlock()
	notAuthorized := isNotAuthorized(err)
	isTokenAuth := zabbix.settings.AuthType == settings.AuthTypeToken
	if err == zabbixapi.ErrNotAuthenticated || (notAuthorized && !isTokenAuth) {
		if notAuthorized {
			zabbix.logger.Debug("Authentication token expired, performing re-login")
		}
		zabbix.authLock.Lock()
		err = zabbix.Authenticate(ctx)
		zabbix.authLock.Unlock()
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
	// check for consecutive auth calls. this is a protection against
	// parallel api calls
	if time.Now().Sub(zabbix.lastAuth) < AUTH_RATE_LIMIT {
		return nil
	}
	jsonData, err := simplejson.NewJson(zabbix.dsInfo.JSONData)
	if err != nil {
		return err
	}

	authType := zabbix.settings.AuthType
	if authType == settings.AuthTypeToken {
		token, exists := zabbix.dsInfo.DecryptedSecureJSONData["apiToken"]
		if !exists {
			return errors.New("cannot find Zabbix API token")
		}
		err = zabbix.api.AuthenticateWithToken(ctx, token)
		if err != nil {
			zabbix.logger.Error("Zabbix authentication error", "error", err)
			return err
		}
		zabbix.logger.Debug("Using API token for authentication")
		zabbix.lastAuth = time.Now()
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

	err = zabbix.api.Authenticate(ctx, zabbixLogin, zabbixPassword)
	if err != nil {
		zabbix.logger.Error("Zabbix authentication error", "error", err)
		return err
	}
	zabbix.logger.Debug("Successfully authenticated", "url", zabbix.api.GetUrl().String(), "user", zabbixLogin)
	zabbix.lastAuth = time.Now()

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
