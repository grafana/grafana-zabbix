import _ from 'lodash';
import mocks from '../../test-setup/mocks';
import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import { DEFAULT_TARGET, DEFAULT_SEVERITY, PANEL_DEFAULTS } from '../triggers_panel_ctrl';
import { CURRENT_SCHEMA_VERSION } from '../migrations';

jest.mock('@grafana/runtime', () => {
  return {
    getDataSourceSrv: () => ({
      getMetricSources: () => {
        return [{ meta: {id: 'alexanderzobnin-zabbix-datasource'}, value: {}, name: 'zabbix_default' }];
      },
      get: () => Promise.resolve({})
    }),
  };
}, {virtual: true});

describe('Triggers Panel schema migration', () => {
  let ctx: any = {};
  let updatePanelCtrl;

  const timeoutMock = () => {};

  beforeEach(() => {
    ctx = {
      scope: {
        panel: {
          datasource: 'zabbix',
          triggers: DEFAULT_TARGET,
          hostField: true,
          statusField: false,
          severityField: false,
          lastChangeField: true,
          ageField: true,
          infoField: true,
          limit: 10,
          showTriggers: 'unacknowledged',
          hideHostsInMaintenance: false,
          hostsInMaintenance: false,
          sortTriggersBy: { text: 'last change', value: 'lastchange' },
          showEvents: { text: 'Problems', value: '1' },
          triggerSeverity: DEFAULT_SEVERITY,
          okEventColor: 'rgba(0, 245, 153, 0.45)',
          ackEventColor: 'rgba(0, 0, 0, 0)',
          scroll: true,
          pageSize: 10,
          fontSize: '100%',
        }
      }
    };

    updatePanelCtrl = (scope) => new TriggerPanelCtrl(scope, {}, timeoutMock);
  });

  it('should update old panel schema', () => {
    const updatedPanelCtrl = updatePanelCtrl(ctx.scope);

    const expected = _.defaultsDeep({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      datasource: 'zabbix',
      targets: [
        {
          ...DEFAULT_TARGET,
          queryType: 5,
          showProblems: 'problems',
          options: {
            hostsInMaintenance: false,
            acknowledged: 0,
            sortProblems: 'default',
            minSeverity: 0,
            limit: 10,
          },
        }
      ],
      sortProblems: 'lastchange',
      ageField: true,
      statusField: false,
      severityField: false,
      limit: 10,
      okEventColor: 'rgba(0, 245, 153, 0.45)',
      ackEventColor: 'rgba(0, 0, 0, 0)'
    }, PANEL_DEFAULTS);

    expect(updatedPanelCtrl.panel).toEqual(expected);
  });

  it('should create new panel with default schema', () => {
    ctx.scope.panel = {};
    const updatedPanelCtrl = updatePanelCtrl(ctx.scope);

    const expected = _.defaultsDeep({
      schemaVersion: CURRENT_SCHEMA_VERSION,
    }, PANEL_DEFAULTS);
    expect(updatedPanelCtrl.panel).toEqual(expected);
  });
});
