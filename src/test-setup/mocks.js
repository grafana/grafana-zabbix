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

export let timeSrvMock = {
  timeRange: jest.fn().mockReturnValue({ from: '', to: '' })
};

export let zabbixAlertingSrvMock = {
  setPanelAlertState: jest.fn(),
  removeZabbixThreshold: jest.fn(),
};

const defaultExports = {
  templateSrvMock,
  backendSrvMock,
  datasourceSrvMock,
  timeSrvMock,
  zabbixAlertingSrvMock
};

export default defaultExports;
