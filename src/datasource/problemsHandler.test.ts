import { expandItemMacros } from './problemsHandler';

describe('expandItemMacros', () => {
  const item = (historicalValue?: string, originalLastvalue?: string) => ({ historicalValue, originalLastvalue });

  describe('{ITEM.VALUE}', () => {
    it('replaces with historicalValue when available', () => {
      expect(expandItemMacros('Value: {ITEM.VALUE}', [item('12', '7')])).toBe('Value: 12');
    });

    it('falls back to originalLastvalue when historicalValue is undefined', () => {
      expect(expandItemMacros('Value: {ITEM.VALUE}', [item(undefined, '7')])).toBe('Value: 7');
    });

    it('replaces all occurrences', () => {
      expect(expandItemMacros('{ITEM.VALUE} / {ITEM.VALUE}', [item('12', '7')])).toBe('12 / 12');
    });
  });

  describe('{ITEM.LASTVALUE}', () => {
    it('always uses originalLastvalue, not historicalValue', () => {
      expect(expandItemMacros('Last: {ITEM.LASTVALUE}', [item('12', '7')])).toBe('Last: 7');
    });

    it('expands to empty string when originalLastvalue is undefined', () => {
      expect(expandItemMacros('Last: {ITEM.LASTVALUE}', [item('12', undefined)])).toBe('Last: ');
    });
  });

  it('expands both macros in the same string with different values', () => {
    const result = expandItemMacros('Value received: {ITEM.VALUE} / Last value received: {ITEM.LASTVALUE}', [
      item('12', '7'),
    ]);
    expect(result).toBe('Value received: 12 / Last value received: 7');
  });

  describe('indexed macros', () => {
    it('expands {ITEM1.VALUE} for first item', () => {
      expect(expandItemMacros('{ITEM1.VALUE}', [item('4', '7'), item('9', '7')])).toBe('4');
    });

    it('expands {ITEM2.VALUE} for second item', () => {
      expect(expandItemMacros('{ITEM2.VALUE}', [item('4', '7'), item('9', '7')])).toBe('9');
    });

    it('expands {ITEM2.LASTVALUE} for second item', () => {
      expect(expandItemMacros('{ITEM2.LASTVALUE}', [item('4', '3'), item('9', '7')])).toBe('7');
    });
  });

  describe('edge cases', () => {
    it('returns empty string unchanged', () => {
      expect(expandItemMacros('', [item('12', '7')])).toBe('');
    });

    it('returns text unchanged when items array is empty', () => {
      expect(expandItemMacros('Value: {ITEM.VALUE}', [])).toBe('Value: {ITEM.VALUE}');
    });

    it('returns text unchanged when no macros present', () => {
      expect(expandItemMacros('no macros here', [item('12', '7')])).toBe('no macros here');
    });

    it('handles undefined text', () => {
      expect(expandItemMacros(undefined as any, [item('12', '7')])).toBeUndefined();
    });
  });
});
