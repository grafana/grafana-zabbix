import { capitalizeFirstLetter, parseCustomTagColumns } from './utils';

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
    expect(parseCustomTagColumns('env, region ,service')).toEqual([
      'env',
      'region',
      'service',
    ]);
  });

  it('filters out empty values', () => {
    expect(parseCustomTagColumns('env,, ,region,')).toEqual([
      'env',
      'region',
    ]);
  });

  it('preserves order', () => {
    expect(parseCustomTagColumns('a,b,c')).toEqual(['a', 'b', 'c']);
  });
});
