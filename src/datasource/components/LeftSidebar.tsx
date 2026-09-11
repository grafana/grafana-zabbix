import React from 'react';
import { css } from '@emotion/css';
import { Box, Icon, LinkButton, Space, Stack, Text, useStyles2 } from '@grafana/ui';

export interface ConfigSectionHeader {
  label: string;
  id: string;
  isOptional: boolean;
}

// The Grafana "Save & test" button doesn't carry an element id, so the sidebar
// entry for it falls back to scrolling to the bottom of the page.
export const SAVE_AND_TEST_SECTION_ID = 'zabbix-config-save-and-test';

export const CONFIG_SECTION_HEADERS: ConfigSectionHeader[] = [
  { label: 'Zabbix connection', id: 'zabbix-config-connection', isOptional: false },
  { label: 'TLS/SSL settings', id: 'zabbix-config-tls', isOptional: true },
  { label: 'HTTP settings', id: 'zabbix-config-http', isOptional: true },
  { label: 'Additional settings', id: 'zabbix-config-additional-settings', isOptional: true },
  { label: 'Save & test', id: SAVE_AND_TEST_SECTION_ID, isOptional: false },
];

export const LeftSidebar = () => {
  const styles = useStyles2(getStyles);

  return (
    <Stack>
      <Box flex={1} marginY={1}>
        <Text element="h4">Connect data source</Text>
        <Box paddingTop={2}>
          {CONFIG_SECTION_HEADERS.map((header) => (
            <div key={header.id} data-testid={`${header.label}-sidebar`}>
              <Icon name="circle" size="xs" />
              <LinkButton
                style={header.isOptional ? { padding: '5px 15px', height: '50px' } : {}}
                variant="secondary"
                fill="text"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById(header.id);
                  if (target) {
                    const top = target.getBoundingClientRect().top + window.scrollY - 60;
                    window.scrollTo({ top, behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }
                }}
              >
                <div className={styles.sidebarText}>
                  <div className={styles.sidebarLabel}>{header.label}</div>
                  {header.isOptional && (
                    <div className={styles.sidebarOptional}>
                      <Text color="secondary" variant="bodySmall">
                        optional
                      </Text>
                    </div>
                  )}
                </div>
              </LinkButton>
              <Space v={1} />
            </div>
          ))}
        </Box>
      </Box>
    </Stack>
  );
};

const getStyles = () => ({
  sidebarText: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  sidebarLabel: css({
    display: 'flex',
    alignItems: 'center',
    marginBottom: 0,
    lineHeight: 1,
  }),
  sidebarOptional: css({
    marginTop: 0,
    marginBottom: 0,
    lineHeight: 1,
    textAlign: 'left',
  }),
});
