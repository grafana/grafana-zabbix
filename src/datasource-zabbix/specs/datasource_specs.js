import {Datasource} from "../module";
import {zabbixTemplateFormat} from "../datasource";
import Q from "q";
import sinon from 'sinon';
import _ from 'lodash';

describe('ZabbixDatasource', () => {
  var ctx = {};
  var defined = sinon.match.defined;

  beforeEach(() => {
    ctx.instanceSettings = {
      jsonData: {
        username: 'zabbix',
        password: 'zabbix',
        trends: true,
        trendsFrom: '7d'
      }
    };
    ctx.$q = Q;
    ctx.templateSrv = {};
    ctx.alertSrv = {};
    ctx.zabbixAPIService   = () => {};
    ctx.ZabbixCachingProxy = () => {};
    ctx.QueryProcessor     = () => {};

    ctx.ds = new Datasource(ctx.instanceSettings, ctx.$q, ctx.templateSrv, ctx.alertSrv,
                            ctx.zabbixAPIService, ctx.ZabbixCachingProxy, ctx.QueryProcessor);
  });

  describe('When querying data', () => {
    beforeEach(() => {
      ctx.ds.replaceTemplateVars = (str) => { return str; };
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

    it('should return an empty array when no targets are set', function(done) {
      var options = {
        targets: [],
        range: {from: 'now-6h', to: 'now'}
      };
      ctx.ds.query(options).then(function(result) {
        expect(result.data).to.have.length(0);
        done();
      });
    });

    it('should use trends if it enabled and time more than trendsFrom', function(done) {
      var ranges = ['now-7d', 'now-168h', 'now-1M', 'now-1y'];

      _.forEach(ranges, range => {
        ctx.options.range.from = range;
        ctx.ds.queryNumericData = sinon.spy();
        ctx.ds.query(ctx.options);

        // Check that useTrends options is true
        expect(ctx.ds.queryNumericData)
          .to.have.been.calledWith(defined, defined, defined, true);
      });

      done();
    });

    it('shouldnt use trends if it enabled and time less than trendsFrom', function(done) {
      var ranges = ['now-6d', 'now-167h', 'now-1h', 'now-30m', 'now-30s'];

      _.forEach(ranges, range => {
        ctx.options.range.from = range;
        ctx.ds.queryNumericData = sinon.spy();
        ctx.ds.query(ctx.options);

        // Check that useTrends options is false
        expect(ctx.ds.queryNumericData)
          .to.have.been.calledWith(defined, defined, defined, false);
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

});
