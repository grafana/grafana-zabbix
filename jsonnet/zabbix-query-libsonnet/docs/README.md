# zabbixQuery

Jsonnet library for creating Zabbix queries for Grafana.
## Install

```
jb install https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet@main
```

## Usage

```jsonnet
local zabbixQuery = import "https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet/main.libsonnet"
```


## Subpackages

* [functions](functions/index.md)

## Index

* [`fn withCountTriggersBy(value)`](#fn-withcounttriggersby)
* [`fn withDatasourceId(value)`](#fn-withdatasourceid)
* [`fn withEvaltype(value)`](#fn-withevaltype)
* [`fn withFunctions(value)`](#fn-withfunctions)
* [`fn withFunctionsMixin(value)`](#fn-withfunctionsmixin)
* [`fn withHide(value=true)`](#fn-withhide)
* [`fn withHostFilter(value)`](#fn-withhostfilter)
* [`fn withItServiceFilter(value)`](#fn-withitservicefilter)
* [`fn withItemFilter(value)`](#fn-withitemfilter)
* [`fn withItemids(value)`](#fn-withitemids)
* [`fn withKey(value)`](#fn-withkey)
* [`fn withMacroFilter(value)`](#fn-withmacrofilter)
* [`fn withMode(value)`](#fn-withmode)
* [`fn withQueryType(value)`](#fn-withquerytype)
* [`fn withRefId(value)`](#fn-withrefid)
* [`fn withSchema(value)`](#fn-withschema)
* [`fn withShowProblems(value)`](#fn-withshowproblems)
* [`fn withSlaFilter(value)`](#fn-withslafilter)
* [`fn withSlaInterval(value)`](#fn-withslainterval)
* [`fn withSlaProperty(value)`](#fn-withslaproperty)
* [`fn withTextFilter(value)`](#fn-withtextfilter)
* [`fn withUseCaptureGroups(value=true)`](#fn-withusecapturegroups)
* [`obj application`](#obj-application)
  * [`fn withFilter(value)`](#fn-applicationwithfilter)
  * [`fn withName(value)`](#fn-applicationwithname)
* [`obj datasource`](#obj-datasource)
  * [`fn withType(value)`](#fn-datasourcewithtype)
  * [`fn withUid(value)`](#fn-datasourcewithuid)
* [`obj group`](#obj-group)
  * [`fn withFilter(value)`](#fn-groupwithfilter)
  * [`fn withName(value)`](#fn-groupwithname)
* [`obj host`](#obj-host)
  * [`fn withFilter(value)`](#fn-hostwithfilter)
  * [`fn withName(value)`](#fn-hostwithname)
* [`obj item`](#obj-item)
  * [`fn withFilter(value)`](#fn-itemwithfilter)
  * [`fn withName(value)`](#fn-itemwithname)
* [`obj itemTag`](#obj-itemtag)
  * [`fn withFilter(value)`](#fn-itemtagwithfilter)
  * [`fn withName(value)`](#fn-itemtagwithname)
* [`obj macro`](#obj-macro)
  * [`fn withFilter(value)`](#fn-macrowithfilter)
  * [`fn withMacro(value)`](#fn-macrowithmacro)
* [`obj options`](#obj-options)
  * [`fn withAcknowledged(value)`](#fn-optionswithacknowledged)
  * [`fn withCount(value=true)`](#fn-optionswithcount)
  * [`fn withDisableDataAlignment(value=true)`](#fn-optionswithdisabledataalignment)
  * [`fn withHideAcknowledged(value=true)`](#fn-optionswithhideacknowledged)
  * [`fn withHostProxy(value=true)`](#fn-optionswithhostproxy)
  * [`fn withHostsInMaintenance(value=true)`](#fn-optionswithhostsinmaintenance)
  * [`fn withLimit(value)`](#fn-optionswithlimit)
  * [`fn withMinSeverity(value)`](#fn-optionswithminseverity)
  * [`fn withSeverities(value)`](#fn-optionswithseverities)
  * [`fn withSeveritiesMixin(value)`](#fn-optionswithseveritiesmixin)
  * [`fn withShowDisabledItems(value=true)`](#fn-optionswithshowdisableditems)
  * [`fn withShowHostname(value=true)`](#fn-optionswithshowhostname)
  * [`fn withShowOkEvents(value=true)`](#fn-optionswithshowokevents)
  * [`fn withSkipEmptyValues(value=true)`](#fn-optionswithskipemptyvalues)
  * [`fn withSortProblems(value)`](#fn-optionswithsortproblems)
  * [`fn withUseTimeRange(value=true)`](#fn-optionswithusetimerange)
  * [`fn withUseTrends(value)`](#fn-optionswithusetrends)
  * [`fn withUseZabbixValueMapping(value=true)`](#fn-optionswithusezabbixvaluemapping)
* [`obj proxy`](#obj-proxy)
  * [`fn withFilter(value)`](#fn-proxywithfilter)
* [`obj tags`](#obj-tags)
  * [`fn withFilter(value)`](#fn-tagswithfilter)
* [`obj trigger`](#obj-trigger)
  * [`fn withFilter(value)`](#fn-triggerwithfilter)
* [`obj triggers`](#obj-triggers)
  * [`fn withAcknowledged(value)`](#fn-triggerswithacknowledged)
  * [`fn withCount(value=true)`](#fn-triggerswithcount)
  * [`fn withMinSeverity(value)`](#fn-triggerswithminseverity)

## Fields

### fn withCountTriggersBy

```jsonnet
withCountTriggersBy(value)
```

PARAMETERS:

* **value** (`string`)
   - valid values: `"problems"`, `"items"`, `""`


### fn withDatasourceId

```jsonnet
withDatasourceId(value)
```

PARAMETERS:

* **value** (`number`)


### fn withEvaltype

```jsonnet
withEvaltype(value)
```

PARAMETERS:

* **value** (`string`)
   - valid values: `"0"`, `"2"`


### fn withFunctions

```jsonnet
withFunctions(value)
```

PARAMETERS:

* **value** (`array`)


### fn withFunctionsMixin

```jsonnet
withFunctionsMixin(value)
```

PARAMETERS:

* **value** (`array`)


### fn withHide

```jsonnet
withHide(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`

true if query is disabled (ie should not be returned to the dashboard) Note this does not always imply that the query should not be executed since the results from a hidden query may be used as the input to other queries (SSE etc)
### fn withHostFilter

```jsonnet
withHostFilter(value)
```

PARAMETERS:

* **value** (`string`)


### fn withItServiceFilter

```jsonnet
withItServiceFilter(value)
```

PARAMETERS:

* **value** (`string`)


### fn withItemFilter

```jsonnet
withItemFilter(value)
```

PARAMETERS:

* **value** (`string`)


### fn withItemids

```jsonnet
withItemids(value)
```

PARAMETERS:

* **value** (`string`)


### fn withKey

```jsonnet
withKey(value)
```

PARAMETERS:

* **value** (`string`)

Unique, guid like, string (used only in explore mode)
### fn withMacroFilter

```jsonnet
withMacroFilter(value)
```

PARAMETERS:

* **value** (`string`)


### fn withMode

```jsonnet
withMode(value)
```

PARAMETERS:

* **value** (`number`)


### fn withQueryType

```jsonnet
withQueryType(value)
```

PARAMETERS:

* **value** (`string`)

Specify the query flavor TODO make this required and give it a default
### fn withRefId

```jsonnet
withRefId(value)
```

PARAMETERS:

* **value** (`string`)

A unique identifier for the query within the list of targets. In server side expressions, the refId is used as a variable name to identify results. By default, the UI will assign A->Z; however setting meaningful names may be useful.
### fn withSchema

```jsonnet
withSchema(value)
```

PARAMETERS:

* **value** (`number`)


### fn withShowProblems

```jsonnet
withShowProblems(value)
```

PARAMETERS:

* **value** (`string`)
   - valid values: `"problems"`, `"recent"`, `"history"`


### fn withSlaFilter

```jsonnet
withSlaFilter(value)
```

PARAMETERS:

* **value** (`string`)


### fn withSlaInterval

```jsonnet
withSlaInterval(value)
```

PARAMETERS:

* **value** (`string`)


### fn withSlaProperty

```jsonnet
withSlaProperty(value)
```

PARAMETERS:

* **value** (`string`)


### fn withTextFilter

```jsonnet
withTextFilter(value)
```

PARAMETERS:

* **value** (`string`)


### fn withUseCaptureGroups

```jsonnet
withUseCaptureGroups(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


### obj application


#### fn application.withFilter

```jsonnet
application.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


#### fn application.withName

```jsonnet
application.withName(value)
```

PARAMETERS:

* **value** (`string`)


### obj datasource


#### fn datasource.withType

```jsonnet
datasource.withType(value)
```

PARAMETERS:

* **value** (`string`)

The plugin type-id
#### fn datasource.withUid

```jsonnet
datasource.withUid(value)
```

PARAMETERS:

* **value** (`string`)

Specific datasource instance
### obj group


#### fn group.withFilter

```jsonnet
group.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


#### fn group.withName

```jsonnet
group.withName(value)
```

PARAMETERS:

* **value** (`string`)


### obj host


#### fn host.withFilter

```jsonnet
host.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


#### fn host.withName

```jsonnet
host.withName(value)
```

PARAMETERS:

* **value** (`string`)


### obj item


#### fn item.withFilter

```jsonnet
item.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


#### fn item.withName

```jsonnet
item.withName(value)
```

PARAMETERS:

* **value** (`string`)


### obj itemTag


#### fn itemTag.withFilter

```jsonnet
itemTag.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


#### fn itemTag.withName

```jsonnet
itemTag.withName(value)
```

PARAMETERS:

* **value** (`string`)


### obj macro


#### fn macro.withFilter

```jsonnet
macro.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


#### fn macro.withMacro

```jsonnet
macro.withMacro(value)
```

PARAMETERS:

* **value** (`string`)


### obj options


#### fn options.withAcknowledged

```jsonnet
options.withAcknowledged(value)
```

PARAMETERS:

* **value** (`number`)


#### fn options.withCount

```jsonnet
options.withCount(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withDisableDataAlignment

```jsonnet
options.withDisableDataAlignment(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withHideAcknowledged

```jsonnet
options.withHideAcknowledged(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withHostProxy

```jsonnet
options.withHostProxy(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withHostsInMaintenance

```jsonnet
options.withHostsInMaintenance(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withLimit

```jsonnet
options.withLimit(value)
```

PARAMETERS:

* **value** (`number`)


#### fn options.withMinSeverity

```jsonnet
options.withMinSeverity(value)
```

PARAMETERS:

* **value** (`number`)


#### fn options.withSeverities

```jsonnet
options.withSeverities(value)
```

PARAMETERS:

* **value** (`array`)


#### fn options.withSeveritiesMixin

```jsonnet
options.withSeveritiesMixin(value)
```

PARAMETERS:

* **value** (`array`)


#### fn options.withShowDisabledItems

```jsonnet
options.withShowDisabledItems(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withShowHostname

```jsonnet
options.withShowHostname(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withShowOkEvents

```jsonnet
options.withShowOkEvents(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withSkipEmptyValues

```jsonnet
options.withSkipEmptyValues(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withSortProblems

```jsonnet
options.withSortProblems(value)
```

PARAMETERS:

* **value** (`string`)


#### fn options.withUseTimeRange

```jsonnet
options.withUseTimeRange(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn options.withUseTrends

```jsonnet
options.withUseTrends(value)
```

PARAMETERS:

* **value** (`string`)
   - valid values: `"default"`, `"true"`, `"false"`


#### fn options.withUseZabbixValueMapping

```jsonnet
options.withUseZabbixValueMapping(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


### obj proxy


#### fn proxy.withFilter

```jsonnet
proxy.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


### obj tags


#### fn tags.withFilter

```jsonnet
tags.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


### obj trigger


#### fn trigger.withFilter

```jsonnet
trigger.withFilter(value)
```

PARAMETERS:

* **value** (`string`)


### obj triggers


#### fn triggers.withAcknowledged

```jsonnet
triggers.withAcknowledged(value)
```

PARAMETERS:

* **value** (`number`)


#### fn triggers.withCount

```jsonnet
triggers.withCount(value=true)
```

PARAMETERS:

* **value** (`boolean`)
   - default value: `true`


#### fn triggers.withMinSeverity

```jsonnet
triggers.withMinSeverity(value)
```

PARAMETERS:

* **value** (`number`)

