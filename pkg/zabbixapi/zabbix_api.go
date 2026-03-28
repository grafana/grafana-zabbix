package zabbixapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/metrics"
	"github.com/bitly/go-simplejson"
	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

var (
	ErrNotAuthenticated = errors.New("zabbix api: not authenticated")
)

// ZabbixAPI is a simple client responsible for making request to Zabbix API
type ZabbixAPI struct {
	url        *url.URL
	dsSettings backend.DataSourceInstanceSettings
	httpClient *http.Client
	logger     log.Logger
	auth       string
}

type ZabbixAPIParams = map[string]interface{}

// New returns new ZabbixAPI instance initialized with given URL or error.
func New(dsSettings backend.DataSourceInstanceSettings, client *http.Client) (*ZabbixAPI, error) {
	apiLogger := log.New()
	zabbixURL, err := url.Parse(dsSettings.URL)
	if err != nil {
		return nil, err
	}

	return &ZabbixAPI{
		url:        zabbixURL,
		dsSettings: dsSettings,
		logger:     apiLogger,
		httpClient: client,
	}, nil
}

// GetUrl gets new API URL
func (api *ZabbixAPI) GetUrl() *url.URL {
	return api.url
}

// SetUrl sets new API URL
func (api *ZabbixAPI) SetUrl(api_url string) error {
	zabbixURL, err := url.Parse(api_url)
	if err != nil {
		return err
	}

	api.url = zabbixURL
	return nil
}

// GetAuth returns API authentication token
func (api *ZabbixAPI) GetAuth() string {
	return api.auth
}

// SetAuth sets API authentication token
func (api *ZabbixAPI) SetAuth(auth string) {
	api.auth = auth
}

// Request performs API request
func (api *ZabbixAPI) Request(ctx context.Context, method string, params ZabbixAPIParams, version int) (*simplejson.Json, error) {
	if api.auth == "" {
		return nil, backend.DownstreamError(ErrNotAuthenticated)
	}

	return api.request(ctx, method, params, api.auth, version)
}

// Request performs API request without authentication token
func (api *ZabbixAPI) RequestUnauthenticated(ctx context.Context, method string, params ZabbixAPIParams, version int) (*simplejson.Json, error) {
	return api.request(ctx, method, params, "", version)
}

func (api *ZabbixAPI) request(ctx context.Context, method string, params ZabbixAPIParams, auth string, version int) (*simplejson.Json, error) {
	apiRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
		"params":  normalizeParams(ctx, method, params, version),
	}

	// Zabbix v7.2 and later deprecated `auth` parameter and replaced it with using Auth header
	// `auth` parameter throws an error in new versions so we need to add it only for older versions
	if auth != "" && version < 72 {
		apiRequest["auth"] = auth
	}

	reqBodyJSON, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, api.url.String(), bytes.NewBuffer(reqBodyJSON))
	if err != nil {
		return nil, err
	}

	metrics.ZabbixAPIQueryTotal.WithLabelValues(method).Inc()

	if auth != "" && version >= 72 {
		if api.dsSettings.BasicAuthEnabled {
			return nil, backend.DownstreamErrorf("basic auth is not supported for Zabbix v7.2 and later")
		}
		req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", auth))
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Grafana/grafana-zabbix")

	response, err := makeHTTPRequest(ctx, api.httpClient, req)
	if err != nil {
		return nil, err
	}

	return handleAPIResult(response)
}

// Login performs API authentication and returns authentication token.
func (api *ZabbixAPI) Login(ctx context.Context, username string, password string, version int) (string, error) {
	params := ZabbixAPIParams{
		"username": username,
		"password": password,
	}

	auth, err := api.request(ctx, "user.login", params, "", version)
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

// Login method for Zabbix prior to 5.4
func (api *ZabbixAPI) LoginDeprecated(ctx context.Context, username string, password string, version int) (string, error) {
	params := ZabbixAPIParams{
		"user":     username,
		"password": password,
	}

	auth, err := api.request(ctx, "user.login", params, "", version)
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

// AuthenticateWithToken performs authentication with API token.
func (api *ZabbixAPI) AuthenticateWithToken(ctx context.Context, token string) error {
	if token == "" {
		return backend.DownstreamError(errors.New("API token is empty"))
	}
	api.SetAuth(token)
	return nil
}

func handleAPIResult(response []byte) (*simplejson.Json, error) {
	jsonResp, err := simplejson.NewJson([]byte(response))
	if err != nil {
		// Response is not valid JSON
		return nil, backend.DownstreamError(err)
	}
	if errJSON, isError := jsonResp.CheckGet("error"); isError {
		errMessage := fmt.Errorf("%s %s", errJSON.Get("message").MustString(), errJSON.Get("data").MustString())
		return nil, backend.DownstreamError(errMessage)
	}
	jsonResult := jsonResp.Get("result")
	return jsonResult, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	// Set to true to prevents re-use of TCP connections (this may cause random EOF error in some request)
	req.Close = true

	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			log.DefaultLogger.Warn("Error closing response body", "error", err)
		}
	}()

	if res.StatusCode != http.StatusOK {
		err = fmt.Errorf("request failed, status: %v", res.Status)
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return nil, backend.DownstreamError(err)
		}

		return nil, err
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}
