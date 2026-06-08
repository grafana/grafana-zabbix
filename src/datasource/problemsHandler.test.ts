import { expandItemMacros, expandUserMacros, hasUserMacro } from './problemsHandler';

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

describe('hasUserMacro', () => {
  it('returns true when text contains a {$MACRO}', () => {
    expect(hasUserMacro('Contact: {$CONTACT}')).toBe(true);
  });

  it('returns true for macros with digits, underscores, and dots', () => {
    expect(hasUserMacro('{$DB.HOST_1}')).toBe(true);
  });

  it('returns false when no macro is present', () => {
    expect(hasUserMacro('plain text')).toBe(false);
  });

  it('returns false for empty or undefined text', () => {
    expect(hasUserMacro('')).toBe(false);
    expect(hasUserMacro(undefined as any)).toBe(false);
  });

  it('returns false for {ITEM.VALUE}-style macros', () => {
    expect(hasUserMacro('{ITEM.VALUE} / {HOST.NAME}')).toBe(false);
  });
});

describe('expandUserMacros', () => {
  const hostMacro = (macro: string, value: string, hostid: string) => ({ macro, value, hostid });
  const globalMacro = (macro: string, value: string) => ({ macro, value });

  it('replaces a host macro with its value', () => {
    const result = expandUserMacros('Contact: {$CONTACT}', [hostMacro('{$CONTACT}', 'Pepe', '10')], [], ['10']);
    expect(result).toBe('Contact: Pepe');
  });

  it('replaces multiple distinct macros in the same string', () => {
    const result = expandUserMacros(
      'CONTACT: {$CONTACT} VERSION: {$VERSION}',
      [hostMacro('{$CONTACT}', 'Pepe', '10'), hostMacro('{$VERSION}', '6.4.1', '10')],
      [],
      ['10']
    );
    expect(result).toBe('CONTACT: Pepe VERSION: 6.4.1');
  });

  it('replaces every occurrence of the same macro', () => {
    const result = expandUserMacros('{$CONTACT}/{$CONTACT}', [hostMacro('{$CONTACT}', 'Pepe', '10')], [], ['10']);
    expect(result).toBe('Pepe/Pepe');
  });

  it('falls back to global macros when no host macro matches', () => {
    const result = expandUserMacros('Region: {$REGION}', [], [globalMacro('{$REGION}', 'eu-west')], ['10']);
    expect(result).toBe('Region: eu-west');
  });

  it('prefers host macro over global macro of the same name', () => {
    const result = expandUserMacros(
      '{$ENV}',
      [hostMacro('{$ENV}', 'prod', '10')],
      [globalMacro('{$ENV}', 'global')],
      ['10']
    );
    expect(result).toBe('prod');
  });

  it('ignores host macros whose hostid is not in the problem hosts', () => {
    const result = expandUserMacros('{$CONTACT}', [hostMacro('{$CONTACT}', 'Pepe', '99')], [], ['10']);
    expect(result).toBe('{$CONTACT}');
  });

  it('leaves the raw macro unchanged when no definition is found', () => {
    expect(expandUserMacros('{$UNKNOWN}', [], [], ['10'])).toBe('{$UNKNOWN}');
  });

  it('leaves the raw macro unchanged when the macro value is null (secret)', () => {
    const result = expandUserMacros(
      '{$SECRET}',
      [{ macro: '{$SECRET}', value: null as any, hostid: '10' }],
      [],
      ['10']
    );
    expect(result).toBe('{$SECRET}');
  });

  it('returns the text unchanged when it contains no macros', () => {
    expect(expandUserMacros('no macros here', [], [], [])).toBe('no macros here');
  });

  it('returns empty/undefined text unchanged', () => {
    expect(expandUserMacros('', [], [], [])).toBe('');
    expect(expandUserMacros(undefined as any, [], [], [])).toBeUndefined();
  });
});
