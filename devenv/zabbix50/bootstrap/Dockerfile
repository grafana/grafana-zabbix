FROM python:3@sha256:8c9a3bf2d6dea60d60a2ae2a07c2b2fb1e7d8daed64b146b6792c74ae0d62ac4

ENV ZBX_API_URL=http://zabbix-web
ENV ZBX_API_USER="Admin"
ENV ZBX_API_PASSWORD="zabbix"
ENV ZBX_CONFIG="zbx_export_hosts_5.xml"
ENV ZBX_BOOTSTRAP_SCRIPT="bootstrap_config.py"

RUN pip install pyzabbix

WORKDIR /

ADD ./${ZBX_CONFIG} /${ZBX_CONFIG}
ADD ./bootstrap_config.py /bootstrap_config.py
# RUN cp ./${ZBX_CONFIG} /${ZBX_CONFIG}

# Run bootstrap_config.py when the container launches
CMD ["python", "/bootstrap_config.py"]
