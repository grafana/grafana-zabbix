import coreModule from 'grafana/app/core/core_module';
import _ from 'lodash';
import $ from 'jquery';
import { react2AngularDirective } from './react2angular';
import { FunctionEditor } from './components/FunctionEditor/FunctionEditor';

/** @ngInject */
export function zabbixFunctionEditor($compile, templateSrv) {
  const funcSpanTemplate = `
    <zbx-function-editor
      func="func"
      onRemove="ctrl.handleRemoveFunction"
      onMoveLeft="ctrl.handleMoveLeft"
      onMoveRight="ctrl.handleMoveRight">
    </zbx-function-editor>
    <span>(</span>
  `;
  const paramTemplate =
    '<input type="text" style="display:none"' + ' class="input-small tight-form-func-param"></input>';

  return {
    restrict: 'A',
    link: function postLink($scope, elem) {
      const $funcLink = $(funcSpanTemplate);
      const ctrl = $scope.ctrl;
      const func = $scope.func;
      let scheduledRelink = false;
      let paramCountAtLink = 0;
      let cancelBlur = null;

      ctrl.handleRemoveFunction = (func) => {
        ctrl.removeFunction(func);
      };

      ctrl.handleMoveLeft = (func) => {
        ctrl.moveFunction(func, -1);
      };

      ctrl.handleMoveRight = (func) => {
        ctrl.moveFunction(func, 1);
      };

      function clickFuncParam(this: any, paramIndex) {
        /*jshint validthis:true */

        const $link = $(this);
        const $comma = $link.prev('.comma');
        const $input = $link.next();

        $input.val(func.params[paramIndex]);

        $comma.removeClass('query-part__last');
        $link.hide();
        $input.show();
        $input.focus();
        $input.select();

        const typeahead = $input.data('typeahead');
        if (typeahead) {
          $input.val('');
          typeahead.lookup();
        }
      }

      function scheduledRelinkIfNeeded() {
        if (paramCountAtLink === func.params.length) {
          return;
        }

        if (!scheduledRelink) {
          scheduledRelink = true;
          setTimeout(() => {
            relink();
            scheduledRelink = false;
          }, 200);
        }
      }

      function paramDef(index) {
        if (index < func.def.params.length) {
          return func.def.params[index];
        }
        if ((_.last(func.def.params) as any).multiple) {
          return _.assign({}, _.last(func.def.params), { optional: true });
        }
        return {};
      }

      function switchToLink(inputElem, paramIndex) {
        /*jshint validthis:true */
        const $input = $(inputElem);

        clearTimeout(cancelBlur);
        cancelBlur = null;

        const $link = $input.prev();
        const $comma = $link.prev('.comma');
        const newValue = $input.val();

        // remove optional empty params
        if (newValue !== '' || paramDef(paramIndex).optional) {
          func.updateParam(newValue, paramIndex);
          $link.html(newValue ? templateSrv.highlightVariablesAsHtml(newValue) : '&nbsp;');
        }

        scheduledRelinkIfNeeded();

        $scope.$apply(() => {
          ctrl.targetChanged();
        });

        if ($link.hasClass('query-part__last') && newValue === '') {
          $comma.addClass('query-part__last');
        } else {
          $link.removeClass('query-part__last');
        }

        $input.hide();
        $link.show();
      }

      // this = input element
      function inputBlur(this: any, paramIndex) {
        /*jshint validthis:true */
        const inputElem = this;
        // happens long before the click event on the typeahead options
        // need to have long delay because the blur
        cancelBlur = setTimeout(() => {
          switchToLink(inputElem, paramIndex);
        }, 200);
      }

      function inputKeyPress(this: any, paramIndex, e) {
        /*jshint validthis:true */
        if (e.which === 13) {
          $(this).blur();
        }
      }

      function inputKeyDown(this: any) {
        /*jshint validthis:true */
        this.style.width = (3 + this.value.length) * 8 + 'px';
      }

      function addTypeahead($input, paramIndex) {
        $input.attr('data-provide', 'typeahead');

        let options = paramDef(paramIndex).options;
        if (paramDef(paramIndex).type === 'int' || paramDef(paramIndex).type === 'float') {
          options = _.map(options, (val) => {
            return val.toString();
          });
        }

        $input.typeahead({
          source: options,
          minLength: 0,
          items: 20,
          updater: (value) => {
            $input.val(value);
            switchToLink($input[0], paramIndex);
            return value;
          },
        });

        const typeahead = $input.data('typeahead');
        typeahead.lookup = function () {
          this.query = this.$element.val() || '';
          return this.process(this.source);
        };
      }

      function addElementsAndCompile() {
        $funcLink.appendTo(elem);

        const defParams: any = _.clone(func.def.params);
        const lastParam: any = _.last(func.def.params);

        while (func.params.length >= defParams.length && lastParam && lastParam.multiple) {
          defParams.push(_.assign({}, lastParam, { optional: true }));
        }

        _.each(defParams, (param: any, index: number) => {
          if (param.optional && func.params.length < index) {
            return false;
          }

          let paramValue = templateSrv.highlightVariablesAsHtml(func.params[index]);
          const hasValue = paramValue !== null && paramValue !== undefined;

          const last = index >= func.params.length - 1 && param.optional && !hasValue;
          if (last && param.multiple) {
            paramValue = '+';
          }

          if (index > 0) {
            $('<span class="comma' + (last ? ' query-part__last' : '') + '">,&nbsp; </span>').appendTo(elem);
          }

          const $paramLink = $(
            '<a ng-click="" class="graphite-func-param-link' +
              (last ? ' query-part__last' : '') +
              '">' +
              (hasValue ? paramValue : '&nbsp;') +
              '</a>'
          );
          const $input = $(paramTemplate);
          $input.attr('placeholder', param.name);

          paramCountAtLink++;

          $paramLink.appendTo(elem);
          $input.appendTo(elem);

          $input.blur(_.partial(inputBlur, index));
          $input.keyup(inputKeyDown);
          $input.keypress(_.partial(inputKeyPress, index));
          $paramLink.click(_.partial(clickFuncParam, index));

          if (param.options) {
            addTypeahead($input, index);
          }

          return true;
        });

        $('<span>)</span>').appendTo(elem);

        $compile(elem.contents())($scope);
      }

      function ifJustAddedFocusFirstParam() {
        if ($scope.func.added) {
          $scope.func.added = false;
          setTimeout(() => {
            elem.find('.graphite-func-param-link').first().click();
          }, 10);
        }
      }

      function relink() {
        elem.children().remove();
        addElementsAndCompile();
        ifJustAddedFocusFirstParam();
      }

      relink();
    },
  };
}

coreModule.directive('zabbixFunctionEditor', zabbixFunctionEditor);

react2AngularDirective('zbxFunctionEditor', FunctionEditor, ['func', 'onRemove', 'onMoveLeft', 'onMoveRight']);
