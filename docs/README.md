# Grafana-Zabbix Documentation

## Building docs
To build this docs on your computer you need [git-lfs](https://git-lfs.github.com/) and [mkdocs](http://www.mkdocs.org/) installed.

Clone repo
```
git clone https://github.com/alexanderzobnin/grafana-zabbix
```
Check images in `docs/sources/img/`. If this folder is empty, run 
```
git lfs fetch --all
```

Build docs
```
cd docs/
mkdocs build --clean
```

Built docs will be placed in `site/` directory.
