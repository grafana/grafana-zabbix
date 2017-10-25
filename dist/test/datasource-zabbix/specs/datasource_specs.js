"use strict";

var _module = require("../module");

var _datasource = require("../datasource");

var _q = require("q");

var _q2 = _interopRequireDefault(_q);

var _sinon = require("sinon");

var _sinon2 = _interopRequireDefault(_sinon);

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('ZabbixDatasource', function () {
  var ctx = {};
  var defined = _sinon2.default.match.defined;

  beforeEach(function () {
    ctx.instanceSettings = {
      jsonData: {
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
    ctx.zabbix = function () {};

    ctx.ds = new _module.Datasource(ctx.instanceSettings, ctx.templateSrv, ctx.alertSrv, ctx.dashboardSrv, ctx.zabbixAlertingSrv, ctx.zabbix);
  });

  describe('When querying data', function () {
    beforeEach(function () {
      ctx.ds.replaceTemplateVars = function (str) {
        return str;
      };
      ctx.ds.alertQuery = function () {
        return _q2.default.when([]);
      };
    });

    ctx.options = {
      targets: [{
        group: { filter: "" },
        host: { filter: "" },
        application: { filter: "" },
        item: { filter: "" }
      }],
      range: { from: 'now-7d', to: 'now' }
    };

    it('should return an empty array when no targets are set', function () {
      var options = {
        targets: [],
        range: { from: 'now-6h', to: 'now' }
      };
      return ctx.ds.query(options).then(function (result) {
        expect(result.data).to.have.length(0);
      });
    });

    it('should use trends if it enabled and time more than trendsFrom', function (done) {
      var ranges = ['now-7d', 'now-168h', 'now-1M', 'now-1y'];

      _lodash2.default.forEach(ranges, function (range) {
        ctx.options.range.from = range;
        ctx.ds.queryNumericData = _sinon2.default.spy();
        ctx.ds.query(ctx.options);

        // Check that useTrends options is true
        expect(ctx.ds.queryNumericData).to.have.been.calledWith(defined, defined, true, _sinon2.default.match.any);
      });

      done();
    });

    it('shouldnt use trends if it enabled and time less than trendsFrom', function (done) {
      var ranges = ['now-6d', 'now-167h', 'now-1h', 'now-30m', 'now-30s'];

      _lodash2.default.forEach(ranges, function (range) {
        ctx.options.range.from = range;
        ctx.ds.queryNumericData = _sinon2.default.spy();
        ctx.ds.query(ctx.options);

        // Check that useTrends options is false
        expect(ctx.ds.queryNumericData).to.have.been.calledWith(defined, defined, false, _sinon2.default.match.any);
      });
      done();
    });
  });

  describe('When replacing template variables', function () {

    function testReplacingVariable(target, varValue, expectedResult, done) {
      ctx.ds.templateSrv.replace = function () {
        return (0, _datasource.zabbixTemplateFormat)(varValue);
      };

      var result = ctx.ds.replaceTemplateVars(target);
      expect(result).to.equal(expectedResult);
      done();
    }

    /*
     * Alphanumerics, spaces, dots, dashes and underscores
     * are allowed in Zabbix host name.
     * 'AaBbCc0123 .-_'
     */
    it('should return properly escaped regex', function (done) {
      var target = '$host';
      var template_var_value = 'AaBbCc0123 .-_';
      var expected_result = '/^AaBbCc0123 \\.-_$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });

    /*
     * Single-value variable
     * $host = backend01
     * $host => /^backend01|backend01$/
     */
    it('should return proper regex for single value', function (done) {
      var target = '$host';
      var template_var_value = 'backend01';
      var expected_result = '/^backend01$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });

    /*
     * Multi-value variable
     * $host = [backend01, backend02]
     * $host => /^(backend01|backend01)$/
     */
    it('should return proper regex for multi-value', function (done) {
      var target = '$host';
      var template_var_value = ['backend01', 'backend02'];
      var expected_result = '/^(backend01|backend02)$/';

      testReplacingVariable(target, template_var_value, expected_result, done);
    });
  });

  describe('When invoking metricFindQuery()', function () {
    beforeEach(function () {
      ctx.ds.replaceTemplateVars = function (str) {
        return str;
      };
      ctx.ds.zabbix = {
        getGroups: function getGroups() {
          return _q2.default.when([]);
        },
        getHosts: function getHosts() {
          return _q2.default.when([]);
        },
        getApps: function getApps() {
          return _q2.default.when([]);
        },
        getItems: function getItems() {
          return _q2.default.when([]);
        }
      };
    });

    it('should return groups', function (done) {
      var tests = [{ query: '*', expect: '/.*/' }, { query: '', expect: '' }, { query: 'Backend', expect: 'Backend' }, { query: 'Back*', expect: 'Back*' }];

      var getGroups = _sinon2.default.spy(ctx.ds.zabbix, 'getGroups');
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = tests[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var test = _step.value;

          ctx.ds.metricFindQuery(test.query);
          expect(getGroups).to.have.been.calledWith(test.expect);
          getGroups.reset();
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      done();
    });

    it('should return hosts', function (done) {
      var tests = [{ query: '*.*', expect: '/.*/' }, { query: '.', expect: '' }, { query: 'Backend.*', expect: 'Backend' }, { query: 'Back*.', expect: 'Back*' }];

      var getHosts = _sinon2.default.spy(ctx.ds.zabbix, 'getHosts');
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = tests[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var test = _step2.value;

          ctx.ds.metricFindQuery(test.query);
          expect(getHosts).to.have.been.calledWith(test.expect);
          getHosts.reset();
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      done();
    });

    it('should return applications', function (done) {
      var tests = [{ query: '*.*.*', expect: ['/.*/', '/.*/'] }, { query: '.*.', expect: ['', '/.*/'] }, { query: 'Backend.backend01.*', expect: ['Backend', 'backend01'] }, { query: 'Back*.*.', expect: ['Back*', '/.*/'] }];

      var getApps = _sinon2.default.spy(ctx.ds.zabbix, 'getApps');
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = tests[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var test = _step3.value;

          ctx.ds.metricFindQuery(test.query);
          expect(getApps).to.have.been.calledWith(test.expect[0], test.expect[1]);
          getApps.reset();
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      done();
    });

    it('should return items', function (done) {
      var tests = [{ query: '*.*.*.*', expect: ['/.*/', '/.*/', ''] }, { query: '.*.*.*', expect: ['', '/.*/', ''] }, { query: 'Backend.backend01.*.*', expect: ['Backend', 'backend01', ''] }, { query: 'Back*.*.cpu.*', expect: ['Back*', '/.*/', 'cpu'] }];

      var getItems = _sinon2.default.spy(ctx.ds.zabbix, 'getItems');
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = tests[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var test = _step4.value;

          ctx.ds.metricFindQuery(test.query);
          expect(getItems).to.have.been.calledWith(test.expect[0], test.expect[1], test.expect[2]);
          getItems.reset();
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      done();
    });

    it('should invoke method with proper arguments', function (done) {
      var query = '*.*';

      var getHosts = _sinon2.default.spy(ctx.ds.zabbix, 'getHosts');
      ctx.ds.metricFindQuery(query);
      expect(getHosts).to.have.been.calledWith('/.*/');
      done();
    });
  });

  describe('When querying alerts', function () {
    var options = {};

    beforeEach(function () {
      ctx.ds.replaceTemplateVars = function (str) {
        return str;
      };
      ctx.ds.alertingEnabled = true;

      var targetItems = [{
        "itemid": "1",
        "name": "test item",
        "key_": "test.key",
        "value_type": "3",
        "hostid": "10631",
        "status": "0",
        "state": "0",
        "hosts": [{ "hostid": "10631", "name": "Test host" }],
        "item": "Test item"
      }];
      ctx.ds.zabbix.getItemsFromTarget = function () {
        return Promise.resolve(targetItems);
      };

      options = {
        "panelId": 10,
        "targets": [{
          "application": { "filter": "" },
          "group": { "filter": "Test group" },
          "host": { "filter": "Test host" },
          "item": { "filter": "Test item" }
        }]
      };
    });

    it('should return threshold when comparative symbol is `less than`', function () {

      var itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}<100"
      }];

      ctx.ds.zabbix.getAlerts = function () {
        return Promise.resolve(itemTriggers);
      };

      return ctx.ds.alertQuery(options).then(function (resp) {
        expect(resp.thresholds.length).to.equal(1);
        expect(resp.thresholds[0]).to.equal(100);
        return resp;
      });
    });

    it('should return threshold when comparative symbol is `less than or equal`', function () {

      var itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}<=100"
      }];

      ctx.ds.zabbix.getAlerts = function () {
        return Promise.resolve(itemTriggers);
      };

      return ctx.ds.alertQuery(options).then(function (resp) {
        expect(resp.thresholds.length).to.equal(1);
        expect(resp.thresholds[0]).to.equal(100);
        return resp;
      });
    });

    it('should return threshold when comparative symbol is `greater than or equal`', function () {

      var itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}>=30"
      }];

      ctx.ds.zabbix.getAlerts = function () {
        return Promise.resolve(itemTriggers);
      };

      return ctx.ds.alertQuery(options).then(function (resp) {
        expect(resp.thresholds.length).to.equal(1);
        expect(resp.thresholds[0]).to.equal(30);
        return resp;
      });
    });

    it('should return threshold when comparative symbol is `equal`', function () {

      var itemTriggers = [{
        "triggerid": "15383",
        "priority": "4",
        "expression": "{15915}=50"
      }];

      ctx.ds.zabbix.getAlerts = function () {
        return Promise.resolve(itemTriggers);
      };

      return ctx.ds.alertQuery(options).then(function (resp) {
        expect(resp.thresholds.length).to.equal(1);
        expect(resp.thresholds[0]).to.equal(50);
        return resp;
      });
    });
  });
});
