import _ from 'lodash';
import mocks from '../../test-setup/mocks';
import {TriggerPanelCtrl} from '../triggers_panel_ctrl';
import {PANEL_DEFAULTS, DEFAULT_TARGET} from '../triggers_panel_ctrl';
// import { create } from 'domain';

describe('TriggerPanelCtrl', () => {
  let ctx: any = {};
  let datasourceSrvMock, zabbixDSMock;
  const timeoutMock = () => {};
  let createPanelCtrl;

  beforeEach(() => {
    ctx = {scope: {panel: PANEL_DEFAULTS}};
    zabbixDSMock = {
      replaceTemplateVars: () => {},
      zabbix: {
        getTriggers: jest.fn().mockReturnValue([generateTrigger("1"), generateTrigger("1")]),
        getExtendedEventData: jest.fn().mockResolvedValue([]),
        getEventAlerts: jest.fn().mockResolvedValue([]),
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
    createPanelCtrl = () => new TriggerPanelCtrl(ctx.scope, {}, timeoutMock, datasourceSrvMock, {}, {}, {}, mocks.timeSrvMock);

    const getTriggersResp = [
      [
        createTrigger({
          triggerid: "1", lastchange: "1510000010", priority: 5, lastEvent: {eventid: "11"}, hosts: [{maintenance_status: '1'}]
        }),
        createTrigger({
          triggerid: "2", lastchange: "1510000040", priority: 3, lastEvent: {eventid: "12"}
        }),
      ],
      [
        createTrigger({triggerid: "3", lastchange: "1510000020", priority: 4, lastEvent: {eventid: "13"}}),
        createTrigger({triggerid: "4", lastchange: "1510000030", priority: 2, lastEvent: {eventid: "14"}}),
      ]
    ];

    // Simulate 2 data sources
    zabbixDSMock.zabbix.getTriggers = jest.fn()
      .mockReturnValueOnce(getTriggersResp[0])
      .mockReturnValueOnce(getTriggersResp[1]);
    zabbixDSMock.zabbix.getExtendedEventData = jest.fn()
      .mockReturnValue(Promise.resolve([defaultEvent]));

    ctx.panelCtrl = createPanelCtrl();
  });

  describe('When adding new panel', () => {
    it('should suggest all zabbix data sources', () => {
      ctx.scope.panel = {};
      const panelCtrl = createPanelCtrl();
      expect(panelCtrl.available_datasources).toEqual([
        'zabbix_default', 'zabbix'
      ]);
    });

    it('should load first zabbix data source as default', () => {
      ctx.scope.panel = {};
      const panelCtrl = createPanelCtrl();
      expect(panelCtrl.panel.targets[0].datasource).toEqual('zabbix_default');
    });

    it('should rewrite default empty target', () => {
      ctx.scope.panel = {
        targets: [{
          "target": "",
          "refId": "A"
        }],
      };
      const panelCtrl = createPanelCtrl();
      expect(panelCtrl.available_datasources).toEqual([
        'zabbix_default', 'zabbix'
      ]);
    });
  });

  describe('When refreshing panel', () => {
    beforeEach(() => {
      ctx.scope.panel.datasources = ['zabbix_default', 'zabbix'];
      ctx.scope.panel.targets = [
        {
          ...DEFAULT_TARGET,
          datasource: 'zabbix_default'
        },
        {
          ...DEFAULT_TARGET,
          datasource: 'zabbix'
        },
      ];
      ctx.panelCtrl = createPanelCtrl();
    });

    it('should format triggers', (done) => {
      ctx.panelCtrl.onRefresh().then(() => {
        const formattedTrigger: any = _.find(ctx.panelCtrl.triggerList, {triggerid: "1"});
        expect(formattedTrigger.host).toBe('backend01');
        expect(formattedTrigger.hostTechName).toBe('backend01_tech');
        expect(formattedTrigger.datasource).toBe('zabbix_default');
        expect(formattedTrigger.maintenance).toBe(true);
        expect(formattedTrigger.lastchange).toBeTruthy();
        done();
      });
    });

    it('should sort triggers by time by default', (done) => {
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger_ids = _.map(ctx.panelCtrl.triggerList, 'triggerid');
        expect(trigger_ids).toEqual([
          '2', '4', '3', '1'
        ]);
        done();
      });
    });

    it('should sort triggers by severity', (done) => {
      ctx.panelCtrl.panel.sortTriggersBy = { text: 'severity', value: 'priority' };
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger_ids = _.map(ctx.panelCtrl.triggerList, 'triggerid');
        expect(trigger_ids).toEqual([
          '1', '3', '2', '4'
        ]);
        done();
      });
    });

    it('should add acknowledges to trigger', (done) => {
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger = getTriggerById(1, ctx);
        expect(trigger.acknowledges).toHaveLength(1);
        expect(trigger.acknowledges[0].message).toBe("event ack");

        expect(getTriggerById(2, ctx).acknowledges).toBe(undefined);
        expect(getTriggerById(3, ctx).acknowledges).toBe(undefined);
        expect(getTriggerById(4, ctx).acknowledges).toBe(undefined);
        done();
      });
    });
  });

  describe('When formatting triggers', () => {
    beforeEach(() => {
      ctx.panelCtrl = createPanelCtrl();
    });

    it('should handle new lines in trigger description', () => {
      ctx.panelCtrl.setTriggerSeverity = jest.fn((trigger) => trigger);
      const trigger = {comments: "this is\ndescription"};
      const formattedTrigger = ctx.panelCtrl.formatTrigger(trigger);
      expect(formattedTrigger.comments).toBe("this is<br>description");
    });

    it('should format host name to display (default)', (done) => {
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger = getTriggerById(1, ctx);
        const hostname = ctx.panelCtrl.formatHostName(trigger);
        expect(hostname).toBe('backend01');
        done();
      });
    });

    it('should format host name to display (tech name)', (done) => {
      ctx.panelCtrl.panel.hostField = false;
      ctx.panelCtrl.panel.hostTechNameField = true;
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger = getTriggerById(1, ctx);
        const hostname = ctx.panelCtrl.formatHostName(trigger);
        expect(hostname).toBe('backend01_tech');
        done();
      });
    });

    it('should format host name to display (both tech and visible)', (done) => {
      ctx.panelCtrl.panel.hostField = true;
      ctx.panelCtrl.panel.hostTechNameField = true;
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger = getTriggerById(1, ctx);
        const hostname = ctx.panelCtrl.formatHostName(trigger);
        expect(hostname).toBe('backend01 (backend01_tech)');
        done();
      });
    });

    it('should hide hostname if both visible and tech name checkboxes unset', (done) => {
      ctx.panelCtrl.panel.hostField = false;
      ctx.panelCtrl.panel.hostTechNameField = false;
      ctx.panelCtrl.onRefresh().then(() => {
        const trigger = getTriggerById(1, ctx);
        const hostname = ctx.panelCtrl.formatHostName(trigger);
        expect(hostname).toBe("");
        done();
      });
    });
  });

  describe('When formatting acknowledges', () => {
    beforeEach(() => {
      ctx.panelCtrl = createPanelCtrl();
    });

    it('should build proper user name', () => {
      const ack = {
        alias: 'alias',  name: 'name', surname: 'surname'
      };

      const formatted = ctx.panelCtrl.formatAcknowledge(ack);
      expect(formatted.user).toBe('alias (name surname)');
    });

    it('should return empty name if it is not defined', () => {
      const formatted = ctx.panelCtrl.formatAcknowledge({});
      expect(formatted.user).toBe('');
    });
  });
});

const defaultTrigger: any = {
  "triggerid": "13565",
  "value": "1",
  "groups": [{"groupid": "1", "name": "Backend"}] ,
  "hosts": [{"host": "backend01_tech", "hostid": "10001","maintenance_status": "0", "name": "backend01"}] ,
  "lastEvent": {
    "eventid": "11",
    "clock": "1507229064",
    "ns": "556202037",
    "acknowledged": "1",
    "value": "1",
    "object": "0",
    "source": "0",
    "objectid": "13565",
  },
  "tags": [] ,
  "lastchange": "1440259530",
  "priority": "2",
  "description": "Lack of free swap space on server",
  "comments": "It probably means that the systems requires\nmore physical memory.",
  "url": "https://host.local/path",
  "templateid": "0", "expression": "{13174}<50", "manual_close": "0", "correlation_mode": "0",
  "correlation_tag": "", "recovery_mode": "0", "recovery_expression": "", "state": "0", "status": "0",
  "flags": "0", "type": "0", "items": [] , "error": ""
};

const defaultEvent: any = {
  "eventid": "11",
  "acknowledges": [
    {
      "acknowledgeid": "185",
      "action": "0",
      "alias": "api",
      "clock": "1512382246",
      "eventid": "11",
      "message": "event ack",
      "name": "api",
      "surname": "user",
      "userid": "3"
    }
  ],
  "clock": "1507229064",
  "ns": "556202037",
  "acknowledged": "1",
  "value": "1",
  "object": "0",
  "source": "0",
  "objectid": "1",
};

function generateTrigger(id, timestamp?, severity?): any {
  const trigger = _.cloneDeep(defaultTrigger);
  trigger.triggerid = id.toString();
  if (severity) {
    trigger.priority = severity.toString();
  }
  if (timestamp) {
    trigger.lastchange = timestamp;
  }
  return trigger;
}

function createTrigger(props): any {
  let trigger = _.cloneDeep(defaultTrigger);
  trigger = _.merge(trigger, props);
  trigger.lastEvent.objectid = trigger.triggerid;
  return trigger;
}

function getTriggerById(id, ctx): any {
  return _.find(ctx.panelCtrl.triggerList, {triggerid: id.toString()});
}
