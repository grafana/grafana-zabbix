import _ from 'lodash';
import * as utils from '../utils';

describe('Utils', () => {

  describe('expandItemName()', () => {

    it('should properly expand unquoted params', (done) => {
      let test_cases = [
        {
          name: `CPU $2 time`,
          key: `system.cpu.util[,user,avg1]`,
          expected: "CPU user time"
        },
        {
          name: `CPU $2 time - $3`,
          key: `system.cpu.util[,system,avg1]`,
          expected: "CPU system time - avg1"
        },
        {
          name: `CPU - $1 - $2 - $3`,
          key: `system.cpu.util[,system,avg1]`,
          expected: "CPU -  - system - avg1"
        }
      ];

      _.each(test_cases, test_case => {
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
          expected: "CPU user time"
        },
        {
          name: `CPU $1 time`,
          key: `system.cpu.util["type=user,value=avg","user"]`,
          expected: "CPU type=user,value=avg time"
        },
        {
          name: `CPU $1 time $3`,
          key: `system.cpu.util["type=user,value=avg",,"user"]`,
          expected: "CPU type=user,value=avg time user"
        },
        {
          name: `CPU $1 $2 $3`,
          key: `system.cpu.util["type=user,value=avg",time,"user"]`,
          expected: "CPU type=user,value=avg time user"
        }
      ];

      _.each(test_cases, test_case => {
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
          expected: "CPU user,system - avg1 time"
        },
        {
          name: `CPU $2 - $3 time`,
          key: `system.cpu.util[,["user,system",iowait],avg1]`,
          expected: `CPU "user,system",iowait - avg1 time`
        },
        {
          name: `CPU - $2 - $3 - $4`,
          key: `system.cpu.util[,[],["user,system",iowait],avg1]`,
          expected: `CPU -  - "user,system",iowait - avg1`
        }
      ];

      _.each(test_cases, test_case => {
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
          query: `/alu/./tw-(nyc|que|brx|dwt|brk)-sta_(\w|\d)*-alu-[0-9{2}/`,
          expected: ['/alu/', '/tw-(nyc|que|brx|dwt|brk)-sta_(\w|\d)*-alu-[0-9{2}/']
        },
        {
          query: `a.b.c.d`,
          expected: ['a', 'b', 'c', 'd']
        }
      ];

      _.each(test_cases, test_case => {
        let splitQuery = utils.splitTemplateQuery(test_case.query);
        expect(splitQuery).toEqual(test_case.expected);
      });
      done();
    });

    it('should properly split query', (done) => {
      let test_cases = [
        {
          query: `{alu}{/tw-(nyc|que|brx|dwt|brk)-sta_(\w|\d)*-alu-[0-9]*/}`,
          expected: ['alu', '/tw-(nyc|que|brx|dwt|brk)-sta_(\w|\d)*-alu-[0-9]*/']
        },
        {
          query: `{alu}{/tw-(nyc|que|brx|dwt|brk)-sta_(\w|\d)*-alu-[0-9]{2}/}`,
          expected: ['alu', '/tw-(nyc|que|brx|dwt|brk)-sta_(\w|\d)*-alu-[0-9]{2}/']
        },
        {
          query: `{a}{b}{c}{d}`,
          expected: ['a', 'b', 'c', 'd']
        },
        {
          query: `{a}{b.c.d}`,
          expected: ['a', 'b.c.d']
        }
      ];

      _.each(test_cases, test_case => {
        let splitQuery = utils.splitTemplateQuery(test_case.query);
        expect(splitQuery).toEqual(test_case.expected);
      });
      done();
    });
  });
});
