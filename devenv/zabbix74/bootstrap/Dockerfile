FROM python:3.14-slim-bookworm@sha256:55e465cb7e50cd1d7217fcb5386aa87d0356ca2cd790872142ef68d9ef6812b4

ENV ZBX_API_URL=http://zabbix-web:8080
ENV ZBX_API_USER="Admin"
ENV ZBX_API_PASSWORD="zabbix"
ENV ZBX_CONFIG="zbx_export_hosts.json"
ENV ZBX_BOOTSTRAP_SCRIPT="bootstrap_config.py"

RUN pip install zabbix_utils

ADD ./bootstrap_config.py /bootstrap_config.py
ADD ${ZBX_CONFIG} /${ZBX_CONFIG}

WORKDIR /

# Run bootstrap_config.py when the container launches
CMD ["python", "/bootstrap_config.py"]