/**
 * Expands a trigger URL the way the Zabbix 7.0+ frontend does
 * (CMacrosResolver::resolveTriggerUrl).
 */
import semver from 'semver';
import { ProblemDTO, ZBXHost, ZBXHostInterface } from '../types';
import { calcMacroFunction, MacroFunctionCall, MacroFunctionOptions, parseFunctionCall } from './macroFunctions';
import { expandUserMacroAt, MacroHostNode, UserMacro, UserMacroResolver } from './userMacros';
import {
  formatAge,
  formatDate,
  formatHistoryValue,
  formatTime,
  logSeverityName,
  UNKNOWN_MACRO,
  ValueMapping,
  VALUE_TYPE,
} from './zabbixFormat';

export interface MacroHost extends MacroHostNode {
  host?: string;
  name?: string;
  interfaces?: ZBXHostInterface[];
}

export interface LogRecord {
  timestamp: string;
  source: string;
  severity: string;
  logeventid: string;
}

export interface MacroItem {
  itemid: string;
  hostid?: string;
  value_type?: string;
  units?: string;
  lastvalue?: string;
  lastclock?: string;
  valuemap?: { mappings?: ValueMapping[] } | [];
  lastLog?: LogRecord;
}

export interface TriggerUrlContext {
  /** Zabbix version; decides which macros and macro functions exist. */
  version?: string;
  hostsById?: Record<string, MacroHost>;
  hostMacros?: UserMacro[];
  globalMacros?: UserMacro[];
  /** Item IDs of each trigger's functions, in expression order (index 0 is function 1). */
  functionItemIds?: Record<string, string[]>;
  itemsById?: Record<string, MacroItem>;
  /** Current time in seconds, for the *.AGE macros. */
  now?: number;
}

const HOST_MACROS = ['HOST.ID', 'HOST.HOST', 'HOST.NAME'];
const INTERFACE_MACROS = ['HOST.IP', 'HOST.DNS', 'HOST.CONN', 'HOST.PORT'];
const ITEM_MACROS = ['ITEM.LASTVALUE', 'ITEM.VALUE'];
const LOG_MACROS = [
  'ITEM.LOG.DATE',
  'ITEM.LOG.TIME',
  'ITEM.LOG.AGE',
  'ITEM.LOG.SOURCE',
  'ITEM.LOG.SEVERITY',
  'ITEM.LOG.NSEVERITY',
  'ITEM.LOG.EVENTID',
];
// Added in Zabbix 7.4.
const ITEM_CLOCK_MACROS = ['DATE', 'TIME', 'TIMESTAMP', 'AGE'].flatMap((s) => ITEM_MACROS.map((m) => `${m}.${s}`));

const escape = (s: string) => s.replace(/\./g, '\\.');
const alternation = (names: string[]) =>
  [...names]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|');

function macroPattern(version?: string): RegExp {
  const is74 = !!version && semver.valid(version) !== null && semver.gte(version, '7.4.0');
  const numbered = [
    ...HOST_MACROS,
    ...INTERFACE_MACROS,
    ...ITEM_MACROS,
    ...LOG_MACROS,
    ...(is74 ? [...ITEM_CLOCK_MACROS, 'ITEM.LOG.TIMESTAMP'] : []),
  ];
  return new RegExp(`\\{(?:(TRIGGER\\.ID|EVENT\\.ID)|(${alternation(numbered)})([1-9]?))\\}`, 'y');
}

// Zabbix picks the main interface with the highest priority: agent, SNMP, JMX, IPMI.
const INTERFACE_PRIORITY: Record<string, number> = { '1': 4, '2': 3, '4': 2, '3': 1 };

function mainInterface(interfaces: ZBXHostInterface[] = []): ZBXHostInterface | undefined {
  let best: ZBXHostInterface | undefined;
  for (const iface of interfaces.filter((i) => i.main === '1')) {
    if (!best || (INTERFACE_PRIORITY[iface.type ?? ''] ?? 0) >= (INTERFACE_PRIORITY[best.type ?? ''] ?? 0)) {
      best = iface;
    }
  }
  return best;
}

/** IDs of the {functionid} references of a collapsed trigger expression, in order. */
export function functionIdsOf(expression = ''): string[] {
  const ids: string[] = [];
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '"') {
      for (i++; i < expression.length && !(expression[i] === '"' && expression[i - 1] !== '\\'); i++) {}
      continue;
    }
    const match = expression[i] === '{' ? /^\{(\d+)\}/.exec(expression.slice(i)) : null;
    if (match) {
      ids.push(match[1]);
      i += match[0].length - 1;
    }
  }
  return ids;
}

/**
 * Value of a built-in macro, before any macro function. undefined means Zabbix shows
 * *UNKNOWN*; `formatted` is the value shown when no macro function is applied.
 */
function builtinValue(
  macro: string,
  n: number,
  problem: ProblemDTO,
  ctx: TriggerUrlContext
): { raw: string; formatted?: string } | undefined {
  if (macro === 'TRIGGER.ID') {
    return problem.triggerid !== undefined ? { raw: problem.triggerid } : undefined;
  }
  if (macro === 'EVENT.ID') {
    return problem.eventid !== undefined ? { raw: problem.eventid } : undefined;
  }

  const index = Math.max(n, 1) - 1;
  const problemItems = problem.items || [];
  const itemid = ctx.functionItemIds?.[problem.triggerid ?? '']?.[index] ?? problemItems[index]?.itemid;
  if (itemid === undefined) {
    return undefined;
  }
  const item: MacroItem | undefined = ctx.itemsById?.[itemid] ?? problemItems.find((i) => i.itemid === itemid);
  if (!item) {
    return undefined;
  }

  if (macro.startsWith('HOST.')) {
    const hosts: ZBXHost[] = problem.hosts || [];
    const hostid = item.hostid ?? (n <= 1 ? hosts[0]?.hostid : undefined);
    const host = { ...(ctx.hostsById?.[hostid ?? ''] ?? {}), ...(hosts.find((h) => h.hostid === hostid) ?? {}) };
    if (hostid === undefined) {
      return undefined;
    }
    switch (macro) {
      case 'HOST.ID':
        return { raw: hostid };
      case 'HOST.HOST':
        return host.host !== undefined ? { raw: host.host } : undefined;
      case 'HOST.NAME':
        return host.name !== undefined ? { raw: host.name } : undefined;
    }
    const iface = mainInterface(ctx.hostsById?.[hostid]?.interfaces);
    if (!iface) {
      return undefined;
    }
    const value = {
      'HOST.IP': iface.ip,
      'HOST.DNS': iface.dns,
      'HOST.CONN': iface.useip === '1' ? iface.ip : iface.dns,
      'HOST.PORT': iface.port,
    }[macro];
    return value !== undefined ? { raw: value } : undefined;
  }

  if (macro.startsWith('ITEM.LOG.')) {
    const log = item.lastLog;
    if (item.value_type !== VALUE_TYPE.LOG || !log) {
      return undefined;
    }
    const timestamp = Number(log.timestamp);
    const value = {
      'ITEM.LOG.DATE': formatDate(timestamp),
      'ITEM.LOG.TIME': formatTime(timestamp),
      'ITEM.LOG.TIMESTAMP': log.timestamp,
      'ITEM.LOG.AGE': formatAge(timestamp, ctx.now),
      'ITEM.LOG.SOURCE': log.source,
      'ITEM.LOG.SEVERITY': logSeverityName(log.severity),
      'ITEM.LOG.NSEVERITY': log.severity,
      'ITEM.LOG.EVENTID': log.logeventid,
    }[macro];
    return value !== undefined ? { raw: value } : undefined;
  }

  // {ITEM.VALUE} and {ITEM.LASTVALUE} both use the latest value, as in the Zabbix trigger URL.
  const hasValue = item.lastclock !== undefined ? Number(item.lastclock) > 0 : item.lastvalue !== undefined;
  if (!hasValue) {
    return undefined;
  }
  const clock = Number(item.lastclock);
  switch (macro.replace(/^ITEM\.(LAST)?VALUE/, '')) {
    case '':
      return item.value_type === VALUE_TYPE.BINARY || item.lastvalue === undefined
        ? undefined
        : { raw: item.lastvalue, formatted: formatHistoryValue(item.lastvalue, item) };
    case '.DATE':
      return { raw: formatDate(clock) };
    case '.TIME':
      return { raw: formatTime(clock) };
    case '.TIMESTAMP':
      return { raw: String(clock) };
    case '.AGE':
      return { raw: formatAge(clock, ctx.now) };
  }
  return undefined;
}

export function expandTriggerUrl(problem: ProblemDTO, ctx: TriggerUrlContext = {}): string {
  const url = problem.url;
  if (!url || !url.includes('{')) {
    return url;
  }
  const functionOptions: MacroFunctionOptions = {
    xmlxpath: !!ctx.version && semver.valid(ctx.version) !== null && semver.gte(ctx.version, '8.0.0'),
  };
  const resolver = new UserMacroResolver(ctx.hostMacros || [], ctx.globalMacros || [], ctx.hostsById || {});
  const hostids = (problem.hosts || []).map((h) => h.hostid).filter(Boolean);
  const pattern = macroPattern(ctx.version);

  const builtinAt = (pos: number) => {
    pattern.lastIndex = pos;
    const match = pattern.exec(url);
    return match ? { length: match[0].length, macro: match[1] ?? match[2], n: Number(match[3] || 0) } : null;
  };
  const resolveBuiltin = (macro: string, n: number, call?: MacroFunctionCall) => {
    const value = builtinValue(macro, n, problem, ctx);
    if (value === undefined) {
      return UNKNOWN_MACRO;
    }
    return call ? calcMacroFunction(value.raw, call, functionOptions) : (value.formatted ?? value.raw);
  };

  let result = '';
  for (let pos = 0; pos < url.length;) {
    if (url[pos] === '{') {
      const user = expandUserMacroAt(url, pos, resolver, hostids, functionOptions);
      if (user) {
        result += user.value;
        pos += user.length;
        continue;
      }
      const builtin = builtinAt(pos);
      if (builtin) {
        result += resolveBuiltin(builtin.macro, builtin.n);
        pos += builtin.length;
        continue;
      }
      // {{MACRO}.func(params)}
      const inner = builtinAt(pos + 1);
      if (inner && url[pos + 1 + inner.length] === '.') {
        const callPos = pos + 2 + inner.length;
        const call = parseFunctionCall(url, callPos);
        if (call && url[callPos + call.length] === '}') {
          result += resolveBuiltin(inner.macro, inner.n, call.call);
          pos = callPos + call.length + 1;
          continue;
        }
      }
    }
    result += url[pos++];
  }
  return result;
}
