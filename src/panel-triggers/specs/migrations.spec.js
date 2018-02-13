import _ from 'lodash';
import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import {DEFAULT_TARGET, DEFAULT_SEVERITY, PANEL_DEFAULTS} from '../triggers_panel_ctrl';
import {CURRENT_SCHEMA_VERSION} from '../migrations';

describe('Triggers Panel schema migration', () => {
  let ctx = {};
  let datasourceSrvMock = {
    getMetricSources: () => {
      return [{ meta: {id: 'alexanderzobnin-zabbix-datasource'}, value: {}, name: 'zabbix_default' }];
    },
    get: () => Promise.resolve({})
  };

  let timeoutMock = () => {};

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
  });

  it('should update old panel schema', () => {
    let updatedPanelCtrl = new TriggerPanelCtrl(ctx.scope, {}, timeoutMock, datasourceSrvMock, {}, {}, {});

    let expected = _.defaultsDeep({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      datasources: ['zabbix'],
      targets: {
        'zabbix': DEFAULT_TARGET
      },
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
    let updatedPanelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});

    let expected = _.defaultsDeep({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      datasources: ['zabbix_default'],
      targets: {
        'zabbix_default': DEFAULT_TARGET
      }
    }, PANEL_DEFAULTS);
    expect(updatedPanelCtrl.panel).toEqual(expected);
  });
});
