import os
from zabbix_utils import ZabbixAPI

zabbix_url = os.environ['ZBX_API_URL']
zabbix_user = os.environ['ZBX_API_USER']
zabbix_password = os.environ['ZBX_API_PASSWORD']
zabbix_test_user = os.environ['ZBX_TEST_USER']
zabbix_test_pass = os.environ['ZBX_TEST_PASS']
print(zabbix_url, zabbix_user, zabbix_password, zabbix_test_user, zabbix_test_pass)

zapi = ZabbixAPI(zabbix_url)

for i in range(10):
  try:
    zapi.login(user=zabbix_user, password=zabbix_password)
    print("Connected to Zabbix API Version %s" % zapi.api_version())
    break
  except Exception as e:
    print(e)

config_path = os.environ['ZBX_CONFIG']
import_rules = {
  'discoveryRules': {
      'createMissing': True,
      'updateExisting': True
  },
  'graphs': {
      'createMissing': True,
      'updateExisting': True
  },
  'host_groups': {
      'createMissing': True
  },
  'hosts': {
      'createMissing': True,
      'updateExisting': True
  },
  'images': {
      'createMissing': True,
      'updateExisting': True
  },
  'items': {
      'createMissing': True,
      'updateExisting': True
  },
  'maps': {
      'createMissing': True,
      'updateExisting': True
  },
  'templateLinkage': {
      'createMissing': True,
  },
  'templates': {
      'createMissing': True,
      'updateExisting': True
  },
  'triggers': {
      'createMissing': True,
      'updateExisting': True
  },
}

print("Importing Zabbix config from %s" % config_path)
with open(config_path, 'r') as f:
  config = f.read()

  try:
    import_result = zapi.configuration.import_(source=config, format="json", rules=import_rules)
    if import_result == True:
      print("Zabbix config imported successfully")
    else:
      print("Failed to import Zabbix config")      
  except Exception as e:
    print(e)

print("Creating a user for testing per-user auth")
groups = zapi.usergoup.get(output="extend", filter={"name": "Zabbix administrators"})
if not groups:
  groups = zapi.usergroup.get(output="extend")
groupid = groups[0]['usrgrpid']

user_create_params = {
  "alias": zabbix_test_user,
  "passwd": zabbix_test_pass,
  "name": "Grafana",
  "surname": "Test",
  "type": 1,  # Zabbix user type
  "user_groups": [{"usrgrpid": groupid}],
}

try:
  user = zapi.user.create(**user_create_params)
  print("User created successfully: %s" % user['userids'][0])
except Exception as e:
  print("Failed to create user: %s" % e)

for h in zapi.host.get(output="extend"):
    print(h['name'])
