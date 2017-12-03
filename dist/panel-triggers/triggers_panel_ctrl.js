'use strict';

System.register(['lodash', 'jquery', 'moment', '../datasource-zabbix/utils', 'app/plugins/sdk', './options_tab', './triggers_tab', './migrations'], function (_export, _context) {
  "use strict";

  var _, $, moment, utils, PanelCtrl, triggerPanelOptionsTab, triggerPanelTriggersTab, migratePanelSchema, _createClass, ZABBIX_DS_ID, DEFAULT_TARGET, DEFAULT_SEVERITY, DEFAULT_TIME_FORMAT, panelDefaults, triggerStatusMap, TriggerPanelCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  function _filterTriggers(triggers, triggerFilter) {
    if (utils.isRegex(triggerFilter)) {
      return _.filter(triggers, function (trigger) {
        return utils.buildRegex(triggerFilter).test(trigger.description);
      });
    } else {
      return _.filter(triggers, function (trigger) {
        return trigger.description === triggerFilter;
      });
    }
  }
  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_jquery) {
      $ = _jquery.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_datasourceZabbixUtils) {
      utils = _datasourceZabbixUtils;
    }, function (_appPluginsSdk) {
      PanelCtrl = _appPluginsSdk.PanelCtrl;
    }, function (_options_tab) {
      triggerPanelOptionsTab = _options_tab.triggerPanelOptionsTab;
    }, function (_triggers_tab) {
      triggerPanelTriggersTab = _triggers_tab.triggerPanelTriggersTab;
    }, function (_migrations) {
      migratePanelSchema = _migrations.migratePanelSchema;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';

      _export('DEFAULT_TARGET', DEFAULT_TARGET = {
        group: { filter: "" },
        host: { filter: "" },
        application: { filter: "" },
        trigger: { filter: "" }
      });

      _export('DEFAULT_TARGET', DEFAULT_TARGET);

      _export('DEFAULT_SEVERITY', DEFAULT_SEVERITY = [{ priority: 0, severity: 'Not classified', color: '#B7DBAB', show: true }, { priority: 1, severity: 'Information', color: '#82B5D8', show: true }, { priority: 2, severity: 'Warning', color: '#E5AC0E', show: true }, { priority: 3, severity: 'Average', color: '#C15C17', show: true }, { priority: 4, severity: 'High', color: '#BF1B00', show: true }, { priority: 5, severity: 'Disaster', color: '#890F02', show: true }]);

      _export('DEFAULT_SEVERITY', DEFAULT_SEVERITY);

      DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";
      panelDefaults = {
        schemaVersion: 2,
        datasources: [],
        targets: {},
        // Fields
        hostField: true,
        statusField: false,
        severityField: false,
        lastChangeField: true,
        ageField: true,
        infoField: true,
        // Options
        hideHostsInMaintenance: false,
        showTriggers: 'all triggers',
        sortTriggersBy: { text: 'last change', value: 'lastchange' },
        showEvents: { text: 'Problems', value: '1' },
        limit: 10,
        // View options
        fontSize: '100%',
        pageSize: 10,
        scroll: true,
        customLastChangeFormat: false,
        lastChangeFormat: "",
        // Triggers severity and colors
        triggerSeverity: DEFAULT_SEVERITY,
        okEventColor: 'rgba(0, 245, 153, 0.45)',
        ackEventColor: 'rgba(0, 0, 0, 0)'
      };
      triggerStatusMap = {
        '0': 'OK',
        '1': 'Problem'
      };

      _export('TriggerPanelCtrl', TriggerPanelCtrl = function (_PanelCtrl) {
        _inherits(TriggerPanelCtrl, _PanelCtrl);

        /** @ngInject */
        function TriggerPanelCtrl($scope, $injector, $element, datasourceSrv, templateSrv, contextSrv, dashboardSrv) {
          _classCallCheck(this, TriggerPanelCtrl);

          var _this = _possibleConstructorReturn(this, (TriggerPanelCtrl.__proto__ || Object.getPrototypeOf(TriggerPanelCtrl)).call(this, $scope, $injector));

          _this.datasourceSrv = datasourceSrv;
          _this.templateSrv = templateSrv;
          _this.contextSrv = contextSrv;
          _this.dashboardSrv = dashboardSrv;

          _this.editorTabIndex = 1;
          _this.triggerStatusMap = triggerStatusMap;
          _this.defaultTimeFormat = DEFAULT_TIME_FORMAT;
          _this.pageIndex = 0;
          _this.triggerList = [];
          _this.currentTriggersPage = [];
          _this.datasources = {};

          _this.panel = migratePanelSchema(_this.panel);
          _.defaults(_this.panel, _.cloneDeep(panelDefaults));

          _this.available_datasources = _.map(_this.getZabbixDataSources(), 'name');
          if (_this.panel.datasources.length === 0) {
            _this.panel.datasources.push(_this.available_datasources[0]);
          }
          if (_.isEmpty(_this.panel.targets)) {
            _this.panel.targets[_this.panel.datasources[0]] = DEFAULT_TARGET;
          }

          _this.initDatasources();
          _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
          _this.events.on('refresh', _this.onRefresh.bind(_this));
          return _this;
        }

        _createClass(TriggerPanelCtrl, [{
          key: 'initDatasources',
          value: function initDatasources() {
            var _this2 = this;

            var promises = _.map(this.panel.datasources, function (ds) {
              // Load datasource
              return _this2.datasourceSrv.get(ds).then(function (datasource) {
                _this2.datasources[ds] = datasource;
                return datasource;
              });
            });
            return Promise.all(promises);
          }
        }, {
          key: 'getZabbixDataSources',
          value: function getZabbixDataSources() {
            return _.filter(this.datasourceSrv.getMetricSources(), function (datasource) {
              return datasource.meta.id === ZABBIX_DS_ID && datasource.value;
            });
          }
        }, {
          key: 'onInitEditMode',
          value: function onInitEditMode() {
            this.addEditorTab('Triggers', triggerPanelTriggersTab, 1);
            this.addEditorTab('Options', triggerPanelOptionsTab, 2);
          }
        }, {
          key: 'setTimeQueryStart',
          value: function setTimeQueryStart() {
            this.timing.queryStart = new Date().getTime();
          }
        }, {
          key: 'setTimeQueryEnd',
          value: function setTimeQueryEnd() {
            this.timing.queryEnd = new Date().getTime();
          }
        }, {
          key: 'onRefresh',
          value: function onRefresh() {
            var _this3 = this;

            // ignore fetching data if another panel is in fullscreen
            if (this.otherPanelInFullscreenMode()) {
              return;
            }

            // clear loading/error state
            delete this.error;
            this.loading = true;
            this.setTimeQueryStart();

            return this.getTriggers().then(function (triggerList) {
              // Notify panel that request is finished
              _this3.loading = false;
              _this3.setTimeQueryEnd();

              // Limit triggers number
              _this3.triggerList = triggerList.slice(0, _this3.panel.limit);
              _this3.getCurrentTriggersPage();
              _this3.render(_this3.triggerList);
            }).catch(function (err) {
              // if cancelled  keep loading set to true
              if (err.cancelled) {
                console.log('Panel request cancelled', err);
                return;
              }

              _this3.loading = false;
              _this3.error = err.message || "Request Error";

              if (err.data) {
                if (err.data.message) {
                  _this3.error = err.data.message;
                }
                if (err.data.error) {
                  _this3.error = err.data.error;
                }
              }

              _this3.events.emit('data-error', err);
              console.log('Panel data error:', err);
            });
          }
        }, {
          key: 'getTriggers',
          value: function getTriggers() {
            var _this4 = this;

            var promises = _.map(this.panel.datasources, function (ds) {
              return _this4.datasourceSrv.get(ds).then(function (datasource) {
                var zabbix = datasource.zabbix;
                var showEvents = _this4.panel.showEvents.value;
                var triggerFilter = _this4.panel.targets[ds];
                var hideHostsInMaintenance = _this4.panel.hideHostsInMaintenance;

                // Replace template variables
                var groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
                var hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
                var appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);

                var triggersOptions = {
                  showTriggers: showEvents,
                  hideHostsInMaintenance: hideHostsInMaintenance
                };

                return zabbix.getTriggers(groupFilter, hostFilter, appFilter, triggersOptions);
              }).then(function (triggers) {
                return _this4.getAcknowledges(triggers, ds);
              }).then(function (triggers) {
                return _this4.filterTriggers(triggers, ds);
              });
            });

            return Promise.all(promises).then(function (results) {
              return _.flatten(results);
            }).then(function (triggers) {
              return _this4.sortTriggers(triggers);
            }).then(function (triggers) {
              return _.map(triggers, _this4.formatTrigger.bind(_this4));
            });
          }
        }, {
          key: 'getAcknowledges',
          value: function getAcknowledges(triggerList, ds) {
            var _this5 = this;

            // Request acknowledges for trigger
            var eventids = _.map(triggerList, function (trigger) {
              return trigger.lastEvent.eventid;
            });

            return this.datasources[ds].zabbix.getAcknowledges(eventids).then(function (events) {

              // Map events to triggers
              _.each(triggerList, function (trigger) {
                var event = _.find(events, function (event) {
                  return event.eventid === trigger.lastEvent.eventid;
                });

                if (event) {
                  trigger.acknowledges = _.map(event.acknowledges, function (ack) {
                    var timestamp = moment.unix(ack.clock);
                    if (_this5.panel.customLastChangeFormat) {
                      ack.time = timestamp.format(_this5.panel.lastChangeFormat);
                    } else {
                      ack.time = timestamp.format(_this5.defaultTimeFormat);
                    }
                    ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                    return ack;
                  });

                  // Mark acknowledged triggers with different color
                  if (_this5.panel.markAckEvents && trigger.acknowledges.length) {
                    trigger.color = _this5.panel.ackEventColor;
                  }
                }
              });

              return triggerList;
            });
          }
        }, {
          key: 'filterTriggers',
          value: function filterTriggers(triggerList, ds) {
            var _this6 = this;

            // Filter triggers by description
            var triggerFilter = this.panel.targets[ds].trigger.filter;
            triggerFilter = this.datasources[ds].replaceTemplateVars(triggerFilter);
            if (triggerFilter) {
              triggerList = _filterTriggers(triggerList, triggerFilter);
            }

            // Filter acknowledged triggers
            if (this.panel.showTriggers === 'unacknowledged') {
              triggerList = _.filter(triggerList, function (trigger) {
                return !trigger.acknowledges;
              });
            } else if (this.panel.showTriggers === 'acknowledged') {
              triggerList = _.filter(triggerList, 'acknowledges');
            } else {
              triggerList = triggerList;
            }

            // Filter triggers by severity
            triggerList = _.filter(triggerList, function (trigger) {
              return _this6.panel.triggerSeverity[trigger.priority].show;
            });

            return triggerList;
          }
        }, {
          key: 'sortTriggers',
          value: function sortTriggers(triggerList) {
            if (this.panel.sortTriggersBy.value === 'priority') {
              triggerList = _.sortBy(triggerList, 'priority').reverse();
            } else {
              triggerList = _.sortBy(triggerList, 'lastchangeUnix').reverse();
            }
            return triggerList;
          }
        }, {
          key: 'formatTrigger',
          value: function formatTrigger(trigger) {
            var triggerObj = trigger;

            // Format last change and age
            trigger.lastchangeUnix = Number(trigger.lastchange);
            var timestamp = moment.unix(trigger.lastchangeUnix);
            if (this.panel.customLastChangeFormat) {
              // User defined format
              triggerObj.lastchange = timestamp.format(this.panel.lastChangeFormat);
            } else {
              triggerObj.lastchange = timestamp.format(this.defaultTimeFormat);
            }
            triggerObj.age = timestamp.fromNow(true);

            // Set host that the trigger belongs
            if (trigger.hosts.length) {
              triggerObj.host = trigger.hosts[0].name;
              triggerObj.hostTechName = trigger.hosts[0].host;
            }

            // Set color
            if (trigger.value === '1') {
              // Problem state
              triggerObj.color = this.panel.triggerSeverity[trigger.priority].color;
            } else {
              // OK state
              triggerObj.color = this.panel.okEventColor;
            }

            triggerObj.severity = this.panel.triggerSeverity[trigger.priority].severity;
            return triggerObj;
          }
        }, {
          key: 'switchComment',
          value: function switchComment(trigger) {
            trigger.showComment = !trigger.showComment;
          }
        }, {
          key: 'acknowledgeTrigger',
          value: function acknowledgeTrigger(trigger, message) {
            var eventid = trigger.lastEvent.eventid;
            var grafana_user = this.contextSrv.user.name;
            var ack_message = grafana_user + ' (Grafana): ' + message;
            return this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
              var zabbixAPI = datasource.zabbix.zabbixAPI;
              return zabbixAPI.acknowledgeEvent(eventid, ack_message);
            }).then(this.onRefresh.bind(this));
          }
        }, {
          key: 'getCurrentTriggersPage',
          value: function getCurrentTriggersPage() {
            var pageSize = this.panel.pageSize || 10;
            var startPos = this.pageIndex * pageSize;
            var endPos = Math.min(startPos + pageSize, this.triggerList.length);
            this.currentTriggersPage = this.triggerList.slice(startPos, endPos);
            return this.currentTriggersPage;
          }
        }, {
          key: 'link',
          value: function link(scope, elem, attrs, ctrl) {
            var data;
            var panel = ctrl.panel;
            var pageCount = 0;
            data = ctrl.triggerList;

            function getTableHeight() {
              var panelHeight = ctrl.height;

              if (pageCount > 1) {
                panelHeight -= 26;
              }

              return panelHeight - 31 + 'px';
            }

            function switchPage(e) {
              var el = $(e.currentTarget);
              ctrl.pageIndex = parseInt(el.text(), 10) - 1;

              var pageSize = ctrl.panel.pageSize || 10;
              var startPos = ctrl.pageIndex * pageSize;
              var endPos = Math.min(startPos + pageSize, ctrl.triggerList.length);
              ctrl.currentTriggersPage = ctrl.triggerList.slice(startPos, endPos);

              scope.$apply(function () {
                renderPanel();
              });
            }

            function appendPaginationControls(footerElem) {
              footerElem.empty();

              var pageSize = ctrl.panel.pageSize || 5;
              pageCount = Math.ceil(data.length / pageSize);
              if (pageCount === 1) {
                return;
              }

              var startPage = Math.max(ctrl.pageIndex - 3, 0);
              var endPage = Math.min(pageCount, startPage + 9);

              var paginationList = $('<ul></ul>');

              for (var i = startPage; i < endPage; i++) {
                var activeClass = i === ctrl.pageIndex ? 'active' : '';
                var pageLinkElem = $('<li><a class="triggers-panel-page-link pointer ' + activeClass + '">' + (i + 1) + '</a></li>');
                paginationList.append(pageLinkElem);
              }

              footerElem.append(paginationList);
            }

            function renderPanel() {
              var panelElem = elem.parents('.panel');
              var rootElem = elem.find('.triggers-panel-scroll');
              var footerElem = elem.find('.triggers-panel-footer');

              elem.css({ 'font-size': panel.fontSize });
              panelElem.addClass('triggers-panel-wrapper');
              appendPaginationControls(footerElem);

              rootElem.css({ 'max-height': panel.scroll ? getTableHeight() : '' });
              ctrl.renderingCompleted();
            }

            elem.on('click', '.triggers-panel-page-link', switchPage);

            var unbindDestroy = scope.$on('$destroy', function () {
              elem.off('click', '.triggers-panel-page-link');
              unbindDestroy();
            });

            ctrl.events.on('render', function (renderData) {
              data = renderData || data;
              if (data) {
                scope.$apply(function () {
                  renderPanel();
                });
              }
            });
          }
        }]);

        return TriggerPanelCtrl;
      }(PanelCtrl));

      _export('TriggerPanelCtrl', TriggerPanelCtrl);

      TriggerPanelCtrl.templateUrl = 'panel-triggers/module.html';
    }
  };
});
//# sourceMappingURL=triggers_panel_ctrl.js.map
