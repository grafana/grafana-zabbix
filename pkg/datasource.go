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
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
)

type ZabbixDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

func (ds *ZabbixDatasource) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	queryType, err := GetQueryType(tsdbReq)
	if err != nil {
		return nil, err
	}

	dsInfo := tsdbReq.GetDatasource()
	ds.logger.Debug("createRequest", "dsInfo", dsInfo)

	ds.logger.Debug("createRequest", "queryType", queryType)

	switch queryType {
	case "zabbixAPI":
		return ds.ZabbixAPIQuery(ctx, tsdbReq)
	default:
		return nil, errors.New("Query is not implemented yet")
	}
}

func GetQueryType(tsdbReq *datasource.DatasourceRequest) (string, error) {
	queryType := "query"
	if len(tsdbReq.Queries) > 0 {
		firstQuery := tsdbReq.Queries[0]
		queryJson, err := simplejson.NewJson([]byte(firstQuery.ModelJson))
		if err != nil {
			return "", err
		}
		queryType = queryJson.Get("queryType").MustString("query")
	}
	return queryType, nil
}

func (ds *ZabbixDatasource) ZabbixAPIQuery(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
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

	// TODO: inject auth token (obtain from 'user.login' first)
	reqBodyJson, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  jsonQuery.Get("method").MustString(),
		"params":  jsonQuery.Get("params"),
	})
	if err != nil {
		return nil, err
	}

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

	response, err := ds.MakeHttpRequest(ctx, req)
	ds.logger.Debug("ZabbixAPIQuery", "response", string(response))

	return nil, errors.New("ZabbixAPIQuery is not implemented yet")
}

func (ds *ZabbixDatasource) MakeHttpRequest(ctx context.Context, req *http.Request) ([]byte, error) {
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

var httpClient = &http.Client{
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	},
	Timeout: time.Duration(time.Second * 30),
}
