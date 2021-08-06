import React from 'react';
import { config, GrafanaBootConfig } from '@grafana/runtime';
import { ThemeContext } from '@grafana/ui';
import { createTheme } from '@grafana/data';

export const ConfigContext = React.createContext<GrafanaBootConfig>(config);
export const ConfigConsumer = ConfigContext.Consumer;

export const provideConfig = (component: React.ComponentType<any>) => {
  const ConfigProvider = (props: any) => (
    <ConfigContext.Provider value={config}>{React.createElement(component, { ...props })}</ConfigContext.Provider>
  );

  return ConfigProvider;
};

export const getCurrentTheme = () => createTheme({
  colors: {
    mode: config.bootData.user.lightTheme ? 'light' : 'dark',
  },
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ConfigConsumer>
      {config => {
        return <ThemeContext.Provider value={getCurrentTheme()}>{children}</ThemeContext.Provider>;
      }}
    </ConfigConsumer>
  );
};

export const provideTheme = (component: React.ComponentType<any>) => {
  return provideConfig((props: any) => <ThemeProvider>{React.createElement(component, { ...props })}</ThemeProvider>);
};
