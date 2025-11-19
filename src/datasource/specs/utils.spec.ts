import _ from 'lodash';
import * as utils from '../utils';
import { replaceTemplateVars, zabbixTemplateFormat } from '../utils';

describe('Utils', () => {
  describe('expandItemName()', () => {
    it('should properly expand unquoted params', (done) => {
      let test_cases = [
        {
          name: `CPU $2 time`,
          key: `system.cpu.util[,user,avg1]`,
          expected: 'CPU user time',
        },
        {
          name: `CPU $2 time - $3`,
          key: `system.cpu.util[,system,avg1]`,
          expected: 'CPU system time - avg1',
        },
        {
          name: `CPU - $1 - $2 - $3`,
          key: `system.cpu.util[,system,avg1]`,
          expected: 'CPU -  - system - avg1',
        },
      ];

      _.each(test_cases, (test_case) => {
        let expandedName = utils.expandItemName(test_case.name, test_case.key);
        expect(expandedName).toBe(test_case.expected);
      });
      done();
    });

    it('should properly expand quoted params with commas', (done) => {
      let test_cases = [
        {
          name: `CPU $2 time`,
          key: `system.cpu.util["type=user,value=avg",user]`,
          expected: 'CPU user time',
        },
        {
          name: `CPU $1 time`,
          key: `system.cpu.util["type=user,value=avg","user"]`,
          expected: 'CPU type=user,value=avg time',
        },
        {
          name: `CPU $1 time $3`,
          key: `system.cpu.util["type=user,value=avg",,"user"]`,
          expected: 'CPU type=user,value=avg time user',
        },
        {
          name: `CPU $1 $2 $3`,
          key: `system.cpu.util["type=user,value=avg",time,"user"]`,
          expected: 'CPU type=user,value=avg time user',
        },
      ];

      _.each(test_cases, (test_case) => {
        let expandedName = utils.expandItemName(test_case.name, test_case.key);
        expect(expandedName).toBe(test_case.expected);
      });
      done();
    });

    it('should properly expand array params', (done) => {
      let test_cases = [
        {
          name: `CPU $2 - $3 time`,
          key: `system.cpu.util[,[user,system],avg1]`,
          expected: 'CPU user,system - avg1 time',
        },
        {
          name: `CPU $2 - $3 time`,
          key: `system.cpu.util[,["user,system",iowait],avg1]`,
          expected: `CPU "user,system",iowait - avg1 time`,
        },
        {
          name: `CPU - $2 - $3 - $4`,
          key: `system.cpu.util[,[],["user,system",iowait],avg1]`,
          expected: `CPU -  - "user,system",iowait - avg1`,
        },
      ];

      _.each(test_cases, (test_case) => {
        let expandedName = utils.expandItemName(test_case.name, test_case.key);
        expect(expandedName).toBe(test_case.expected);
      });
      done();
    });
  });

  describe('splitTemplateQuery()', () => {
    // Backward compatibility
    it('should properly split query in old format', (done) => {
      let test_cases = [
        {
          query: `/alu/./tw-(nyc|que|brx|dwt|brk)-sta_(\\w|\\d)*-alu-[0-9{2}/`,
          expected: ['/alu/', '/tw-(nyc|que|brx|dwt|brk)-sta_(\\w|\\d)*-alu-[0-9{2}/'],
        },
        {
          query: `a.b.c.d`,
          expected: ['a', 'b', 'c', 'd'],
        },
      ];

      _.each(test_cases, (test_case) => {
        let splitQuery = utils.splitTemplateQuery(test_case.query);
        expect(splitQuery).toEqual(test_case.expected);
      });
      done();
    });

    it('should properly split query', (done) => {
      let test_cases = [
        {
          query: `{alu}{/tw-(nyc|que|brx|dwt|brk)-sta_(\\w|\\d)*-alu-[0-9]*/}`,
          expected: ['alu', '/tw-(nyc|que|brx|dwt|brk)-sta_(\\w|\\d)*-alu-[0-9]*/'],
        },
        {
          query: `{alu}{/tw-(nyc|que|brx|dwt|brk)-sta_(\\w|\\d)*-alu-[0-9]{2}/}`,
          expected: ['alu', '/tw-(nyc|que|brx|dwt|brk)-sta_(\\w|\\d)*-alu-[0-9]{2}/'],
        },
        {
          query: `{a}{b}{c}{d}`,
          expected: ['a', 'b', 'c', 'd'],
        },
        {
          query: `{a}{b.c.d}`,
          expected: ['a', 'b.c.d'],
        },
      ];

      _.each(test_cases, (test_case) => {
        let splitQuery = utils.splitTemplateQuery(test_case.query);
        expect(splitQuery).toEqual(test_case.expected);
      });
      done();
    });
  });

  describe('getArrayDepth()', () => {
    it('should calculate proper array depth', () => {
      const test_cases = [
        {
          array: [],
          depth: 1,
        },
        {
          array: [1, 2, 3],
          depth: 1,
        },
        {
          array: [
            [1, 2],
            [3, 4],
          ],
          depth: 2,
        },
        {
          array: [
            [
              [1, 2],
              [3, 4],
            ],
            [
              [1, 2],
              [3, 4],
            ],
          ],
          depth: 3,
        },
      ];

      for (const test_case of test_cases) {
        expect(utils.getArrayDepth(test_case.array)).toBe(test_case.depth);
      }
    });
  });

  describe('replaceTemplateVars()', () => {
    function testReplacingVariable(target, varValue, expectedResult, done) {
      const templateSrv = {
        replace: jest.fn((target) => zabbixTemplateFormat(varValue)),
        getVariables: jest.fn(),
        containsTemplate: jest.fn(),
        updateTimeRange: jest.fn(),
      };

      let result = replaceTemplateVars(templateSrv, target, {});
      expect(result).toBe(expectedResult);
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
