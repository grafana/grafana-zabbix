FROM python:3.13-slim-bookworm@sha256:97e9392d12279f8c180eb80f0c7c0f3dfe5650f0f2573f7ad770aea58f75ed12

ENV ZBX_API_URL=http://zabbix-web:8080
ENV ZBX_API_USER="Admin"
ENV ZBX_API_PASSWORD="zabbix"
ENV ZBX_CONFIG="zbx_export_hosts.json"
ENV ZBX_BOOTSTRAP_SCRIPT="bootstrap_config.py"
ENV ZBX_TEST_USER="grafana_test"
ENV ZBX_TEST_PASS="grafana_test_pass"

RUN pip install zabbix_utils

ADD ./bootstrap_config.py /bootstrap_config.py
ADD ${ZBX_CONFIG} /${ZBX_CONFIG}

WORKDIR /

# Run bootstrap_config.py when the container launches
CMD ["python", "/bootstrap_config.py"]