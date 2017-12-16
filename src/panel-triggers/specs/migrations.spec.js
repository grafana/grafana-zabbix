import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import {DEFAULT_TARGET, DEFAULT_SEVERITY} from '../triggers_panel_ctrl';

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

    let expected = {
      schemaVersion: 4,
      datasources: ['zabbix'],
      targets: {
        'zabbix': DEFAULT_TARGET
      },
      hostField: true,
      hostTechNameField: false,
      hostGroups: false,
      showTags: true,
      statusField: false,
      severityField: false,
      descriptionField: true,
      descriptionAtNewLine: false,
      hostsInMaintenance: true,
      showTriggers: 'all triggers',
      sortTriggersBy: { text: 'last change', value: 'lastchange' },
      showEvents: { text: 'Problems', value: '1' },
      limit: 10,
      fontSize: '100%',
      pageSize: 10,
      highlightNewEvents: true,
      highlightNewerThan: '1h',
      customLastChangeFormat: false,
      lastChangeFormat: "",
      triggerSeverity: DEFAULT_SEVERITY,
      okEventColor: 'rgba(0, 245, 153, 0.45)',
      ackEventColor: 'rgba(0, 0, 0, 0)'
    };

    expect(updatedPanelCtrl.panel).toEqual(expected);
  });

  it('should create new panel with default schema', () => {
    ctx.scope.panel = {};
    let updatedPanelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});

    let expected = {
      schemaVersion: 4,
      datasources: ['zabbix_default'],
      targets: {
        'zabbix_default': DEFAULT_TARGET
      },
      hostField: true,
      hostTechNameField: false,
      hostGroups: false,
      showTags: true,
      statusField: true,
      severityField: true,
      descriptionField: true,
      descriptionAtNewLine: false,
      hostsInMaintenance: true,
      showTriggers: 'all triggers',
      sortTriggersBy: { text: 'last change', value: 'lastchange' },
      showEvents: { text: 'Problems', value: '1' },
      limit: 100,
      fontSize: '100%',
      pageSize: 10,
      highlightNewEvents: true,
      highlightNewerThan: '1h',
      customLastChangeFormat: false,
      lastChangeFormat: "",
      triggerSeverity: DEFAULT_SEVERITY,
      okEventColor: 'rgb(56, 189, 113)',
      ackEventColor: 'rgb(56, 219, 156)'
    };

    expect(updatedPanelCtrl.panel).toEqual(expected);
  });
});
