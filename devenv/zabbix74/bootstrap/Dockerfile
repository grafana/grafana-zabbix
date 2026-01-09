FROM python:3.13-slim-bookworm@sha256:0c5171fd1e80d3133604e1006aa5f788c5f020631537dd1e09edcbe874bb8192

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