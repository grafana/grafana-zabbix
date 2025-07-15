import React from 'react';
import { render } from '@testing-library/react';
import { ConfigEditor, Props } from './ConfigEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {},
}));

describe('ConfigEditor', () => {
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
      expect(onOptionsChangeSpy).toBeCalledTimes(1);
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
      expect(onOptionsChangeSpy).toBeCalledTimes(1);
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
