import { PanelCtrl, MetricsPanelCtrl } from './panelStub';

jest.mock(
  'grafana/app/features/templating/template_srv',
  () => {
    return {};
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/features/dashboard/dashboard_srv',
  () => {
    return {};
  },
  { virtual: true }
);

jest.mock(
  '@grafana/runtime',
  () => {
    return {
      getBackendSrv: () => ({
        datasourceRequest: jest.fn().mockResolvedValue(),
      }),
      getTemplateSrv: () => ({
        replace: jest.fn().mockImplementation((query) => query),
      }),
    };
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/core/core_module',
  () => {
    return {
      directive: function () {},
    };
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/core/core',
  () => ({
    contextSrv: {},
  }),
  { virtual: true }
);

const mockPanelCtrl = PanelCtrl;
const mockMetricsPanelCtrl = MetricsPanelCtrl;

jest.mock(
  'grafana/app/plugins/sdk',
  () => {
    return {
      QueryCtrl: null,
      PanelCtrl: mockPanelCtrl,
      loadPluginCss: () => {},
      PanelCtrl: mockPanelCtrl,
      MetricsPanelCtrl: mockMetricsPanelCtrl,
    };
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/core/utils/datemath',
  () => {
    const datemath = require('./modules/datemath');
    return {
      parse: datemath.parse,
      parseDateMath: datemath.parseDateMath,
      isValid: datemath.isValid,
    };
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/core/table_model',
  () => {
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
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/core/config',
  () => {
    return {
      buildInfo: { env: 'development' },
    };
  },
  { virtual: true }
);

jest.mock(
  'grafana/app/core/utils/kbn',
  () => {
    return {
      round_interval: (n) => n,
      secondsToHms: (n) => n + 'ms',
    };
  },
  { virtual: true }
);
