/**
 * General Zabbix API methods
 */

import angular from 'angular';

class ZabbixAPICoreService {

  /** @ngInject */
  constructor($q, backendSrv) {
    this.$q = $q;
    this.backendSrv = backendSrv;
  }

  /**
   * Request data from Zabbix API
   * @return {object}  response.result
   */
  request(api_url, method, params, options, auth) {
    var deferred = this.$q.defer();
    var requestData = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    };

    if (auth === "") {
      // Reject immediately if not authenticated
      deferred.reject({data: "Not authorised."});
      return deferred.promise;
    } else if (auth) {
      // Set auth parameter only if it needed
      requestData.auth = auth;
    }

    var requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      url: api_url,
      data: requestData
    };

    // Set request options for basic auth
    if (options.basicAuth || options.withCredentials) {
      requestOptions.withCredentials = true;
    }
    if (options.basicAuth) {
      requestOptions.headers.Authorization = options.basicAuth;
    }

    this.backendSrv.datasourceRequest(requestOptions)
      .then((response) => {
        // General connection issues
        if (!response.data) {
          deferred.reject(response);
        }

        // Handle Zabbix API errors
        else if (response.data.error) {
          deferred.reject(response.data.error);
        }

        deferred.resolve(response.data.result);
      }, (error) => {
        deferred.reject(error.err);
      });

    return deferred.promise;
  }

  /**
   * Get authentication token.
   * @return {string}  auth token
   */
  login(api_url, username, password, options) {
    var params = {
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
function ZabbixException(error) {
  this.code = error.code;
  this.errorType = error.message;
  this.message = error.data;
}

ZabbixException.prototype.toString = function() {
  return this.errorType + ": " + this.message;
};

angular
  .module('grafana.services')
  .service('zabbixAPICoreService', ZabbixAPICoreService);
