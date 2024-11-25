import React, { PureComponent } from 'react';
import { parseLegacyVariableQuery } from '../utils';
import { SelectableValue } from '@grafana/data';
import { VariableQuery, VariableQueryData, VariableQueryProps, VariableQueryTypes } from '../types';
import { ZabbixInput } from './ZabbixInput';
import { InlineField, InlineFieldRow, InlineFormLabel, Input, Select } from '@grafana/ui';

export class ZabbixVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
  queryTypes: Array<SelectableValue<VariableQueryTypes>> = [
    { value: VariableQueryTypes.Group, label: 'Group' },
    { value: VariableQueryTypes.Host, label: 'Host' },
    { value: VariableQueryTypes.Application, label: 'Application' },
    { value: VariableQueryTypes.ItemTag, label: 'Item tag' },
    { value: VariableQueryTypes.Item, label: 'Item' },
    { value: VariableQueryTypes.ItemValues, label: 'Item values' },
    { value: VariableQueryTypes.UserMacroName, label: 'User macro Name' },
    { value: VariableQueryTypes.UserMacroValue, label: 'User macro Value' },
  ];

  defaults: VariableQueryData = {
    selectedQueryType: { value: VariableQueryTypes.Group, label: 'Group' },
    queryType: VariableQueryTypes.Group,
    group: '/.*/',
    host: '',
    application: '',
    itemTag: '',
    item: '',
    userMacroName: '',
    userMacroValue: '',
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
    const { queryType, group, host, application, itemTag, item, userMacroName , userMacroValue } = this.state;
    const queryModel = { queryType, group, host, application, itemTag, item, userMacroName, userMacroValue };
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  };

  handleQueryTypeChange = (selectedItem: SelectableValue<VariableQueryTypes>) => {
    this.setState({
      ...this.state,
      selectedQueryType: selectedItem,
      queryType: selectedItem.value,
    });

    const { group, host, application, itemTag, item, userMacroName, userMacroValue } = this.state;
    const queryType = selectedItem.value;
    const queryModel = { queryType, group, host, application, itemTag, item, userMacroName, userMacroValue };
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  };

  render() {
    const { selectedQueryType, legacyQuery, group, host, application, itemTag, item,userMacroName, userMacroValue } = this.state;
    const { datasource } = this.props;
    const supportsItemTags = datasource?.zabbix?.isZabbix54OrHigherSync() || false;

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Query Type" labelWidth={16}>
            <Select
              width={30}
              value={selectedQueryType}
              options={this.queryTypes}
              onChange={this.handleQueryTypeChange}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField label="Group" labelWidth={16}>
            <ZabbixInput
              width={30}
              value={group}
              onChange={(evt) => this.handleQueryUpdate(evt, 'group')}
              onBlur={this.handleQueryChange}
            />
          </InlineField>
        </InlineFieldRow>

        {( selectedQueryType.value === VariableQueryTypes.Application ||
          selectedQueryType.value === VariableQueryTypes.ItemTag ||
          selectedQueryType.value === VariableQueryTypes.Item ||
          selectedQueryType.value === VariableQueryTypes.ItemValues ||
          selectedQueryType.value === VariableQueryTypes.Host ) && (
          <InlineFieldRow>
            <InlineField label="Host" labelWidth={16}>
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
          selectedQueryType.value === VariableQueryTypes.ItemValues ) && (
          <>
            {supportsItemTags && (
              <InlineFieldRow>
                <InlineField label="Item Tag" labelWidth={16}>
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
                <InlineField label="Application" labelWidth={16}>
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
                <InlineField label="Item" labelWidth={16}>
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

        {selectedQueryType.value === VariableQueryTypes.UserMacroName && (
          <InlineFieldRow>
            <InlineField label="Macro Name" labelWidth={16}>
              <Input
                width={30}
                value={userMacroName}
                onChange={(evt) => this.handleQueryUpdate(evt, 'userMacroName')}
                onBlur={this.handleQueryChange}
              />
            </InlineField>
          </InlineFieldRow>
        )}

        {selectedQueryType.value === VariableQueryTypes.UserMacroValue && (
          <>

          <InlineFieldRow>
            <InlineField label="Macro Name" labelWidth={16}>
              <Input
                width={30}
                value={userMacroName}
                onChange={(evt) => this.handleQueryUpdate(evt, 'userMacroName')}
                onBlur={this.handleQueryChange}
              />
            </InlineField>
          </InlineFieldRow>

          <InlineFieldRow>
            <InlineField label="Macro Value" labelWidth={16}>
              <Input
                width={30}
                value={userMacroValue}
                onChange={(evt) => this.handleQueryUpdate(evt, 'userMacroValue')}
                onBlur={this.handleQueryChange}
              />
            </InlineField>
          </InlineFieldRow>

          </>

        )}

        {selectedQueryType.value === VariableQueryTypes.Host && (
          <>
            <InlineFieldRow>
              <InlineField label="Macro Name" labelWidth={16}>
                <Input
                  width={30}
                  value={userMacroName}
                  onChange={(evt) => this.handleQueryUpdate(evt, 'userMacroName')}
                  onBlur={this.handleQueryChange}
                />
              </InlineField>
            </InlineFieldRow>

            <InlineFieldRow>
              <InlineField label="Macro Value" labelWidth={16}>
                <Input
                  width={30}
                  value={userMacroValue}
                  onChange={(evt) => this.handleQueryUpdate(evt, 'userMacroValue')}
                  onBlur={this.handleQueryChange}
                />
              </InlineField>
            </InlineFieldRow>
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
      </>
    );
  }
}

