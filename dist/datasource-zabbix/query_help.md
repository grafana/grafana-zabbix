#### Max data points
Override max data points, automatically set to graph width in pixels. Grafana-Zabbix plugin uses maxDataPoints parameter to consolidate the real number of values down to this number. If there are more real values, then by default they will be consolidated using averages. This could hide real peaks and max values in your series. Point consolidation will affect series legend values (min,max,total,current).

#### Query Mode
##### Merics
Data from numeric items.

##### Text
Data from items with `Character`, `Text` or `Log` type.

##### IT Services
Time series representation of IT Services data
###### IT service property
Zabbix returns the following availability information about IT service:
- Status - current status of the IT service
- SLA - SLA for the given time interval
- OK time - time the service was in OK state, in seconds
- Problem time - time the service was in problem state, in seconds
- Down time - time the service was in scheduled downtime, in seconds

##### Item ID
Data from items with specified ID's (comma separated). 
This mode is suitable for rendering charts in grafana by passing itemids as url params. 
1. Create multivalue template variable with type _Custom_, for example, `itemids`.
1. Create graph with desired parameters and use `$itemids` in _Item IDs_ filed.
1. Save dashboard.
1. Click to graph title and select _Share_ -> _Direct link rendered image_.
1. Use this URL for graph png image and set `var-itemids` param to desired IDs. Note, for multiple IDs you should pass multiple params, like `&var-itemids=28276&var-itemids=28277`.

##### Triggers
Active triggers count for selected hosts or table data like Zabbix _System status_ panel on the main dashboard.
