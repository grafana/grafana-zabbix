import angular from 'angular';
import $ from 'jquery';

System.config({
  paths: {
    tether: System.getConfig().baseURL + "plugins/alexanderzobnin-zabbix-app/vendor/npm/tether.min.js"
  }
});

let Drop;
System.amdRequire(["plugins/alexanderzobnin-zabbix-app/vendor/npm/drop.min.js"], (drop) => {
  Drop = drop;
});

/** @ngInject */
angular
  .module('grafana.directives')
  .directive('ackTooltip', function($sanitize, $compile) {
    let buttonTemplate = '<a bs-tooltip="\'Acknowledges ({{trigger.acknowledges.length}})\'"' +
                          '<i ng-class="' +
                            "{'fa fa-comments': trigger.acknowledges.length, " +
                            "'fa fa-comments-o': !trigger.acknowledges.length, " +
                          '}"></i></a>';

    return {
      scope: {
        ack: "=",
        trigger: "=",
        onAck: "=",
        context: "="
      },
      link: function(scope, element) {
        let acknowledges = scope.ack;
        let $button = $(buttonTemplate);
        $button.appendTo(element);

        $button.click(function() {
          let tooltip = '<div>';

          if (acknowledges && acknowledges.length) {
            tooltip += '<table class="table"><thead><tr>' +
                        '<th class="ack-time">Time</th>' +
                        '<th class="ack-user">User</th>' +
                        '<th class="ack-comments">Comments</th>' +
                        '</tr></thead><tbody>';
            for (let ack of acknowledges) {
              tooltip += '<tr><td>' + ack.time + '</td>' +
                         '<td>' + ack.user + '</td>' +
                         '<td>' + ack.message + '</td></tr>';
            }
            tooltip += '</tbody></table>';
          } else {
            tooltip += 'Add acknowledge';
          }

          let addAckButtonTemplate = '<div class="ack-add-button">' +
                                       '<button id="add-acknowledge-btn"' +
                                         'class="btn btn-mini btn-inverse gf-form-button">' +
                                         '<i class="fa fa-plus"></i>' +
                                       '</button></div>';
          tooltip += addAckButtonTemplate;
          tooltip += '</div>';

          let drop = new Drop({
            target: element[0],
            content: tooltip,
            position: "bottom left",
            classes: 'drop-popover ack-tooltip',
            openOn: 'hover',
            hoverCloseDelay: 500,
            tetherOptions: {
              constraints: [{to: 'window', pin: true, attachment: "both"}]
            }
          });

          drop.open();
          drop.on('close', closeDrop);

          $('#add-acknowledge-btn').on('click', onAddAckButtonClick);

          function onAddAckButtonClick() {
            let inputTemplate = '<div class="ack-input-group">' +
                                  '<input type="text" id="ack-message">' +
                                  '<button id="send-ack-button"' +
                                    'class="btn btn-mini btn-inverse gf-form-button">' +
                                    'Acknowledge </button>' +
                                  '<button id="cancel-ack-button"' +
                                    'class="btn btn-mini btn-inverse gf-form-button">' +
                                    'Cancel' +
                                  '</button></input></div>';

            let $input = $(inputTemplate);
            let $addAckButton = $('.ack-tooltip .ack-add-button');
            $addAckButton.replaceWith($input);
            $('.ack-tooltip #cancel-ack-button').on('click', onAckCancelButtonClick);
            $('.ack-tooltip #send-ack-button').on('click', onAckSendlButtonClick);
          }

          function onAckCancelButtonClick() {
            $('.ack-tooltip .ack-input-group').replaceWith(addAckButtonTemplate);
            $('#add-acknowledge-btn').on('click', onAddAckButtonClick);
          }

          function onAckSendlButtonClick() {
            let message = $('.ack-tooltip #ack-message')[0].value;
            let onAck = scope.onAck.bind(scope.context);
            onAck(scope.trigger, message).then(() => {
              closeDrop();
            });
          }

          function closeDrop() {
            setTimeout(function() {
              try {
                drop.destroy();
              } catch (err) {
                console.log('drop.destroy() error: ', err.message);
              }
            });
          }

        });

        $compile(element.contents())(scope);
      }
    };
  });
