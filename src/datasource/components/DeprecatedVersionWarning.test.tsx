import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { getBackendSrv } from '@grafana/runtime';
import { DeprecatedVersionWarning } from './DeprecatedVersionWarning';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockPost = (post: jest.Mock) => (getBackendSrv as jest.Mock).mockReturnValue({ post });

const flushRequests = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe('DeprecatedVersionWarning', () => {
  it.each(['5.0.47', '5.2.7', '5.4.12'])('shows a warning for Zabbix %s', async (version) => {
    const post = jest.fn().mockResolvedValue({ result: version });
    mockPost(post);

    render(<DeprecatedVersionWarning datasourceUid="zabbix-uid" />);

    expect(await screen.findByText(`Zabbix ${version} is not supported in plugin version 7.0`)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      '/api/datasources/uid/zabbix-uid/resources/zabbix-api',
      { method: 'apiinfo.version', params: {} },
      { showErrorAlert: false }
    );
  });

  it.each(['6.0.0', '7.0.5', '8.0.0alpha1'])('shows nothing for Zabbix %s', async (version) => {
    mockPost(jest.fn().mockResolvedValue({ result: version }));

    render(<DeprecatedVersionWarning datasourceUid="zabbix-uid" />);
    await flushRequests();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows nothing when the version request fails', async () => {
    mockPost(jest.fn().mockRejectedValue(new Error('connection refused')));

    render(<DeprecatedVersionWarning datasourceUid="zabbix-uid" />);
    await flushRequests();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
