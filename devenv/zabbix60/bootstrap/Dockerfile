FROM python:3.14@sha256:37cba1153c7a3cd4477640ce0f976f7460308f812bc29d7149532e352a97ac8b

ENV ZBX_API_URL=http://zabbix-web:8080
ENV ZBX_API_USER="Admin"
ENV ZBX_API_PASSWORD="zabbix"
ENV ZBX_CONFIG="zbx_export_hosts.xml"
ENV ZBX_BOOTSTRAP_SCRIPT="bootstrap_config.py"

RUN pip install pyzabbix

ADD ./bootstrap_config.py /bootstrap_config.py
ADD ${ZBX_CONFIG} /${ZBX_CONFIG}

WORKDIR /

# Run bootstrap_config.py when the container launches
CMD ["python", "/bootstrap_config.py"]
