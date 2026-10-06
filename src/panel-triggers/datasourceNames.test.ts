import { renderHook, waitFor } from '@testing-library/react';
import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';
import { getDataSourceName, getDataSourceNames, useDataSourceNames } from './datasourceNames';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceSettings: jest.fn(
    async (uid: string) => ({ 'zbx-a': { name: 'Zabbix A' }, 'zbx-b': { name: 'Zabbix B' } })[uid]
  ),
}));

const mockedGetDataSourceInstanceSettings = getDataSourceInstanceSettings as jest.MockedFunction<
  typeof getDataSourceInstanceSettings
>;

const ref = (uid: string) => ({ type: 'alexanderzobnin-zabbix-datasource', uid });

describe('getDataSourceNames', () => {
  beforeEach(() => {
    mockedGetDataSourceInstanceSettings.mockClear();
  });

  it('looks up each data source once and names unknown ones by their UID', async () => {
    const names = await getDataSourceNames([ref('zbx-a'), ref('zbx-b'), ref('zbx-a'), ref('missing')]);

    expect(names).toEqual({ 'zbx-a': 'Zabbix A', 'zbx-b': 'Zabbix B', missing: 'missing' });
    expect(mockedGetDataSourceInstanceSettings).toHaveBeenCalledTimes(3);
  });

  it('does not look up data sources referenced by name', async () => {
    expect(await getDataSourceNames(['Zabbix A', undefined])).toEqual({});
    expect(mockedGetDataSourceInstanceSettings).not.toHaveBeenCalled();
  });
});

describe('getDataSourceName', () => {
  it('returns the looked up name of a data source ref', () => {
    expect(getDataSourceName(ref('zbx-a'), { 'zbx-a': 'Zabbix A' })).toBe('Zabbix A');
  });

  it('returns an empty string while the name is not looked up yet', () => {
    expect(getDataSourceName(ref('zbx-a'), {})).toBe('');
  });

  it('returns data source names as they are', () => {
    expect(getDataSourceName('Zabbix A', {})).toBe('Zabbix A');
    expect(getDataSourceName(undefined, {})).toBe('');
  });
});

describe('useDataSourceNames', () => {
  beforeEach(() => {
    mockedGetDataSourceInstanceSettings.mockClear();
  });

  it('looks up the names again only when the data sources change', async () => {
    const { result, rerender } = renderHook(({ datasources }) => useDataSourceNames(datasources), {
      initialProps: { datasources: [ref('zbx-a')] },
    });

    expect(result.current).toEqual({});
    await waitFor(() => expect(result.current).toEqual({ 'zbx-a': 'Zabbix A' }));

    rerender({ datasources: [ref('zbx-a'), ref('zbx-a')] });
    expect(mockedGetDataSourceInstanceSettings).toHaveBeenCalledTimes(1);

    rerender({ datasources: [ref('zbx-a'), ref('zbx-b')] });
    await waitFor(() => expect(result.current).toEqual({ 'zbx-a': 'Zabbix A', 'zbx-b': 'Zabbix B' }));
  });
});
