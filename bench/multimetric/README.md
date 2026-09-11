# Multi-Metric Table request benchmark

Compares how many Zabbix JSON-RPC calls (and roughly how much payload) it takes to render an
"interface bits in/out" table the **plain metric** way (one query per column, assembled with Grafana
transforms) versus the new **Multi-Metric Table** query type.

The counts mirror the real backend call graph:

- **Plain metric** (per column): `hostgroup.get` + `host.get` (`GetHosts`) + `item.get` (`GetAllItems`) + `history.get` (`GetHistory`).
- **Multi-metric table** (single query): entity-pattern `item.get` + metric-pattern `item.get` (both with `lastvalue`), plus one `history.get` per column whose aggregation is **not** `last`.

## Run it

From the repo root:

```bash
go run ./bench/multimetric                                              # defaults: 10 hosts × 8 interfaces, 1h
go run ./bench/multimetric -hosts 50  -ifaces 16 -range 6h              # medium dashboard
go run ./bench/multimetric -hosts 100 -ifaces 24 -range 24h            # large dashboard
go run ./bench/multimetric -metrics 2 -multi-non-last 2                 # both columns use a non-"last" aggregation
```

Flags: `-hosts`, `-ifaces`, `-items-per-host`, `-range`, `-interval`, `-rpc` (per-call latency),
`-metrics` (columns), `-multi-non-last` (how many columns use a non-`last` aggregation, each adding a `history.get`).

## Sample results (`-rpc 50ms`, 2 columns, `last` aggregation)

| Scenario | Mode | Total calls | Est. payload |
| --- | --- | --- | --- |
| 10 hosts × 8 ifaces, 1h | Plain | 8 | 1.33 MiB |
| | Multi-metric | 6 | 753 KiB (**1.8× less**) |
| 50 hosts × 16 ifaces, 6h | Plain | 8 | 46.9 MiB |
| | Multi-metric | 6 | 3.67 MiB (**12.8× less**) |
| 100 hosts × 24 ifaces, 24h | Plain | 8 | 533 MiB |
| | Multi-metric | 6 | 7.34 MiB (**72.6× less**) |

The call count is comparable; the payload win comes from reading `lastvalue` instead of full history,
and it grows with time range × interface count. The advantage shrinks for columns using a non-`last`
aggregation (or sparklines), since those fetch history again — model that with `-multi-non-last`.
