export enum HostTagOperatorLabel {
  Exists = 'Exists',
  Equals = 'Equals',
  Contains = 'Contains',
  DoesNotExist = 'Does not exist',
  DoesNotEqual = 'Does not equal',
  DoesNotContain = 'Does not contain',
}

export enum HostTagOperatorValue {
  Contains = '0', // default
  Equals = '1',
  DoesNotContain = '2',
  DoesNotEqual = '3',
  Exists = '4',
  DoesNotExist = '5',
}
