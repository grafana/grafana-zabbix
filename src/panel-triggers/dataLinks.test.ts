import { getTemplateSrv } from '@grafana/runtime';
import { getProblemsDataLinks, tagNameToVariable } from './dataLinks';
import { ProblemDTO } from '../datasource/types';

jest.mock(
  '@grafana/runtime',
  () => ({
    getTemplateSrv: jest.fn(),
  }),
  { virtual: true }
);

// Mimics templateSrv scoped-var substitution: known vars are replaced, unknown ones are left as-is
const replace = (target: string, scopedVars: any) =>
  (target ?? '').replace(/\$\{(\w+)\}/g, (match, name) => scopedVars[name]?.value ?? match);

const problem: ProblemDTO = {
  timestamp: 0,
  host: 'web-01',
  name: 'High CPU',
  triggerid: '100',
  eventid: '200',
  tags: [
    { tag: 'component', value: 'network' },
    { tag: '.category', value: 'infra' },
    { tag: 'interface-status', value: 'down' },
    { tag: 'novalue' },
  ],
};

describe('getProblemsDataLinks', () => {
  beforeEach(() => {
    (getTemplateSrv as jest.Mock).mockReturnValue({ replace });
  });

  it('interpolates problem fields', () => {
    const links = getProblemsDataLinks([{ title: '${name}', url: '/d/x?host=${host}&event=${eventid}' }], problem);
    expect(links[0].title).toBe('High CPU');
    expect(links[0].href).toBe('/d/x?host=web-01&event=200');
  });

  it('interpolates tag values via ${tag_<name>}', () => {
    const links = getProblemsDataLinks([{ title: 'link', url: '/d/x?c=${tag_component}' }], problem);
    expect(links[0].href).toBe('/d/x?c=network');
  });

  it('normalizes special characters in tag names to underscores', () => {
    const links = getProblemsDataLinks(
      [{ title: 'link', url: '/d/x?cat=${tag__category}&if=${tag_interface_status}' }],
      problem
    );
    expect(links[0].href).toBe('/d/x?cat=infra&if=down');
  });

  it('resolves referenced tags missing on the problem to an empty string', () => {
    const links = getProblemsDataLinks([{ title: 'link', url: '/d/x?m=${tag_missing}&c=${tag_component}' }], problem);
    expect(links[0].href).toBe('/d/x?m=&c=network');
  });

  it('picks the alphabetically smallest value when multiple tags share a name, regardless of order', () => {
    const url = '/d/x?s=${tag_scope}';
    const multiTag: ProblemDTO = {
      ...problem,
      tags: [
        { tag: 'scope', value: 'performance' },
        { tag: 'scope', value: 'availability' },
        { tag: 'scope', value: 'notice' },
      ],
    };
    expect(getProblemsDataLinks([{ title: 'link', url }], multiTag)[0].href).toBe('/d/x?s=availability');

    const reversed: ProblemDTO = { ...multiTag, tags: [...multiTag.tags!].reverse() };
    expect(getProblemsDataLinks([{ title: 'link', url }], reversed)[0].href).toBe('/d/x?s=availability');
  });

  it('resolves tags without a value to an empty string', () => {
    const links = getProblemsDataLinks([{ title: 'link', url: '/d/x?v=${tag_novalue}' }], problem);
    expect(links[0].href).toBe('/d/x?v=');
  });

  it('sets link target from targetBlank', () => {
    const links = getProblemsDataLinks(
      [
        { title: 'a', url: '/a', targetBlank: true },
        { title: 'b', url: '/b' },
      ],
      problem
    );
    expect(links[0].target).toBe('_blank');
    expect(links[1].target).toBe('_self');
  });
});

describe('tagNameToVariable', () => {
  it.each([
    ['component', 'tag_component'],
    ['.category', 'tag__category'],
    ['interface-status', 'tag_interface_status'],
    ['_id', 'tag__id'],
    ['app:name', 'tag_app_name'],
  ])('maps %s to %s', (tag, expected) => {
    expect(tagNameToVariable(tag)).toBe(expected);
  });
});
