import React, { PureComponent } from 'react';
import { parseLegacyVariableQuery } from '../utils';
import { VariableQuery, VariableQueryData, VariableQueryProps, VariableQueryTypes } from '../types';
import { ZabbixInput } from './ZabbixInput';
import { Combobox, ComboboxOption, InlineField, InlineFieldRow, InlineFormLabel, Input, Switch } from '@grafana/ui';

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

  handleQueryChange = () => {
    const { queryType, group, host, application, itemTag, item, showDisabledItems } = this.state;
    const queryModel = { queryType, group, host, application, itemTag, item, showDisabledItems };
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  };

  handleQueryTypeChange = (selectedItem: ComboboxOption<VariableQueryTypes>) => {
    this.setState({
      ...this.state,
      selectedQueryType: selectedItem,
      queryType: selectedItem.value,
    });

    const { group, host, application, itemTag, item, showDisabledItems } = this.state;
    const queryType = selectedItem.value;
    const queryModel = { queryType, group, host, application, itemTag, item, showDisabledItems };
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

    const { queryType, group, host, application, itemTag, item } = this.state;
    const queryModel = { queryType, group, host, application, itemTag, item, showDisabledItems };
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  };

  render() {
    const { selectedQueryType, legacyQuery, group, host, application, itemTag, item, showDisabledItems } = this.state;
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
