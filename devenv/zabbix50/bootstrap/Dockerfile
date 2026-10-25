FROM python:3@sha256:67ee282bdbe5ece1e38ea94fa68f1420e969e6176e6c826b9acc931055011bfb

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
