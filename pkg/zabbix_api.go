package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana_plugin_model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
)

// ZabbixDatasource stores state about a specific datasource and provides methods to make
// requests to the Zabbix API
type ZabbixDatasource struct {
	queryCache *Cache
	logger     hclog.Logger
	httpClient *http.Client
	authToken  string
}

// NewZabbixDatasource returns an initialized ZabbixDatasource
func NewZabbixDatasource() *ZabbixDatasource {
	return &ZabbixDatasource{
		queryCache: NewCache(10*time.Minute, 10*time.Minute),
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
	}
}

// ZabbixAPIQuery handles query requests to Zabbix
func (ds *ZabbixDatasource) ZabbixAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	result, queryExistInCache := ds.queryCache.Get(HashString(tsdbReq.String()))

	if !queryExistInCache {
		dsInfo := tsdbReq.GetDatasource()
		zabbixUrlStr := dsInfo.GetUrl()
		zabbixUrl, err := url.Parse(zabbixUrlStr)
		if err != nil {
			return nil, err
		}

		jsonDataStr := dsInfo.GetJsonData()
		jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
		if err != nil {
			return nil, err
		}

		zabbixLogin := jsonData.Get("username").MustString()
		// zabbixPassword := jsonData.Get("password").MustString()
		ds.logger.Debug("ZabbixAPIQuery", "url", zabbixUrl, "user", zabbixLogin)

		jsonQueries := make([]*simplejson.Json, 0)
		for _, query := range tsdbReq.Queries {
			json, err := simplejson.NewJson([]byte(query.ModelJson))
			apiMethod := json.GetPath("target", "method").MustString()
			apiParams := json.GetPath("target", "params")

			if err != nil {
				return nil, err
			}

			ds.logger.Debug("ZabbixAPIQuery", "method", apiMethod, "params", apiParams)

			jsonQueries = append(jsonQueries, json)
		}

		if len(jsonQueries) == 0 {
			return nil, errors.New("At least one query should be provided")
		}

		jsonQuery := jsonQueries[0].Get("target")
		apiMethod := jsonQuery.Get("method").MustString()
		apiParams := jsonQuery.Get("params")

		result, err := ds.ZabbixRequest(ctx, dsInfo, apiMethod, apiParams)
		ds.queryCache.Set(HashString(tsdbReq.String()), result)
		if err != nil {
			ds.logger.Debug("ZabbixAPIQuery", "error", err)
			return nil, errors.New("ZabbixAPIQuery is not implemented yet")
		}
	}

	resultByte, _ := result.(*simplejson.Json).MarshalJSON()
	ds.logger.Debug("ZabbixAPIQuery", "result", string(resultByte))

	return ds.BuildResponse(result.(*simplejson.Json))
}

// BuildResponse transforms a Zabbix API response to a DatasourceResponse
func (ds *ZabbixDatasource) BuildResponse(result *simplejson.Json) (*datasource.DatasourceResponse, error) {
	resultByte, err := result.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return &datasource.DatasourceResponse{
		Results: []*datasource.QueryResult{
			&datasource.QueryResult{
				RefId:    "zabbixAPI",
				MetaJson: string(resultByte),
			},
		},
	}, nil
}

// ZabbixRequest checks authentication and makes a request to the Zabbix API
func (ds *ZabbixDatasource) ZabbixRequest(ctx context.Context, dsInfo *datasource.DatasourceInfo, method string, params *simplejson.Json) (*simplejson.Json, error) {
	zabbixURL := dsInfo.GetUrl()

	// Authenticate first
	if ds.authToken == "" {
		auth, err := ds.loginWithDs(ctx, dsInfo)
		if err != nil {
			return nil, err
		}
		ds.authToken = auth
	}

	return ds.zabbixAPIRequest(ctx, zabbixURL, method, params, ds.authToken)
}

func (ds *ZabbixDatasource) loginWithDs(ctx context.Context, dsInfo *datasource.DatasourceInfo) (string, error) {
	zabbixUrlStr := dsInfo.GetUrl()
	zabbixUrl, err := url.Parse(zabbixUrlStr)
	if err != nil {
		return "", err
	}

	jsonDataStr := dsInfo.GetJsonData()
	jsonData, err := simplejson.NewJson([]byte(jsonDataStr))
	if err != nil {
		return "", err
	}

	zabbixLogin := jsonData.Get("username").MustString()
	zabbixPassword := jsonData.Get("password").MustString()
	auth, err := ds.login(ctx, zabbixUrlStr, zabbixLogin, zabbixPassword)
	if err != nil {
		ds.logger.Error("loginWithDs", "error", err)
		return "", err
	}
	ds.logger.Debug("loginWithDs", "url", zabbixUrl, "user", zabbixLogin, "auth", auth)

	return auth, nil
}

func (ds *ZabbixDatasource) login(ctx context.Context, apiUrl string, username string, password string) (string, error) {
	params := map[string]interface{}{
		"user":     username,
		"password": password,
	}
	paramsJson, err := json.Marshal(params)
	if err != nil {
		return "", err
	}
	data, _ := simplejson.NewJson(paramsJson)
	auth, err := ds.zabbixAPIRequest(ctx, apiUrl, "user.login", data, "")
	if err != nil {
		return "", err
	}

	return auth.MustString(), nil
}

func (ds *ZabbixDatasource) zabbixAPIRequest(ctx context.Context, apiUrl string, method string, params *simplejson.Json, auth string) (*simplejson.Json, error) {
	zabbixUrl, err := url.Parse(apiUrl)

	// TODO: inject auth token (obtain from 'user.login' first)
	apiRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  method,
		"params":  params,
	}

	if auth != "" {
		apiRequest["auth"] = auth
	}

	reqBodyJson, err := json.Marshal(apiRequest)
	if err != nil {
		return nil, err
	}

	var body io.Reader
	body = bytes.NewReader(reqBodyJson)
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}

	req := &http.Request{
		Method: "POST",
		URL:    zabbixUrl,
		Header: map[string][]string{
			"Content-Type": {"application/json"},
		},
		Body: rc,
	}

	response, err := makeHTTPRequest(ctx, ds.httpClient, req)
	if err != nil {
		return nil, err
	}

	ds.logger.Debug("zabbixAPIRequest", "response", string(response))

	return handleApiResult(response)
}

func handleApiResult(response []byte) (*simplejson.Json, error) {
	jsonResp, err := simplejson.NewJson([]byte(response))
	if err != nil {
		return nil, err
	}
	if errJson, isError := jsonResp.CheckGet("error"); isError {
		errMessage := fmt.Sprintf("%s %s", errJson.Get("message").MustString(), errJson.Get("data").MustString())
		return nil, errors.New(errMessage)
	}
	jsonResult := jsonResp.Get("result")
	return jsonResult, nil
}

func makeHTTPRequest(ctx context.Context, httpClient *http.Client, req *http.Request) ([]byte, error) {
	res, err := ctxhttp.Do(ctx, httpClient, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid status code. status: %v", res.Status)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}
