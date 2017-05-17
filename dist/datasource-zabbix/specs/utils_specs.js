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
        }
      ];

      _.each(test_cases, test_case => {
        let expandedName = utils.expandItemName(test_case.name, test_case.key);
        expect(expandedName).to.equal(test_case.expected);
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
        expect(expandedName).to.equal(test_case.expected);
      });
      done();
    });
  });
});
