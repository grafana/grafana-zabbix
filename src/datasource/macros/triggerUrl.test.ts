import { expandTriggerUrl, functionIdsOf, TriggerUrlContext } from './triggerUrl';

// Tests run in UTC (jest.config.js).
const CLOCK = '1700000000'; // 2023-11-14 22:13:20 UTC

const web = { hostid: '10', host: 'web01', name: 'Web 01' };
const db = { hostid: '11', host: 'db01', name: 'DB 01' };

const problem = (url: string, overrides = {}) =>
  ({
    triggerid: '501',
    eventid: '900',
    timestamp: 0,
    url,
    hosts: [web, db],
    items: [],
    ...overrides,
  }) as any;

const ctx = (overrides: Partial<TriggerUrlContext> = {}): TriggerUrlContext => ({
  version: '7.0.0',
  now: Number(CLOCK) + 90061,
  // Expression "{7002}>0 and {7001}<5": function 1 reads item 602 (db01), function 2 item 601 (web01).
  functionItemIds: { '501': ['602', '601'] },
  itemsById: {
    '601': { itemid: '601', hostid: '10', value_type: '3', units: 'B', lastvalue: '1536', lastclock: CLOCK },
    '602': {
      itemid: '602',
      hostid: '11',
      value_type: '1',
      lastvalue: 'up',
      lastclock: CLOCK,
      valuemap: { mappings: [{ type: '0', value: 'up', newvalue: 'Running' }] },
    },
  },
  hostsById: {
    '10': {
      hostid: '10',
      interfaces: [
        { type: '3', main: '1', useip: '1', ip: '192.0.2.3', dns: '', port: '623' },
        { type: '1', main: '1', useip: '0', ip: '192.0.2.10', dns: 'web01.example', port: '10050' },
        { type: '1', main: '0', useip: '1', ip: '192.0.2.99', dns: '', port: '10050' },
      ],
    },
    '11': {
      hostid: '11',
      interfaces: [
        { type: '3', main: '1', useip: '1', ip: '192.0.2.30', dns: '', port: '623' },
        { type: '4', main: '1', useip: '1', ip: '192.0.2.40', dns: '', port: '12345' },
      ],
    },
  },
  ...overrides,
});

describe('functionIdsOf', () => {
  it('lists function references in order, repeats included, skipping strings', () => {
    expect(functionIdsOf('{7002}>0 and find("{9}") or {7001}<5 and {7002}=1')).toEqual(['7002', '7001', '7002']);
    expect(functionIdsOf('{$MACRO}>{12}')).toEqual(['12']);
  });
});

describe('expandTriggerUrl', () => {
  it('expands trigger and event IDs', () => {
    expect(expandTriggerUrl(problem('/t/{TRIGGER.ID}/e/{EVENT.ID}'), ctx())).toBe('/t/501/e/900');
  });

  it('maps {HOST.*N} to the host of the item read by the N-th function of the expression', () => {
    const url = '{HOST.HOST}|{HOST.HOST1}|{HOST.HOST2}|{HOST.NAME2}|{HOST.ID}|{HOST.HOST3}';
    expect(expandTriggerUrl(problem(url), ctx())).toBe('db01|db01|web01|Web 01|11|*UNKNOWN*');
  });

  it('takes interface macros from the main interface: agent, then SNMP, JMX, IPMI', () => {
    const url = '{HOST.IP2}|{HOST.DNS2}|{HOST.CONN2}|{HOST.PORT2}|{HOST.CONN}:{HOST.PORT}';
    expect(expandTriggerUrl(problem(url), ctx())).toBe('192.0.2.10|web01.example|web01.example|10050|192.0.2.40:12345');
  });

  it('formats item values with units and value maps, as Zabbix shows them', () => {
    expect(expandTriggerUrl(problem('{ITEM.VALUE}|{ITEM.LASTVALUE2}|{ITEM.VALUE2}'), ctx())).toBe(
      'Running (up)|1.5 KB|1.5 KB'
    );
  });

  it('passes the raw value to macro functions', () => {
    expect(expandTriggerUrl(problem('{{ITEM.VALUE2}.fmtnum(1)}|{{ITEM.VALUE}.uppercase()}'), ctx())).toBe('1536|UP');
    expect(expandTriggerUrl(problem('{{HOST.HOST2}.regsub("(\\d+)", n\\1)}'), ctx())).toBe('n01');
  });

  it('prints *UNKNOWN* when the item has no value, is binary or is missing', () => {
    const items = {
      '601': { itemid: '601', hostid: '10', value_type: '3', lastvalue: '0', lastclock: '0' },
      '602': { itemid: '602', hostid: '11', value_type: '5', lastvalue: 'x', lastclock: CLOCK },
    };
    expect(
      expandTriggerUrl(problem('{ITEM.VALUE}|{ITEM.VALUE2}|{{ITEM.VALUE2}.uppercase()}'), ctx({ itemsById: items }))
    ).toBe('*UNKNOWN*|*UNKNOWN*|*UNKNOWN*');
    expect(expandTriggerUrl(problem('{ITEM.VALUE}'), ctx({ itemsById: {} }))).toBe('*UNKNOWN*');
  });

  it('expands {ITEM.LOG.*} from the latest log record of a log item only', () => {
    const items = {
      '602': {
        itemid: '602',
        hostid: '11',
        value_type: '2',
        lastvalue: 'line',
        lastclock: CLOCK,
        lastLog: { timestamp: CLOCK, source: 'app', severity: '9', logeventid: '42' },
      },
      '601': { itemid: '601', hostid: '10', value_type: '3', lastvalue: '1', lastclock: CLOCK },
    };
    const url =
      '{ITEM.LOG.DATE}|{ITEM.LOG.TIME}|{ITEM.LOG.AGE}|{ITEM.LOG.SOURCE}|{ITEM.LOG.SEVERITY}|' +
      '{ITEM.LOG.NSEVERITY}|{ITEM.LOG.EVENTID}|{ITEM.LOG.SOURCE2}';
    expect(expandTriggerUrl(problem(url), ctx({ itemsById: items }))).toBe(
      '2023.11.14|22:13:20|1d 1h 1m|app|Critical|9|42|*UNKNOWN*'
    );
  });

  it('knows the value clock macros and {ITEM.LOG.TIMESTAMP} only from Zabbix 7.4', () => {
    const url = '{ITEM.VALUE.DATE}|{ITEM.LASTVALUE.TIME2}|{ITEM.VALUE.TIMESTAMP}|{ITEM.VALUE.AGE}|{ITEM.LOG.TIMESTAMP}';
    expect(expandTriggerUrl(problem(url), ctx({ version: '7.0.32' }))).toBe(url);
    expect(expandTriggerUrl(problem(url), ctx({ version: '7.4.0' }))).toBe(
      '2023.11.14|22:13:20|1700000000|1d 1h 1m|*UNKNOWN*'
    );
  });

  it('supports xmlxpath() only from Zabbix 8.0', () => {
    const items = {
      '602': { itemid: '602', hostid: '11', value_type: '4', lastvalue: '<a><b>x</b></a>', lastclock: CLOCK },
    };
    const url = '{{ITEM.VALUE}.xmlxpath("/a/b/text()")}';
    expect(expandTriggerUrl(problem(url), ctx({ itemsById: items }))).toBe('*UNKNOWN*');
    expect(expandTriggerUrl(problem(url), ctx({ itemsById: items, version: '8.0.0' }))).toBe('x');
  });

  it('expands user macros of the trigger hosts, also with functions', () => {
    const result = expandTriggerUrl(
      problem('https://{$WIKI}/{{$WIKI}.uppercase()}/{$NOPE}'),
      ctx({ hostMacros: [{ macro: '{$WIKI}', value: 'wiki.example', hostid: '11' }] })
    );
    expect(result).toBe('https://wiki.example/WIKI.EXAMPLE/{$NOPE}');
  });

  it('falls back to the problem items when expression functions are not loaded', () => {
    const p = problem('{HOST.HOST}|{ITEM.VALUE}', {
      items: [{ itemid: '601', hostid: '10', name: 'i', key_: 'k', lastvalue: '7' }],
    });
    expect(expandTriggerUrl(p, { version: '7.0.0' })).toBe('web01|7');
  });

  it('keeps unknown macros, broken syntax and URLs without macros as written', () => {
    expect(expandTriggerUrl(problem('{EVENT.NAME}/{HOST.HOST0}/{{TRIGGER.ID}.nofn()}/{TRIGGER.ID'), ctx())).toBe(
      '{EVENT.NAME}/{HOST.HOST0}/*UNKNOWN*/{TRIGGER.ID'
    );
    expect(expandTriggerUrl(problem('https://example.com/a?b=c'), ctx())).toBe('https://example.com/a?b=c');
    expect(expandTriggerUrl(problem(''), ctx())).toBe('');
  });
});
