import {Datasource} from "../module";
import Q from "q";
import sinon from 'sinon';
import _ from 'lodash';

describe('ZabbixDatasource', function() {
  var ctx = {};
  var defined = sinon.match.defined;

  beforeEach(function() {
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
    ctx.zabbixAPIService = function() {};
    ctx.ZabbixCachingProxy = function() {};
    ctx.QueryProcessor = function() {};

    ctx.ds = new Datasource(ctx.instanceSettings, ctx.$q, ctx.templateSrv, ctx.alertSrv,
                            ctx.zabbixAPIService, ctx.ZabbixCachingProxy, ctx.QueryProcessor);

    ctx.ds.replaceTemplateVars = function(str) {
      return str;
    };
  });

  describe('When querying data', function() {
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

});
