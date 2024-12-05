#!/bin/bash

# Run redis server first
# cd /zas/redis-3.2.9/src/
# nohup redis-server > /tmp/redis.log &

REDIS_HOST=${REDIS_HOST:-"redis"}
REDIS_PORT=${REDIS_PORT:-"6381"}

rm -f /tmp/zas_agent.pid
echo Using redis host: ${REDIS_HOST} and port: ${REDIS_PORT}
zas_agent.py --start --user root --group root --scenario /etc/zas_scenario.cfg --redis_host ${REDIS_HOST} --redis_port ${REDIS_PORT}
