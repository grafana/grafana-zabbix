'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnnotationsQueryCtrl = exports.QueryOptionsCtrl = exports.QueryCtrl = exports.ConfigCtrl = exports.Datasource = undefined;

var _datasource = require('./datasource');

var _query = require('./query.controller');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ZabbixConfigController = function ZabbixConfigController() {
  _classCallCheck(this, ZabbixConfigController);
};

ZabbixConfigController.templateUrl = 'datasource-zabbix/partials/config.html';

var ZabbixQueryOptionsController = function ZabbixQueryOptionsController() {
  _classCallCheck(this, ZabbixQueryOptionsController);
};

ZabbixQueryOptionsController.templateUrl = 'datasource-zabbix/partials/query.options.html';

var ZabbixAnnotationsQueryController = function ZabbixAnnotationsQueryController() {
  _classCallCheck(this, ZabbixAnnotationsQueryController);
};

ZabbixAnnotationsQueryController.templateUrl = 'datasource-zabbix/partials/annotations.editor.html';

exports.Datasource = _datasource.ZabbixAPIDatasource;
exports.ConfigCtrl = ZabbixConfigController;
exports.QueryCtrl = _query.ZabbixQueryController;
exports.QueryOptionsCtrl = ZabbixQueryOptionsController;
exports.AnnotationsQueryCtrl = ZabbixAnnotationsQueryController;
