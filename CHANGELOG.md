# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Fixed
- Item name expanding when key contains commas in quoted params, like my_key["a=1,b=2",c,d]
- Incorrect points order when trends are used [#202](https://github.com/alexanderzobnin/grafana-zabbix/issues/202)
- Triggers panel styles for light theme
- Bug with text metrics when singlestat or table shows NaN, [#325](https://github.com/alexanderzobnin/grafana-zabbix/issues/325)

### Changed
- Template query format. New format is `{group}{host}{app}{item}`. It allows to use names with dot. Updated 
  [templating docs](http://docs.grafana-zabbix.org/guides/templating/#query-format), 
  [#254](https://github.com/alexanderzobnin/grafana-zabbix/issues/254)
- Update included dashboards. Add templated zabbix datasource and use it for all metrics.
- Improved performance of groupBy() functions (at 6-10x faster than old).
- Fill empty intervals by _null_ when aggregations are used, [#388](https://github.com/alexanderzobnin/grafana-zabbix/issues/388)

### Added
- rate() function, which calculates per-second rate for growing counters.
- Benchmarks for time series functions. Used [Benchmark.js](https://github.com/bestiejs/benchmark.js) library.


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
- **Docs**: deprecate special repo with builded plugin.
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
