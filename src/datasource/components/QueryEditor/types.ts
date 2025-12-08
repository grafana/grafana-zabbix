export enum HostTagOperatorLabel {
  Exists = 'Exists',
  Equals = 'Equals',
  Contains = 'Contains',
  DoesNotExist = 'Does not exist',
  DoesNotEqual = 'Does not equal',
  DoesNotContain = 'Does not contain',
}

export enum HostTagOperatorValue {
  Equals = '0',
  Contains = '1',
  DoesNotContain = '2',
  DoesNotEqual = '3',
  Exists = '4',
  DoesNotExist = '5',
}

export interface HostTagFilter {
  hostTagName: string;
  operator: string;
  hostTagValue?: string;
}
