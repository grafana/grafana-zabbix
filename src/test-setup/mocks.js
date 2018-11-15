export let templateSrvMock = {
  replace: jest.fn().mockImplementation(query => query)
};

export let backendSrvMock = {
  datasourceRequest: jest.fn()
};

export let datasourceSrvMock = {
  loadDatasource: jest.fn(),
  getAll: jest.fn()
};

export let zabbixAlertingSrvMock = {
  setPanelAlertState: jest.fn(),
  removeZabbixThreshold: jest.fn(),
};

const defaultExports = {
  templateSrvMock,
  backendSrvMock,
  datasourceSrvMock,
  zabbixAlertingSrvMock
};

export default defaultExports;
