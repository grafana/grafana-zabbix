FROM python:2.7

# ENV ZAS_SOURCE_URL=https://github.com/vulogov/zas_agent/archive/master.zip
# ENV ZAS_ARC_NAME=zas_agent-master
# Use version with fixed redis dependency
ENV ZAS_SOURCE_URL=https://github.com/alexanderzobnin/zas_agent/archive/refs/heads/redis-dependency.zip
ENV ZAS_ARC_NAME=zas_agent-redis-dependency
ENV ZAS_ARC_FILE=${ZAS_ARC_NAME}.zip
ENV ZAS_WORKDIR="/zas-agent"

# Fix repository sources to use archive.debian.org for Debian Buster
RUN sed -i 's|http://deb.debian.org/debian|http://archive.debian.org/debian|g' /etc/apt/sources.list
RUN sed -i 's|http://security.debian.org/debian-security|http://archive.debian.org/debian-security|g' /etc/apt/sources.list
RUN sed -i '/stretch-updates/d' /etc/apt/sources.list

RUN apt-get update && apt-get install -y ca-certificates
RUN apt-get install -y unzip wget

# Download and extract
WORKDIR ${ZAS_WORKDIR}
RUN wget ${ZAS_SOURCE_URL} -O ${ZAS_ARC_FILE}
RUN unzip ${ZAS_ARC_FILE}

# Install zas_agent
WORKDIR ${ZAS_WORKDIR}/${ZAS_ARC_NAME}/install
RUN python ./check_python_packages.py
WORKDIR ${ZAS_WORKDIR}/${ZAS_ARC_NAME}
RUN python setup.py build
RUN python setup.py install

COPY ./run_zas_agent.sh ${ZAS_WORKDIR}/${ZAS_ARC_NAME}/run_zas_agent.sh

# Make port 10050 available to the world outside this container
EXPOSE 10050

# Set default redis port to connect
ENV REDIS_PORT=6379
ENV REDIS_HOST=redis

# Run zas_agent.py when the container launches
# ENTRYPOINT  ["./run_zas_agent.sh"]
CMD ["./run_zas_agent.sh"]
