'use strict';

var _jsdom = require('jsdom');

// Mock Grafana modules that are not available outside of the core project
// Required for loading module.js
jest.mock('angular', function () {
  return {
    module: function module() {
      return {
        directive: function directive() {},
        service: function service() {},
        factory: function factory() {}
      };
    }
  };
}, { virtual: true }); // JSHint options
/* globals global: false */

jest.mock('app/plugins/sdk', function () {
  return {
    QueryCtrl: null
  };
}, { virtual: true });

jest.mock('app/core/utils/datemath', function () {
  var datemath = require('./modules/datemath');
  return {
    parse: datemath.parse,
    parseDateMath: datemath.parseDateMath,
    isValid: datemath.isValid
  };
}, { virtual: true });

jest.mock('app/core/table_model', function () {
  return {};
}, { virtual: true });

jest.mock('./css/query-editor.css!', function () {
  return "";
}, { virtual: true });

jest.mock('jquery', function () {
  return 'module not found';
}, { virtual: true });

// Required for loading angularjs
var dom = new _jsdom.JSDOM('<html><head><script></script></head><body></body></html>');
// Setup jsdom
global.window = dom.window;
global.document = global.window.document;
global.Node = window.Node;
