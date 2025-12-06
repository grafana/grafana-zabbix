FROM python:3@sha256:595140b768992c05b096570e5ae487a02a2c6b3ae23ba33ce0fc34b99579c98e

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
