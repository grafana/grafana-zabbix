// JSHint options
/* globals global: false */

import { JSDOM } from 'jsdom';
import { PanelCtrl, MetricsPanelCtrl } from './panelStub';

// Suppress messages
console.log = () => {};

jest.mock('grafana/app/features/templating/template_srv', () => {
  return {};
}, {virtual: true});

jest.mock('grafana/app/features/dashboard/dashboard_srv', () => {
  return {};
}, {virtual: true});

jest.mock('@grafana/runtime', () => {
  return {
    getBackendSrv: () => ({
      datasourceRequest: jest.fn().mockResolvedValue(),
    }),
    getTemplateSrv: () => ({
      replace: jest.fn().mockImplementation(query => query),
    }),
  };
}, {virtual: true});

jest.mock('grafana/app/core/core_module', () => {
  return {
    directive: function() {},
  };
}, {virtual: true});

jest.mock('grafana/app/core/core', () => ({
  contextSrv: {},
}), {virtual: true});

const mockPanelCtrl = PanelCtrl;
const mockMetricsPanelCtrl = MetricsPanelCtrl;

jest.mock('grafana/app/plugins/sdk', () => {
  return {
    QueryCtrl: null,
    PanelCtrl: mockPanelCtrl,
    loadPluginCss: () => {},
    PanelCtrl: mockPanelCtrl,
    MetricsPanelCtrl: mockMetricsPanelCtrl,
  };
}, {virtual: true});

jest.mock('grafana/app/core/utils/datemath', () => {
  const datemath = require('./modules/datemath');
  return {
    parse: datemath.parse,
    parseDateMath: datemath.parseDateMath,
    isValid: datemath.isValid
  };
}, {virtual: true});

jest.mock('grafana/app/core/table_model', () => {
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

jest.mock('grafana/app/core/config', () => {
  return {
    buildInfo: { env: 'development' }
  };
}, {virtual: true});

jest.mock('jquery', () => 'module not found', {virtual: true});

jest.mock('grafana/app/core/utils/kbn', () => {
  return {
    round_interval: n => n,
    secondsToHms: n => n + 'ms'
  };
}, {virtual: true});

// Setup jsdom
let dom = new JSDOM('<html><head><script></script></head><body></body></html>');
global.window = dom.window;
global.document = global.window.document;
global.Node = window.Node;

// Mock Canvas.getContext(), fixes
// Error: Not implemented: HTMLCanvasElement.prototype.getContext (without installing the canvas npm package)
window.HTMLCanvasElement.prototype.getContext = () => {};
