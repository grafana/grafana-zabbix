local schema = import './schema.json';

local j = import 'github.com/Duologic/jsonnet-libsonnet/main.libsonnet';
local jutils = import 'github.com/Duologic/jsonnet-libsonnet/utils.libsonnet';
local crdsonnet = import 'github.com/crdsonnet/crdsonnet/crdsonnet/main.libsonnet';
local astengine = import 'github.com/crdsonnet/crdsonnet/crdsonnet/renderEngines/ast.libsonnet';
local d = import 'github.com/jsonnet-libs/docsonnet/doc-util/main.libsonnet';

local processor =
  crdsonnet.processor.new()
  + crdsonnet.processor.withRenderEngineType('ast');


local unwrapFromCRDsonnet(astObject, title) =
  jutils.get(
    astObject,
    title,
    default=error 'field %s not found in ast' % title
  ).expr;

local addDoc(obj) =
  j.object.members(
    [
      j.field.field(
        j.fieldname.string('#'),
        // render docsonnet as literal to avoid docsonnet dependency
        j.literal(
          d.package.new(
            'zabbixQuery',
            'https://github.com/grafana/grafana-zabbix/jsonnet/zabbix-query-libsonnet',
            'Jsonnet library for creating Zabbix queries for Grafana.',
            'main.libsonnet',
            'main',
          ),
        ),
        nobreak=true,
      ),
    ]
    + std.filter(
      // '#' docstring replaced by above
      function(m) jutils.fieldnameValue(m.fieldname) != '#',
      obj.members
    )
  );

local hideDocs(obj) =
  // The sub fields of these objects can be accessed directly.
  // For example: `application.withFilter`
  local objFields = [
    'application',
    'datasource',
    'group',
    'host',
    'item',
    'itemTag',
    'macro',
    'options',
    'proxy',
    'tags',
    'trigger',
    'triggers',
  ];

  local docsToHide =
    std.map(
      function(f) '#%s' % astengine.functionName(f),
      objFields
    )
    + std.map(
      function(f) '#%sMixin' % astengine.functionName(f),
      objFields
    );

  j.object.members(
    std.filter(
      function(m)
        !std.member(
          docsToHide,
          jutils.fieldnameValue(m.fieldname)
        ),
      obj.members,
    )
  );

local render = crdsonnet.schema.render('item', schema, processor);

local unwrapped = unwrapFromCRDsonnet(render, 'item');

local renderWithDoc = addDoc(unwrapped);

local renderWithHiddenDocs = hideDocs(renderWithDoc);

renderWithHiddenDocs.toString(break='\n')
