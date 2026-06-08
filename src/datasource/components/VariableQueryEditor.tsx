import React, { PureComponent } from 'react';
import { useAsyncFn } from 'react-use';
import { parseLegacyVariableQuery } from '../utils';
import { VariableQuery, VariableQueryData, VariableQueryProps, VariableQueryTypes } from '../types';
import { HostTagFilter, ZabbixTagEvalType } from '../types/query';
import { ZabbixInput } from './ZabbixInput';
import { Combobox, ComboboxOption, InlineField, InlineFieldRow, InlineFormLabel, Input, Switch } from '@grafana/ui';
import { HostTagQueryEditor } from './QueryEditor/HostTagQueryEditor';
import { processHostTags } from './QueryEditor/utils';

export class ZabbixVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
  queryTypes: Array<ComboboxOption<VariableQueryTypes>> = [
    { value: VariableQueryTypes.Group, label: 'Group' },
    { value: VariableQueryTypes.Host, label: 'Host' },
    { value: VariableQueryTypes.Application, label: 'Application' },
    { value: VariableQueryTypes.ItemTag, label: 'Item tag' },
    { value: VariableQueryTypes.Item, label: 'Item' },
    { value: VariableQueryTypes.ItemValues, label: 'Item values' },
  ];

  defaults: VariableQueryData = {
    selectedQueryType: { value: VariableQueryTypes.Group, label: 'Group' },
    queryType: VariableQueryTypes.Group,
    group: '/.*/',
    host: '',
    application: '',
    itemTag: '',
    item: '',
    showDisabledItems: false,
    hostTags: [],
  };

  constructor(props: VariableQueryProps) {
    super(props);

    if (this.props.query && typeof this.props.query === 'string') {
      // Backward compatibility
      const query = parseLegacyVariableQuery(this.props.query);
      const selectedQueryType = this.getSelectedQueryType(query.queryType);
      this.state = {
        selectedQueryType,
        legacyQuery: this.props.query,
        ...query,
      };
    } else if (this.props.query) {
      const query = this.props.query as VariableQuery;
      const selectedQueryType = this.getSelectedQueryType(query.queryType);
      this.state = {
        ...this.defaults,
        ...query,
        selectedQueryType,
      };
    } else {
      this.state = this.defaults;
    }
  }

  getSelectedQueryType(queryType: VariableQueryTypes) {
    return this.queryTypes.find((q) => q.value === queryType);
  }

  handleQueryUpdate = (evt: React.ChangeEvent<HTMLInputElement>, prop: string) => {
    const value = evt.currentTarget.value;
    this.setState((prevState: VariableQueryData) => {
      const newQuery = {
        ...prevState,
      };
      newQuery[prop] = value;

      return {
        ...newQuery,
      };
    });
  };

  buildQueryModel(overrides: Partial<VariableQuery> = {}): VariableQuery {
    const { queryType, group, host, application, itemTag, item, showDisabledItems, hostTags, evaltype } = this.state;
    return {
      queryType,
      group,
      host,
      application,
      itemTag,
      item,
      showDisabledItems,
      hostTags,
      evaltype,
      ...overrides,
    };
  }

  handleQueryChange = () => {
    const queryModel = this.buildQueryModel();
    this.props.onChange(queryModel, `Zabbix - ${queryModel.queryType}`);
  };

  handleQueryTypeChange = (selectedItem: ComboboxOption<VariableQueryTypes>) => {
    this.setState({
      ...this.state,
      selectedQueryType: selectedItem,
      queryType: selectedItem.value,
    });

    const queryType = selectedItem.value;
    const queryModel = this.buildQueryModel({ queryType });
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  };

  handleShowDisabledItemsChange = (evt: React.FormEvent<HTMLInputElement>) => {
    const showDisabledItems = (evt.target as any).checked;
    this.setState((prevState: VariableQueryData) => {
      return {
        ...prevState,
        showDisabledItems: showDisabledItems,
      };
    });

    const queryModel = this.buildQueryModel({ showDisabledItems });
    this.props.onChange(queryModel, `Zabbix - ${queryModel.queryType}`);
  };

  handleHostTagsChange = (hostTags: HostTagFilter[]) => {
    const prev = this.state.hostTags ?? [];
    if (prev.length === hostTags.length && prev.every((f, i) => f === hostTags[i])) {
      return;
    }
    this.setState({ ...this.state, hostTags });
    const queryModel = this.buildQueryModel({ hostTags });
    this.props.onChange(queryModel, `Zabbix - ${queryModel.queryType}`);
  };

  handleHostTagEvalTypeChange = (evaltype: ZabbixTagEvalType) => {
    if (this.state.evaltype === evaltype) {
      return;
    }
    this.setState({ ...this.state, evaltype });
    const queryModel = this.buildQueryModel({ evaltype });
    this.props.onChange(queryModel, `Zabbix - ${queryModel.queryType}`);
  };

  render() {
    const {
      selectedQueryType,
      legacyQuery,
      group,
      host,
      application,
      itemTag,
      item,
      showDisabledItems,
      hostTags,
      evaltype,
    } = this.state;
    const { datasource } = this.props;
    const supportsItemTags = datasource?.zabbix?.isZabbix54OrHigherSync() || false;

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Query Type" labelWidth={18}>
            <Combobox
              width={30}
              value={selectedQueryType}
              options={this.queryTypes}
              onChange={this.handleQueryTypeChange}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField label="Group" labelWidth={18}>
            <ZabbixInput
              width={30}
              value={group}
              onChange={(evt) => this.handleQueryUpdate(evt, 'group')}
              onBlur={this.handleQueryChange}
            />
          </InlineField>
        </InlineFieldRow>

        {selectedQueryType.value !== VariableQueryTypes.Group && (
          <InlineFieldRow>
            <InlineField label="Host tag" labelWidth={18}>
              <HostTagFilterLoader
                datasource={datasource}
                group={group}
                value={hostTags}
                evalTypeValue={evaltype}
                onHostTagFilterChange={this.handleHostTagsChange}
                onHostTagEvalTypeChange={this.handleHostTagEvalTypeChange}
              />
            </InlineField>
          </InlineFieldRow>
        )}

        {selectedQueryType.value !== VariableQueryTypes.Group && (
          <InlineFieldRow>
            <InlineField label="Host" labelWidth={18}>
              <ZabbixInput
                width={30}
                value={host}
                onChange={(evt) => this.handleQueryUpdate(evt, 'host')}
                onBlur={this.handleQueryChange}
              />
            </InlineField>
          </InlineFieldRow>
        )}

        {(selectedQueryType.value === VariableQueryTypes.Application ||
          selectedQueryType.value === VariableQueryTypes.ItemTag ||
          selectedQueryType.value === VariableQueryTypes.Item ||
          selectedQueryType.value === VariableQueryTypes.ItemValues) && (
          <>
            {supportsItemTags && (
              <InlineFieldRow>
                <InlineField label="Item Tag" labelWidth={18}>
                  <ZabbixInput
                    width={30}
                    value={itemTag}
                    onChange={(evt) => this.handleQueryUpdate(evt, 'itemTag')}
                    onBlur={this.handleQueryChange}
                  />
                </InlineField>
              </InlineFieldRow>
            )}

            {!supportsItemTags && (
              <InlineFieldRow>
                <InlineField label="Application" labelWidth={18}>
                  <ZabbixInput
                    width={30}
                    value={application}
                    onChange={(evt) => this.handleQueryUpdate(evt, 'application')}
                    onBlur={this.handleQueryChange}
                  />
                </InlineField>
              </InlineFieldRow>
            )}

            {(selectedQueryType.value === VariableQueryTypes.Item ||
              selectedQueryType.value === VariableQueryTypes.ItemValues) && (
              <InlineFieldRow>
                <InlineField label="Item" labelWidth={18}>
                  <ZabbixInput
                    width={30}
                    value={item}
                    onChange={(evt) => this.handleQueryUpdate(evt, 'item')}
                    onBlur={this.handleQueryChange}
                  />
                </InlineField>
              </InlineFieldRow>
            )}
          </>
        )}

        {legacyQuery && (
          <>
            <InlineFormLabel width={10} tooltip="Original query string, read-only">
              Legacy Query
            </InlineFormLabel>
            <Input value={legacyQuery} readOnly={true} />
          </>
        )}
        {selectedQueryType.value === VariableQueryTypes.Item && (
          <>
            <InlineFieldRow>
              <InlineField label="Show disabled items" labelWidth={18} style={{ alignItems: 'center' }}>
                <Switch value={showDisabledItems} onChange={this.handleShowDisabledItemsChange} />
              </InlineField>
            </InlineFieldRow>
          </>
        )}
      </>
    );
  }
}

interface HostTagFilterLoaderProps {
  datasource: any;
  group: string;
  value?: HostTagFilter[];
  evalTypeValue?: ZabbixTagEvalType;
  onHostTagFilterChange: (hostTags: HostTagFilter[]) => void;
  onHostTagEvalTypeChange: (evalType: ZabbixTagEvalType) => void;
}

const HostTagFilterLoader: React.FC<HostTagFilterLoaderProps> = ({
  datasource,
  group,
  value,
  evalTypeValue,
  onHostTagFilterChange,
  onHostTagEvalTypeChange,
}) => {
  const [{ loading, value: result }, fetchTags] = useAsyncFn(async () => {
    if (!group) {
      return { tagOptions: [] as ComboboxOption[], valueOptions: {} as Record<string, ComboboxOption[]> };
    }
    const interpolated = datasource?.templateSrv?.replace ? datasource.templateSrv.replace(group) : group;
    const hostsWithTags = await datasource.zabbix.getAllHosts(interpolated, true);
    const tags = processHostTags(hostsWithTags ?? []);
    const tagOptions = tags.map((t: { tag: string }) => ({ value: t.tag, label: t.tag })) as ComboboxOption[];

    // Build a tag -> unique values map for the value autocomplete.
    const valuesByTag = new Map<string, Set<string>>();
    for (const h of hostsWithTags ?? []) {
      for (const t of (h.tags ?? []) as Array<{ tag: string; value?: string }>) {
        if (!t?.tag) {
          continue;
        }
        const v = (t.value ?? '').toString();
        if (!v) {
          continue;
        }
        if (!valuesByTag.has(t.tag)) {
          valuesByTag.set(t.tag, new Set());
        }
        valuesByTag.get(t.tag)!.add(v);
      }
    }
    const valueOptions: Record<string, ComboboxOption[]> = {};
    for (const [tag, set] of valuesByTag.entries()) {
      valueOptions[tag] = Array.from(set)
        .sort()
        .map((v) => ({ value: v, label: v }));
    }
    return { tagOptions, valueOptions };
  }, [group]);

  React.useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return (
    <HostTagQueryEditor
      hostTagOptions={result?.tagOptions ?? []}
      hostTagOptionsLoading={loading}
      version={datasource?.zabbix?.version ?? ''}
      value={value}
      evalTypeValue={evalTypeValue}
      hostTagValueOptions={result?.valueOptions}
      onHostTagFilterChange={onHostTagFilterChange}
      onHostTagEvalTypeChange={onHostTagEvalTypeChange}
    />
  );
};
