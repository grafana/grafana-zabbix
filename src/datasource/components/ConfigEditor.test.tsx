import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  describe('per-user authentication', () => {
    const originalFetch = window.fetch;
    afterEach(() => {
      window.fetch = originalFetch;
    });

    it('hides the per-user auth fields when the feature is disabled', () => {
      window.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
      render(<ConfigEditor options={getDefaultOptions()} onOptionsChange={jest.fn()} />);

      expect(screen.queryByText('User identity field')).not.toBeInTheDocument();
      expect(screen.queryByText('Exclude users from per-user authentication')).not.toBeInTheDocument();
    });

    it('shows the identity field and exclude-users list when enabled', async () => {
      window.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ login: 'admin' }, { login: 'alice' }],
      } as Response);
      const options = getDefaultOptions();
      options.jsonData = { ...options.jsonData, perUserAuth: true };

      render(<ConfigEditor options={options} onOptionsChange={jest.fn()} />);

      expect(await screen.findByText('User identity field')).toBeInTheDocument();
      expect(screen.getByText('Exclude users from per-user authentication')).toBeInTheDocument();
    });

    it('shows a warning when the user lacks permission to list Grafana users', async () => {
      window.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) } as Response);
      const options = getDefaultOptions();
      options.jsonData = { ...options.jsonData, perUserAuth: true };

      render(<ConfigEditor options={options} onOptionsChange={jest.fn()} />);

      expect(await screen.findByText('Cannot list Grafana users')).toBeInTheDocument();
      expect(screen.getByText(/Grafana Admin permissions/)).toBeInTheDocument();
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

describe('ConfigEditor severity overrides', () => {
  it('renders one row per severity with the default name as placeholder', () => {
    render(<ConfigEditor options={getDefaultOptions()} onOptionsChange={jest.fn()} />);

    expect(screen.getByText('Problem severity')).toBeInTheDocument();
    for (const name of ['Not classified', 'Information', 'Warning', 'Average', 'High', 'Disaster']) {
      expect(screen.getByPlaceholderText(name)).toHaveValue('');
    }
  });

  it('stores a name override and drops the entry again when the name is cleared', () => {
    const onOptionsChange = jest.fn();
    const options = getDefaultOptions();
    render(<ConfigEditor options={options} onOptionsChange={onOptionsChange} />);
    onOptionsChange.mockClear();

    fireEvent.change(screen.getByLabelText('High name override'), { target: { value: 'Critical' } });
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({ severityOverrides: [{ priority: 4, name: 'Critical' }] }),
      })
    );

    const withOverride = {
      ...options,
      jsonData: { ...options.jsonData, severityOverrides: [{ priority: 4, name: 'Critical' }] },
    };
    onOptionsChange.mockClear();
    render(<ConfigEditor options={withOverride} onOptionsChange={onOptionsChange} />);
    onOptionsChange.mockClear();
    const input = screen.getAllByLabelText('High name override')[1];
    expect(input).toHaveValue('Critical');
    fireEvent.change(input, { target: { value: '' } });
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ jsonData: expect.objectContaining({ severityOverrides: undefined }) })
    );
  });

  it('resets a color override and keeps the name of the same severity', () => {
    const onOptionsChange = jest.fn();
    const options = getDefaultOptions();
    options.jsonData = {
      ...options.jsonData,
      severityOverrides: [
        { priority: 2, color: '#ffff00' },
        { priority: 5, name: 'Outage', color: '#000000' },
      ],
    };
    render(<ConfigEditor options={options} onOptionsChange={onOptionsChange} />);
    onOptionsChange.mockClear();

    fireEvent.click(screen.getByLabelText('Reset Disaster color to default'));
    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({
          severityOverrides: [
            { priority: 2, color: '#ffff00' },
            { priority: 5, name: 'Outage' },
          ],
        }),
      })
    );
    // no reset button for severities without a color override
    expect(screen.queryByLabelText('Reset High color to default')).not.toBeInTheDocument();
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
