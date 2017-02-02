'use strict';

System.register(['lodash', 'jquery', 'moment', '../datasource-zabbix/utils', 'app/plugins/sdk', './editor', './ack-tooltip.directive', './css/panel_triggers.css!'], function (_export, _context) {
  "use strict";

  var _, $, moment, utils, MetricsPanelCtrl, triggerPanelEditor, _createClass, _get, defaultSeverity, panelDefaults, triggerStatusMap, defaultTimeFormat, TriggerPanelCtrl;

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

  function filterTriggers(triggers, triggerFilter) {
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
      MetricsPanelCtrl = _appPluginsSdk.MetricsPanelCtrl;
    }, function (_editor) {
      triggerPanelEditor = _editor.triggerPanelEditor;
    }, function (_ackTooltipDirective) {}, function (_cssPanel_triggersCss) {}],
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

      _get = function get(object, property, receiver) {
        if (object === null) object = Function.prototype;
        var desc = Object.getOwnPropertyDescriptor(object, property);

        if (desc === undefined) {
          var parent = Object.getPrototypeOf(object);

          if (parent === null) {
            return undefined;
          } else {
            return get(parent, property, receiver);
          }
        } else if ("value" in desc) {
          return desc.value;
        } else {
          var getter = desc.get;

          if (getter === undefined) {
            return undefined;
          }

          return getter.call(receiver);
        }
      };

      defaultSeverity = [{ priority: 0, severity: 'Not classified', color: '#B7DBAB', show: true }, { priority: 1, severity: 'Information', color: '#82B5D8', show: true }, { priority: 2, severity: 'Warning', color: '#E5AC0E', show: true }, { priority: 3, severity: 'Average', color: '#C15C17', show: true }, { priority: 4, severity: 'High', color: '#BF1B00', show: true }, { priority: 5, severity: 'Disaster', color: '#890F02', show: true }];
      panelDefaults = {
        datasource: null,
        triggers: {
          group: { filter: "" },
          host: { filter: "" },
          application: { filter: "" },
          trigger: { filter: "" }
        },
        hostField: true,
        statusField: false,
        severityField: false,
        lastChangeField: true,
        ageField: true,
        infoField: true,
        limit: 10,
        showTriggers: 'all triggers',
        sortTriggersBy: { text: 'last change', value: 'lastchange' },
        showEvents: { text: 'Problems', value: '1' },
        triggerSeverity: defaultSeverity,
        okEventColor: 'rgba(0, 245, 153, 0.45)',
        ackEventColor: 'rgba(0, 0, 0, 0)',
        scroll: true,
        pageSize: 10
      };
      triggerStatusMap = {
        '0': 'OK',
        '1': 'Problem'
      };
      defaultTimeFormat = "DD MMM YYYY HH:mm:ss";

      _export('PanelCtrl', _export('TriggerPanelCtrl', TriggerPanelCtrl = function (_MetricsPanelCtrl) {
        _inherits(TriggerPanelCtrl, _MetricsPanelCtrl);

        /** @ngInject */
        function TriggerPanelCtrl($scope, $injector, $element, datasourceSrv, templateSrv, contextSrv) {
          _classCallCheck(this, TriggerPanelCtrl);

          var _this = _possibleConstructorReturn(this, (TriggerPanelCtrl.__proto__ || Object.getPrototypeOf(TriggerPanelCtrl)).call(this, $scope, $injector));

          _this.datasourceSrv = datasourceSrv;
          _this.templateSrv = templateSrv;
          _this.contextSrv = contextSrv;
          _this.triggerStatusMap = triggerStatusMap;
          _this.defaultTimeFormat = defaultTimeFormat;

          _this.pageIndex = 0;

          // Load panel defaults
          // _.cloneDeep() need for prevent changing shared defaultSeverity.
          // Load object "by value" istead "by reference".
          _.defaults(_this.panel, _.cloneDeep(panelDefaults));

          _this.triggerList = [];
          _this.refreshData();
          return _this;
        }

        /**
         * Override onInitMetricsPanelEditMode() method from MetricsPanelCtrl.
         * We don't need metric editor from Metrics Panel.
         */


        _createClass(TriggerPanelCtrl, [{
          key: 'onInitMetricsPanelEditMode',
          value: function onInitMetricsPanelEditMode() {
            this.addEditorTab('Options', triggerPanelEditor, 2);
          }
        }, {
          key: 'refresh',
          value: function refresh() {
            this.onMetricsPanelRefresh();
          }
        }, {
          key: 'onMetricsPanelRefresh',
          value: function onMetricsPanelRefresh() {
            // ignore fetching data if another panel is in fullscreen
            if (this.otherPanelInFullscreenMode()) {
              return;
            }

            this.refreshData();
          }
        }, {
          key: 'refreshData',
          value: function refreshData() {
            var _this2 = this;

            // clear loading/error state
            delete this.error;
            this.loading = true;
            this.setTimeQueryStart();

            var self = this;

            // Load datasource
            return this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
              var zabbix = datasource.zabbix;
              var showEvents = self.panel.showEvents.value;
              var triggerFilter = self.panel.triggers;

              // Replace template variables
              var groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
              var hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
              var appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);

              var getTriggers = zabbix.getTriggers(groupFilter, hostFilter, appFilter, showEvents);
              return getTriggers.then(function (triggers) {
                return _.map(triggers, function (trigger) {
                  var triggerObj = trigger;

                  // Format last change and age
                  trigger.lastchangeUnix = Number(trigger.lastchange);
                  var timestamp = moment.unix(trigger.lastchangeUnix);
                  if (self.panel.customLastChangeFormat) {
                    // User defined format
                    triggerObj.lastchange = timestamp.format(self.panel.lastChangeFormat);
                  } else {
                    triggerObj.lastchange = timestamp.format(self.defaultTimeFormat);
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
                    triggerObj.color = self.panel.triggerSeverity[trigger.priority].color;
                  } else {
                    // OK state
                    triggerObj.color = self.panel.okEventColor;
                  }

                  triggerObj.severity = self.panel.triggerSeverity[trigger.priority].severity;
                  return triggerObj;
                });
              }).then(function (triggerList) {

                // Request acknowledges for trigger
                var eventids = _.map(triggerList, function (trigger) {
                  return trigger.lastEvent.eventid;
                });

                return zabbix.getAcknowledges(eventids).then(function (events) {

                  // Map events to triggers
                  _.each(triggerList, function (trigger) {
                    var event = _.find(events, function (event) {
                      return event.eventid === trigger.lastEvent.eventid;
                    });

                    if (event) {
                      trigger.acknowledges = _.map(event.acknowledges, function (ack) {
                        var timestamp = moment.unix(ack.clock);
                        if (self.panel.customLastChangeFormat) {
                          ack.time = timestamp.format(self.panel.lastChangeFormat);
                        } else {
                          ack.time = timestamp.format(self.defaultTimeFormat);
                        }
                        ack.user = ack.alias + ' (' + ack.name + ' ' + ack.surname + ')';
                        return ack;
                      });

                      // Mark acknowledged triggers with different color
                      if (self.panel.markAckEvents && trigger.acknowledges.length) {
                        trigger.color = self.panel.ackEventColor;
                      }
                    }
                  });

                  // Filter triggers by description
                  var triggerFilter = self.panel.triggers.trigger.filter;
                  if (triggerFilter) {
                    triggerList = filterTriggers(triggerList, triggerFilter);
                  }

                  // Filter acknowledged triggers
                  if (self.panel.showTriggers === 'unacknowledged') {
                    triggerList = _.filter(triggerList, function (trigger) {
                      return !trigger.acknowledges;
                    });
                  } else if (self.panel.showTriggers === 'acknowledged') {
                    triggerList = _.filter(triggerList, 'acknowledges');
                  } else {
                    triggerList = triggerList;
                  }

                  // Filter triggers by severity
                  triggerList = _.filter(triggerList, function (trigger) {
                    return self.panel.triggerSeverity[trigger.priority].show;
                  });

                  // Sort triggers
                  if (self.panel.sortTriggersBy.value === 'priority') {
                    triggerList = _.sortBy(triggerList, 'priority').reverse();
                  } else {
                    triggerList = _.sortBy(triggerList, 'lastchangeUnix').reverse();
                  }

                  // Limit triggers number
                  self.triggerList = triggerList.slice(0, self.panel.limit);

                  // Notify panel that request is finished
                  self.setTimeQueryEnd();
                  self.loading = false;

                  _this2.panel.triggerList = _this2.triggerList;
                  _this2.render();
                });
              });
            });
          }
        }, {
          key: 'switchComment',
          value: function switchComment(trigger) {
            trigger.showComment = !trigger.showComment;
          }
        }, {
          key: 'acknowledgeTrigger',
          value: function acknowledgeTrigger(trigger, message) {
            var _this3 = this;

            var eventid = trigger.lastEvent.eventid;
            var grafana_user = this.contextSrv.user.name;
            var ack_message = grafana_user + ' (Grafana): ' + message;
            return this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
              var zabbixAPI = datasource.zabbix.zabbixAPI;
              return zabbixAPI.acknowledgeEvent(eventid, ack_message).then(function () {
                _this3.refresh();
              });
            });
          }
        }, {
          key: 'render',
          value: function render() {
            return _get(TriggerPanelCtrl.prototype.__proto__ || Object.getPrototypeOf(TriggerPanelCtrl.prototype), 'render', this).call(this, this.table);
          }
        }, {
          key: 'link',
          value: function link(scope, elem, attrs, ctrl) {
            var data;
            var panel = ctrl.panel;
            var pageCount = 0;
            // var formaters = [];
            data = ctrl.panel.triggerList;

            function getTableHeight() {
              var panelHeight = ctrl.height;

              if (pageCount > 1) {
                panelHeight -= 26;
              }

              return panelHeight - 31 + 'px';
            }

            // function appendTableRows(tbodyElem) {
            //   var renderer = new TableRenderer(panel, data, ctrl.dashboard.isTimezoneUtc(), ctrl.$sanitize);
            //   tbodyElem.empty();
            //   tbodyElem.html(renderer.render(ctrl.pageIndex));
            // }

            function switchPage(e) {
              var el = $(e.currentTarget);
              ctrl.pageIndex = parseInt(el.text(), 10) - 1;
              renderPanel();
            }

            function appendPaginationControls(footerElem) {
              footerElem.empty();

              var pageSize = panel.pageSize || 5;
              pageCount = Math.ceil(ctrl.panel.triggerList.length / pageSize);
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
              // var tbodyElem = elem.find('tbody');
              var footerElem = elem.find('.triggers-panel-footer');

              elem.css({ 'font-size': panel.fontSize });
              panelElem.addClass('triggers-panel-wrapper');

              // appendTableRows(tbodyElem);
              appendPaginationControls(footerElem);

              rootElem.css({ 'max-height': panel.scroll ? getTableHeight() : '' });
            }

            elem.on('click', '.triggers-panel-page-link', switchPage);

            var unbindDestroy = scope.$on('$destroy', function () {
              elem.off('click', '.triggers-panel-page-link');
              unbindDestroy();
            });

            ctrl.events.on('render', function () {
              renderPanel();
            });
          }
        }]);

        return TriggerPanelCtrl;
      }(MetricsPanelCtrl)));

      TriggerPanelCtrl.templateUrl = 'panel-triggers/module.html';
      _export('TriggerPanelCtrl', TriggerPanelCtrl);

      _export('PanelCtrl', TriggerPanelCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
