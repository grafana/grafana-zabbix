/**
 * Value formatting used by Zabbix 7.0+ when it resolves {ITEM.VALUE}-like macros
 * (formatHistoryValue in the Zabbix frontend). Ported to keep macro values identical
 * to what the Zabbix UI shows. Dates use the browser time zone.
 */

export const UNKNOWN_MACRO = '*UNKNOWN*';

const FLOAT_DIG = 15;
const UNITS_ROUNDOFF_SUFFIXED = 2;
const UNITS_ROUNDOFF_UNSUFFIXED = 4;
const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;
const SEC_PER_MONTH = 2592000;
const SEC_PER_YEAR = 31536000;

// Zabbix item value types.
export const VALUE_TYPE = { FLOAT: '0', STR: '1', LOG: '2', UINT64: '3', TEXT: '4', BINARY: '5' };

const NUMERIC = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

export function isNumeric(value: string): boolean {
  return NUMERIC.test(value);
}

function shiftDecimal(value: number, places: number): number {
  const [mantissa, exponent = '0'] = String(value).split('e');
  return Number(`${mantissa}e${Number(exponent) + places}`);
}

/** PHP round(): half away from zero, on the decimal representation. */
export function phpRound(value: number, decimals = 0): number {
  if (!isFinite(value) || value === 0) {
    return value;
  }
  return Math.sign(value) * shiftDecimal(Math.round(shiftDecimal(Math.abs(value), decimals)), -decimals);
}

interface FormatFloatOptions {
  precision?: number;
  decimals?: number;
  decimalsExact?: boolean;
  smallScientific?: boolean;
  zeroAsZero?: boolean;
}

export function formatFloat(number: number, options: FormatFloatOptions = {}): string {
  const {
    precision = FLOAT_DIG,
    decimals = 0,
    decimalsExact = false,
    smallScientific = true,
    zeroAsZero = true,
  } = options;

  const round = (mantissa: number, exponent: number, places: number): [string, number, boolean] => {
    let rounded = Math.abs(phpRound(mantissa, places));
    if (rounded >= 10) {
      rounded = 1;
      exponent++;
      places++;
    }
    const digits = places >= 0 ? rounded.toFixed(places).replace('.', '').replace(/0+$/, '') : '';
    return [digits, exponent, rounded === Math.abs(mantissa)];
  };

  const format = (sign: string, integer: string, fraction: string, exponent?: number): string => {
    if (decimalsExact) {
      fraction = fraction.padEnd(decimals, '0');
    }
    return (
      sign +
      integer +
      (fraction !== '' ? '.' + fraction : '') +
      (exponent !== undefined ? 'E' + (exponent >= 0 ? '+' : '') + exponent : '')
    );
  };

  if (zeroAsZero && number === 0) {
    return '0';
  }
  if (number === Infinity) {
    return 'Infinity';
  }
  if (number === -Infinity) {
    return '-Infinity';
  }

  const sign = number < 0 ? '-' : '';
  const [mantissaText, exponentText] = number.toExponential(FLOAT_DIG - 1).split('e');
  const mantissa = Number(mantissaText);
  const exponent = Number(exponentText);

  const [digitsDec, exponentDec, preciseDec] = round(
    mantissa,
    exponent,
    exponent >= 0 ? Math.min(exponent + decimals, precision - 1) : decimalsExact ? exponent + decimals : decimals - 1
  );
  const [digitsSci, exponentSci] = round(mantissa, exponent, decimals);

  if (
    exponentDec >= (preciseDec ? Math.min(FLOAT_DIG, precision + 3) : precision) ||
    (smallScientific &&
      ((decimalsExact && exponentSci < -1 && -exponentSci + digitsSci.length > decimals + 1) ||
        (!decimalsExact && -exponentSci + digitsSci.length > Math.min(FLOAT_DIG, precision + 3))))
  ) {
    return format(sign, digitsSci.charAt(0), digitsSci.slice(1), exponentSci);
  }
  if (exponentDec >= 0) {
    return format(
      sign,
      digitsDec.slice(0, exponentDec + 1).padEnd(exponentDec + 1, '0'),
      digitsDec.slice(exponentDec + 1)
    );
  }
  return digitsDec !== '' ? format(sign, '0', '0'.repeat(-exponentDec - 1) + digitsDec) : format('', '0', '');
}

/** Zabbix convertUnitsS(): "1d 2h 3m"-like durations. */
export function convertUnitsS(input: number): string {
  const value = Number(input);
  const valueAbs = Math.abs(value);
  const parts: Record<string, number | string> = {};
  let start: number | null = null;
  let valueAbsInt = Math.floor(valueAbs);

  let v = Math.floor(valueAbsInt / SEC_PER_YEAR);
  if (v > 0) {
    parts.years = v;
    valueAbsInt -= v * SEC_PER_YEAR;
    start = 0;
  }

  v = Math.floor(valueAbsInt / SEC_PER_MONTH);
  if (v === 12) {
    parts.years = start === null ? 1 : (parts.years as number) + 1;
    start = 0;
  } else if (start === null || Math.ceil(Math.log10(parts.years as number)) <= FLOAT_DIG) {
    if (v > 0) {
      parts.months = v;
      valueAbsInt -= v * SEC_PER_MONTH;
      start = start === null ? 1 : start;
    }

    let level = 2;
    for (const [part, secPerPart] of [
      ['days', SEC_PER_DAY],
      ['hours', SEC_PER_HOUR],
      ['minutes', SEC_PER_MIN],
    ] as Array<[string, number]>) {
      v = Math.floor(valueAbsInt / secPerPart);
      if (v > 0) {
        parts[part] = v;
        valueAbsInt -= v * secPerPart;
        start = start === null ? level : start;
      }
      if (start !== null && level - start >= 2) {
        break;
      }
      level++;
    }

    if (start === null || start >= 3) {
      parts.seconds = valueAbsInt;
      if (start === null || start >= 4) {
        const ms = (valueAbs % 1) * 1000;
        if (ms > 0) {
          parts.milliseconds = formatFloat(ms, { decimals: UNITS_ROUNDOFF_SUFFIXED });
        }
      }
    }
  }

  const units: Record<string, string> = {
    years: 'y',
    months: 'M',
    days: 'd',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
    milliseconds: 'ms',
  };
  const result = Object.keys(units)
    // PHP array_filter() drops 0 and "0".
    .filter((unit) => parts[unit] !== undefined && Number(parts[unit]) !== 0)
    .map((unit) => formatFloat(Number(parts[unit]), { decimals: UNITS_ROUNDOFF_SUFFIXED }) + units[unit]);

  return result.length ? (value < 0 ? '-' : '') + result.join(' ') : '0';
}

/** PHP float to string conversion (shortest form, exponent from 1E+15 on). */
function phpFloatToString(value: number): string {
  if (value !== 0 && (Math.abs(value) >= 1e15 || Math.abs(value) < 1e-4)) {
    const [mantissa, exponent] = value.toExponential().split('e');
    return `${mantissa.includes('.') ? mantissa : mantissa + '.0'}E${exponent.startsWith('-') ? exponent : '+' + exponent.replace('+', '')}`;
  }
  return String(value);
}

function convertUnitsUptime(input: number): string {
  const value = phpRound(input);
  let valueAbs = Math.abs(value);
  let result = value < 0 ? '-' : '';
  const days = Math.floor(valueAbs / SEC_PER_DAY);

  if (days !== 0) {
    // sprintf('%d') of the formatted number, as PHP does.
    const n = Math.trunc(Number(formatFloat(days)));
    result += `${n} ${n === 1 ? 'day' : 'days'}`;
  }
  if (phpFloatToString(valueAbs).length <= FLOAT_DIG) {
    if (days !== 0) {
      result += ', ';
    }
    valueAbs -= days * SEC_PER_DAY;
    const hours = Math.floor(valueAbs / SEC_PER_HOUR);
    valueAbs -= hours * SEC_PER_HOUR;
    const minutes = Math.floor(valueAbs / SEC_PER_MIN);
    const seconds = valueAbs - minutes * SEC_PER_MIN;
    result += [hours, minutes, seconds].map((n) => String(Math.trunc(n)).padStart(2, '0')).join(':');
  }
  return result;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** PHP date('Y.m.d'). */
export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/** PHP date('H:i:s'). */
export function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Zabbix zbx_date2age(): time elapsed since the given moment. */
export function formatAge(unixSeconds: number, now = Date.now() / 1000): string {
  return convertUnitsS(Math.floor(now) - unixSeconds);
}

/** Zabbix convertUnitsRaw() with default options. */
export function convertUnits(rawValue: string, rawUnits = ''): { value: string; units: string } {
  if (!isNumeric(rawValue)) {
    return { value: rawValue, units: '' };
  }
  let units = rawUnits ?? '';

  if (units === 'unixtime') {
    if (Number(rawValue) === 0) {
      return { value: 'Never', units: '' };
    }
    // PHP date('Y-m-d h:i:s A')
    const d = new Date(Number(rawValue) * 1000);
    const hours = d.getHours() % 12 || 12;
    return {
      value:
        `${formatDate(d.getTime() / 1000).replace(/\./g, '-')} ${pad2(hours)}:${pad2(d.getMinutes())}:` +
        `${pad2(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`,
      units: '',
    };
  }
  if (units === 'uptime') {
    return { value: convertUnitsUptime(Number(rawValue)), units: '' };
  }
  if (units === 's') {
    return { value: convertUnitsS(Number(rawValue)), units: '' };
  }

  const blacklist = ['%', 'ms', 'rpm', 'RPM'];
  if (units.startsWith('!')) {
    units = units.slice(1);
    blacklist.push(units);
  }

  const value = Number(rawValue);
  if (blacklist.includes(units) || units === '' || Math.abs(value) < 1) {
    return { value: formatFloat(value, { decimals: UNITS_ROUNDOFF_UNSUFFIXED }), units };
  }

  const base = units === 'B' || units === 'Bps' ? 1024 : 1000;
  let result = '';
  let prefix = '';
  for (const [power, p] of ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'].entries()) {
    result = formatFloat(value / Math.pow(base, power), {
      decimals: p === '' ? UNITS_ROUNDOFF_UNSUFFIXED : UNITS_ROUNDOFF_SUFFIXED,
    });
    prefix = p;
    if (Math.abs(Number(result)) < base) {
      break;
    }
  }
  return { value: result, units: (Number(result) === 0 ? '' : prefix) + units };
}

export interface ValueMapping {
  type?: string;
  value: string;
  newvalue: string;
}

const MAPPING = { EQUAL: '0', GREATER_EQUAL: '1', LESS_EQUAL: '2', IN_RANGE: '3', REGEXP: '4', DEFAULT: '5' };

const RANGE_SUFFIX: Record<string, number> = {
  K: 1024,
  M: 1024 ** 2,
  G: 1024 ** 3,
  T: 1024 ** 4,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/** Zabbix CRangesParser: "10-20,30,1K-2K". The whole text must parse, or nothing matches. */
function parseRanges(source: string): number[][] | null {
  const skipSpaces = (p: number) => {
    while (p < source.length && ' \t\n\r'.includes(source[p])) {
      p++;
    }
    return p;
  };
  const constant = (p: number, first?: number) => {
    const m = /^-?(\d+(\.\d*)?|\.\d+)([Ee][+-]?\d+)?([KMGTsmhdw])?/.exec(source.slice(p));
    if (!m) {
      return null;
    }
    const value = parseFloat(m[0]) * (m[4] ? RANGE_SUFFIX[m[4]] : 1);
    if (value > 2147483647 || (first !== undefined && first > value)) {
      return null;
    }
    return { value, end: p + m[0].length };
  };

  const ranges: number[][] = [];
  let p = 0;
  while (true) {
    const from = constant(skipSpaces(p));
    if (!from) {
      break;
    }
    let q = skipSpaces(from.end);
    const range = [from.value];
    if (source[q] === '-') {
      const to = constant(skipSpaces(q + 1), from.value);
      if (to) {
        range.push(to.value);
        q = skipSpaces(to.end);
      }
    }
    ranges.push(range);
    p = q;
    if (source[p] !== ',') {
      break;
    }
    p++;
  }
  if (p === 0) {
    return null;
  }
  if (source[p - 1] === ',') {
    p--;
  }
  return p === source.length ? ranges : null;
}

function inRange(value: number, source: string): boolean {
  return (parseRanges(source) ?? []).some(
    ([from, to]) => value === from || (to !== undefined && value >= from && value <= to)
  );
}

function matchMapping(valueType: string, value: string, mapping: ValueMapping): boolean {
  const numeric = valueType === VALUE_TYPE.FLOAT || valueType === VALUE_TYPE.UINT64;
  switch (mapping.type ?? MAPPING.EQUAL) {
    case MAPPING.EQUAL:
      return numeric
        ? isNumeric(mapping.value) && parseFloat(value) === parseFloat(mapping.value)
        : value === mapping.value;
    case MAPPING.GREATER_EQUAL:
      return numeric && parseFloat(value) >= parseFloat(mapping.value);
    case MAPPING.LESS_EQUAL:
      return numeric && parseFloat(value) <= parseFloat(mapping.value);
    case MAPPING.IN_RANGE:
      return numeric && inRange(parseFloat(value), mapping.value);
    case MAPPING.REGEXP:
      try {
        return !numeric && new RegExp(mapping.value).test(value);
      } catch {
        return false;
      }
    case MAPPING.DEFAULT:
      return true;
  }
  return false;
}

export function getMappedValue(valueType: string, value: string, mappings: ValueMapping[] = []): string | undefined {
  let mapped: string | undefined;
  for (const mapping of mappings) {
    if (mapping.type === MAPPING.DEFAULT) {
      mapped = mapping.newvalue;
    } else if (matchMapping(valueType, value, mapping)) {
      return mapping.newvalue;
    }
  }
  return mapped;
}

export interface FormattableItem {
  value_type?: string;
  units?: string;
  valuemap?: { mappings?: ValueMapping[] } | [];
}

/** Zabbix formatHistoryValue(): units, value map and the 20 character trim of texts. */
export function formatHistoryValue(value: string, item: FormattableItem): string {
  const valueType = item.value_type ?? VALUE_TYPE.STR;
  const mappings = Array.isArray(item.valuemap) ? [] : item.valuemap?.mappings;
  const mapped = [VALUE_TYPE.FLOAT, VALUE_TYPE.UINT64, VALUE_TYPE.STR].includes(valueType)
    ? getMappedValue(valueType, value, mappings)
    : undefined;

  switch (valueType) {
    case VALUE_TYPE.FLOAT:
    case VALUE_TYPE.UINT64: {
      const converted = convertUnits(value, item.units);
      const text = converted.value + (converted.units !== '' ? ' ' + converted.units : '');
      return mapped !== undefined ? `${mapped} (${text})` : text;
    }
    case VALUE_TYPE.STR:
    case VALUE_TYPE.TEXT:
    case VALUE_TYPE.LOG: {
      const chars = Array.from(value);
      const trimmed = chars.length > 20 ? chars.slice(0, 20).join('') + '...' : value;
      return mapped !== undefined ? `${mapped} (${trimmed})` : trimmed;
    }
    case VALUE_TYPE.BINARY:
      return 'binary value';
  }
  return 'Unknown value type';
}

const LOG_SEVERITY: Record<string, string> = {
  '1': 'Information',
  '2': 'Warning',
  '4': 'Error',
  '7': 'Failure Audit',
  '8': 'Success Audit',
  '9': 'Critical',
  '10': 'Verbose',
};

export function logSeverityName(severity: string): string {
  return LOG_SEVERITY[severity] ?? 'Unknown';
}
