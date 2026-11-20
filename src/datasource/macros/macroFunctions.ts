/**
 * Zabbix macro functions ({{MACRO}.func(params)}), ported from the Zabbix 7.0+ frontend
 * (CMacroFunction, C10FunctionParser). Regular expressions run as JavaScript RegExp,
 * which matches PCRE for everyday patterns. Dates use the browser time zone.
 */
import { UNKNOWN_MACRO } from './zabbixFormat';

export interface MacroFunctionCall {
  name: string;
  params: string[];
}

/** Parses "name(params)" at pos like C10FunctionParser. Returns the call and its length. */
export function parseFunctionCall(source: string, pos: number): { call: MacroFunctionCall; length: number } | null {
  let p = pos;
  while (p < source.length && source[p] >= 'a' && source[p] <= 'z') {
    p++;
  }
  if (p === pos || source[p] !== '(') {
    return null;
  }
  const name = source.slice(pos, p);

  type Param = { quoted: boolean; raw: string };
  const params: Param[] = [];
  let state: 'new' | 'end' | 'unquoted' | 'quoted' | 'done' = 'new';
  let num = 0;

  for (p = p + 1; p < source.length && state !== 'done'; p++) {
    const c = source[p];
    switch (state) {
      case 'new':
        if (c === ' ') {
          break;
        }
        if (c === ',') {
          params[num++] = { quoted: false, raw: '' };
        } else if (c === ')') {
          params[num] = { quoted: false, raw: '' };
          state = 'done';
        } else if (c === '"') {
          params[num] = { quoted: true, raw: c };
          state = 'quoted';
        } else {
          params[num] = { quoted: false, raw: c };
          state = 'unquoted';
        }
        break;
      case 'end':
        if (c === ',') {
          state = 'new';
          num++;
        } else if (c === ')') {
          state = 'done';
        } else if (c !== ' ') {
          return null;
        }
        break;
      case 'unquoted':
        if (c === ')') {
          state = 'done';
        } else if (c === ',') {
          state = 'new';
          num++;
        } else {
          params[num].raw += c;
        }
        break;
      case 'quoted':
        params[num].raw += c;
        if (c === '"' && source[p - 1] !== '\\') {
          state = 'end';
        }
        break;
    }
  }
  if (state !== 'done') {
    return null;
  }

  const unquote = (raw: string) => raw.slice(1, -1).replace(/\\"/g, '"');
  return {
    call: { name, params: params.map((param) => (param.quoted ? unquote(param.raw) : param.raw)) },
    length: p - pos,
  };
}

// PHP strings are bytes: these helpers move between UTF-8 text and one-char-per-byte strings.
function toBytes(text: string): string {
  let bytes = '';
  new TextEncoder().encode(text).forEach((b) => (bytes += String.fromCharCode(b)));
  return bytes;
}

function fromBytes(bytes: string): string {
  return new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
}

const noParams = (params: string[]) => params.length === 0 || (params.length === 1 && params[0] === '');

/** Replaces \0..\9 with the matching groups in one pass, like PHP strtr(). */
function substituteGroups(template: string, groups: Array<string | undefined>): string {
  return template.replace(/\\[0-9]/g, (token) => groups[Number(token[1])] ?? '');
}

function regsub(value: string, params: string[], insensitive: boolean): string {
  if (params.length !== 2) {
    return UNKNOWN_MACRO;
  }
  let match: RegExpExecArray | null;
  try {
    match = new RegExp(params[0], insensitive ? 'i' : '').exec(value);
  } catch {
    return UNKNOWN_MACRO;
  }
  return match ? substituteGroups(params[1], Array.from(match)) : '';
}

/** PHP sprintf('%.Nf'): exact halves round to even, unlike Number.toFixed(). */
function toFixedHalfEven(value: number, decimals: number): string {
  const scaled = value * Math.pow(10, decimals);
  if (Math.abs(scaled % 1) === 0.5) {
    const down = Math.trunc(scaled);
    const even = down % 2 === 0 ? down : down + Math.sign(scaled);
    return (even / Math.pow(10, decimals)).toFixed(decimals);
  }
  return value.toFixed(decimals);
}

function fmtnum(value: string, params: string[]): string {
  if (params.length !== 1 || params[0] === '') {
    return UNKNOWN_MACRO;
  }
  if (/^-?\d+$/.test(value)) {
    return value;
  }
  if (!/^-?(\d+(\.\d*)?|\.\d+)([Ee][+-]?\d+)?$/.test(value)) {
    return UNKNOWN_MACRO;
  }
  if (!/^\d+$/.test(params[0]) || Number(params[0]) > 20) {
    return UNKNOWN_MACRO;
  }
  return toFixedHalfEven(Number(value), Number(params[0]));
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  return {
    year: t.getFullYear(),
    week: 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7),
  };
}

/** C strftime() as PHP calls it, in the C locale. */
export function strftime(format: string, date: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 86400000
  );
  const hours12 = date.getHours() % 12 || 12;
  const offset = -date.getTimezoneOffset();
  const specs: Record<string, () => string> = {
    a: () => DAYS[date.getDay()].slice(0, 3),
    A: () => DAYS[date.getDay()],
    b: () => MONTHS[date.getMonth()].slice(0, 3),
    h: () => MONTHS[date.getMonth()].slice(0, 3),
    B: () => MONTHS[date.getMonth()],
    c: () => strftime('%a %b %e %H:%M:%S %Y', date),
    C: () => p2(Math.floor(date.getFullYear() / 100)),
    d: () => p2(date.getDate()),
    D: () => strftime('%m/%d/%y', date),
    e: () => String(date.getDate()).padStart(2, ' '),
    F: () => strftime('%Y-%m-%d', date),
    g: () => p2(isoWeek(date).year % 100),
    G: () => String(isoWeek(date).year),
    H: () => p2(date.getHours()),
    I: () => p2(hours12),
    j: () => String(dayOfYear + 1).padStart(3, '0'),
    m: () => p2(date.getMonth() + 1),
    M: () => p2(date.getMinutes()),
    n: () => '\n',
    p: () => (date.getHours() < 12 ? 'AM' : 'PM'),
    r: () => strftime('%I:%M:%S %p', date),
    R: () => strftime('%H:%M', date),
    s: () => String(Math.floor(date.getTime() / 1000)),
    S: () => p2(date.getSeconds()),
    t: () => '\t',
    T: () => strftime('%H:%M:%S', date),
    u: () => String(date.getDay() || 7),
    U: () => p2(Math.floor((dayOfYear + 7 - date.getDay()) / 7)),
    V: () => p2(isoWeek(date).week),
    w: () => String(date.getDay()),
    W: () => p2(Math.floor((dayOfYear + 7 - ((date.getDay() + 6) % 7)) / 7)),
    x: () => strftime('%m/%d/%y', date),
    X: () => strftime('%H:%M:%S', date),
    y: () => p2(date.getFullYear() % 100),
    Y: () => String(date.getFullYear()),
    z: () => (offset >= 0 ? '+' : '-') + p2(Math.floor(Math.abs(offset) / 60)) + p2(Math.abs(offset) % 60),
    Z: () =>
      new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value ?? '',
    '%': () => '%',
  };
  return format.replace(/%([a-zA-Z%])/g, (token, spec: string) => (specs[spec] ? specs[spec]() : token));
}

/** Applies a Zabbix relative time such as "-1d/d" (CRelativeTimeParser, start of period). */
export function applyRelativeTime(date: Date, relative: string): Date | null {
  const tokens = /^(?:\/[yMwdhm]|[+-]\d+[yMwdhms]?)*$/.test(relative)
    ? (relative.match(/\/[yMwdhm]|[+-]\d+[yMwdhms]?/g) ?? [])
    : null;
  if (tokens === null) {
    return null;
  }
  const d = new Date(date.getTime());
  for (const token of tokens) {
    if (token[0] === '/') {
      switch (token[1]) {
        case 'm':
          d.setSeconds(0, 0);
          break;
        case 'h':
          d.setMinutes(0, 0, 0);
          break;
        case 'd':
          d.setHours(0, 0, 0, 0);
          break;
        case 'w':
          d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          d.setHours(0, 0, 0, 0);
          break;
        case 'M':
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
          break;
        case 'y':
          d.setMonth(0, 1);
          d.setHours(0, 0, 0, 0);
          break;
      }
      continue;
    }
    const [, sign, amount, unit = 's'] = /^([+-])(\d+)([yMwdhms])?$/.exec(token)!;
    if (Number(amount) > 2147483647) {
      return null;
    }
    const n = Number(sign + amount);
    switch (unit) {
      case 's':
        d.setSeconds(d.getSeconds() + n);
        break;
      case 'm':
        d.setMinutes(d.getMinutes() + n);
        break;
      case 'h':
        d.setHours(d.getHours() + n);
        break;
      case 'd':
        d.setDate(d.getDate() + n);
        break;
      case 'w':
        d.setDate(d.getDate() + 7 * n);
        break;
      case 'M':
        d.setMonth(d.getMonth() + n);
        break;
      case 'y':
        d.setFullYear(d.getFullYear() + n);
        break;
    }
  }
  return d;
}

function parseFmttimeValue(value: string): Date | null {
  if (/^\d+$/.test(value)) {
    return new Date(Number(value) * 1000);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|([+-])(\d{2})(?::?(\d{2}))?)?$/.exec(value);
  if (iso) {
    const [, y, mo, d, h, mi, s, zone, sign, zh, zm = '0'] = iso;
    if (!zone) {
      return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    }
    const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (Number(zh) * 60 + Number(zm)) * 60000;
    return new Date(utc - offset);
  }
  const time = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (time) {
    const d = new Date();
    d.setHours(Number(time[1]), Number(time[2]), Number(time[3]), 0);
    return d;
  }
  return null;
}

function fmttime(value: string, params: string[]): string {
  if (params.length === 0 || params.length > 2) {
    return UNKNOWN_MACRO;
  }
  let date = parseFmttimeValue(value);
  if (date && params.length === 2) {
    date = applyRelativeTime(date, params[1]);
  }
  return date ? strftime(params[0], date) : UNKNOWN_MACRO;
}

/** Zabbix handleReplacement(): "\\" becomes "\", any other escape is kept. */
function handleReplacement(replacement: string): string {
  let result = '';
  for (let i = 0; i < replacement.length; i++) {
    if (replacement[i] === '\\') {
      if (replacement[i + 1] === '\\') {
        result += '\\';
      } else {
        result += i + 1 < replacement.length ? '\\' + replacement[i + 1] : '\\';
      }
      i++;
    } else {
      result += replacement[i];
    }
  }
  return result;
}

function regrepl(value: string, params: string[]): string {
  if (params.length === 0 || params.length % 2 !== 0) {
    return UNKNOWN_MACRO;
  }
  const maxLength = 65536;
  try {
    for (let i = 0; i < params.length; i += 2) {
      let pattern = params[i];
      if (pattern === '') {
        continue;
      }
      const replacement = handleReplacement(params[i + 1]);

      if (/[^\x00-\x7f]/.test(value)) {
        // JavaScript has no possessive quantifiers; "\w+" becomes a greedy one.
        pattern = pattern.replace(/\\w/g, '[a-zA-Z0-9_]+').replace(/\[a-zA-Z0-9_\]\+\+/g, '[a-zA-Z0-9_]+');
      }
      const regex = new RegExp(pattern, 'gu');
      const matches = value.match(regex) ?? [];
      const byteLength = (s: string) => new TextEncoder().encode(s).length;
      for (const match of matches) {
        const diff = byteLength(replacement) - byteLength(match);
        if (byteLength(value) + diff * matches.length > maxLength) {
          return UNKNOWN_MACRO;
        }
      }
      value = value.replace(regex, (...args) => {
        const groupsEnd = args.findIndex((arg, index) => index > 0 && typeof arg === 'number');
        return substituteGroups(replacement, args.slice(0, groupsEnd));
      });
    }
  } catch {
    return UNKNOWN_MACRO;
  }
  return value;
}

/** Expands escapes and ranges of a tr() list (Zabbix expandParameters), on bytes. */
function expandTrList(parameter: string): string | null {
  if (parameter === '\\') {
    return parameter;
  }
  const escapes: Record<string, string> = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
  const chars: Array<string | undefined> = parameter.split('');
  const length = parameter.length;
  let expanded = '';
  let i = 0;

  while (i < length) {
    if (chars[i] === '\\') {
      i++;
      if (i < length) {
        expanded += escapes[chars[i]!] ?? chars[i];
        chars[i] = undefined;
      }
    }
    if (chars[i] !== undefined && parameter[i] === '-' && i + 1 !== length) {
      if (i === 0 && parameter[i + 1] === '-') {
        i++;
        continue;
      }
      if (i - 1 >= 0) {
        const from = parameter.charCodeAt(i - 1);
        const to = parameter.charCodeAt(i + 1);
        if (from > to) {
          return null;
        }
        for (let c = from + 1; c <= to; c++) {
          expanded += String.fromCharCode(c);
        }
        i += 2;
      } else {
        expanded += parameter[i];
        i++;
      }
    }
    if (chars[i] !== undefined && i < length) {
      expanded += parameter[i];
    }
    i++;
  }
  return expanded;
}

function tr(value: string, params: string[]): string {
  if (params.length !== 2) {
    return UNKNOWN_MACRO;
  }
  const search = expandTrList(toBytes(params[0]));
  let replace = expandTrList(toBytes(params[1]));
  if (search === '' || replace === '') {
    return value;
  }
  if (search === null || replace === null) {
    return UNKNOWN_MACRO;
  }
  if (search.length > replace.length) {
    replace = replace.padEnd(search.length, replace[replace.length - 1]);
  } else {
    replace = replace.slice(0, search.length);
  }
  const map = new Map<string, string>();
  for (let i = 0; i < search.length; i++) {
    map.set(search[i], replace[i]);
  }
  const bytes = Array.from(toBytes(value), (c) => map.get(c) ?? c).join('');

  const multibyte = /[^\x00-\x7f]/.test(search + replace);
  // Zabbix re-encodes byte-wise translations to UTF-8, turning broken bytes into "?".
  return multibyte ? fromBytes(bytes).replace(/\uFFFD/g, '?') : fromBytes(bytes);
}

function rawurlencode(value: string): string {
  return Array.from(toBytes(value), (c) =>
    /[A-Za-z0-9\-_.~]/.test(c) ? c : '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
  ).join('');
}

function urldecode(value: string): string {
  const bytes = toBytes(value)
    .replace(/\+/g, ' ')
    .replace(/%([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return fromBytes(bytes);
}

function htmlencode(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmldecode(value: string): string {
  // A detached <textarea> decodes entities without parsing tags or running anything.
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function xmlxpath(value: string, params: string[]): string {
  if (value === '' || params.length < 1 || params.length > 2 || params[0] === '') {
    return UNKNOWN_MACRO;
  }
  const doc = new DOMParser().parseFromString(value, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    return UNKNOWN_MACRO;
  }
  let result: XPathResult;
  try {
    result = doc.evaluate(params[0], doc, null, XPathResult.ANY_TYPE, null);
  } catch {
    return UNKNOWN_MACRO;
  }
  switch (result.resultType) {
    case XPathResult.NUMBER_TYPE: {
      if (!isFinite(result.numberValue)) {
        return UNKNOWN_MACRO;
      }
      const fixed = result.numberValue.toFixed(6);
      return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
    }
    case XPathResult.BOOLEAN_TYPE:
      return result.booleanValue ? '1' : '0';
    case XPathResult.STRING_TYPE:
      return result.stringValue;
  }
  const serializer = new XMLSerializer();
  let output = '';
  let found = false;
  for (let node = result.iterateNext(); node; node = result.iterateNext()) {
    found = true;
    output +=
      node.nodeType === Node.ATTRIBUTE_NODE
        ? ` ${(node as Attr).name}="${htmlencode((node as Attr).value).replace(/&#39;/g, "'")}"`
        : serializer.serializeToString(node);
  }
  if (!found) {
    return params.length === 2 ? params[1] : UNKNOWN_MACRO;
  }
  return output;
}

export interface MacroFunctionOptions {
  /** xmlxpath() exists since Zabbix 8.0. */
  xmlxpath?: boolean;
}

/** Zabbix CMacroFunction::calcMacrofunc(). */
export function calcMacroFunction(value: string, call: MacroFunctionCall, options: MacroFunctionOptions = {}): string {
  const { name, params } = call;
  const simple = (fn: (v: string) => string) => (noParams(params) ? fn(value) : UNKNOWN_MACRO);
  switch (name) {
    case 'regsub':
    case 'iregsub':
      return regsub(value, params, name === 'iregsub');
    case 'fmtnum':
      return fmtnum(value, params);
    case 'fmttime':
      return fmttime(value, params);
    case 'regrepl':
      return regrepl(value, params);
    case 'tr':
      return tr(value, params);
    case 'btoa':
      return simple((v) => btoa(toBytes(v)));
    case 'urlencode':
      return simple(rawurlencode);
    case 'htmlencode':
      return simple(htmlencode);
    case 'urldecode':
      return simple(urldecode);
    case 'htmldecode':
      return simple(htmldecode);
    case 'lowercase':
      return simple((v) => v.replace(/[A-Z]/g, (c) => c.toLowerCase()));
    case 'uppercase':
      return simple((v) => v.replace(/[a-z]/g, (c) => c.toUpperCase()));
    case 'xmlxpath':
      return options.xmlxpath ? xmlxpath(value, params) : UNKNOWN_MACRO;
  }
  return UNKNOWN_MACRO;
}
