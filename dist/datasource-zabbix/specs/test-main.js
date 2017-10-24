// JSHint options
/* globals global: false */

import prunk from 'prunk';
import {JSDOM} from 'jsdom';
import chai from 'chai';
// import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as dateMath from './modules/datemath';

// Mock angular module
var angularMocks = {
  module: function() {
    return {
      directive: function() {},
      service: function() {},
      factory: function() {}
    };
  }
};

var datemathMock = {
  parse: dateMath.parse,
  parseDateMath: dateMath.parseDateMath,
  isValid: dateMath.isValid
};

// Mock Grafana modules that are not available outside of the core project
// Required for loading module.js
prunk.mock('./css/query-editor.css!', 'no css, dude.');
prunk.mock('app/plugins/sdk', {
  QueryCtrl: null
});
prunk.mock('app/core/utils/datemath', datemathMock);
prunk.mock('app/core/table_model', {});
prunk.mock('angular', angularMocks);
prunk.mock('jquery', 'module not found');

// Required for loading angularjs
let dom = new JSDOM('<html><head><script></script></head><body></body></html>');
// Setup jsdom
global.window = dom.window;
global.document = global.window.document;
global.Node = window.Node;

// Setup Chai
chai.should();
chai.use(sinonChai);
global.assert = chai.assert;
global.expect = chai.expect;
