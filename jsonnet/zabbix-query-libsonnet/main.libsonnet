{
  '#': { filename: 'main.libsonnet', help: 'Jsonnet library for creating Zabbix queries for Grafana.\n## Install\n\n```\njb install https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet@main\n```\n\n## Usage\n\n```jsonnet\nlocal zabbixQuery = import "https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet/main.libsonnet"\n```\n', 'import': 'https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet/main.libsonnet', installTemplate: '\n## Install\n\n```\njb install %(url)s@%(version)s\n```\n', name: 'zabbixQuery', url: 'https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet', usageTemplate: '\n## Usage\n\n```jsonnet\nlocal %(name)s = import "%(import)s"\n```\n', version: 'main' },
  withApplication(value): { application: value },
  withApplicationMixin(value): { application+: value },
  application+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { application+: { filter: value } },
      '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withName(value): { application+: { name: value } },
    },
  '#withCountTriggersBy': { 'function': { args: [{ default: null, enums: ['problems', 'items', ''], name: 'value', type: ['string'] }], help: '' } },
  withCountTriggersBy(value): { countTriggersBy: value },
  withDatasource(value): { datasource: value },
  withDatasourceMixin(value): { datasource+: value },
  datasource+:
    {
      '#withType': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: 'The plugin type-id' } },
      withType(value): { datasource+: { type: value } },
      '#withUid': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: 'Specific datasource instance' } },
      withUid(value): { datasource+: { uid: value } },
    },
  '#withDatasourceId': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
  withDatasourceId(value): { datasourceId: value },
  '#withEvaltype': { 'function': { args: [{ default: null, enums: ['0', '2'], name: 'value', type: ['string'] }], help: '' } },
  withEvaltype(value): { evaltype: value },
  '#withFunctions': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
  withFunctions(value): { functions: (if std.isArray(value)
                                      then value
                                      else [value]) },
  '#withFunctionsMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
  withFunctionsMixin(value): { functions+: (if std.isArray(value)
                                            then value
                                            else [value]) },
  functions+:
    {
      '#': { help: '', name: 'functions' },
      '#withAdded': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withAdded(value=true): { added: value },
      '#withDef': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['object'] }], help: '' } },
      withDef(value): { def: value },
      '#withDefMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['object'] }], help: '' } },
      withDefMixin(value): { def+: value },
      def+:
        {
          '#withCategory': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
          withCategory(value): { def+: { category: value } },
          '#withDefaultParams': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
          withDefaultParams(value): { def+: { defaultParams: (if std.isArray(value)
                                                              then value
                                                              else [value]) } },
          '#withDefaultParamsMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
          withDefaultParamsMixin(value): { def+: { defaultParams+: (if std.isArray(value)
                                                                    then value
                                                                    else [value]) } },
          '#withDescription': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
          withDescription(value): { def+: { description: value } },
          '#withFake': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
          withFake(value=true): { def+: { fake: value } },
          '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
          withName(value): { def+: { name: value } },
          '#withParams': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
          withParams(value): { def+: { params: (if std.isArray(value)
                                                then value
                                                else [value]) } },
          '#withParamsMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
          withParamsMixin(value): { def+: { params+: (if std.isArray(value)
                                                      then value
                                                      else [value]) } },
          params+:
            {
              '#': { help: '', name: 'params' },
              '#withMultiple': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
              withMultiple(value=true): { multiple: value },
              '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
              withName(value): { name: value },
              '#withOptional': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
              withOptional(value=true): { optional: value },
              '#withOptions': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
              withOptions(value): { options: (if std.isArray(value)
                                              then value
                                              else [value]) },
              '#withOptionsMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
              withOptionsMixin(value): { options+: (if std.isArray(value)
                                                    then value
                                                    else [value]) },
              '#withType': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
              withType(value): { type: value },
              '#withVersion': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
              withVersion(value): { version: value },
            },
          '#withShortName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
          withShortName(value): { def+: { shortName: value } },
          '#withUnknown': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: 'True if the function was not found on the list of available function descriptions.' } },
          withUnknown(value=true): { def+: { unknown: value } },
          '#withVersion': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
          withVersion(value): { def+: { version: value } },
        },
      '#withParams': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
      withParams(value): { params: (if std.isArray(value)
                                    then value
                                    else [value]) },
      '#withParamsMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
      withParamsMixin(value): { params+: (if std.isArray(value)
                                          then value
                                          else [value]) },
      '#withText': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withText(value): { text: value },
    },
  withGroup(value): { group: value },
  withGroupMixin(value): { group+: value },
  group+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { group+: { filter: value } },
      '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withName(value): { group+: { name: value } },
    },
  '#withHide': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: 'true if query is disabled (ie should not be returned to the dashboard) Note this does not always imply that the query should not be executed since the results from a hidden query may be used as the input to other queries (SSE etc)' } },
  withHide(value=true): { hide: value },
  withHost(value): { host: value },
  withHostMixin(value): { host+: value },
  host+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { host+: { filter: value } },
      '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withName(value): { host+: { name: value } },
    },
  '#withHostFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withHostFilter(value): { hostFilter: value },
  '#withItServiceFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withItServiceFilter(value): { itServiceFilter: value },
  withItem(value): { item: value },
  withItemMixin(value): { item+: value },
  item+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { item+: { filter: value } },
      '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withName(value): { item+: { name: value } },
    },
  '#withItemFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withItemFilter(value): { itemFilter: value },
  withItemTag(value): { itemTag: value },
  withItemTagMixin(value): { itemTag+: value },
  itemTag+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { itemTag+: { filter: value } },
      '#withName': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withName(value): { itemTag+: { name: value } },
    },
  '#withItemids': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withItemids(value): { itemids: value },
  '#withKey': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: 'Unique, guid like, string (used only in explore mode)' } },
  withKey(value): { key: value },
  withMacro(value): { macro: value },
  withMacroMixin(value): { macro+: value },
  macro+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { macro+: { filter: value } },
      '#withMacro': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withMacro(value): { macro: value },
    },
  '#withMacroFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withMacroFilter(value): { macroFilter: value },
  '#withMode': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
  withMode(value): { mode: value },
  withOptions(value): { options: value },
  withOptionsMixin(value): { options+: value },
  options+:
    {
      '#withAcknowledged': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
      withAcknowledged(value): { options+: { acknowledged: value } },
      '#withCount': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withCount(value=true): { options+: { count: value } },
      '#withDisableDataAlignment': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withDisableDataAlignment(value=true): { options+: { disableDataAlignment: value } },
      '#withHideAcknowledged': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withHideAcknowledged(value=true): { options+: { hideAcknowledged: value } },
      '#withHostProxy': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withHostProxy(value=true): { options+: { hostProxy: value } },
      '#withHostsInMaintenance': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withHostsInMaintenance(value=true): { options+: { hostsInMaintenance: value } },
      '#withLimit': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
      withLimit(value): { options+: { limit: value } },
      '#withMinSeverity': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
      withMinSeverity(value): { options+: { minSeverity: value } },
      '#withSeverities': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
      withSeverities(value): { options+: { severities: (if std.isArray(value)
                                                        then value
                                                        else [value]) } },
      '#withSeveritiesMixin': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['array'] }], help: '' } },
      withSeveritiesMixin(value): { options+: { severities+: (if std.isArray(value)
                                                              then value
                                                              else [value]) } },
      '#withShowDisabledItems': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withShowDisabledItems(value=true): { options+: { showDisabledItems: value } },
      '#withShowHostname': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withShowHostname(value=true): { options+: { showHostname: value } },
      '#withShowOkEvents': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withShowOkEvents(value=true): { options+: { showOkEvents: value } },
      '#withSkipEmptyValues': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withSkipEmptyValues(value=true): { options+: { skipEmptyValues: value } },
      '#withSortProblems': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withSortProblems(value): { options+: { sortProblems: value } },
      '#withUseTimeRange': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withUseTimeRange(value=true): { options+: { useTimeRange: value } },
      '#withUseTrends': { 'function': { args: [{ default: null, enums: ['default', 'true', 'false'], name: 'value', type: ['string'] }], help: '' } },
      withUseTrends(value): { options+: { useTrends: value } },
      '#withUseZabbixValueMapping': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withUseZabbixValueMapping(value=true): { options+: { useZabbixValueMapping: value } },
    },
  withProxy(value): { proxy: value },
  withProxyMixin(value): { proxy+: value },
  proxy+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { proxy+: { filter: value } },
    },
  '#withQueryType': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: 'Specify the query flavor TODO make this required and give it a default' } },
  withQueryType(value): { queryType: value },
  '#withRefId': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: 'A unique identifier for the query within the list of targets. In server side expressions, the refId is used as a variable name to identify results. By default, the UI will assign A->Z; however setting meaningful names may be useful.' } },
  withRefId(value): { refId: value },
  '#withSchema': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
  withSchema(value): { schema: value },
  '#withShowProblems': { 'function': { args: [{ default: null, enums: ['problems', 'recent', 'history'], name: 'value', type: ['string'] }], help: '' } },
  withShowProblems(value): { showProblems: value },
  '#withSlaFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withSlaFilter(value): { slaFilter: value },
  '#withSlaInterval': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withSlaInterval(value): { slaInterval: value },
  '#withSlaProperty': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withSlaProperty(value): { slaProperty: value },
  withTags(value): { tags: value },
  withTagsMixin(value): { tags+: value },
  tags+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { tags+: { filter: value } },
    },
  '#withTextFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
  withTextFilter(value): { textFilter: value },
  withTrigger(value): { trigger: value },
  withTriggerMixin(value): { trigger+: value },
  trigger+:
    {
      '#withFilter': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['string'] }], help: '' } },
      withFilter(value): { trigger+: { filter: value } },
    },
  withTriggers(value): { triggers: value },
  withTriggersMixin(value): { triggers+: value },
  triggers+:
    {
      '#withAcknowledged': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
      withAcknowledged(value): { triggers+: { acknowledged: value } },
      '#withCount': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
      withCount(value=true): { triggers+: { count: value } },
      '#withMinSeverity': { 'function': { args: [{ default: null, enums: null, name: 'value', type: ['number'] }], help: '' } },
      withMinSeverity(value): { triggers+: { minSeverity: value } },
    },
  '#withUseCaptureGroups': { 'function': { args: [{ default: true, enums: null, name: 'value', type: ['boolean'] }], help: '' } },
  withUseCaptureGroups(value=true): { useCaptureGroups: value },
}
