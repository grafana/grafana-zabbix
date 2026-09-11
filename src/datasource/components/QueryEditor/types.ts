// Zabbix tag-filter operators are shared by host.get, problem.get and event.get
// (same numeric values), so the enums are generic. The Host* names are kept as
// aliases for existing imports.
export enum TagOperatorLabel {
  Exists = 'Exists',
  Equals = 'Equals',
  Contains = 'Contains',
  DoesNotExist = 'Does not exist',
  DoesNotEqual = 'Does not equal',
  DoesNotContain = 'Does not contain',
}

export enum TagOperatorValue {
  Contains = '0', // default
  Equals = '1',
  DoesNotContain = '2',
  DoesNotEqual = '3',
  Exists = '4',
  DoesNotExist = '5',
}

export enum TagOperatorLabelBefore70 {
  NotExist = 'Not exists',
  NotEqual = 'Not equal',
  NotLike = 'Not like',
}

export {
  TagOperatorLabel as HostTagOperatorLabel,
  TagOperatorValue as HostTagOperatorValue,
  TagOperatorLabelBefore70 as HostTagOperatorLabelBefore70,
};
