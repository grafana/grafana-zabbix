export interface JSONRPCRequest {
  jsonrpc: '2.0' | string;
  method: string;
  id: number;
  auth?: string | null;
  params?: JSONRPCRequestParams;
}

export interface JSONRPCResponse<T> {
  jsonrpc: '2.0' | string;
  id: number;
  result?: T;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code?: number;
  message?: string;
  data?: string;
}

export interface GFHTTPRequest {
  method: HTTPMethod;
  url: string;
  data?: any;
  headers?: {[key: string]: string};
  withCredentials?: boolean;
}

export type JSONRPCRequestParams = {[key: string]: any};

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'CONNECT' | 'OPTIONS' | 'TRACE';

export type GFRequestOptions = {[key: string]: any};

export interface ZabbixRequestResponse {
  data?: JSONRPCResponse<any>;
}

export type ZabbixAPIResponse<T> = T;

export type APILoginResponse = string;
