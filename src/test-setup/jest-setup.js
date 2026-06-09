import { PanelCtrl, MetricsPanelCtrl } from './panelStub';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

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
  'grafana/app/core/config',
  () => {
    return {
      buildInfo: { env: 'development' },
    };
  },
  { virtual: true }
);
