import {
  buildProblemNameSearchParams,
  extractRegexLiteral,
  extractRegexLiterals,
  matchesProblemName,
  parseLegacyProblemTags,
  problemTagsToQueryParam,
  wildcardToRegex,
} from './utils';
import { TagOperatorValue } from './components/QueryEditor/types';

describe('wildcardToRegex', () => {
  it('matches a prefix wildcard, anchored and case-insensitive', () => {
    const re = wildcardToRegex('CPU*');
    expect(re.test('CPU load high')).toBe(true);
    expect(re.test('cpu load high')).toBe(true);
    expect(re.test('High CPU load')).toBe(false);
  });

  it('matches wildcards in the middle', () => {
    const re = wildcardToRegex('High*load');
    expect(re.test('High CPU load')).toBe(true);
    expect(re.test('High memory usage')).toBe(false);
  });

  it('escapes regex metacharacters in the literal parts', () => {
    const re = wildcardToRegex('a.b*');
    expect(re.test('a.b and more')).toBe(true);
    expect(re.test('axb and more')).toBe(false);
  });
});

describe('matchesProblemName', () => {
  it('does an exact match for a plain string', () => {
    expect(matchesProblemName('High CPU load', 'High CPU load')).toBe(true);
    expect(matchesProblemName('High CPU load on host', 'High CPU load')).toBe(false);
  });

  it('does a wildcard match when the filter contains *', () => {
    expect(matchesProblemName('High CPU load on host', 'High CPU*')).toBe(true);
    expect(matchesProblemName('Low memory', 'High CPU*')).toBe(false);
  });

  it('does a regex match for /pattern/ filters', () => {
    expect(matchesProblemName('CPU load 95%', '/CPU load \\d+%/')).toBe(true);
    expect(matchesProblemName('cpu load 95%', '/CPU load \\d+%/i')).toBe(true);
    expect(matchesProblemName('Memory low', '/CPU load \\d+%/')).toBe(false);
  });

  it('matches an alternation regex', () => {
    const f = '/(Datastore free space|Unavailable by ICMP|Zabbix agent is not available)/';
    expect(matchesProblemName('Datastore free space is low', f)).toBe(true);
    expect(matchesProblemName('Unavailable by ICMP', f)).toBe(true);
    expect(matchesProblemName('High CPU load', f)).toBe(false);
  });

  it('honors a negative look-ahead (exclusion) regex', () => {
    const f = '/^(?!.*Zabbix agent).*/';
    expect(matchesProblemName('High CPU load', f)).toBe(true);
    expect(matchesProblemName('Zabbix agent is not available', f)).toBe(false);
  });
});

describe('extractRegexLiteral', () => {
  it('returns the literal of a simple regex', () => {
    expect(extractRegexLiteral('/CPU load/')).toBe('CPU load');
  });

  it('strips anchors and trailing quantified expressions', () => {
    expect(extractRegexLiteral('/^CPU load.*$/')).toBe('CPU load');
  });

  it('drops the character preceding an optional quantifier', () => {
    // "loads?" -> the trailing "s" is optional, so it is not guaranteed.
    expect(extractRegexLiteral('/CPU loads?/')).toBe('CPU load');
  });

  it('skips character classes', () => {
    expect(extractRegexLiteral('/Disk[0-9]+ full/')).toBe(' full');
  });

  it('returns null for alternations', () => {
    expect(extractRegexLiteral('/(network|system)/')).toBeNull();
  });

  it('returns null when no literal reaches the minimum length', () => {
    expect(extractRegexLiteral('/a.b/')).toBeNull();
  });

  it('returns null for non-regex input', () => {
    expect(extractRegexLiteral('CPU load')).toBeNull();
  });

  it('returns null for an alternation (more than one branch)', () => {
    expect(extractRegexLiteral('/(network|system)/')).toBeNull();
  });
});

describe('extractRegexLiterals', () => {
  it('returns one literal per branch of a top-level alternation', () => {
    expect(extractRegexLiterals('/(Datastore free space|Unavailable by ICMP|Zabbix agent is not available)/')).toEqual([
      'Datastore free space',
      'Unavailable by ICMP',
      'Zabbix agent is not available',
    ]);
  });

  it('handles an alternation without an enclosing group', () => {
    expect(extractRegexLiterals('/Datastore free space|Unavailable by ICMP/')).toEqual([
      'Datastore free space',
      'Unavailable by ICMP',
    ]);
  });

  it('returns a single-element array for a non-alternation regex', () => {
    expect(extractRegexLiterals('/CPU load.*/')).toEqual(['CPU load']);
  });

  it('returns null when any branch has no guaranteed literal', () => {
    expect(extractRegexLiterals('/(CPU load|.*)/')).toBeNull();
  });

  it('returns null for look-around constructs', () => {
    expect(extractRegexLiterals('/^(?!.*Zabbix agent).*/')).toBeNull();
    expect(extractRegexLiterals('/foo(?=bar)/')).toBeNull();
  });

  describe('quantified groups', () => {
    it('retracts the contents of an optional group', () => {
      expect(extractRegexLiterals('/(Critical failure)?CPU load/')).toEqual(['CPU load']);
    });

    it('retracts the contents of a *-quantified group', () => {
      expect(extractRegexLiterals('/(Very long prefix)*CPU load/')).toEqual(['CPU load']);
    });

    it('retracts the contents of a {}-quantified group', () => {
      expect(extractRegexLiterals('/(Prefix here){0,2}CPU load/')).toEqual(['CPU load']);
    });

    it('retracts every run committed inside an optional group', () => {
      // The group commits two runs ("Foo bar", "Baz qux") — both must be retracted.
      expect(extractRegexLiterals('/(Foo bar|Baz qux)?Common part/')).toEqual(['Common part']);
    });

    it('retracts nested optional groups', () => {
      expect(extractRegexLiterals('/((Inner)?Outer)?Trailing text/')).toEqual(['Trailing text']);
    });

    it('keeps the contents of a +-quantified group (guaranteed at least once)', () => {
      expect(extractRegexLiterals('/(Mandatory prefix)+CPU/')).toEqual(['Mandatory prefix']);
    });

    it('keeps the contents of an unquantified group', () => {
      expect(extractRegexLiterals('/(Foo bar)Baz/')).toEqual(['Foo bar']);
    });
  });
});

describe('buildProblemNameSearchParams', () => {
  it('returns an empty object for an empty filter', () => {
    expect(buildProblemNameSearchParams(undefined)).toEqual({});
    expect(buildProblemNameSearchParams('')).toEqual({});
  });

  it('maps a plain string to a substring search', () => {
    expect(buildProblemNameSearchParams('High CPU load')).toEqual({ search: { name: 'High CPU load' } });
  });

  it('enables wildcards for a pattern containing *', () => {
    expect(buildProblemNameSearchParams('CPU*')).toEqual({
      search: { name: 'CPU*' },
      searchWildcardsEnabled: true,
    });
  });

  it('narrows a regex by its guaranteed literal', () => {
    expect(buildProblemNameSearchParams('/CPU load.*/')).toEqual({ search: { name: 'CPU load' } });
  });

  it('narrows an alternation regex by an OR of branch literals', () => {
    expect(
      buildProblemNameSearchParams('/(Datastore free space|Unavailable by ICMP|Zabbix agent is not available)/')
    ).toEqual({
      search: { name: ['Datastore free space', 'Unavailable by ICMP', 'Zabbix agent is not available'] },
      searchByAny: true,
    });
  });

  it('skips narrowing when an alternation branch has no safe literal', () => {
    expect(buildProblemNameSearchParams('/(CPU load|.*)/')).toEqual({});
  });

  it('skips narrowing for a negative look-ahead (exclusion) regex', () => {
    expect(buildProblemNameSearchParams('/^(?!.*Zabbix agent).*/')).toEqual({});
  });

  it('narrows a regex with an optional group by the remaining guaranteed literal', () => {
    expect(buildProblemNameSearchParams('/(Critical failure)?CPU load/')).toEqual({ search: { name: 'CPU load' } });
  });

  it('skips narrowing when the only literal is inside an optional group', () => {
    expect(buildProblemNameSearchParams('/(Critical failure)?.*/')).toEqual({});
  });
});

describe('parseLegacyProblemTags', () => {
  it('converts the free-text filter to structured filters with the Equals operator', () => {
    expect(parseLegacyProblemTags('environment:production, service:web')).toEqual([
      { tag: 'environment', value: 'production', operator: TagOperatorValue.Equals },
      { tag: 'service', value: 'web', operator: TagOperatorValue.Equals },
    ]);
  });

  it('defaults a missing value to an empty string', () => {
    expect(parseLegacyProblemTags('environment')).toEqual([
      { tag: 'environment', value: '', operator: TagOperatorValue.Equals },
    ]);
  });

  it('returns an empty list for an empty filter', () => {
    expect(parseLegacyProblemTags('')).toEqual([]);
  });
});

describe('problemTagsToQueryParam', () => {
  it('converts operators to the numbers Zabbix expects', () => {
    expect(
      problemTagsToQueryParam([
        { tag: 'environment', value: 'production', operator: TagOperatorValue.Contains },
        { tag: 'service', value: 'web', operator: TagOperatorValue.DoesNotEqual },
      ])
    ).toEqual([
      { tag: 'environment', value: 'production', operator: 0 },
      { tag: 'service', value: 'web', operator: 3 },
    ]);
  });

  it('omits the value for Exists and Does not exist', () => {
    expect(
      problemTagsToQueryParam([
        { tag: 'environment', value: 'ignored', operator: TagOperatorValue.Exists },
        { tag: 'service', value: '', operator: TagOperatorValue.DoesNotExist },
      ])
    ).toEqual([
      { tag: 'environment', operator: 4 },
      { tag: 'service', operator: 5 },
    ]);
  });

  it('skips filters without a tag name', () => {
    expect(problemTagsToQueryParam([{ tag: '', value: 'production', operator: TagOperatorValue.Contains }])).toEqual(
      []
    );
  });

  it('trims regex-like anchors produced by variable interpolation', () => {
    expect(
      problemTagsToQueryParam([{ tag: '/^environment$/', value: '/^production$/', operator: '1' as any }])
    ).toEqual([{ tag: 'environment', value: 'production', operator: 1 }]);
  });

  it('expands a variable that interpolated to the legacy "tag:value" text format', () => {
    expect(
      problemTagsToQueryParam([{ tag: 'environment:production, service:web', value: '', operator: '1' as any }])
    ).toEqual([
      { tag: 'environment', value: 'production', operator: 1 },
      { tag: 'service', value: 'web', operator: 1 },
    ]);
  });

  it('keeps a colon in the tag name when a value is set', () => {
    expect(problemTagsToQueryParam([{ tag: 'app:component', value: 'db', operator: '0' as any }])).toEqual([
      { tag: 'app:component', value: 'db', operator: 0 },
    ]);
  });
});
