import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import {DEFAULT_TARGET} from '../triggers_panel_ctrl';
import {DEFAULT_SEVERITY} from '../triggers_panel_ctrl';

describe('Triggers Panel schema migration', () => {
  let ctx = {};
  let datasourceSrvMock = {
    getMetricSources: () => {
      return [{ meta: {id: 'alexanderzobnin-zabbix-datasource'}, value: {}, name: 'zabbix_default' }];
    },
    get: () => Promise.resolve({})
  };

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

  it('should update old panel schema', (done) => {
    let updatedPanelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});

    let expected = {
      schemaVersion: 2,
      datasources: ['zabbix'],
      targets: {
        'zabbix': DEFAULT_TARGET
      },
      hostField: true,
      statusField: false,
      severityField: false,
      lastChangeField: true,
      ageField: true,
      infoField: true,
      hideHostsInMaintenance: false,
      showTriggers: 'all triggers',
      sortTriggersBy: { text: 'last change', value: 'lastchange' },
      showEvents: { text: 'Problems', value: '1' },
      limit: 10,
      fontSize: '100%',
      fontColor: null,
      pageSize: 10,
      scroll: true,
      customLastChangeFormat: false,
      lastChangeFormat: "",
      triggerSeverity: DEFAULT_SEVERITY,
      okEventColor: 'rgba(0, 245, 153, 0.45)',
      ackEventColor: 'rgba(0, 0, 0, 0)'
    };

    expect(updatedPanelCtrl.panel).toEqual(expected);
    done();
  });

  it('should create new panel with default schema', (done) => {
    ctx.scope.panel = {};
    let updatedPanelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});

    let expected = {
      schemaVersion: 2,
      datasources: ['zabbix_default'],
      targets: {
        'zabbix_default': DEFAULT_TARGET
      },
      hostField: true,
      statusField: false,
      severityField: false,
      lastChangeField: true,
      ageField: true,
      infoField: true,
      hideHostsInMaintenance: false,
      showTriggers: 'all triggers',
      sortTriggersBy: { text: 'last change', value: 'lastchange' },
      showEvents: { text: 'Problems', value: '1' },
      limit: 10,
      fontSize: '100%',
      fontColor: null,
      pageSize: 10,
      scroll: true,
      customLastChangeFormat: false,
      lastChangeFormat: "",
      triggerSeverity: DEFAULT_SEVERITY,
      okEventColor: 'rgba(0, 245, 153, 0.45)',
      ackEventColor: 'rgba(0, 0, 0, 0)'
    };

    expect(updatedPanelCtrl.panel).toEqual(expected);
    done();
  });
});
