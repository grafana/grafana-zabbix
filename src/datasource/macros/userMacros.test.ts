import { expandUserMacros, hasUserMacro, parseUserMacroAt, UserMacroResolver } from './userMacros';

const macro = (m: string, value: string, hostid?: string) => ({ macro: m, value, hostid });

describe('parseUserMacroAt', () => {
  it('parses plain, quoted and unquoted context macros', () => {
    expect(parseUserMacroAt('{$A}', 0)).toEqual({ match: '{$A}', name: 'A' });
    expect(parseUserMacroAt('x{$A.B_1:"a \\"q\\" }"}y', 1)).toEqual({
      match: '{$A.B_1:"a \\"q\\" }"}',
      name: 'A.B_1',
      context: 'a "q" }',
    });
    expect(parseUserMacroAt('{$A:  ctx }', 0)).toEqual({ match: '{$A:  ctx }', name: 'A', context: 'ctx ' });
  });

  it('parses regex contexts only when asked to', () => {
    expect(parseUserMacroAt('{$A:regex:"^/v"}', 0, true)).toMatchObject({ name: 'A', regex: '^/v' });
    expect(parseUserMacroAt('{$A:regex:"^/v"}', 0)).toMatchObject({ name: 'A', context: 'regex:"^/v"' });
  });

  it('rejects text that is not a user macro', () => {
    for (const text of ['{$a}', '{$}', '{A}', '{$A', '{$A:"x" y}', '{$A:"x"']) {
      expect(parseUserMacroAt(text, 0)).toBeNull();
    }
  });
});

describe('UserMacroResolver', () => {
  // host 10 -> template 30 -> template 40; host 11 -> template 20
  const hostsById = {
    '10': { hostid: '10', parentTemplates: [{ templateid: '30' }] },
    '11': { hostid: '11', parentTemplates: [{ templateid: '20' }] },
    '30': { hostid: '30', parentTemplates: [{ templateid: '40' }] },
  };

  it('treats all trigger hosts as one level, lowest ID first, before any template', () => {
    const resolver = new UserMacroResolver(
      [macro('{$M}', 'template-20', '20'), macro('{$M}', 'host-11', '11'), macro('{$M}', 'template-30', '30')],
      [],
      hostsById
    );
    expect(resolver.resolve('M', undefined, ['11', '10'])).toBe('host-11');
  });

  it('walks templates level by level', () => {
    const resolver = new UserMacroResolver(
      [macro('{$M}', 'template-40', '40'), macro('{$M}', 'template-20', '20')],
      [macro('{$M}', 'global')],
      hostsById
    );
    expect(resolver.resolve('M', undefined, ['10', '11'])).toBe('template-20');
    expect(resolver.resolve('M', undefined, ['10'])).toBe('template-40');
    expect(resolver.resolve('M', undefined, ['99'])).toBe('global');
  });

  it('per host: exact context, then regex context, then remembers the plain macro as default', () => {
    const resolver = new UserMacroResolver(
      [
        macro('{$P:regex:"^/v"}', 'host-regex', '10'),
        macro('{$P}', 'host-plain', '10'),
        macro('{$P:"/var"}', 'template-exact', '30'),
      ],
      [macro('{$P:"/opt"}', 'global-exact'), macro('{$P}', 'global-plain')],
      hostsById
    );
    // A matching regex on the host wins over an exact context on a template.
    expect(resolver.resolve('P', '/var', ['10'])).toBe('host-regex');
    // A global context match wins over the plain host macro.
    expect(resolver.resolve('P', '/opt', ['10'])).toBe('global-exact');
    // Nothing matches the context: the nearest plain macro is used.
    expect(resolver.resolve('P', '/home', ['10'])).toBe('host-plain');
    expect(resolver.resolve('P', '/home', ['99'])).toBe('global-plain');
  });

  it('checks regex contexts in alphabetical order', () => {
    const resolver = new UserMacroResolver(
      [macro('{$P:regex:"b"}', 'second', '10'), macro('{$P:regex:"a"}', 'first', '10')],
      []
    );
    expect(resolver.resolve('P', 'ab', ['10'])).toBe('first');
  });

  it('returns undefined when nothing is defined', () => {
    expect(new UserMacroResolver([], []).resolve('M', undefined, ['10'])).toBeUndefined();
  });
});

describe('expandUserMacros with macro functions', () => {
  it('applies a macro function to a user macro and keeps undefined ones as written', () => {
    const result = expandUserMacros(
      '{{$NAME}.uppercase()} {{$NONE}.uppercase()} {{$NAME}.regsub("(\\w+) (\\w+)", \\2)}',
      [macro('{$NAME}', 'web server', '10')],
      [],
      ['10']
    );
    expect(result).toBe('WEB SERVER {{$NONE}.uppercase()} server');
  });

  it('does not expand macros found inside resolved values', () => {
    expect(expandUserMacros('{$A}', [macro('{$A}', '{$B}', '10'), macro('{$B}', 'x', '10')], [], ['10'])).toBe('{$B}');
  });

  it('detects user macros with functions', () => {
    expect(hasUserMacro('{{$A}.lowercase()}')).toBe(true);
    expect(hasUserMacro('{{HOST.HOST}.lowercase()}')).toBe(false);
  });
});
