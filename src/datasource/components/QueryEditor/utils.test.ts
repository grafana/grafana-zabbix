import { getTemplateSrv } from '@grafana/runtime';
import { getHostTagOptionLabel, getVariableOptions, processHostTags } from './utils';
import { HostTagOperatorLabel, HostTagOperatorLabelBefore70, HostTagOperatorValue } from './types';

jest.mock(
  '@grafana/runtime',
  () => ({
    getTemplateSrv: jest.fn(),
  }),
  { virtual: true }
);

describe('QueryEditor utils', () => {
  describe('getVariableOptions', () => {
    it('returns template variables except datasource and interval types', () => {
      (getTemplateSrv as jest.Mock).mockReturnValue({
        getVariables: jest.fn().mockReturnValue([
          { name: 'env', type: 'query' },
          { name: 'ds', type: 'datasource' },
          { name: 'step', type: 'interval' },
          { name: 'region', type: 'custom' },
        ]),
      });

      const options = getVariableOptions();

      expect(options).toEqual([
        { label: '$env', value: '$env' },
        { label: '$region', value: '$region' },
      ]);
    });
  });

  describe('processHostTags', () => {
    it('deduplicates tags by tag key', () => {
      const tags = processHostTags([
        {
          host: 'a',
          name: 'a',
          tags: [
            { tag: 'env', value: 'prod' },
            { tag: 'role', value: 'api' },
          ],
        },
        {
          host: 'b',
          name: 'b',
          tags: [
            { tag: 'env', value: 'stage' },
            { tag: 'region', value: 'eu' },
          ],
        },
        { host: 'c', name: 'c' },
      ]);

      expect(tags).toEqual([
        { tag: 'env', value: 'prod' },
        { tag: 'role', value: 'api' },
        { tag: 'region', value: 'eu' },
      ]);
    });
  });

  describe('getHostTagOptionLabel', () => {
    it('returns pre-7.0 labels for legacy versions', () => {
      expect(getHostTagOptionLabel(HostTagOperatorValue.DoesNotExist, '6.4.0')).toBe(
        HostTagOperatorLabelBefore70.NotExist
      );
      expect(getHostTagOptionLabel(HostTagOperatorValue.DoesNotEqual, '6.0.0')).toBe(
        HostTagOperatorLabelBefore70.NotEqual
      );
      expect(getHostTagOptionLabel(HostTagOperatorValue.DoesNotContain, '5.0.0')).toBe(
        HostTagOperatorLabelBefore70.NotLike
      );
    });

    it('returns current labels for 7.0 and newer', () => {
      expect(getHostTagOptionLabel(HostTagOperatorValue.DoesNotExist, '7.0.0')).toBe(HostTagOperatorLabel.DoesNotExist);
      expect(getHostTagOptionLabel(HostTagOperatorValue.DoesNotEqual, '7.1.0')).toBe(HostTagOperatorLabel.DoesNotEqual);
      expect(getHostTagOptionLabel(HostTagOperatorValue.DoesNotContain, '7.2.0')).toBe(
        HostTagOperatorLabel.DoesNotContain
      );
    });

    it('returns empty string for unsupported values', () => {
      expect(getHostTagOptionLabel(HostTagOperatorValue.Equals, '7.2.0')).toBe('');
    });
  });
});
