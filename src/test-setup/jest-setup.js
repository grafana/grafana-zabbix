// JSHint options
/* globals global: false */

import {JSDOM} from 'jsdom';
import System from 'systemjs';
import {PanelCtrl} from './panelStub';

// Mock Grafana modules that are not available outside of the core project
// Required for loading module.js
jest.mock('angular', () => {
  return {
    module: function() {
      return {
        directive: function() {},
        service: function() {},
        factory: function() {}
      };
    }
  };
}, {virtual: true});

let mockPanelCtrl = PanelCtrl;
jest.mock('app/plugins/sdk', () => {
  return {
    QueryCtrl: null,
    loadPluginCss: () => {},
    PanelCtrl: mockPanelCtrl
  };
}, {virtual: true});

jest.mock('app/core/utils/datemath', () => {
  const datemath = require('./modules/datemath');
  return {
    parse: datemath.parse,
    parseDateMath: datemath.parseDateMath,
    isValid: datemath.isValid
  };
}, {virtual: true});

jest.mock('app/core/table_model', () => {
  return class TableModel {
    constructor() {
      this.columns = [];
      this.columnMap = {};
      this.rows = [];
      this.type = 'table';
    }

    addColumn(col) {
      if (!this.columnMap[col.text]) {
        this.columns.push(col);
        this.columnMap[col.text] = col;
      }
    }
  };
}, {virtual: true});

jest.mock('jquery', () => 'module not found', {virtual: true});

// Required for loading angularjs
let dom = new JSDOM('<html><head><script></script></head><body></body></html>');
// Setup jsdom
global.window = dom.window;
global.document = global.window.document;
global.Node = window.Node;
global.System = System;
