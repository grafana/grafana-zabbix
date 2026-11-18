import { capitalizeFirstLetter, parseCustomTagColumns, reconcileColumnOrder } from './utils';

describe('capitalizeFirstLetter', () => {
  it('capitalizes first letter and lowercases the rest', () => {
    expect(capitalizeFirstLetter('zabbixgrafana')).toBe('Zabbixgrafana');
    expect(capitalizeFirstLetter('ZABBIXGRAFANA')).toBe('Zabbixgrafana');
    expect(capitalizeFirstLetter('zAbBiXgRaFaNa')).toBe('Zabbixgrafana');
  });

  it('returns empty string for empty input', () => {
    expect(capitalizeFirstLetter('')).toBe('');
  });

  it('handles single-character strings', () => {
    expect(capitalizeFirstLetter('a')).toBe('A');
    expect(capitalizeFirstLetter('A')).toBe('A');
  });
});

describe('parseCustomTagColumns', () => {
  it('returns empty array for undefined or empty input', () => {
    expect(parseCustomTagColumns(undefined)).toEqual([]);
    expect(parseCustomTagColumns('')).toEqual([]);
    expect(parseCustomTagColumns('   ')).toEqual([]);
  });

  it('splits comma-separated values and trims whitespace', () => {
    expect(parseCustomTagColumns('env, region ,service')).toEqual(['env', 'region', 'service']);
  });

  it('filters out empty values', () => {
    expect(parseCustomTagColumns('env,, ,region,')).toEqual(['env', 'region']);
  });

  it('preserves order', () => {
    expect(parseCustomTagColumns('a,b,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('reconcileColumnOrder', () => {
  const defaults = ['host', 'priority', 'name', 'tags', 'age', 'expander'];

  it('returns the default order when nothing is saved', () => {
    expect(reconcileColumnOrder(undefined, defaults, ['expander'])).toEqual(defaults);
    expect(reconcileColumnOrder([], defaults, ['expander'])).toEqual(defaults);
  });

  it('keeps a complete saved order', () => {
    const saved = ['name', 'host', 'age', 'tags', 'priority'];
    expect(reconcileColumnOrder(saved, defaults, ['expander'])).toEqual([...saved, 'expander']);
  });

  it('drops ids that no longer exist and duplicates', () => {
    const saved = ['name', 'problem-tag_env', 'host', 'name', 'age', 'tags', 'priority'];
    expect(reconcileColumnOrder(saved, defaults, ['expander'])).toEqual([
      'name',
      'host',
      'age',
      'tags',
      'priority',
      'expander',
    ]);
  });

  it('slots unknown ids in after their default neighbour, not at the end', () => {
    // A custom tag column defined between "name" and "tags" appears there even though
    // the saved order moved "tags" to the front
    const withTag = ['host', 'priority', 'name', 'problem-tag_env', 'tags', 'age', 'expander'];
    const saved = ['tags', 'age', 'host', 'priority', 'name'];
    expect(reconcileColumnOrder(saved, withTag, ['expander'])).toEqual([
      'tags',
      'age',
      'host',
      'priority',
      'name',
      'problem-tag_env',
      'expander',
    ]);
  });

  it('inserts consecutive unknown ids in default order', () => {
    const saved = ['age', 'host'];
    expect(reconcileColumnOrder(saved, defaults, ['expander'])).toEqual([
      'age',
      'host',
      'priority',
      'name',
      'tags',
      'expander',
    ]);
  });

  it('puts an unknown id first when nothing precedes it in the default order', () => {
    const saved = ['tags', 'priority', 'name', 'age'];
    expect(reconcileColumnOrder(saved, defaults, ['expander'])).toEqual([
      'host',
      'tags',
      'priority',
      'name',
      'age',
      'expander',
    ]);
  });

  it('always renders pinned ids last, even if the saved order lists them', () => {
    const saved = ['expander', 'age', 'host', 'priority', 'name', 'tags'];
    expect(reconcileColumnOrder(saved, defaults, ['expander'])).toEqual([
      'age',
      'host',
      'priority',
      'name',
      'tags',
      'expander',
    ]);
  });
});
