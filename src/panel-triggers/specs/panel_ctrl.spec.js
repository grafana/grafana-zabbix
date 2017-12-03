import _ from 'lodash';
import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import {PANEL_DEFAULTS, DEFAULT_TARGET} from '../triggers_panel_ctrl';

describe('TriggerPanelCtrl', () => {
  let ctx = {};
  let datasourceSrvMock, zabbixDSMock;

  beforeEach(() => {
    ctx = {scope: {panel: PANEL_DEFAULTS}};
    zabbixDSMock = {
      replaceTemplateVars: () => {},
      zabbix: {
        getTriggers: jest.fn().mockReturnValue([generateTrigger("1"), generateTrigger("1")]),
        getAcknowledges: jest.fn().mockReturnValue(Promise.resolve([]))
      }
    };

    datasourceSrvMock = {
      getMetricSources: () => {
        return [
          { meta: {id: 'alexanderzobnin-zabbix-datasource'}, value: {}, name: 'zabbix_default' },
          { meta: {id: 'alexanderzobnin-zabbix-datasource'}, value: {}, name: 'zabbix' },
          { meta: {id: 'graphite'}, value: {}, name: 'graphite' },
        ];
      },
      get: () => Promise.resolve(zabbixDSMock)
    };
  });

  describe('When adding new panel', () => {
    it('should suggest all zabbix data sources', () => {
      ctx.scope.panel = {};
      let panelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});
      expect(panelCtrl.available_datasources).toEqual([
        'zabbix_default', 'zabbix'
      ]);
    });

    it('should load first zabbix data source as default', () => {
      ctx.scope.panel = {};
      let panelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});
      expect(panelCtrl.panel.datasources).toEqual([
        'zabbix_default'
      ]);
    });
  });

  describe('When refreshing panel', () => {
    beforeEach(() => {
      ctx.scope.panel.datasources = ['zabbix_default', 'zabbix'];
      ctx.scope.panel.targets = {
        'zabbix_default': DEFAULT_TARGET,
        'zabbix': DEFAULT_TARGET
      };
      zabbixDSMock.zabbix.getTriggers = jest.fn()
        .mockReturnValueOnce([
          generateTrigger(1, 1), generateTrigger(2, 11)
        ])
        .mockReturnValueOnce([
          generateTrigger(3, 2), generateTrigger(4, 3)
        ]);
    });

    it('should sort triggers', (done) => {
      let panelCtrl = new TriggerPanelCtrl(ctx.scope, {}, {}, datasourceSrvMock, {}, {}, {});
      panelCtrl.onRefresh().then(() => {
        let trigger_ids = _.map(panelCtrl.triggerList, 'triggerid');
        expect(trigger_ids).toEqual([
          '2', '4', '3', '1'
        ]);
        done();
      });
    });
  });
});

const defaultTrigger = {
  triggerid: "1",
  priority: 3,
  lastchange: "1",
  hosts: [],
  lastEvent: []
};

function generateTrigger(id, timestamp, severity) {
  let trigger = _.cloneDeep(defaultTrigger);
  trigger.triggerid = id.toString();
  if (severity) {
    trigger.priority = severity;
  }
  if (timestamp) {
    trigger.lastchange = timestamp;
  }
  return trigger;
}
