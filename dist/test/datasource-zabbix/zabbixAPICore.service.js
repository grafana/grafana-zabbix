'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ZabbixAPIError = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * General Zabbix API methods
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ZabbixAPICoreService = function () {

  /** @ngInject */
  function ZabbixAPICoreService(backendSrv) {
    _classCallCheck(this, ZabbixAPICoreService);

    this.backendSrv = backendSrv;
  }

  /**
   * Request data from Zabbix API
   * @return {object}  response.result
   */


  _createClass(ZabbixAPICoreService, [{
    key: 'request',
    value: function request(api_url, method, params, options, auth) {
      var requestData = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      };

      if (auth === "") {
        // Reject immediately if not authenticated
        return Promise.reject(new ZabbixAPIError({ data: "Not authorised." }));
      } else if (auth) {
        // Set auth parameter only if it needed
        requestData.auth = auth;
      }

      var requestOptions = {
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
  }, {
    key: 'datasourceRequest',
    value: function datasourceRequest(requestOptions) {
      return this.backendSrv.datasourceRequest(requestOptions).then(function (response) {
        if (!response.data) {
          return Promise.reject(new ZabbixAPIError({ data: "General Error, no data" }));
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

  }, {
    key: 'login',
    value: function login(api_url, username, password, options) {
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

  }, {
    key: 'getVersion',
    value: function getVersion(api_url, options) {
      return this.request(api_url, 'apiinfo.version', [], options);
    }
  }]);

  return ZabbixAPICoreService;
}();

// Define zabbix API exception type


var ZabbixAPIError = exports.ZabbixAPIError = function () {
  function ZabbixAPIError(error) {
    _classCallCheck(this, ZabbixAPIError);

    this.code = error.code || null;
    this.name = error.message || "";
    this.data = error.data || "";
    this.message = "Zabbix API Error: " + this.name + " " + this.data;
  }

  _createClass(ZabbixAPIError, [{
    key: 'toString',
    value: function toString() {
      return this.name + " " + this.data;
    }
  }]);

  return ZabbixAPIError;
}();

_angular2.default.module('grafana.services').service('zabbixAPICoreService', ZabbixAPICoreService);
