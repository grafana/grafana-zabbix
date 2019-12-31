import React, { PureComponent } from 'react';
import { parseLegacyVariableQuery } from '../utils';
import { Select, Input, AsyncSelect, FormLabel } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { VariableQuery, VariableQueryTypes, VariableQueryProps, VariableQueryData } from '../types';

export class ZabbixVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryData> {
  queryTypes: Array<SelectableValue<VariableQueryTypes>> = [
    { value: VariableQueryTypes.Group, label: 'Group'},
    { value: VariableQueryTypes.Host, label: 'Host' },
    { value: VariableQueryTypes.Application, label: 'Application' },
    { value: VariableQueryTypes.Item, label: 'Item' },
  ];

  defaults: VariableQueryData = {
    selectedQueryType: { value: VariableQueryTypes.Group, label: 'Group' },
    queryType: VariableQueryTypes.Group,
    group: '/.*/',
    host: '',
    application: '',
    item: '',
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
        ...query
      };
    } else if (this.props.query) {
      const query = (this.props.query as VariableQuery);
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
    return this.queryTypes.find(q => q.value === queryType);
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
  }

  handleQueryChange = () => {
    const { queryType, group, host, application, item } = this.state;
    const queryModel = { queryType, group, host, application, item };
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  }

  handleQueryTypeChange = (selectedItem: SelectableValue<VariableQueryTypes>) => {
    this.setState({
      ...this.state,
      selectedQueryType: selectedItem,
      queryType: selectedItem.value,
    });

    const { group, host, application, item } = this.state;
    const queryType = selectedItem.value;
    const queryModel = { queryType, group, host, application, item };
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  }

  render() {
    const { selectedQueryType, legacyQuery, group, host, application, item } = this.state;

    return (
      <>
        <div className="gf-form max-width-21">
          <FormLabel width={10}>Query Type</FormLabel>
          <Select
            width={11}
            value={selectedQueryType}
            options={this.queryTypes}
            onChange={this.handleQueryTypeChange}
          />
        </div>
        <div className="gf-form-inline">
          <div className="gf-form max-width-30">
            <FormLabel width={10}>Group</FormLabel>
            <Input
              value={group}
              onChange={evt => this.handleQueryUpdate(evt, 'group')}
              onBlur={this.handleQueryChange}
            />
          </div>
          {selectedQueryType.value !== VariableQueryTypes.Group &&
            <div className="gf-form max-width-30">
              <FormLabel width={10}>Host</FormLabel>
              <Input
                value={host}
                onChange={evt => this.handleQueryUpdate(evt, 'host')}
                onBlur={this.handleQueryChange}
              />
            </div>
          }
        </div>
        {(selectedQueryType.value === VariableQueryTypes.Application ||
          selectedQueryType.value === VariableQueryTypes.Item) &&
          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <FormLabel width={10}>Application</FormLabel>
              <Input
                value={application}
                onChange={evt => this.handleQueryUpdate(evt, 'application')}
                onBlur={this.handleQueryChange}
              />
            </div>
            {selectedQueryType.value === VariableQueryTypes.Item &&
              <div className="gf-form max-width-30">
                <FormLabel width={10}>Item</FormLabel>
                <Input
                  value={item}
                  onChange={evt => this.handleQueryUpdate(evt, 'item')}
                  onBlur={this.handleQueryChange}
                />
              </div>
            }
          </div>
        }

        {legacyQuery &&
          <div className="gf-form">
            <FormLabel width={10} tooltip="Original query string, read-only">Legacy Query</FormLabel>
            <Input
              value={legacyQuery}
              readOnly={true}
            />
          </div>
        }
      </>
    );
  }
}
