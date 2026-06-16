import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigEditor, Props } from './ConfigEditor';

const mockGetList = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {},
  getDataSourceSrv: () => ({
    getList: mockGetList,
    get: jest.fn().mockResolvedValue({ uid: 'mysql-uid', name: 'MySQL Zabbix' }),
  }),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  config: {},
  Combobox: function MockCombobox({ options = [], onChange, placeholder }: any) {
    return (
      <div data-testid="db-datasource-combobox" data-placeholder={placeholder}>
        {(options as Array<{ label: string; value: string }>).map((opt, i) => (
          <button key={i} type="button" onClick={() => onChange(opt)}>
            {opt.label}
          </button>
        ))}
      </div>
    );
  },
}));

describe('ConfigEditor', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => ({
        measureText: () => ({ width: 0 }),
        font: '',
        textAlign: '',
      }),
    });
  });

  describe('on initial render', () => {
    it('should not mutate the options object', () => {
      const options = Object.freeze({ ...getDefaultOptions() }); // freezing the options to prevent mutations
      Object.freeze(options.jsonData);
      Object.freeze(options.secureJsonData);
      Object.freeze(options.secureJsonFields);
      const onOptionsChangeSpy = jest.fn();

      expect(() => render(<ConfigEditor options={options} onOptionsChange={onOptionsChangeSpy} />)).not.toThrow();
    });

    it('should call onOptionsChange with the correct values', () => {
      const options = Object.freeze({ ...getDefaultOptions() }); // freezing the options to prevent mutations
      Object.freeze(options.jsonData);
      Object.freeze(options.secureJsonData);
      Object.freeze(options.secureJsonFields);
      const onOptionsChangeSpy = jest.fn();

      expect(() => render(<ConfigEditor options={options} onOptionsChange={onOptionsChangeSpy} />)).not.toThrow();
      expect(onOptionsChangeSpy).toHaveBeenCalledTimes(1);
      expect(onOptionsChangeSpy).toHaveBeenCalledWith({
        ...getDefaultOptions(),
        jsonData: {
          ...getDefaultOptions().jsonData,
          authType: 'userLogin',
          timeout: undefined,
          password: undefined, // password should be missing from jsonData
        },
        secureJsonData: {
          ...getDefaultOptions().secureJsonData,
          password: 'a password', // password should be present in secureJsonData
        },
      });
    });

    it('should not update password in secureJsonData if the field already exists in secureJsonFields', () => {
      const options = Object.freeze({ ...getDefaultOptions(), secureJsonFields: { password: true } }); // freezing the options to prevent mutations
      Object.freeze(options.jsonData);
      Object.freeze(options.secureJsonData);
      Object.freeze(options.secureJsonFields);
      const onOptionsChangeSpy = jest.fn();

      expect(() => render(<ConfigEditor options={options} onOptionsChange={onOptionsChangeSpy} />)).not.toThrow();
      expect(onOptionsChangeSpy).toHaveBeenCalledTimes(1);
      expect(onOptionsChangeSpy).toHaveBeenCalledWith({
        ...getDefaultOptions(),
        jsonData: {
          ...getDefaultOptions().jsonData,
          authType: 'userLogin',
          timeout: undefined,
          password: undefined, // password should be missing from jsonData
        },
        secureJsonData: {}, // password should be missing from secureJsonData
        secureJsonFields: { ...getDefaultOptions().secureJsonFields, password: true },
      });
    });
  });

  describe('Direct DB datasource selection', () => {
    beforeEach(() => {
      mockGetList.mockReturnValue([
        { id: 1, uid: 'mysql-uid', name: 'MySQL Zabbix', type: 'mysql' },
        { id: 2, uid: 'influx-uid', name: 'InfluxDB', type: 'influxdb' },
      ]);
    });

    it('calls onOptionsChange with dbConnectionDatasourceUID when user selects a DB datasource', async () => {
      const options = getDefaultOptions();
      options.jsonData = {
        ...options.jsonData,
        dbConnectionEnable: true,
      };
      const onOptionsChangeSpy = jest.fn();

      render(<ConfigEditor options={options} onOptionsChange={onOptionsChangeSpy} />);

      const mysqlButton = screen.getByRole('button', { name: 'MySQL Zabbix' });
      await userEvent.click(mysqlButton);

      expect(onOptionsChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonData: expect.objectContaining({
            dbConnectionDatasourceUID: 'mysql-uid',
            dbConnectionDatasourceName: 'MySQL Zabbix',
          }),
        })
      );
    });
  });
});

function getDefaultOptions(): Props['options'] {
  return {
    id: 1,
    orgId: 1,
    uid: '',
    name: '',
    typeLogoUrl: '',
    type: '',
    typeName: '',
    access: '',
    url: '',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthUser: '',
    isDefault: false,
    jsonData: {
      cacheTTL: '',
      dbConnectionEnable: false,
      disableDataAlignment: false,
      disableReadOnlyUsersAck: false,
      trends: false,
      trendsFrom: '',
      trendsRange: '',
      username: '',
      password: 'a password',
    },
    readOnly: false,
    secureJsonData: {},
    secureJsonFields: {},
    withCredentials: false,
  };
}
