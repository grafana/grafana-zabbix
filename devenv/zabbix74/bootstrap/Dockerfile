FROM python:3.15-slim-bookworm@sha256:4e03260adeeebafccd084f3584e6b84823aba5651cfb53ef8a078ed441ddf9cd

ENV ZBX_API_URL=http://zabbix-web:8080
ENV ZBX_API_USER="Admin"
ENV ZBX_API_PASSWORD="zabbix"
ENV ZBX_CONFIG="zbx_export_hosts.json"
ENV ZBX_BOOTSTRAP_SCRIPT="bootstrap_config.py"
ENV ZBX_TEST_USER="grafana_test"
ENV ZBX_TEST_PASS="s3cure_devenv_2024"

RUN pip install zabbix_utils

ADD ./bootstrap_config.py /bootstrap_config.py
ADD ${ZBX_CONFIG} /${ZBX_CONFIG}

WORKDIR /

# Run bootstrap_config.py when the container launches
CMD ["python", "/bootstrap_config.py"]