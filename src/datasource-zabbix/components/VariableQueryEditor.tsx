import _ from 'lodash';
import React, { PureComponent } from 'react';
import { parseLegacyVariableQuery } from '../utils';
import { Select, Input, AsyncSelect, FormLabel } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { VariableQuery, MetricFindQueryTypes } from '../types';

export interface VariableQueryProps {
  query: string | VariableQuery;
  onChange: (query: VariableQuery, definition: string) => void;
  datasource: any;
  templateSrv: any;
}

export interface VariableQueryState extends VariableQuery {
  selectedQueryType: SelectableValue<string>;
  legacyQuery?: string;
}

export class ZabbixVariableQueryEditor extends PureComponent<VariableQueryProps, VariableQueryState> {
  queryTypes: Array<SelectableValue<MetricFindQueryTypes>> = [
    { value: MetricFindQueryTypes.Group, label: 'Group'},
    { value: MetricFindQueryTypes.Host, label: 'Host' },
    { value: MetricFindQueryTypes.Application, label: 'Application' },
    { value: MetricFindQueryTypes.Item, label: 'Item' },
  ];

  defaults: VariableQueryState = {
    selectedQueryType: this.queryTypes[0],
    queryType: MetricFindQueryTypes.Group,
    group: '/.*/',
    host: '',
    application: '',
    item: '',
  };

  constructor(props: VariableQueryProps) {
    super(props);

    console.log(props);
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
    console.log(this.state);
  }

  getSelectedQueryType(queryType: MetricFindQueryTypes) {
    return this.queryTypes.find(q => q.value === queryType);
  }

  handleQueryUpdate = (evt: React.ChangeEvent<HTMLInputElement>, prop: string) => {
    console.log(evt.currentTarget.value, prop);
    const value = evt.currentTarget.value;
    this.setState((prevState: VariableQueryState) => {
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
    // console.log(queryModel);
    this.props.onChange(queryModel, `Zabbix - ${queryType}`);
  }

  handleQueryTypeChange = (selectedItem: SelectableValue<MetricFindQueryTypes>) => {
    console.log(selectedItem);
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
          {selectedQueryType.value !== MetricFindQueryTypes.Group &&
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
        {(selectedQueryType.value === MetricFindQueryTypes.Application ||
          selectedQueryType.value === MetricFindQueryTypes.Item) &&
          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <FormLabel width={10}>Application</FormLabel>
              <Input
                value={application}
                onChange={evt => this.handleQueryUpdate(evt, 'application')}
                onBlur={this.handleQueryChange}
              />
            </div>
            {selectedQueryType.value === MetricFindQueryTypes.Item &&
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
