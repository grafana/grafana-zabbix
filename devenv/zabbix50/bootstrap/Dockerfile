FROM python:3@sha256:e748956ccf3f50c9555f236753bbcd5f430d3937e665d3bd6922dd0e6e591a24

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
