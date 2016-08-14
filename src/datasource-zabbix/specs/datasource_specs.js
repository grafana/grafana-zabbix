import {Datasource} from "../module";
import Q from "q";

describe('ZabbixDatasource', function() {
  var ctx = {};

  beforeEach(function() {
    ctx.instanceSettings = {
      jsonData: {
        username: 'zabbix',
        password: 'zabbix',
        trends: false
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
  });

  describe('When querying data', function() {

    it('should return an empty array when no targets are set', function(done) {
      var options = {
        targets: [],
        range: {from: null, to: null}
      };
      ctx.ds.query(options).then(function(result) {
        expect(result.data).to.have.length(0);
        done();
      });
    });

  });

});
