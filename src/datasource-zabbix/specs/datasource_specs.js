import {Datasource} from "../module";
import {zabbixTemplateFormat} from "../datasource";
import Q from "q";
import sinon from 'sinon';
import _ from 'lodash';

describe('ZabbixDatasource', () => {
  let ctx = {};
  let defined = sinon.match.defined;

  beforeEach(() => {
    ctx.instanceSettings = {
      jsonData: {
        alerting: true,
        username: 'zabbix',
        password: 'zabbix',
        trends: true,
        trendsFrom: '14d',
        trendsRange: '7d',
        dbConnection: {
          enabled: false
        }
      }
    };
    ctx.templateSrv = {};
    ctx.alertSrv = {};
    ctx.dashboardSrv = {};
    ctx.zabbixAlertingSrv = {};
    ctx.zabbix = () => {};

    ctx.ds = new Datasource(ctx.instanceSettings, ctx.templateSrv, ctx.alertSrv, ctx.dashboardSrv, ctx.zabbixAlertingSrv, ctx.zabbix);
  });

  describe('When querying data', () => {
    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => str;
      ctx.ds.alertQuery = () => Q.when([]);
    });

    ctx.options = {
      targets: [
        {
          group: {filter: ""},
          host: {filter: ""},
          application: {filter: ""},
          item: {filter: ""}
        }
      ],
      range: {from: 'now-7d', to: 'now'}
    };

    it('should return an empty array when no targets are set', (done) => {
      let options = {
        targets: [],
        range: {from: 'now-6h', to: 'now'}
      };
      ctx.ds.query(options).then(result => {
        expect(result.data).to.have.length(0);
        done();
      });
    });

    it('should use trends if it enabled and time more than trendsFrom', (done) => {
      let ranges = ['now-7d', 'now-168h', 'now-1M', 'now-1y'];

      _.forEach(ranges, range => {
        ctx.options.range.from = range;
        ctx.ds.queryNumericData = sinon.spy();
        ctx.ds.query(ctx.options);

        // Check that useTrends options is true
        expect(ctx.ds.queryNumericData)
          .to.have.been.calledWith(defined, defined, true, sinon.match.any);
      });

      done();
    });

    it('shouldnt use trends if it enabled and time less than trendsFrom', (done) => {
      let ranges = ['now-6d', 'now-167h', 'now-1h', 'now-30m', 'now-30s'];

      _.forEach(ranges, range => {
        ctx.options.range.from = range;
        ctx.ds.queryNumericData = sinon.spy();
        ctx.ds.query(ctx.options);

        // Check that useTrends options is false
        expect(ctx.ds.queryNumericData)
          .to.have.been.calledWith(defined, defined, false, sinon.match.any);
      });
      done();
    });

  });

  describe('When replacing template variables', () => {

    function testReplacingVariable(target, varValue, expectedResult, done) {
      ctx.ds.templateSrv.replace = () => {
        return zabbixTemplateFormat(varValue);
      };

      let result = ctx.ds.replaceTemplateVars(target);
      expect(result).to.equal(expectedResult);
      done();
    }

    /*
     * Alphanumerics, spaces, dots, dashes and underscores
     * are allowed in Zabbix host name.
     * 'AaBbCc0123 .-_'
     */
    it('should return properly escaped regex', (done) => {
      let target = '$host';
      let template_var_value = 'AaBbCc0123 .-_';
      let expected_result = '/^AaBbCc0123 \\.-_$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });

    /*
     * Single-value variable
     * $host = backend01
     * $host => /^backend01|backend01$/
     */
    it('should return proper regex for single value', (done) => {
      let target = '$host';
      let template_var_value = 'backend01';
      let expected_result = '/^backend01$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });

    /*
     * Multi-value variable
     * $host = [backend01, backend02]
     * $host => /^(backend01|backend01)$/
     */
    it('should return proper regex for multi-value', (done) => {
      let target = '$host';
      let template_var_value = ['backend01', 'backend02'];
      let expected_result = '/^(backend01|backend02)$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });
  });

  describe('When invoking metricFindQuery()', () => {
    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => str;
      ctx.ds.zabbix = {
        getGroups: () => Q.when([]),
        getHosts: () => Q.when([]),
        getApps: () => Q.when([]),
        getItems: () => Q.when([])
      };
    });

    it('should return groups', (done) => {
      const tests = [
        {query: '*',        expect: '/.*/'},
        {query: '',         expect: ''},
        {query: 'Backend',  expect: 'Backend'},
        {query: 'Back*',    expect: 'Back*'}
      ];

      let getGroups = sinon.spy(ctx.ds.zabbix, 'getGroups');
      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(getGroups).to.have.been.calledWith(test.expect);
        getGroups.reset();
      }
      done();
    });

    it('should return hosts', (done) => {
      const tests = [
        {query: '*.*',       expect: '/.*/'},
        {query: '.',         expect: ''},
        {query: 'Backend.*', expect: 'Backend'},
        {query: 'Back*.',    expect: 'Back*'}
      ];

      let getHosts = sinon.spy(ctx.ds.zabbix, 'getHosts');
      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(getHosts).to.have.been.calledWith(test.expect);
        getHosts.reset();
      }
      done();
    });

    it('should return applications', (done) => {
      const tests = [
        {query: '*.*.*',               expect: ['/.*/', '/.*/']},
        {query: '.*.',                 expect: ['', '/.*/']},
        {query: 'Backend.backend01.*', expect: ['Backend', 'backend01']},
        {query: 'Back*.*.',            expect: ['Back*', '/.*/']}
      ];

      let getApps = sinon.spy(ctx.ds.zabbix, 'getApps');
      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(getApps).to.have.been.calledWith(test.expect[0], test.expect[1]);
        getApps.reset();
      }
      done();
    });

    it('should return items', (done) => {
      const tests = [
        {query: '*.*.*.*',               expect: ['/.*/', '/.*/', '']},
        {query: '.*.*.*',                expect: ['', '/.*/', '']},
        {query: 'Backend.backend01.*.*', expect: ['Backend', 'backend01', '']},
        {query: 'Back*.*.cpu.*',         expect: ['Back*', '/.*/', 'cpu']}
      ];

      let getItems = sinon.spy(ctx.ds.zabbix, 'getItems');
      for (const test of tests) {
        ctx.ds.metricFindQuery(test.query);
        expect(getItems)
          .to.have.been.calledWith(test.expect[0], test.expect[1], test.expect[2]);
        getItems.reset();
      }
      done();
    });

    it('should invoke method with proper arguments', (done) => {
      let query = '*.*';

      let getHosts = sinon.spy(ctx.ds.zabbix, 'getHosts');
      ctx.ds.metricFindQuery(query);
      expect(getHosts).to.have.been.calledWith('/.*/');
      done();
    });
  });

  describe('When querying alerts', () => {
    let options = {};

    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => str;

      let targetItems = [{
        "itemid": "1",
        "name": "test item",
        "key_": "test.key",
        "value_type": "3",
        "hostid": "10631",
        "status": "0",
        "state": "0",
        "hosts": [{"hostid": "10631", "name": "Test host"}],
        "item": "Test item"
      }];
      ctx.ds.zabbix.getItemsFromTarget = () => Promise.resolve(targetItems);

      options = {
        "panelId": 10,
        "targets": [{
          "application": {"filter": ""},
          "group": {"filter": "Test group"},
          "host": {"filter": "Test host"},
          "item": {"filter": "Test item"},
        }]
      };
    });

    it('should return threshold when comparative symbol is `less than`', () => {

      let itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}<100",
      }];

      ctx.ds.zabbix.getAlerts = () => Promise.resolve(itemTriggers);

      return ctx.ds.alertQuery(options)
        .then(resp => {
          expect(resp.thresholds.length).to.equal(1);
          expect(resp.thresholds[0]).to.equal(100);
          return resp;
        });
    });

    it('should return threshold when comparative symbol is `less than or equal`', () => {

      let itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}<=100",
      }];

      ctx.ds.zabbix.getAlerts = () => Promise.resolve(itemTriggers);

      return ctx.ds.alertQuery(options)
        .then(resp => {
          expect(resp.thresholds.length).to.equal(1);
          expect(resp.thresholds[0]).to.equal(100);
          return resp;
        });
    });

    it('should return threshold when comparative symbol is `greater than or equal`', () => {

      let itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}>=30",
      }];

      ctx.ds.zabbix.getAlerts = () => Promise.resolve(itemTriggers);

      return ctx.ds.alertQuery(options)
        .then(resp => {
          expect(resp.thresholds.length).to.equal(1);
          expect(resp.thresholds[0]).to.equal(30);
          return resp;
        });
    });

    it('should return threshold when comparative symbol is `equal`', () => {

      let itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}=50",
      }];

      ctx.ds.zabbix.getAlerts = () => Promise.resolve(itemTriggers);

      return ctx.ds.alertQuery(options)
        .then(resp => {
          expect(resp.thresholds.length).to.equal(1);
          expect(resp.thresholds[0]).to.equal(50);
          return resp;
        });
    });
  });
});
