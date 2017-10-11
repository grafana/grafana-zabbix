'use strict';

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

System.config({
  paths: {
    tether: System.getConfig().baseURL + "plugins/alexanderzobnin-zabbix-app/vendor/npm/tether.min.js"
  }
});

var Drop = void 0;
System.amdRequire(["plugins/alexanderzobnin-zabbix-app/vendor/npm/drop.min.js"], function (drop) {
  Drop = drop;
});

/** @ngInject */
_angular2.default.module('grafana.directives').directive('ackTooltip', function ($sanitize, $compile) {
  var buttonTemplate = '<a bs-tooltip="\'Acknowledges ({{trigger.acknowledges.length}})\'"' + '<i ng-class="' + "{'fa fa-comments': trigger.acknowledges.length, " + "'fa fa-comments-o': !trigger.acknowledges.length, " + '}"></i></a>';

  return {
    scope: {
      ack: "=",
      trigger: "=",
      onAck: "=",
      context: "="
    },
    link: function link(scope, element) {
      var acknowledges = scope.ack;
      var $button = (0, _jquery2.default)(buttonTemplate);
      $button.appendTo(element);

      $button.click(function () {
        var tooltip = '<div>';

        if (acknowledges && acknowledges.length) {
          tooltip += '<table class="table"><thead><tr>' + '<th class="ack-time">Time</th>' + '<th class="ack-user">User</th>' + '<th class="ack-comments">Comments</th>' + '</tr></thead><tbody>';
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = acknowledges[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var ack = _step.value;

              tooltip += '<tr><td>' + ack.time + '</td>' + '<td>' + ack.user + '</td>' + '<td>' + ack.message + '</td></tr>';
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

          tooltip += '</tbody></table>';
        } else {
          tooltip += 'Add acknowledge';
        }

        var addAckButtonTemplate = '<div class="ack-add-button">' + '<button id="add-acknowledge-btn"' + 'class="btn btn-mini btn-inverse gf-form-button">' + '<i class="fa fa-plus"></i>' + '</button></div>';
        tooltip += addAckButtonTemplate;
        tooltip += '</div>';

        var drop = new Drop({
          target: element[0],
          content: tooltip,
          position: "bottom left",
          classes: 'drop-popover ack-tooltip',
          openOn: 'hover',
          hoverCloseDelay: 500,
          tetherOptions: {
            constraints: [{ to: 'window', pin: true, attachment: "both" }]
          }
        });

        drop.open();
        drop.on('close', closeDrop);

        (0, _jquery2.default)('#add-acknowledge-btn').on('click', onAddAckButtonClick);

        function onAddAckButtonClick() {
          var inputTemplate = '<div class="ack-input-group">' + '<input type="text" id="ack-message">' + '<button id="send-ack-button"' + 'class="btn btn-mini btn-inverse gf-form-button">' + 'Acknowledge </button>' + '<button id="cancel-ack-button"' + 'class="btn btn-mini btn-inverse gf-form-button">' + 'Cancel' + '</button></input></div>';

          var $input = (0, _jquery2.default)(inputTemplate);
          var $addAckButton = (0, _jquery2.default)('.ack-tooltip .ack-add-button');
          $addAckButton.replaceWith($input);
          (0, _jquery2.default)('.ack-tooltip #cancel-ack-button').on('click', onAckCancelButtonClick);
          (0, _jquery2.default)('.ack-tooltip #send-ack-button').on('click', onAckSendlButtonClick);
        }

        function onAckCancelButtonClick() {
          (0, _jquery2.default)('.ack-tooltip .ack-input-group').replaceWith(addAckButtonTemplate);
          (0, _jquery2.default)('#add-acknowledge-btn').on('click', onAddAckButtonClick);
        }

        function onAckSendlButtonClick() {
          var message = (0, _jquery2.default)('.ack-tooltip #ack-message')[0].value;
          var onAck = scope.onAck.bind(scope.context);
          onAck(scope.trigger, message).then(function () {
            closeDrop();
          });
        }

        function closeDrop() {
          setTimeout(function () {
            drop.destroy();
          });
        }
      });

      $compile(element.contents())(scope);
    }
  };
});
