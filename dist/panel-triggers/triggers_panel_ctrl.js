'use strict';

System.register(['lodash', 'jquery', 'moment', '../datasource-zabbix/utils', 'app/plugins/sdk', './options_tab', './triggers_tab', './migrations'], function (_export, _context) {
  "use strict";

  var _, $, moment, utils, PanelCtrl, triggerPanelOptionsTab, triggerPanelTriggersTab, migratePanelSchema, CURRENT_SCHEMA_VERSION, _createClass, _get, ZABBIX_DS_ID, DEFAULT_TARGET, DEFAULT_SEVERITY, DEFAULT_TIME_FORMAT, PANEL_DEFAULTS, triggerStatusMap, TriggerPanelCtrl;

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
      PanelCtrl = _appPluginsSdk.PanelCtrl;
    }, function (_options_tab) {
      triggerPanelOptionsTab = _options_tab.triggerPanelOptionsTab;
    }, function (_triggers_tab) {
      triggerPanelTriggersTab = _triggers_tab.triggerPanelTriggersTab;
    }, function (_migrations) {
      migratePanelSchema = _migrations.migratePanelSchema;
      CURRENT_SCHEMA_VERSION = _migrations.CURRENT_SCHEMA_VERSION;
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

      ZABBIX_DS_ID = 'alexanderzobnin-zabbix-datasource';

      _export('DEFAULT_TARGET', DEFAULT_TARGET = {
        group: { filter: "" },
        host: { filter: "" },
        application: { filter: "" },
        trigger: { filter: "" },
        tags: { filter: "" }
      });

      _export('DEFAULT_TARGET', DEFAULT_TARGET);

      _export('DEFAULT_SEVERITY', DEFAULT_SEVERITY = [{ priority: 0, severity: 'Not classified', color: 'rgb(108, 108, 108)', show: true }, { priority: 1, severity: 'Information', color: 'rgb(120, 158, 183)', show: true }, { priority: 2, severity: 'Warning', color: 'rgb(175, 180, 36)', show: true }, { priority: 3, severity: 'Average', color: 'rgb(255, 137, 30)', show: true }, { priority: 4, severity: 'High', color: 'rgb(255, 101, 72)', show: true }, { priority: 5, severity: 'Disaster', color: 'rgb(215, 0, 0)', show: true }]);

      _export('DEFAULT_SEVERITY', DEFAULT_SEVERITY);

      DEFAULT_TIME_FORMAT = "DD MMM YYYY HH:mm:ss";

      _export('PANEL_DEFAULTS', PANEL_DEFAULTS = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        datasources: [],
        targets: {},
        // Fields
        hostField: true,
        hostTechNameField: false,
        hostGroups: false,
        showTags: true,
        statusField: true,
        severityField: true,
        descriptionField: true,
        descriptionAtNewLine: false,
        // Options
        hostsInMaintenance: true,
        showTriggers: 'all triggers',
        sortTriggersBy: { text: 'last change', value: 'lastchange' },
        showEvents: { text: 'Problems', value: '1' },
        limit: 100,
        // View options
        fontSize: '100%',
        pageSize: 10,
        highlightBackground: false,
        highlightNewEvents: false,
        highlightNewerThan: '1h',
        customLastChangeFormat: false,
        lastChangeFormat: "",
        // Triggers severity and colors
        triggerSeverity: DEFAULT_SEVERITY,
        okEventColor: 'rgb(56, 189, 113)',
        ackEventColor: 'rgb(56, 219, 156)'
      });

      _export('PANEL_DEFAULTS', PANEL_DEFAULTS);

      triggerStatusMap = {
        '0': 'OK',
        '1': 'PROBLEM'
      };

      _export('TriggerPanelCtrl', TriggerPanelCtrl = function (_PanelCtrl) {
        _inherits(TriggerPanelCtrl, _PanelCtrl);

        /** @ngInject */
        function TriggerPanelCtrl($scope, $injector, $timeout, datasourceSrv, templateSrv, contextSrv, dashboardSrv) {
          _classCallCheck(this, TriggerPanelCtrl);

          var _this = _possibleConstructorReturn(this, (TriggerPanelCtrl.__proto__ || Object.getPrototypeOf(TriggerPanelCtrl)).call(this, $scope, $injector));

          _this.datasourceSrv = datasourceSrv;
          _this.templateSrv = templateSrv;
          _this.contextSrv = contextSrv;
          _this.dashboardSrv = dashboardSrv;
          _this.scope = $scope;
          _this.$timeout = $timeout;

          _this.editorTabIndex = 1;
          _this.triggerStatusMap = triggerStatusMap;
          _this.defaultTimeFormat = DEFAULT_TIME_FORMAT;
          _this.pageIndex = 0;
          _this.triggerList = [];
          _this.currentTriggersPage = [];
          _this.datasources = {};

          _this.panel = migratePanelSchema(_this.panel);
          _.defaultsDeep(_this.panel, _.cloneDeep(PANEL_DEFAULTS));

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
            this.pageIndex = 0;

            return this.getTriggers().then(function (zabbixTriggers) {
              // Notify panel that request is finished
              _this3.loading = false;
              _this3.setTimeQueryEnd();

              _this3.render(zabbixTriggers);
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
          key: 'render',
          value: function render(zabbixTriggers) {
            var _this4 = this;

            var triggers = _.cloneDeep(zabbixTriggers || this.triggerListUnfiltered);
            this.triggerListUnfiltered = _.cloneDeep(triggers);

            triggers = _.map(triggers, this.formatTrigger.bind(this));
            triggers = this.filterTriggersPost(triggers);
            triggers = this.sortTriggers(triggers);

            // Limit triggers number
            triggers = triggers.slice(0, this.panel.limit || PANEL_DEFAULTS.limit);

            this.triggerList = triggers;
            this.getCurrentTriggersPage();

            this.$timeout(function () {
              _get(TriggerPanelCtrl.prototype.__proto__ || Object.getPrototypeOf(TriggerPanelCtrl.prototype), 'render', _this4).call(_this4, _this4.triggerList);
            });
          }
        }, {
          key: 'getTriggers',
          value: function getTriggers() {
            var _this5 = this;

            var promises = _.map(this.panel.datasources, function (ds) {
              return _this5.datasourceSrv.get(ds).then(function (datasource) {
                var zabbix = datasource.zabbix;
                var showEvents = _this5.panel.showEvents.value;
                var triggerFilter = _this5.panel.targets[ds];

                // Replace template variables
                var groupFilter = datasource.replaceTemplateVars(triggerFilter.group.filter);
                var hostFilter = datasource.replaceTemplateVars(triggerFilter.host.filter);
                var appFilter = datasource.replaceTemplateVars(triggerFilter.application.filter);

                var triggersOptions = {
                  showTriggers: showEvents
                };

                return zabbix.getTriggers(groupFilter, hostFilter, appFilter, triggersOptions);
              }).then(function (triggers) {
                return _this5.getAcknowledges(triggers, ds);
              }).then(function (triggers) {
                return _this5.setMaintenanceStatus(triggers);
              }).then(function (triggers) {
                return _this5.filterTriggersPre(triggers, ds);
              }).then(function (triggers) {
                return _this5.addTriggerDataSource(triggers, ds);
              });
            });

            return Promise.all(promises).then(function (results) {
              return _.flatten(results);
            });
          }
        }, {
          key: 'getAcknowledges',
          value: function getAcknowledges(triggerList, ds) {
            var _this6 = this;

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
                  trigger.acknowledges = _.map(event.acknowledges, _this6.formatAcknowledge.bind(_this6));
                }

                if (!trigger.lastEvent.eventid) {
                  trigger.lastEvent = null;
                }
              });

              return triggerList;
            });
          }
        }, {
          key: 'formatAcknowledge',
          value: function formatAcknowledge(ack) {
            var timestamp = moment.unix(ack.clock);
            if (this.panel.customLastChangeFormat) {
              ack.time = timestamp.format(this.panel.lastChangeFormat);
            } else {
              ack.time = timestamp.format(this.defaultTimeFormat);
            }
            ack.user = ack.alias || '';
            if (ack.name || ack.surname) {
              var fullName = (ack.name || '') + ' ' + (ack.surname || '');
              ack.user += ' (' + fullName + ')';
            }
            return ack;
          }
        }, {
          key: 'filterTriggersPre',
          value: function filterTriggersPre(triggerList, ds) {
            // Filter triggers by description
            var triggerFilter = this.panel.targets[ds].trigger.filter;
            triggerFilter = this.datasources[ds].replaceTemplateVars(triggerFilter);
            if (triggerFilter) {
              triggerList = filterTriggers(triggerList, triggerFilter);
            }

            // Filter by tags
            var target = this.panel.targets[ds];
            if (target.tags.filter) {
              var tagsFilter = this.datasources[ds].replaceTemplateVars(target.tags.filter);
              // replaceTemplateVars() builds regex-like string, so we should trim it.
              tagsFilter = tagsFilter.replace('/^', '').replace('$/', '');
              var tags = this.parseTags(tagsFilter);
              triggerList = _.filter(triggerList, function (trigger) {
                return _.every(tags, function (tag) {
                  return _.find(trigger.tags, { tag: tag.tag, value: tag.value });
                });
              });
            }

            return triggerList;
          }
        }, {
          key: 'filterTriggersPost',
          value: function filterTriggersPost(triggers) {
            var _this7 = this;

            var triggerList = _.cloneDeep(triggers);

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

            // Filter by maintenance status
            if (!this.panel.hostsInMaintenance) {
              triggerList = _.filter(triggerList, function (trigger) {
                return trigger.maintenance === false;
              });
            }

            // Filter triggers by severity
            triggerList = _.filter(triggerList, function (trigger) {
              return _this7.panel.triggerSeverity[trigger.priority].show;
            });

            return triggerList;
          }
        }, {
          key: 'setMaintenanceStatus',
          value: function setMaintenanceStatus(triggers) {
            _.each(triggers, function (trigger) {
              var maintenance_status = _.some(trigger.hosts, function (host) {
                return host.maintenance_status === '1';
              });
              trigger.maintenance = maintenance_status;
            });
            return triggers;
          }
        }, {
          key: 'addTriggerDataSource',
          value: function addTriggerDataSource(triggers, ds) {
            _.each(triggers, function (trigger) {
              trigger.datasource = ds;
            });
            return triggers;
          }
        }, {
          key: 'sortTriggers',
          value: function sortTriggers(triggerList) {
            if (this.panel.sortTriggersBy.value === 'priority') {
              triggerList = _.orderBy(triggerList, ['priority', 'lastchangeUnix', 'triggerid'], ['desc', 'desc', 'desc']);
            } else {
              triggerList = _.orderBy(triggerList, ['lastchangeUnix', 'priority', 'triggerid'], ['desc', 'desc', 'desc']);
            }
            return triggerList;
          }
        }, {
          key: 'formatTrigger',
          value: function formatTrigger(zabbixTrigger) {
            var trigger = _.cloneDeep(zabbixTrigger);
            var triggerObj = trigger;

            // Set host that the trigger belongs
            if (trigger.hosts && trigger.hosts.length) {
              triggerObj.host = trigger.hosts[0].name;
              triggerObj.hostTechName = trigger.hosts[0].host;
            }

            // Set tags if present
            if (trigger.tags && trigger.tags.length === 0) {
              trigger.tags = null;
            }

            // Handle multi-line description
            if (trigger.comments) {
              trigger.comments = trigger.comments.replace('\n', '<br>');
            }

            // Format last change and age
            trigger.lastchangeUnix = Number(trigger.lastchange);
            triggerObj = this.setTriggerLastChange(triggerObj);
            triggerObj = this.setTriggerSeverity(triggerObj);
            return triggerObj;
          }
        }, {
          key: 'updateTriggerFormat',
          value: function updateTriggerFormat(trigger) {
            trigger = this.setTriggerLastChange(trigger);
            trigger = this.setTriggerSeverity(trigger);
            return trigger;
          }
        }, {
          key: 'setTriggerSeverity',
          value: function setTriggerSeverity(trigger) {
            if (trigger.value === '1') {
              // Problem state
              trigger.color = this.panel.triggerSeverity[trigger.priority].color;
            } else {
              // OK state
              trigger.color = this.panel.okEventColor;
            }
            trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;

            // Mark acknowledged triggers with different color
            if (this.panel.markAckEvents && trigger.acknowledges && trigger.acknowledges.length) {
              trigger.color = this.panel.ackEventColor;
            }

            return trigger;
          }
        }, {
          key: 'setTriggerLastChange',
          value: function setTriggerLastChange(trigger) {
            if (!trigger.lastchangeUnix) {
              trigger.lastchange = "";
              trigger.age = "";
              return trigger;
            }

            var timestamp = moment.unix(trigger.lastchangeUnix);
            if (this.panel.customLastChangeFormat) {
              // User defined format
              trigger.lastchange = timestamp.format(this.panel.lastChangeFormat);
            } else {
              trigger.lastchange = timestamp.format(this.defaultTimeFormat);
            }
            trigger.age = timestamp.fromNow(true);
            return trigger;
          }
        }, {
          key: 'parseTags',
          value: function parseTags(tagStr) {
            if (!tagStr) {
              return [];
            }

            var tags = _.map(tagStr.split(','), function (tag) {
              return tag.trim();
            });
            tags = _.map(tags, function (tag) {
              var tagParts = tag.split(':');
              return { tag: tagParts[0].trim(), value: tagParts[1].trim() };
            });
            return tags;
          }
        }, {
          key: 'tagsToString',
          value: function tagsToString(tags) {
            return _.map(tags, function (tag) {
              return tag.tag + ':' + tag.value;
            }).join(', ');
          }
        }, {
          key: 'addTagFilter',
          value: function addTagFilter(tag, ds) {
            var tagFilter = this.panel.targets[ds].tags.filter;
            var targetTags = this.parseTags(tagFilter);
            var newTag = { tag: tag.tag, value: tag.value };
            targetTags.push(newTag);
            targetTags = _.uniqWith(targetTags, _.isEqual);
            var newFilter = this.tagsToString(targetTags);
            this.panel.targets[ds].tags.filter = newFilter;
            this.refresh();
          }
        }, {
          key: 'switchComment',
          value: function switchComment(trigger) {
            trigger.showComment = !trigger.showComment;
          }
        }, {
          key: 'acknowledgeTrigger',
          value: function acknowledgeTrigger(trigger, message) {
            var _this8 = this;

            var eventid = trigger.lastEvent ? trigger.lastEvent.eventid : null;
            var grafana_user = this.contextSrv.user.name;
            var ack_message = grafana_user + ' (Grafana): ' + message;
            return this.datasourceSrv.get(trigger.datasource).then(function (datasource) {
              var userIsEditor = _this8.contextSrv.isEditor || _this8.contextSrv.isGrafanaAdmin;
              if (datasource.disableReadOnlyUsersAck && !userIsEditor) {
                return Promise.reject({ message: 'You have no permissions to acknowledge events.' });
              }
              if (eventid) {
                return datasource.zabbix.zabbixAPI.acknowledgeEvent(eventid, ack_message);
              } else {
                return Promise.reject({ message: 'Trigger has no events. Nothing to acknowledge.' });
              }
            }).then(this.onRefresh.bind(this)).catch(function (err) {
              _this8.error = err.message || "Acknowledge Error";
              _this8.events.emit('data-error', err);
              console.log('Panel data error:', err);
            });
          }
        }, {
          key: 'getCurrentTriggersPage',
          value: function getCurrentTriggersPage() {
            var pageSize = this.panel.pageSize || PANEL_DEFAULTS.pageSize;
            var startPos = this.pageIndex * pageSize;
            var endPos = Math.min(startPos + pageSize, this.triggerList.length);
            this.currentTriggersPage = this.triggerList.slice(startPos, endPos);
            return this.currentTriggersPage;
          }
        }, {
          key: 'formatHostName',
          value: function formatHostName(trigger) {
            var host = "";
            if (this.panel.hostField && this.panel.hostTechNameField) {
              host = trigger.host + ' (' + trigger.hostTechName + ')';
            } else if (this.panel.hostField || this.panel.hostTechNameField) {
              host = this.panel.hostField ? trigger.host : trigger.hostTechName;
            }

            return host;
          }
        }, {
          key: 'formatHostGroups',
          value: function formatHostGroups(trigger) {
            var groupNames = "";
            if (this.panel.hostGroups) {
              var groups = _.map(trigger.groups, 'name').join(', ');
              groupNames += '[ ' + groups + ' ]';
            }

            return groupNames;
          }
        }, {
          key: 'getAlertIconClass',
          value: function getAlertIconClass(trigger) {
            var iconClass = '';
            if (trigger.value === '1') {
              if (trigger.priority >= 3) {
                iconClass = 'icon-gf-critical';
              } else {
                iconClass = 'icon-gf-warning';
              }
            } else {
              iconClass = 'icon-gf-online';
            }

            if (this.panel.highlightNewEvents && this.isNewTrigger(trigger)) {
              iconClass += ' zabbix-trigger--blinked';
            }
            return iconClass;
          }
        }, {
          key: 'getAlertIconClassBySeverity',
          value: function getAlertIconClassBySeverity(triggerSeverity) {
            var iconClass = 'icon-gf-warning';
            if (triggerSeverity.priority >= 3) {
              iconClass = 'icon-gf-critical';
            }
            return iconClass;
          }
        }, {
          key: 'getAlertStateClass',
          value: function getAlertStateClass(trigger) {
            var statusClass = '';

            if (trigger.value === '1') {
              statusClass = 'alert-state-critical';
            } else {
              statusClass = 'alert-state-ok';
            }

            if (this.panel.highlightNewEvents && this.isNewTrigger(trigger)) {
              statusClass += ' zabbix-trigger--blinked';
            }

            return statusClass;
          }
        }, {
          key: 'getBackground',
          value: function getBackground(trigger) {
            var mainColor = trigger.color;
            var secondColor = this.contextSrv.user.lightTheme ? '#dde4ed' : '#262628';
            if (this.contextSrv.user.lightTheme) {
              return 'linear-gradient(135deg, ' + secondColor + ', ' + mainColor + ')';
            }
            return 'linear-gradient(135deg, ' + mainColor + ', ' + secondColor + ')';
          }
        }, {
          key: 'isNewTrigger',
          value: function isNewTrigger(trigger) {
            try {
              var highlightIntervalMs = utils.parseInterval(this.panel.highlightNewerThan || PANEL_DEFAULTS.highlightNewerThan);
              var durationSec = Date.now() - trigger.lastchangeUnix * 1000;
              return durationSec < highlightIntervalMs;
            } catch (e) {
              return false;
            }
          }
        }, {
          key: 'link',
          value: function link(scope, elem, attrs, ctrl) {
            var panel = ctrl.panel;
            var pageCount = 0;
            var triggerList = ctrl.triggerList;

            scope.$watchGroup(['ctrl.currentTriggersPage', 'ctrl.triggerList'], renderPanel);
            elem.on('click', '.triggers-panel-page-link', switchPage);
            ctrl.events.on('render', function (renderData) {
              triggerList = renderData || triggerList;
              renderPanel();
            });

            function getContentHeight() {
              var panelHeight = ctrl.height;
              if (pageCount > 1) {
                panelHeight -= 36;
              }
              return panelHeight + 'px';
            }

            function switchPage(e) {
              var el = $(e.currentTarget);
              ctrl.pageIndex = parseInt(el.text(), 10) - 1;

              var pageSize = panel.pageSize || 10;
              var startPos = ctrl.pageIndex * pageSize;
              var endPos = Math.min(startPos + pageSize, triggerList.length);
              ctrl.currentTriggersPage = triggerList.slice(startPos, endPos);

              scope.$apply(function () {
                renderPanel();
              });
            }

            function appendPaginationControls(footerElem) {
              footerElem.empty();

              var pageSize = panel.pageSize || 5;
              pageCount = Math.ceil(triggerList.length / pageSize);
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

            function setFontSize() {
              var fontSize = parseInt(panel.fontSize.slice(0, panel.fontSize.length - 1));
              var triggerCardElem = elem.find('.alert-rule-item');
              if (fontSize && fontSize !== 100) {
                triggerCardElem.find('.alert-rule-item__icon').css({
                  'font-size': fontSize + '%',
                  'margin': fontSize / 100 * 6 + 'px'
                });
                triggerCardElem.find('.alert-rule-item__name').css({ 'font-size': fontSize + '%' });
                triggerCardElem.find('.alert-rule-item__text').css({ 'font-size': fontSize * 0.8 + '%' });
                triggerCardElem.find('.zbx-trigger-lastchange').css({ 'font-size': fontSize * 0.8 + '%' });
                triggerCardElem.find('.zbx-tag').css({ 'font-size': fontSize * 0.6 + '%' });
                triggerCardElem.find('.zbx-tag').css({ 'line-height': fontSize / 100 * 16 + 'px' });
              } else {
                // remove css
                triggerCardElem.find('.alert-rule-item__icon').css({ 'font-size': '', 'margin-right': '' });
                triggerCardElem.find('.alert-rule-item__name').css({ 'font-size': '' });
                triggerCardElem.find('.alert-rule-item__text').css({ 'font-size': '' });
                triggerCardElem.find('.zbx-trigger-lastchange').css({ 'font-size': '' });
                triggerCardElem.find('.zbx-tag').css({ 'font-size': '' });
                triggerCardElem.find('.zbx-tag').css({ 'line-height': '' });
              }
            }

            function renderPanel() {
              var rootElem = elem.find('.triggers-panel-scroll');
              var footerElem = elem.find('.triggers-panel-footer');
              appendPaginationControls(footerElem);
              rootElem.css({ 'max-height': getContentHeight() });
              rootElem.css({ 'height': getContentHeight() });
              setFontSize();
              ctrl.renderingCompleted();
            }

            var unbindDestroy = scope.$on('$destroy', function () {
              elem.off('click', '.triggers-panel-page-link');
              unbindDestroy();
            });
          }
        }]);

        return TriggerPanelCtrl;
      }(PanelCtrl));

      _export('TriggerPanelCtrl', TriggerPanelCtrl);

      TriggerPanelCtrl.templateUrl = 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/partials/module.html';
    }
  };
});
//# sourceMappingURL=triggers_panel_ctrl.js.map
