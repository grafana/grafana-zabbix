'use strict';

var _prunk = require('prunk');

var _prunk2 = _interopRequireDefault(_prunk);

var _jsdom = require('jsdom');

var _chai = require('chai');

var _chai2 = _interopRequireDefault(_chai);

var _sinonChai = require('sinon-chai');

var _sinonChai2 = _interopRequireDefault(_sinonChai);

var _datemath = require('./modules/datemath');

var dateMath = _interopRequireWildcard(_datemath);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Mock angular module

// import sinon from 'sinon';
var angularMocks = {
  module: function module() {
    return {
      directive: function directive() {},
      service: function service() {},
      factory: function factory() {}
    };
  }
}; // JSHint options
/* globals global: false */

var datemathMock = {
  parse: dateMath.parse,
  parseDateMath: dateMath.parseDateMath,
  isValid: dateMath.isValid
};

// Mock Grafana modules that are not available outside of the core project
// Required for loading module.js
_prunk2.default.mock('./css/query-editor.css!', 'no css, dude.');
_prunk2.default.mock('app/plugins/sdk', {
  QueryCtrl: null
});
_prunk2.default.mock('app/core/utils/datemath', datemathMock);
_prunk2.default.mock('angular', angularMocks);
_prunk2.default.mock('jquery', 'module not found');

// Required for loading angularjs
var dom = new _jsdom.JSDOM('<html><head><script></script></head><body></body></html>');
// Setup jsdom
global.window = dom.window;
global.document = global.window.document;
global.Node = window.Node;

// Setup Chai
_chai2.default.should();
_chai2.default.use(_sinonChai2.default);
global.assert = _chai2.default.assert;
global.expect = _chai2.default.expect;
