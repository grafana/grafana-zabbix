#!/bin/bash
if [ "$1" == "-h" ]; then
  echo "Usage: ${BASH_SOURCE[0]} [plugin process name] [port]"
  exit
fi

PORT="${2:-3222}"
PLUGIN_NAME="${1:-zabbix-plugin_}"

ptrace_scope=`cat /proc/sys/kernel/yama/ptrace_scope`
if [ "$ptrace_scope" != 0 ]; then
  echo "WARNING: ptrace_scope set to value other than 0, this might prevent debugger from connecting, try writing \"0\" to /proc/sys/kernel/yama/ptrace_scope.
Read more at https://www.kernel.org/doc/Documentation/security/Yama.txt"
fi

PLUGIN_PID=`pgrep ${PLUGIN_NAME}`
dlv attach ${PLUGIN_PID} --headless --listen 0.0.0.0:${PORT} --api-version 2
pkill dlv
