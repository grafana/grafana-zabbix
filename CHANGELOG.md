# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).


## [Unreleased]
### Added
- **Alerting**: higlight panel contained metrics with fired triggers.
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
