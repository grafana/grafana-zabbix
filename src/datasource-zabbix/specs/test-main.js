// JSHint options
/* globals global: false */

import prunk from 'prunk';
import {jsdom} from 'jsdom';
import chai from 'chai';

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
  parse: function() {}
};

// Mock Grafana modules that are not available outside of the core project
// Required for loading module.js
prunk.mock('./css/query-editor.css!', 'no css, dude.');
prunk.mock('app/plugins/sdk', {
  QueryCtrl: null
});
prunk.mock('app/core/utils/datemath', datemathMock);
prunk.mock('angular', angularMocks);
prunk.mock('jquery', 'module not found');

// Setup jsdom
// Required for loading angularjs
global.document = jsdom('<html><head><script></script></head><body></body></html>');
global.window = global.document.parentWindow;
global.navigator = window.navigator = {};
global.Node = window.Node;

// Setup Chai
chai.should();
global.assert = chai.assert;
global.expect = chai.expect;
