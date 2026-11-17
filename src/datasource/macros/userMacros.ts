/**
 * User macro ({$MACRO}) resolution as done by the Zabbix 7.0+ frontend
 * (CUserMacroParser, CMacrosResolverGeneral::getUserMacros / getHostUserMacros).
 */
import { calcMacroFunction, MacroFunctionOptions, parseFunctionCall } from './macroFunctions';

export interface UserMacro {
  macro: string;
  value?: string | null;
  hostid?: string;
  /** '0' text, '1' secret, '2' vault. */
  type?: string;
}

/** A host or template, with the templates it is linked to. */
export interface MacroHostNode {
  hostid: string;
  parentTemplates?: Array<{ templateid: string }>;
}

export interface ParsedUserMacro {
  match: string;
  name: string;
  context?: string;
  regex?: string;
}

const SECRET_MASK = '******';

function unquote(context: string): string {
  return context.slice(1, -1).replace(/\\"/g, '"');
}

/** Parses {$NAME}, {$NAME:context} or {$NAME:"context"} at pos (regex contexts with allowRegex). */
export function parseUserMacroAt(source: string, pos: number, allowRegex = false): ParsedUserMacro | null {
  if (source[pos] !== '{' || source[pos + 1] !== '$') {
    return null;
  }
  let p = pos + 2;
  while (p < source.length && /[A-Z0-9._]/.test(source[p])) {
    p++;
  }
  if (p === pos + 2 || p >= source.length) {
    return null;
  }
  const name = source.slice(pos + 2, p);
  if (source[p] === '}') {
    return { match: source.slice(pos, p + 1), name };
  }
  if (source[p] !== ':') {
    return null;
  }
  p++;

  let isRegex = false;
  const regexPrefix = /^\s*regex:/.exec(source.slice(p));
  if (allowRegex && regexPrefix) {
    isRegex = true;
    p += regexPrefix[0].length;
  }

  let context = '';
  let quoted = false;
  let state: 'new' | 'quoted' | 'unquoted' | 'end' | 'done' = 'new';
  for (; p < source.length && state !== 'done'; p++) {
    const c = source[p];
    switch (state) {
      case 'new':
        if (c === '}') {
          state = 'done';
        } else if (c === '"') {
          context += c;
          quoted = true;
          state = 'quoted';
        } else if (c !== ' ') {
          context += c;
          state = 'unquoted';
        }
        break;
      case 'quoted':
        context += c;
        if (c === '"' && source[p - 1] !== '\\') {
          state = 'end';
        }
        break;
      case 'unquoted':
        if (c === '}') {
          state = 'done';
        } else {
          context += c;
        }
        break;
      case 'end':
        if (c === '}') {
          state = 'done';
        } else if (c !== ' ') {
          return null;
        }
        break;
    }
  }
  if (state !== 'done') {
    return null;
  }
  const value = quoted ? unquote(context) : context;
  return {
    match: source.slice(pos, p),
    name,
    ...(isRegex ? { regex: value } : { context: value }),
  };
}

interface MacroDefinitions {
  value?: string;
  contexts: Map<string, string>;
  regex: Array<[string, string]>;
}

function macroValue(macro: UserMacro): string | undefined {
  if (macro.type === '1' || macro.type === '2') {
    return SECRET_MASK;
  }
  return macro.value ?? undefined;
}

function indexMacros(macros: UserMacro[]): Map<string, MacroDefinitions> {
  const index = new Map<string, MacroDefinitions>();
  for (const macro of macros) {
    const parsed = parseUserMacroAt(macro.macro, 0, true);
    const value = macroValue(macro);
    if (!parsed || parsed.match !== macro.macro || value === undefined) {
      continue;
    }
    const key = `${macro.hostid ?? ''}\u0000${parsed.name}`;
    let defs = index.get(key);
    if (!defs) {
      defs = { contexts: new Map(), regex: [] };
      index.set(key, defs);
    }
    if (parsed.regex !== undefined) {
      defs.regex.push([parsed.regex, value]);
    } else if (parsed.context !== undefined) {
      defs.contexts.set(parsed.context, value);
    } else {
      defs.value = value;
    }
  }
  index.forEach((defs) => defs.regex.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return index;
}

function regexMatches(pattern: string, context: string): boolean {
  try {
    return new RegExp(pattern).test(context);
  } catch {
    return false;
  }
}

const byId = (a: string, b: string) => Number(a) - Number(b);

export class UserMacroResolver {
  private hostIndex: Map<string, MacroDefinitions>;
  private globalIndex: Map<string, MacroDefinitions>;

  constructor(
    hostMacros: UserMacro[],
    globalMacros: UserMacro[],
    private hostsById: Record<string, MacroHostNode> = {}
  ) {
    this.hostIndex = indexMacros(hostMacros);
    this.globalIndex = indexMacros(globalMacros.map((m) => ({ ...m, hostid: undefined })));
  }

  /** Value of {$name:context} for a trigger on the given hosts, or undefined when not defined. */
  resolve(name: string, context: string | undefined, hostids: string[]): string | undefined {
    let valueDefault: string | undefined;
    // All trigger hosts form the first level, then their templates level by level.
    let level = [...new Set(hostids)].sort(byId);
    const seen = new Set<string>();
    while (level.length) {
      for (const id of level) {
        seen.add(id);
        const defs = this.hostIndex.get(`${id}\u0000${name}`);
        if (!defs) {
          continue;
        }
        if (context !== undefined && defs.contexts.has(context)) {
          return defs.contexts.get(context);
        } else if (context !== undefined) {
          const regex = defs.regex.find(([pattern]) => regexMatches(pattern, context));
          if (regex) {
            return regex[1];
          }
        }
        if (defs.value !== undefined) {
          if (context === undefined) {
            return defs.value;
          }
          valueDefault ??= defs.value;
        }
      }
      const parents = level.flatMap((id) => (this.hostsById[id]?.parentTemplates || []).map((t) => t.templateid));
      level = [...new Set(parents)].filter((id) => !seen.has(id)).sort(byId);
    }

    const global = this.globalIndex.get(`\u0000${name}`);
    if (global) {
      if (context !== undefined && global.contexts.has(context)) {
        return global.contexts.get(context);
      } else if (context !== undefined) {
        const regex = global.regex.find(([pattern]) => regexMatches(pattern, context));
        if (regex) {
          return regex[1];
        }
      }
      if (global.value !== undefined) {
        if (context === undefined) {
          return global.value;
        }
        valueDefault ??= global.value;
      }
    }
    return valueDefault;
  }
}

/** Parses {{$NAME...}.func(params)} at pos. */
export function parseUserMacroFunctionAt(source: string, pos: number) {
  if (source[pos] !== '{') {
    return null;
  }
  const macro = parseUserMacroAt(source, pos + 1);
  if (!macro || source[pos + 1 + macro.match.length] !== '.') {
    return null;
  }
  const callPos = pos + 2 + macro.match.length;
  const call = parseFunctionCall(source, callPos);
  if (!call || source[callPos + call.length] !== '}') {
    return null;
  }
  return { macro, call: call.call, length: callPos + call.length + 1 - pos };
}

/**
 * If a user macro (optionally with a macro function) starts at pos, returns its length and
 * resolved text. Undefined macros keep their text, as in Zabbix.
 */
export function expandUserMacroAt(
  text: string,
  pos: number,
  resolver: UserMacroResolver,
  hostids: string[],
  functionOptions?: MacroFunctionOptions
): { length: number; value: string } | null {
  const macro = parseUserMacroAt(text, pos);
  if (macro) {
    return { length: macro.match.length, value: resolver.resolve(macro.name, macro.context, hostids) ?? macro.match };
  }
  const withFunction = parseUserMacroFunctionAt(text, pos);
  if (withFunction) {
    const { macro: m, call, length } = withFunction;
    const value = resolver.resolve(m.name, m.context, hostids);
    return {
      length,
      value: value === undefined ? text.slice(pos, pos + length) : calcMacroFunction(value, call, functionOptions),
    };
  }
  return null;
}

export function hasUserMacro(text: string): boolean {
  if (!text) {
    return false;
  }
  for (let pos = text.indexOf('{'); pos !== -1; pos = text.indexOf('{', pos + 1)) {
    if (parseUserMacroAt(text, pos) || parseUserMacroFunctionAt(text, pos)) {
      return true;
    }
  }
  return false;
}

/**
 * Replaces user macros in text. hostMacros carry the hostid of the host or template that
 * defines them; hostsById links hosts to their templates.
 */
export function expandUserMacros(
  text: string,
  hostMacros: UserMacro[],
  globalMacros: UserMacro[],
  hostids: string[],
  hostsById: Record<string, MacroHostNode> = {}
): string {
  if (!text || !text.includes('{')) {
    return text;
  }
  const resolver = new UserMacroResolver(hostMacros, globalMacros, hostsById);
  let result = '';
  for (let pos = 0; pos < text.length;) {
    const expanded = text[pos] === '{' ? expandUserMacroAt(text, pos, resolver, hostids) : null;
    if (expanded) {
      result += expanded.value;
      pos += expanded.length;
    } else {
      result += text[pos++];
    }
  }
  return result;
}
