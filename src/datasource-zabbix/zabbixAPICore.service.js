/**
 * General Zabbix API methods
 */

import angular from 'angular';

class ZabbixAPICoreService {

  /** @ngInject */
  constructor(backendSrv) {
    this.backendSrv = backendSrv;
  }

  /**
   * Request data from Zabbix API
   * @return {object}  response.result
   */
  request(api_url, method, params, options, auth) {
    let requestData = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    };

    if (auth === "") {
      // Reject immediately if not authenticated
      return Promise.reject(new ZabbixAPIError({data: "Not authorised."}));
    } else if (auth) {
      // Set auth parameter only if it needed
      requestData.auth = auth;
    }

    let requestOptions = {
      method: 'POST',
      url: api_url,
      data: requestData,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Set request options for basic auth
    if (options.basicAuth || options.withCredentials) {
      requestOptions.withCredentials = true;
    }
    if (options.basicAuth) {
      requestOptions.headers.Authorization = options.basicAuth;
    }

    return this.datasourceRequest(requestOptions);
  }

  datasourceRequest(requestOptions) {
    return this.backendSrv.datasourceRequest(requestOptions)
    .then((response) => {
      if (!response.data) {
        return Promise.reject(new ZabbixAPIError({data: "General Error, no data"}));
      } else if (response.data.error) {

        // Handle Zabbix API errors
        return Promise.reject(new ZabbixAPIError(response.data.error));
      }

      // Success
      return response.data.result;
    });
  }

  /**
   * Get authentication token.
   * @return {string}  auth token
   */
  login(api_url, username, password, options) {
    let params = {
      user: username,
      password: password
    };
    return this.request(api_url, 'user.login', params, options, null);
  }

  /**
   * Get Zabbix API version
   * Matches the version of Zabbix starting from Zabbix 2.0.4
   */
  getVersion(api_url, options) {
    return this.request(api_url, 'apiinfo.version', [], options);
  }
}

// Define zabbix API exception type
export class ZabbixAPIError {
  constructor(error) {
    this.code = error.code || null;
    this.name = error.message || "";
    this.data = error.data || "";
    this.message = "Zabbix API Error: " + this.name + " " + this.data;
  }

  toString() {
    return this.name + " " + this.data;
  }
}

angular
  .module('grafana.services')
  .service('zabbixAPICoreService', ZabbixAPICoreService);
