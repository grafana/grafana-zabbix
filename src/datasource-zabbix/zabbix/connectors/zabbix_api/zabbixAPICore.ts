/**
 * General Zabbix API methods
 */
import { getBackendSrv } from '@grafana/runtime';
import { JSONRPCRequest, ZabbixRequestResponse, JSONRPCError, APILoginResponse, GFHTTPRequest, GFRequestOptions } from './types';

export class ZabbixAPICore {
  /**
   * Request data from Zabbix API
   * @return {object}  response.result
   */
  request(api_url: string, method: string, params: any, options: GFRequestOptions, auth?: string) {
    const requestData: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1
    };

    if (auth === "") {
      // Reject immediately if not authenticated
      return Promise.reject(new ZabbixAPIError({data: "Not initialized"}));
    } else if (auth) {
      // Set auth parameter only if it needed
      requestData.auth = auth;
    }

    const requestOptions: GFHTTPRequest = {
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
    return getBackendSrv().datasourceRequest(requestOptions)
    .then((response: ZabbixRequestResponse) => {
      if (!response?.data) {
        return Promise.reject(new ZabbixAPIError({data: "General Error, no data"}));
      } else if (response?.data.error) {

        // Handle Zabbix API errors
        return Promise.reject(new ZabbixAPIError(response.data.error));
      }

      // Success
      return response?.data.result;
    });
  }

  /**
   * Get authentication token.
   * @return {string}  auth token
   */
  login(api_url: string, username: string, password: string, options: GFRequestOptions): Promise<APILoginResponse> {
    const params = {
      user: username,
      password: password
    };
    return this.request(api_url, 'user.login', params, options, null);
  }

  /**
   * Get Zabbix API version
   * Matches the version of Zabbix starting from Zabbix 2.0.4
   */
  getVersion(api_url: string, options: GFRequestOptions): Promise<string> {
    return this.request(api_url, 'apiinfo.version', [], options).catch(err => {
      console.error(err);
      return undefined;
    });
  }
}

// Define zabbix API exception type
export class ZabbixAPIError {
  code: number;
  name: string;
  data: string;
  message: string;

  constructor(error: JSONRPCError) {
    this.code = error.code || null;
    this.name = error.message || "";
    this.data = error.data || "";
    this.message = "Zabbix API Error: " + this.name + " " + this.data;
  }

  toString() {
    return this.name + " " + this.data;
  }
}
