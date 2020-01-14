import _ from 'lodash';
import mocks from '../../test-setup/mocks';
import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import {DEFAULT_TARGET, DEFAULT_SEVERITY, PANEL_DEFAULTS} from '../triggers_panel_ctrl';
import {CURRENT_SCHEMA_VERSION} from '../migrations';

describe('Triggers Panel schema migration', () => {
  let ctx: any = {};
  let updatePanelCtrl;
  const datasourceSrvMock = {
    getMetricSources: () => {
      return [{ meta: {id: 'alexanderzobnin-zabbix-datasource'}, value: {}, name: 'zabbix_default' }];
    },
    get: () => Promise.resolve({})
  };

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
          showTriggers: 'all triggers',
          hideHostsInMaintenance: false,
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

    updatePanelCtrl = (scope) => new TriggerPanelCtrl(scope, {}, timeoutMock, datasourceSrvMock, {}, {}, {}, mocks.timeSrvMock);
  });

  it('should update old panel schema', () => {
    const updatedPanelCtrl = updatePanelCtrl(ctx.scope);

    const expected = _.defaultsDeep({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      targets: [
        {
          ...DEFAULT_TARGET,
          datasource: 'zabbix',
        }
      ],
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
      targets: [{
        ...DEFAULT_TARGET,
        datasource: 'zabbix_default'
      }]
    }, PANEL_DEFAULTS);
    expect(updatedPanelCtrl.panel).toEqual(expected);
  });

  it('should set default targets for new panel with empty targets', () => {
    ctx.scope.panel = {
      targets: []
    };
    const updatedPanelCtrl = updatePanelCtrl(ctx.scope);

    const expected = _.defaultsDeep({
      targets: [{
        ...DEFAULT_TARGET,
        datasource: 'zabbix_default'
      }]
    }, PANEL_DEFAULTS);

    expect(updatedPanelCtrl.panel).toEqual(expected);
  });
});
