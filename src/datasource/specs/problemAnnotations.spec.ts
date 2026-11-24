import { DataTopic } from '@grafana/data';
import {
  buildProblemAnnotationsFrame,
  collectItemIdsByRefId,
  isProblemAnnotationsTarget,
  recoveryClocksFrom,
  selectProblemEvents,
  selectTriggers,
  triggersOfItems,
} from '../problemAnnotations';

const triggers = [
  { triggerid: '10', description: 'High CPU on web-01', priority: '4', hosts: [{ name: 'web-01' }] },
  { triggerid: '11', description: 'Low memory on web-01', priority: '2', hosts: [{ name: 'web-01' }] },
];

const fieldValues = (frame: any, name: string) => frame.fields.find((f: any) => f.name === name).values;

describe('problemAnnotations', () => {
  describe('isProblemAnnotationsTarget', () => {
    it('is off for queries saved without the setting when the data source default is off', () => {
      expect(isProblemAnnotationsTarget({ queryType: '0' } as any)).toBe(false);
      expect(isProblemAnnotationsTarget({} as any)).toBe(false);
    });

    it('follows the data source default when the query does not set it', () => {
      expect(isProblemAnnotationsTarget({ queryType: '0' } as any, true)).toBe(true);
    });

    it('lets the query override the data source default either way', () => {
      expect(isProblemAnnotationsTarget({ queryType: '0', problemAnnotations: { enabled: false } } as any, true)).toBe(
        false
      );
      expect(isProblemAnnotationsTarget({ queryType: '0', problemAnnotations: { enabled: true } } as any)).toBe(true);
    });

    it.each([
      ['problems query', { queryType: '5', problemAnnotations: { enabled: true } }],
      ['hidden query', { queryType: '0', hide: true, problemAnnotations: { enabled: true } }],
      ['dashboard annotation target', { fromAnnotations: true, problemAnnotations: { enabled: true } }],
      ['item ID query without ids', { queryType: '3', itemids: '', problemAnnotations: { enabled: true } }],
    ])('skips a %s', (_, target) => {
      expect(isProblemAnnotationsTarget(target as any, true)).toBe(false);
    });
  });

  describe('selectTriggers', () => {
    const allTriggers = [
      ...triggers,
      { triggerid: '12', description: 'Load average is too high', priority: '3', hosts: [{ name: 'web-01' }] },
    ];
    const ids = (filter?: string) => selectTriggers(allTriggers, { triggerFilter: filter }).map((t) => t.triggerid);

    it('keeps every trigger without a filter', () => {
      expect(ids(undefined)).toEqual(['10', '11', '12']);
      expect(ids('')).toEqual(['10', '11', '12']);
      expect(ids('  ')).toEqual(['10', '11', '12']);
    });

    it('matches one trigger by exact name', () => {
      expect(ids('Low memory on web-01')).toEqual(['11']);
      expect(ids('Low memory')).toEqual([]);
    });

    it('matches several triggers with a regex', () => {
      expect(ids('/CPU|load/i')).toEqual(['10', '12']);
      expect(ids('/.*/')).toEqual(['10', '11', '12']);
    });

    it('excludes triggers with a negative lookahead regex', () => {
      expect(ids('/^(?!.*memory).*$/i')).toEqual(['10', '12']);
    });
  });

  describe('collectItemIdsByRefId', () => {
    const valueField = (itemid?: string) => ({
      name: 'Value',
      config: { custom: { scopedVars: itemid ? { __zbx_item_id: { value: itemid } } : {} } },
      values: [],
    });

    it('reads item ids per query from the series scoped vars', () => {
      const frames: any[] = [
        { refId: 'A', fields: [{ name: 'Time', config: {} }, valueField('1')] },
        { refId: 'A', fields: [valueField('2')] },
        { refId: 'B', fields: [valueField('3')] },
        // Aggregated series carry no item
        { refId: 'C', fields: [valueField()] },
        { fields: [valueField('4')] },
      ];

      const byRefId = collectItemIdsByRefId(frames);

      expect([...byRefId.get('A')!]).toEqual(['1', '2']);
      expect([...byRefId.get('B')!]).toEqual(['3']);
      expect(byRefId.has('C')).toBe(false);
      expect(byRefId.size).toBe(2);
    });

    it('ignores missing responses and objects that are not data frames', () => {
      expect(collectItemIdsByRefId(undefined).size).toBe(0);
      expect(collectItemIdsByRefId([null, { refId: 'A' }, { refId: 'A', fields: {} }, 'x'] as any).size).toBe(0);
    });
  });

  it('keeps the triggers that reference one of the items', () => {
    const withItems = [
      { ...triggers[0], items: [{ itemid: '1' }] },
      { ...triggers[1], items: [{ itemid: '2' }, { itemid: '3' }] },
    ];

    expect(triggersOfItems(withItems, ['3']).map((t) => t.triggerid)).toEqual(['11']);
    expect(triggersOfItems(withItems, ['9'])).toEqual([]);
  });

  describe('selectProblemEvents', () => {
    const events = [
      { eventid: '1', objectid: '10', clock: '1', value: '1', name: 'p', severity: '4', acknowledged: '1' },
      { eventid: '2', objectid: '10', clock: '2', value: '1', name: 'p', severity: '2', acknowledged: '0' },
      // Recovery events never become annotations themselves
      { eventid: '3', objectid: '10', clock: '3', value: '0', name: 'p', severity: '0' },
      { eventid: '4', objectid: '11', clock: '4', value: '1', name: 'q', severity: '5' },
    ];
    const ids = (options?: any, triggerids = ['10']) =>
      selectProblemEvents(events, new Set(triggerids), options).map((e) => e.eventid);

    it('keeps the problem events of the given triggers', () => {
      expect(ids()).toEqual(['1', '2']);
      expect(ids({}, ['10', '11'])).toEqual(['1', '2', '4']);
    });

    it("applies the minimum severity to the event's own severity", () => {
      expect(ids({ minSeverity: 3 })).toEqual(['1']);
    });

    it('drops acknowledged problems when asked', () => {
      expect(ids({ hideAcknowledged: true })).toEqual(['2']);
    });
  });

  it('maps recovery events to their clocks', () => {
    const events: any[] = [
      { eventid: '5', value: '0', clock: '1700000300' },
      { eventid: '6', value: '1', clock: '1700000000' },
    ];

    expect(recoveryClocksFrom(events)).toEqual({ '5': 1700000300 });
  });

  describe('buildProblemAnnotationsFrame', () => {
    const events = [
      {
        eventid: '100',
        objectid: '10',
        clock: '1700000000',
        name: 'High CPU on web-01',
        severity: '4',
        r_eventid: '101',
        acknowledged: '1',
        tags: [{ tag: 'scope', value: 'performance' }],
      },
      {
        eventid: '200',
        objectid: '11',
        clock: '1700000600',
        name: 'Low memory on web-01',
        severity: '2',
        r_eventid: '0',
      },
      // Belongs to a trigger the query did not select
      { eventid: '300', objectid: '99', clock: '1700000700', name: 'Other', severity: '5', r_eventid: '0' },
    ];

    it('builds an annotations frame with regions from problem start to recovery', () => {
      const frame = buildProblemAnnotationsFrame({
        events,
        triggers,
        recoveryClocks: { '101': 1700000300 },
        rangeEndMs: 1700003600000,
      });

      expect(frame.meta?.dataTopic).toBe(DataTopic.Annotations);
      expect(fieldValues(frame, 'id')).toEqual(['100', '200']);
      expect(fieldValues(frame, 'time')).toEqual([1700000000000, 1700000600000]);
      // Resolved problem ends at recovery; open problem runs to the end of the range
      expect(fieldValues(frame, 'timeEnd')).toEqual([1700000300000, 1700003600000]);
      expect(fieldValues(frame, 'isRegion')).toEqual([true, true]);
      expect(fieldValues(frame, 'title')).toEqual(['High (resolved)', 'Warning']);
      expect(fieldValues(frame, 'text')).toEqual(['High CPU on web-01', 'Low memory on web-01']);
      expect(fieldValues(frame, 'tags')).toEqual([['web-01', 'scope:performance'], ['web-01']]);
      expect(fieldValues(frame, 'color')).toEqual(['rgb(255, 101, 72)', 'rgb(175, 180, 36)']);
    });

    it('uses the data source severity overrides for names and colors', () => {
      const frame = buildProblemAnnotationsFrame({
        events: [events[1]],
        triggers,
        recoveryClocks: {},
        rangeEndMs: 1700003600000,
        severityOverrides: [{ priority: 2, name: 'Minor', color: '#00ff00' }],
      });

      expect(fieldValues(frame, 'title')).toEqual(['Minor']);
      expect(fieldValues(frame, 'color')).toEqual(['#00ff00']);
    });

    it('marks a problem resolved after the range as resolved and runs it to the range end', () => {
      const frame = buildProblemAnnotationsFrame({
        events: [events[0]],
        triggers,
        // Recovery 101 happened after the range, so it was not fetched
        recoveryClocks: {},
        rangeEndMs: 1700003600000,
      });

      expect(fieldValues(frame, 'timeEnd')).toEqual([1700003600000]);
      expect(fieldValues(frame, 'title')).toEqual(['High (resolved)']);
    });

    it('skips recovery events', () => {
      const frame = buildProblemAnnotationsFrame({
        events: [{ eventid: '101', objectid: '10', clock: '1700000300', value: '0', name: 'High CPU on web-01' }],
        triggers,
        recoveryClocks: {},
        rangeEndMs: 1700003600000,
      });

      expect(frame.length).toBe(0);
    });
  });
});
