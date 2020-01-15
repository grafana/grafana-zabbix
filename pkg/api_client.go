package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/zabbix"
	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
)

// ZabbixAPIClient stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type ZabbixAPIClient struct {
	datasource *ZabbixDatasource
	url        *url.URL
	queryCache *Cache
	logger     hclog.Logger
	httpClient *http.Client
	authToken  string
}

// NewZabbixAPIClient returns an initialized ZabbixDatasource
func NewZabbixAPIClient(logger hclog.Logger, urlString string) (*ZabbixAPIClient, error) {

	zabbixURL, err := url.Parse(urlString)
	if err != nil {
		return nil, err
	}

	return &ZabbixAPIClient{
		url:        zabbixURL,
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
		logger:     logger,
		httpClient: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					Renegotiation: tls.RenegotiateFreelyAsClient,
				},
				Proxy: http.ProxyFromEnvironment,
				Dial: (&net.Dialer{
					Timeout:   30 * time.Second,
					KeepAlive: 30 * time.Second,
				}).Dial,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       90 * time.Second,
			},
			Timeout: time.Duration(time.Second * 30),
		},
	}, nil
}

// APIRequest checks authentication and makes a request to the Zabbix API
func (c *ZabbixAPIClient) APIRequest(ctx context.Context, method string, params ZabbixAPIParams) (result json.RawMessage, err error) {
	for attempt := 0; attempt <= 3; attempt++ {
		if c.authToken == "" {
			// Authenticate
			err := c.loginWithDs(ctx)
			if err != nil {
				return nil, fmt.Errorf("Authentication failure: %w", err)
			}
		}

		result, err = c.zabbixAPIRequest(ctx, method, params, c.authToken)

		if err == nil || (err != nil && !isNotAuthorized(err.Error())) {
			break
		} else {
			c.authToken = ""
		}
	}
	return result, err
}

func (c *ZabbixAPIClient) loginWithDs(ctx context.Context) error {
	jsonDataStr := c.datasource.dsInfo.GetJsonData()
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return err
	}

	var zabbixUsername string
	if secureUsername, exists := c.datasource.dsInfo.GetDecryptedSecureJsonData()["username"]; exists {
		zabbixUsername = secureUsername
	} else {
		zabbixUsername = jsonData.Get("username").MustString()
	}

	if zabbixUsername == "" {
		return fmt.Errorf("Login failed -- no username provided")
	}

	var zabbixPassword string
	if securePassword, exists := c.datasource.dsInfo.GetDecryptedSecureJsonData()["password"]; exists {
		zabbixPassword = securePassword
	} else {
		zabbixPassword = jsonData.Get("password").MustString()
	}

	if zabbixPassword == "" {
		return fmt.Errorf("Login failed -- no password provided")
	}

	auth, err := c.login(ctx, zabbixUsername, zabbixPassword)
	if err != nil {
		c.logger.Error("Authentication error", "error", err)
		c.authToken = ""
		return err
	}
	c.logger.Debug("Successfully authenticated", "url", c.url, "user", zabbixUsername)
	c.authToken = auth

	return nil
}

func (c *ZabbixAPIClient) login(ctx context.Context, username string, password string) (string, error) {
	params := ZabbixAPIParams{
		User:     username,
		Password: password,
	}
	result, err := c.zabbixAPIRequest(ctx, "user.login", params, "")
	if err != nil {
		return "", err
	}

	var auth string
	err = json.Unmarshal(result, &auth)
	if err != nil {
		return "", err
	}

	return auth, nil
}

func (c *ZabbixAPIClient) zabbixAPIRequest(ctx context.Context, method string, params ZabbixAPIParams, auth string) (json.RawMessage, error) {
	// TODO: inject auth token (obtain from 'user.login' first)
	apiRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
		"params":  params,
	}

	if auth != "" && method != "apiinfo.version" {
		apiRequest["auth"] = auth
	}

	reqBodyJSON, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	var body io.Reader
	body = bytes.NewReader(reqBodyJSON)
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}

	req := &http.Request{
		Method: "POST",
		URL:    c.url,
		Header: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: rc,
	}

	tStart := time.Now()
	response, err := makeHTTPRequest(ctx, c.httpClient, req)
	if err != nil {
		return nil, err
	}

	requestTime := time.Now().Sub(tStart)
	c.logger.Debug("Response from Zabbix Request", "method", method, "requestTime", requestTime)

	return handleAPIResult(response)
}

func handleAPIResult(response []byte) (json.RawMessage, error) {
	var zabbixResp *zabbixResponse
	err := json.Unmarshal(response, &zabbixResp)

	if err != nil {
		return nil, err
	}

	if zabbixResp.Error != nil {
		return nil, fmt.Errorf("Code %d: '%s' %s", zabbixResp.Error.Code, zabbixResp.Error.Message, zabbixResp.Error.Data)
	}

	return zabbixResp.Result, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Error returned from Zabbix service: %v\n%v", res.StatusCode, string(body))
	}

	return body, nil
}

func isNotAuthorized(message string) bool {
	return message == "Session terminated, re-login, please." ||
		message == "Not authorised." ||
		message == "Not authorized."
}

