# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [3.10.4] - 2019-08-08
### Fixed
- Problems panel: query editor broken in Grafana 6.3, [#778](https://github.com/alexanderzobnin/grafana-zabbix/issues/778)
- Problems panel: some heart icons are missing, [#754](https://github.com/alexanderzobnin/grafana-zabbix/issues/754)

## [3.10.3] - 2019-07-26
### Fixed
- Direct DB Connection: can't stay enabled, [#731](https://github.com/alexanderzobnin/grafana-zabbix/issues/731)
- Triggers query mode: count doesn't work with Singlestat, [#726](https://github.com/alexanderzobnin/grafana-zabbix/issues/726)
- Query editor: function editor looks odd in Grafana 6.x, [#765](https://github.com/alexanderzobnin/grafana-zabbix/issues/765)
- Alerting: heart icon on panels in Grafana 6.x, [#715](https://github.com/alexanderzobnin/grafana-zabbix/issues/715)

## [3.10.2] - 2019-04-23
### Fixed
- Direct DB Connection: provisioned datasource fails to load, [#711](https://github.com/alexanderzobnin/grafana-zabbix/issues/711)
- Functions: `sumSeries` doesn't work in couple with other aggregation functions, [#530](https://github.com/alexanderzobnin/grafana-zabbix/issues/530)
- Problems panel: performance and memory issues, [#720](https://github.com/alexanderzobnin/grafana-zabbix/issues/720), [#712](https://github.com/alexanderzobnin/grafana-zabbix/issues/712)
- Problems panel: hide acknowledge button for read-only users, [#722](https://github.com/alexanderzobnin/grafana-zabbix/issues/722)
- Problems panel: "no data" overlaps table header when font size increased, [#717](https://github.com/alexanderzobnin/grafana-zabbix/issues/717)
- Problems panel: problem description does not resize problem bar, [#704](https://github.com/alexanderzobnin/grafana-zabbix/issues/704)
- Triggers query mode: problems not filtered by selected groups, [#709](https://github.com/alexanderzobnin/grafana-zabbix/issues/709)

## [3.10.1] - 2019-03-05
### Fixed
- Problems panel: unable to edit panel in Grafana 6.0, [#685](https://github.com/alexanderzobnin/grafana-zabbix/issues/685)
- Problems panel: datasource selector is empty, [#692](https://github.com/alexanderzobnin/grafana-zabbix/issues/692)
- Problems panel: "acknowledged" filter doesn't work correctly, [#678](https://github.com/alexanderzobnin/grafana-zabbix/issues/678) [#691](https://github.com/alexanderzobnin/grafana-zabbix/issues/691)
- Problems panel: acknowledged color isn't working, [#676](https://github.com/alexanderzobnin/grafana-zabbix/issues/676)
- Problems panel: highlight background doesn't work correctly for resolved events in List view, [#681](https://github.com/alexanderzobnin/grafana-zabbix/issues/681)
- Problems panel: duplicated page size entries, [#696](https://github.com/alexanderzobnin/grafana-zabbix/issues/696)
- Direct DB Connection: unable to get trends data from InfluxDB, [#675](https://github.com/alexanderzobnin/grafana-zabbix/issues/675)
- Annotations are not displayed when time set to a full day/week/month, [#680](https://github.com/alexanderzobnin/grafana-zabbix/issues/680)
- Datasource provisioning with direct DB connection enabled failed [#688](https://github.com/alexanderzobnin/grafana-zabbix/issues/688)
- Functions: `offset` function returns `NaN` in singlestat panel, [#683](https://github.com/alexanderzobnin/grafana-zabbix/issues/683)
- Functions: `median()` doesn't correspond to `aggregateBy(median)`, [#690](https://github.com/alexanderzobnin/grafana-zabbix/issues/690)
- Docs: add warnings about installation methods, [#693](https://github.com/alexanderzobnin/grafana-zabbix/issues/693)


## [3.10.0] - 2019-02-14
### Added
- Table-like layout for Problems (former Triggers) panel, [#673](https://github.com/alexanderzobnin/grafana-zabbix/issues/673)
- Problems panel: able to show last problems from dashboard time range, [#550](https://github.com/alexanderzobnin/grafana-zabbix/issues/550)
- Problems panel: filter problems by event tags, [#487](https://github.com/alexanderzobnin/grafana-zabbix/issues/487)
- Problems panel: option for displaying groups and proxy, [#418](https://github.com/alexanderzobnin/grafana-zabbix/issues/418)
- Support InfluxDB as Direct DB Connection datasource, [#640](https://github.com/alexanderzobnin/grafana-zabbix/issues/640), collaboration with [Gleb Ivanovsky aka @i-ky](https://github.com/i-ky)
- Support datasource provisioning with direct DB connection enabled, [#614](https://github.com/alexanderzobnin/grafana-zabbix/issues/614)
- Functions: `offset` function, [#387](https://github.com/alexanderzobnin/grafana-zabbix/issues/387), thanks to [@drakosha](https://github.com/drakosha)
- Functions: `removeAboveValue`, `removeBelowValue`, `transformNull` functions, [#562](https://github.com/alexanderzobnin/grafana-zabbix/issues/562), thanks to [@gelonsoft](https://github.com/gelonsoft)

### Fixed
- _t.replace is not a function_ error when adding new metric, [#661](https://github.com/alexanderzobnin/grafana-zabbix/issues/661)
- Problems panel: error when acknowledging problems in Zabbix 4.0, [#629](https://github.com/alexanderzobnin/grafana-zabbix/issues/629)
- Problems panel: direct link rendered image, [#605](https://github.com/alexanderzobnin/grafana-zabbix/issues/605)
- Direct DB Connection: _Cannot read property 'name' of null_ error when no series returned, [#571](https://github.com/alexanderzobnin/grafana-zabbix/issues/571)
- Direct DB Connection: `consolidateBy(sum)` does not work correctly, [#603](https://github.com/alexanderzobnin/grafana-zabbix/issues/603)
- Direct DB Connection: `consolidateBy()` affects other metrics in a panel, [#602](https://github.com/alexanderzobnin/grafana-zabbix/issues/602)

### Changed
- Disable auto-creation of Zabbix/Linux Server dashboards (still can be imported from datasource config page), [#422](https://github.com/alexanderzobnin/grafana-zabbix/issues/422)
- Use Webpack for building plugin, [#632](https://github.com/alexanderzobnin/grafana-zabbix/issues/632)
- `dist/` folder removed from repo, installation from github repo doesn't work anymore, [#693](https://github.com/alexanderzobnin/grafana-zabbix/issues/693)


## [3.9.1] - 2018-05-02
### Fixed
- Datasource fails when "Direct DB connection" enabled [#564](https://github.com/alexanderzobnin/grafana-zabbix/issues/564)
- Alerting and health icons on panels [#556](https://github.com/alexanderzobnin/grafana-zabbix/issues/556)
- Alerting threshold error [#549](https://github.com/alexanderzobnin/grafana-zabbix/issues/549)

## [3.9.0] - 2018-03-23
### Added
- Table format support for text data [#492](https://github.com/alexanderzobnin/grafana-zabbix/issues/492)
- Option to enable triggers background highlighting [#532](https://github.com/alexanderzobnin/grafana-zabbix/issues/532)
- Option to disable acknowledges for read-only users [#481](https://github.com/alexanderzobnin/grafana-zabbix/issues/481)

### Fixed
- Triggers panel has broken styles in Grafana 5.0 [#522](https://github.com/alexanderzobnin/grafana-zabbix/issues/522)
- Undefined username in acknowledges [#393](https://github.com/alexanderzobnin/grafana-zabbix/issues/393)

## [3.8.1] - 2017-12-21
### Fixed
- Triggers panel multiple targets bug (typing in one target affects other)
- Triggers panel event source icon


## [3.8.0] - 2017-12-20
### Added
- Multiple data sources support for triggers panel, [#431](https://github.com/alexanderzobnin/grafana-zabbix/issues/431)

### Changed
- Triggers Panel fully redesigned, closed a bunch of issues: #431, #488, #299, #485, #412, #157, #483, #487, #248
- Tests migrated to [Jest](http://facebook.github.io/jest/)

### Fixed
- Triggers panel refreshing issues
- aggregateBy() function bug, [#498](https://github.com/alexanderzobnin/grafana-zabbix/issues/498)


## [3.7.0] - 2017-10-24
### Added
- PostgreSQL support for Direct DB Connection.
- _Triggers_ query mode which allows to count active alerts by group, host and application, [#141](https://github.com/alexanderzobnin/grafana-zabbix/issues/141)
- `sortSeries()` function that allows to sort multiple timeseries by name, [#447](https://github.com/alexanderzobnin/grafana-zabbix/issues/447), thanks to [@mdorenkamp](https://github.com/mdorenkamp)
- `percentil()` function, thanks to [@pedrohrf](https://github.com/pedrohrf)
- _Zabbix System Status_ example dashboard.

### Changed
- Included dashboards moved to data source. Go to the data source config to import it.

### Fixed
- Direct DB connection doesn't work with `ONLY_FULL_GROUP_BY` option enabled, [#445](https://github.com/alexanderzobnin/grafana-zabbix/issues/445)
- Application selection doesn't work, [#352](https://github.com/alexanderzobnin/grafana-zabbix/issues/352)
- "data points outside time range" error when there is no datapoints and aggregation function is used
- Missed Max data points option in Grafana 4.5+
- Missed query editor help in Grafana 4.5+
- Alert threshold detection with `<=` `>=` `=` operators, thanks to [@akotynski](https://github.com/akotynski).

## [3.6.1] - 2017-07-26
### Fixed
- _cannot read property 'enable' of undefined_ error after upgrade, [#436](https://github.com/alexanderzobnin/grafana-zabbix/issues/436)


## [3.6.0] - 2017-07-26
### Added
- Direct DB Connection, which allows to use existing SQL data source for querying history data directly from Zabbix database.
- **Docs**: Direct DB Connection reference and configuration.
- `consolidateBy` function, which allows to specify aggregation function for time series data.
- `movingAverage` and `exponentialMovingAverage` functions.
- _Item ID_ editor mode for querying items by id.

### Changed
- IT Services query editor. Now user able to select multiple services by using regex, [#415](https://github.com/alexanderzobnin/grafana-zabbix/issues/415)

### Fixed
- Template variables support in annotations and triggers panel (trigger name field), [#428](https://github.com/alexanderzobnin/grafana-zabbix/issues/428)
- Parsing of template variable query with braces, [#432](https://github.com/alexanderzobnin/grafana-zabbix/issues/432)
- `sumSeries()` function bug, [#286](https://github.com/alexanderzobnin/grafana-zabbix/issues/286)


## [3.5.1] - 2017-07-10
### Fixed
- Bug with alerting when template queries are used, [#424](https://github.com/alexanderzobnin/grafana-zabbix/issues/424)


## [3.5.0] - 2017-07-05
### Added
- rate() function, which calculates per-second rate for growing counters.
- Benchmarks for time series functions. Used [Benchmark.js](https://github.com/bestiejs/benchmark.js) library.

### Changed
- Template query format. New format is `{group}{host}{app}{item}`. It allows to use names with dot. Updated 
  [templating docs](https://alexanderzobnin.github.io/grafana-zabbix/guides/templating/#query-format), 
  [#254](https://github.com/alexanderzobnin/grafana-zabbix/issues/254)
- Update included dashboards. Add templated zabbix datasource and use it for all metrics.
- Improved performance of groupBy() functions (at 6-10x faster than old).
- Fill empty intervals by _null_ when aggregations are used, [#388](https://github.com/alexanderzobnin/grafana-zabbix/issues/388)

### Fixed
- Item name expanding when key contains commas in quoted params, like my_key["a=1,b=2",c,d]
- Incorrect points order when trends are used [#202](https://github.com/alexanderzobnin/grafana-zabbix/issues/202)
- Triggers panel styles for light theme
- Bug with text metrics when singlestat or table shows NaN, [#325](https://github.com/alexanderzobnin/grafana-zabbix/issues/325)


## [3.4.0] - 2017-05-17
### Added
- **Alerting**: highlight panel contained metrics with fired triggers.
- **Alerting**: add thresholds to panels from zabbix triggers.
- **Docs**: add docs for setAliasByRegex() from @v-zhuravlev
- Support millisecond resolution on graphs. Patch from Jay Dawes <ajaxous@gmail.com>.
- Sum and count aggregations.
- Expand user macros in items [#212](https://github.com/alexanderzobnin/grafana-zabbix/issues/212)
- replaceAlias() function [#287](https://github.com/alexanderzobnin/grafana-zabbix/issues/287)
- Additional `Range` config option for trends [#364](https://github.com/alexanderzobnin/grafana-zabbix/issues/364)

### Changed
- Add template variables to dropdown metric list [#310](https://github.com/alexanderzobnin/grafana-zabbix/issues/310)
- Add all value regex `/.*/` to host dropdown.
- Replace native map() and forEach() methods by lodash.

### Fixed
- Templatig issue when no values returned [#354](https://github.com/alexanderzobnin/grafana-zabbix/issues/354)
- Add host name for multiple text metrics.
- Timeshift issue (Datapoints outside time range) for multiple targets with timeshift(), [#338](https://github.com/alexanderzobnin/grafana-zabbix/issues/338)


## [3.3.0] - 2017-02-10
### Added
- **Triggers panel**: allow to hide hosts in maintenance [#186](https://github.com/alexanderzobnin/grafana-zabbix/issues/186)
- **Triggers panel**: allow to change font size [#351](https://github.com/alexanderzobnin/grafana-zabbix/issues/351).
- **Triggers panel**: table pagination [#229](https://github.com/alexanderzobnin/grafana-zabbix/issues/229)
- **Triggers panel**: add 'enable scroll' control and page size input.

### Changed
- **Triggers panel**: rearrange options.

### Fixed
- Grunt: fix watch task.


## [3.2.1] - 2017-02-02
### Added
- **Docs**: add building instructions.
- setAliasByRegex() function

### Changed
- **Docs**: deprecate special repo with built plugins.
- **Triggers panel**: remove 'default' from datasources list (cause error), iss [#340](https://github.com/alexanderzobnin/grafana-zabbix/issues/340)
- Add dist/ directory to repo to correspond development guide http://docs.grafana.org/plugins/development/

### Fixed
- **Triggers panel**: metrics suggestion.
- **Triggers panel**: event acknowledge.
- **Triggers panel**: panel styles.
- **Query editor**: options styles.
- **Docs**: fixed timeShift() docs
- Error for new empty panel [#337](https://github.com/alexanderzobnin/grafana-zabbix/issues/337)
- Checking query for variables.


## [3.2.0] - 2017-02-02 [YANKED]
### Added
- timeShift() function [#307](https://github.com/alexanderzobnin/grafana-zabbix/issues/307)
