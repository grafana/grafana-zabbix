import { calcMacroFunction, parseFunctionCall } from './macroFunctions';
import { convertUnitsS, formatFloat, formatHistoryValue } from './zabbixFormat';
import cases from './testdata/zabbixParity.json';

// Expected values were produced by the Zabbix frontend PHP code itself (formatHistoryValue,
// formatFloat, convertUnitsS, CMacroFunction::calcMacrofunc, C10FunctionParser) on
// Zabbix 7.0.32, 7.4.16 and 8.0.0 with the UTC time zone, the one these tests run in.
// `zabbix80` is only present where 8.0 differs from 7.x.
const optionNames: Record<string, string> = {
  decimals_exact: 'decimalsExact',
  small_scientific: 'smallScientific',
  zero_as_zero: 'zeroAsZero',
};

function run(c: any, zabbix8: boolean): unknown {
  switch (c.fn) {
    case 'formatHistoryValue':
      return formatHistoryValue(c.value, { ...c.item, value_type: String(c.item.value_type) });
    case 'formatFloat':
      return formatFloat(
        Number(c.value),
        Object.fromEntries(Object.entries(c.options).map(([k, v]) => [optionNames[k] ?? k, v]))
      );
    case 'convertUnitsS':
      return convertUnitsS(c.value);
    case 'macrofunc':
      return calcMacroFunction(c.value, { name: c.function, params: c.parameters }, { xmlxpath: zabbix8 });
    case 'parse': {
      const parsed = parseFunctionCall(c.value, 0);
      return parsed && parsed.length === c.value.length ? [parsed.call.name, parsed.call.params] : null;
    }
  }
  throw new Error(`unknown case ${c.fn}`);
}

describe('parity with the Zabbix frontend', () => {
  const label = (c: any) => `${c.fn}${c.function ? ':' + c.function : ''} ${JSON.stringify(c.value)}`;

  it.each((cases as any[]).map((c) => [label(c), c]))('Zabbix 7.x: %s', (_, c: any) => {
    expect(run(c, false)).toEqual(c.zabbix70);
  });

  it.each((cases as any[]).filter((c) => 'zabbix80' in c).map((c) => [label(c), c]))('Zabbix 8.0: %s', (_, c: any) => {
    expect(run(c, true)).toEqual(c.zabbix80);
  });
});
