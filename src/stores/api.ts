import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type {
  ApiProject, DesignerMode,
  RestSchema, RestNode, RestEndpointNode, RestTypeNode, RestRelation, RestField, RestParam, RestResponse,
  GqlSchema, GqlTypeNode, GqlRelation, GqlField, GqlTypeKind,
  FedSchema, FedService, FedTypeNode, FedRelation, FedField,
  ApiGroup, HttpMethod, Position,
} from '../types/api'
import { NODE_DEFAULT_WIDTH, METHOD_COLORS, GQL_KIND_COLORS } from '../types/api'

const ENDPOINT_COLORS = ['#3ECF8E','#2FBF8F','#58C98D','#8ACB88','#56B8A6','#D5A35B','#E0705E','#A6D97A']
const SERVICE_COLORS  = ['#3ECF8E','#57C5A0','#56B8A6','#8ACB88','#D5A35B','#E0705E','#A6D97A','#2FBF8F']

function makeProject(): ApiProject {
  return {
    id: uuidv4(),
    name: 'untitled-api',
    mode: 'rest',
    rest:        makeRestSchema(),
    graphql:     makeGqlSchema(),
    federation:  makeFedSchema(),
    linkedDbSchemaPath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeRestSchema(): RestSchema {
  return { id: uuidv4(), title: 'My API', version: '1.0.0', baseUrl: '/api/v1', nodes: [], relations: [], groups: [] }
}
function makeGqlSchema(): GqlSchema {
  return { id: uuidv4(), name: 'MyGraph', nodes: [], relations: [], groups: [] }
}
function makeFedSchema(): FedSchema {
  return { id: uuidv4(), name: 'MyFederation', services: [], nodes: [], relations: [], groups: [] }
}

export const useApiStore = defineStore('api', () => {
  const project = ref<ApiProject>(makeProject())

  // â”€â”€ DB Schema integration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const importedSchema = ref<{ name: string; tables: any[] } | null>(null)

  function loadDbSchema(json: any) {
    const schema = json.tables ? json : json.schema ?? json
    importedSchema.value = {
      name: schema.name || 'Imported Schema',
      tables: schema.tables || []
    }
  }

  function clearDbSchema() {
    importedSchema.value = null
  }

  function createFromTable(table: any) {
    const pos = { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 }
    
    if (project.value.mode === 'rest') {
      // 1. Create Type
      const typeNode: RestTypeNode = {
        id: uuidv4(),
        kind: 'type',
        name: table.name,
        description: table.comment || '',
        fields: (table.columns || []).map((c: any) => ({
          id: uuidv4(),
          name: c.name,
          type: c.type.toLowerCase(),
          description: c.comment || ''
        })),
        position: { x: pos.x + 350, y: pos.y },
        width: NODE_DEFAULT_WIDTH,
        color: '#57C5A0',
        groupId: null
      }
      project.value.rest.nodes.push(typeNode)

      // 2. Create standard Endpoints
      const endpoints: RestEndpointNode[] = [
        {
          id: uuidv4(),
          kind: 'endpoint',
          method: 'GET',
          path: `/${table.name.toLowerCase()}s`,
          summary: `List ${table.name}s`,
          description: '',
          tags: [table.name],
          params: [],
          responses: [{ id: uuidv4(), statusCode: 200, description: 'OK', bodyTypeRef: typeNode.id }],
          requestBodyRef: null,
          position: pos,
          width: NODE_DEFAULT_WIDTH,
          color: METHOD_COLORS['GET'],
          groupId: null
        },
        {
          id: uuidv4(),
          kind: 'endpoint',
          method: 'POST',
          path: `/${table.name.toLowerCase()}s`,
          summary: `Create ${table.name}`,
          description: '',
          tags: [table.name],
          params: [],
          responses: [{ id: uuidv4(), statusCode: 201, description: 'Created', bodyTypeRef: typeNode.id }],
          requestBodyRef: typeNode.id,
          position: { x: pos.x, y: pos.y + 200 },
          width: NODE_DEFAULT_WIDTH,
          color: METHOD_COLORS['POST'],
          groupId: null
        }
      ]
      project.value.rest.nodes.push(...endpoints)

      // 3. Select the new nodes
      selectedNodeId.value = typeNode.id
    } 
    else if (project.value.mode === 'graphql') {
      const gqlNode: GqlTypeNode = {
        id: uuidv4(),
        kind: 'type',
        name: table.name,
        description: table.comment || '',
        fields: (table.columns || []).map((c: any) => ({
          id: uuidv4(),
          name: c.name,
          type: c.type.toLowerCase(),
          args: [],
          description: c.comment || '',
          isDeprecated: false,
          deprecationReason: ''
        })),
        implements: [],
        values: [],
        position: pos,
        width: NODE_DEFAULT_WIDTH,
        color: GQL_KIND_COLORS['type'],
        groupId: null
      }
      project.value.graphql.nodes.push(gqlNode)
      selectedNodeId.value = gqlNode.id
    }
    
    persist()
  }

  // â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function persist() {
    project.value.updatedAt = new Date().toISOString()
    try { localStorage.setItem('api-modeler-project', JSON.stringify(project.value)) } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('api-modeler-project')
      if (!raw) return
      const p = JSON.parse(raw) as ApiProject
      // migrations
      if (!p.federation) p.federation = makeFedSchema()
      if (!p.graphql)    p.graphql    = makeGqlSchema()
      if (!p.rest)       p.rest       = makeRestSchema()
      p.rest.nodes       = p.rest.nodes.map(n => ({ width: NODE_DEFAULT_WIDTH, groupId: null, ...n }))
      p.graphql.nodes    = p.graphql.nodes.map(n => ({ width: NODE_DEFAULT_WIDTH, groupId: null, ...n }))
      p.federation.nodes = p.federation.nodes.map(n => ({ width: NODE_DEFAULT_WIDTH, groupId: null, ...n }))
      p.rest.groups       = (p.rest.groups || []).map(g => ({ parentGroupId: null, ...g }))
      p.graphql.groups    = (p.graphql.groups || []).map(g => ({ parentGroupId: null, ...g }))
      p.federation.groups = (p.federation.groups || []).map(g => ({ parentGroupId: null, ...g }))
      project.value = p
    } catch {}
  }

  loadFromStorage()

  // â”€â”€ Mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mode = computed(() => project.value.mode)
  function setMode(m: DesignerMode) { project.value.mode = m; persist() }

  // â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectedNodeId     = ref<string | null>(null)
  const selectedRelId      = ref<string | null>(null)
  const selectedGroupId    = ref<string | null>(null)
  const selectedServiceId  = ref<string | null>(null)
  const editingNodeId      = ref<string | null>(null)
  const editingGroupId     = ref<string | null>(null)
  const editingServiceId   = ref<string | null>(null)

  function clearSelection() {
    selectedNodeId.value = selectedRelId.value = selectedGroupId.value =
    selectedServiceId.value = editingNodeId.value = editingGroupId.value = null
  }

  // â”€â”€ REST helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const restNodes     = computed(() => project.value.rest.nodes)
  const restRelations = computed(() => project.value.rest.relations)
  const restGroups    = computed(() => project.value.rest.groups)

  function createEndpoint(position: Position = { x: 100, y: 100 }): RestEndpointNode {
    const idx   = restNodes.value.filter(n => n.kind === 'endpoint').length
    const node: RestEndpointNode = {
      id: uuidv4(), kind: 'endpoint',
      method: 'GET',
      path: `/resource${idx > 0 ? idx + 1 : ''}`,
      summary: '', description: '', tags: [],
      params: [], responses: [{ id: uuidv4(), statusCode: 200, description: 'OK', bodyTypeRef: null }],
      requestBodyRef: null,
      position, width: NODE_DEFAULT_WIDTH,
      color: ENDPOINT_COLORS[idx % ENDPOINT_COLORS.length],
      groupId: null,
    }
    project.value.rest.nodes.push(node)
    selectedNodeId.value = node.id
    editingNodeId.value  = node.id
    persist()
    return node
  }

  function createRestType(position: Position = { x: 100, y: 100 }): RestTypeNode {
    const idx  = restNodes.value.filter(n => n.kind === 'type').length
    const node: RestTypeNode = {
      id: uuidv4(), kind: 'type',
      name: `Type${idx + 1}`, description: '',
      fields: [{ id: uuidv4(), name: 'id', type: 'string', required: true, description: '' }],
      position, width: NODE_DEFAULT_WIDTH,
      color: ENDPOINT_COLORS[(idx + 3) % ENDPOINT_COLORS.length],
      groupId: null,
    }
    project.value.rest.nodes.push(node)
    selectedNodeId.value = node.id
    editingNodeId.value  = node.id
    persist()
    return node
  }

  function updateRestNode(id: string, updates: Partial<RestNode>) {
    const n = project.value.rest.nodes.find(n => n.id === id)
    if (n) { Object.assign(n, updates); persist() }
  }

  function deleteRestNode(id: string) {
    const r = project.value.rest
    r.nodes     = r.nodes.filter(n => n.id !== id)
    r.relations = r.relations.filter(rel => rel.sourceId !== id && rel.targetId !== id)
    if (selectedNodeId.value === id) selectedNodeId.value = null
    persist()
  }

  function addRestRelation(rel: Omit<RestRelation, 'id'>) {
    const r: RestRelation = { id: uuidv4(), ...rel }
    project.value.rest.relations.push(r); persist(); return r
  }

  function deleteRestRelation(id: string) {
    project.value.rest.relations = project.value.rest.relations.filter(r => r.id !== id)
    if (selectedRelId.value === id) selectedRelId.value = null
    persist()
  }

  function updateRestNodePosition(id: string, pos: Position) {
    const n = project.value.rest.nodes.find(n => n.id === id)
    if (n) n.position = pos
  }

  function commitRestNodePosition(id: string) { persist() }

  function updateRestNodeWidth(id: string, w: number) {
    const n = project.value.rest.nodes.find(n => n.id === id)
    if (n) n.width = Math.max(260, w)
  }

  function commitRestNodeWidth(id: string) { persist() }

  // â”€â”€ GraphQL helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const gqlNodes     = computed(() => project.value.graphql.nodes)
  const gqlRelations = computed(() => project.value.graphql.relations)
  const gqlGroups    = computed(() => project.value.graphql.groups)

  function createGqlType(kind: GqlTypeKind = 'type', position: Position = { x: 100, y: 100 }): GqlTypeNode {
    const idx  = gqlNodes.value.length
    const node: GqlTypeNode = {
      id: uuidv4(), kind,
      name: kind === 'query-root' ? 'Query'
          : kind === 'mutation-root' ? 'Mutation'
          : kind === 'subscription-root' ? 'Subscription'
          : `Type${idx + 1}`,
      description: '',
      fields: kind === 'enum' || kind === 'scalar' ? [] : [
        { id: uuidv4(), name: 'id', type: 'ID!', description: '', isDeprecated: false, args: [], resolverRef: null }
      ],
      implements: [],
      values: kind === 'enum' ? ['VALUE_1', 'VALUE_2'] : [],
      position, width: NODE_DEFAULT_WIDTH,
      color: GQL_KIND_COLORS[kind],
      groupId: null,
    }
    project.value.graphql.nodes.push(node)
    selectedNodeId.value = node.id
    editingNodeId.value  = node.id
    persist()
    return node
  }

  function updateGqlNode(id: string, updates: Partial<GqlTypeNode>) {
    const n = project.value.graphql.nodes.find(n => n.id === id)
    if (n) { Object.assign(n, updates); persist() }
  }

  function deleteGqlNode(id: string) {
    const g = project.value.graphql
    g.nodes     = g.nodes.filter(n => n.id !== id)
    g.relations = g.relations.filter(r => r.sourceId !== id && r.targetId !== id)
    if (selectedNodeId.value === id) selectedNodeId.value = null
    persist()
  }

  function addGqlRelation(rel: Omit<GqlRelation, 'id'>) {
    const r: GqlRelation = { id: uuidv4(), ...rel }
    project.value.graphql.relations.push(r); persist(); return r
  }

  function deleteGqlRelation(id: string) {
    project.value.graphql.relations = project.value.graphql.relations.filter(r => r.id !== id)
    if (selectedRelId.value === id) selectedRelId.value = null
    persist()
  }

  function updateGqlNodePosition(id: string, pos: Position) {
    const n = project.value.graphql.nodes.find(n => n.id === id)
    if (n) n.position = pos
  }

  function commitGqlNodePosition(id: string) { persist() }

  function updateGqlNodeWidth(id: string, w: number) {
    const n = project.value.graphql.nodes.find(n => n.id === id)
    if (n) n.width = Math.max(260, w)
  }

  function commitGqlNodeWidth(id: string) { persist() }

  // â”€â”€ Federation helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const fedServices  = computed(() => project.value.federation.services)
  const fedNodes     = computed(() => project.value.federation.nodes)
  const fedRelations = computed(() => project.value.federation.relations)
  const fedGroups    = computed(() => project.value.federation.groups)

  function createService(position: Position = { x: 60, y: 60 }): FedService {
    const idx = fedServices.value.length
    const svc: FedService = {
      id: uuidv4(),
      name: `service-${idx + 1}`,
      url: `https://service-${idx + 1}.example.com/graphql`,
      color: SERVICE_COLORS[idx % SERVICE_COLORS.length],
      position,
      size: { w: 480, h: 360 },
    }
    project.value.federation.services.push(svc)
    selectedServiceId.value = svc.id
    editingServiceId.value  = svc.id
    persist()
    return svc
  }

  function updateService(id: string, updates: Partial<FedService>) {
    const s = project.value.federation.services.find(s => s.id === id)
    if (s) { Object.assign(s, updates); persist() }
  }

  function deleteService(id: string) {
    const f = project.value.federation
    f.services = f.services.filter(s => s.id !== id)
    // Orphan nodes â€” keep them but clear serviceId
    f.nodes.forEach(n => { if (n.serviceId === id) n.serviceId = '' })
    f.relations = f.relations.filter(r => r.sourceServiceId !== id && r.targetServiceId !== id)
    if (selectedServiceId.value === id) selectedServiceId.value = null
    persist()
  }

  function createFedType(serviceId: string, position: Position = { x: 100, y: 100 }): FedTypeNode {
    const idx  = fedNodes.value.length
    const svc  = fedServices.value.find(s => s.id === serviceId)
    const node: FedTypeNode = {
      id: uuidv4(), serviceId,
      name: `Type${idx + 1}`, description: '',
      isEntity: false, keyFields: [], isExtension: false,
      fields: [
        { id: uuidv4(), name: 'id', type: 'ID!', isExternal: false, isRequired: false, requiresFields: '', isKey: false, description: '' }
      ],
      position, width: NODE_DEFAULT_WIDTH,
      color: svc?.color ?? SERVICE_COLORS[0],
      groupId: null,
    }
    project.value.federation.nodes.push(node)
    selectedNodeId.value = node.id
    editingNodeId.value  = node.id
    persist()
    return node
  }

  function updateFedNode(id: string, updates: Partial<FedTypeNode>) {
    const n = project.value.federation.nodes.find(n => n.id === id)
    if (n) { Object.assign(n, updates); persist() }
  }

  function deleteFedNode(id: string) {
    const f = project.value.federation
    f.nodes     = f.nodes.filter(n => n.id !== id)
    f.relations = f.relations.filter(r => r.sourceTypeId !== id && r.targetTypeId !== id)
    if (selectedNodeId.value === id) selectedNodeId.value = null
    persist()
  }

  function addFedRelation(rel: Omit<FedRelation, 'id'>) {
    const r: FedRelation = { id: uuidv4(), ...rel }
    project.value.federation.relations.push(r); persist(); return r
  }

  function deleteFedRelation(id: string) {
    project.value.federation.relations = project.value.federation.relations.filter(r => r.id !== id)
    if (selectedRelId.value === id) selectedRelId.value = null
    persist()
  }

  function updateFedNodePosition(id: string, pos: Position) {
    const n = project.value.federation.nodes.find(n => n.id === id)
    if (n) n.position = pos
  }

  function commitFedNodePosition(id: string) { persist() }

  function updateFedNodeWidth(id: string, w: number) {
    const n = project.value.federation.nodes.find(n => n.id === id)
    if (n) n.width = Math.max(260, w)
  }

  function commitFedNodeWidth(id: string) { persist() }

  function updateServicePosition(id: string, pos: Position) {
    const s = project.value.federation.services.find(s => s.id === id)
    if (s) s.position = pos
  }

  function updateServiceSize(id: string, size: { w: number; h: number }) {
    const s = project.value.federation.services.find(s => s.id === id)
    if (s) { s.size = size; persist() }
  }

  // â”€â”€ Groups (shared pattern across all modes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function currentGroups() {
    if (project.value.mode === 'rest')       return project.value.rest.groups
    if (project.value.mode === 'graphql')    return project.value.graphql.groups
    return project.value.federation.groups
  }

  function createGroup(position: Position = { x: 60, y: 60 }): ApiGroup {
    const groups = currentGroups()
    const COLS = ['#3ECF8E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#06B6D4']
    const g: ApiGroup = {
      id: uuidv4(), name: `group_${groups.length + 1}`,
      color: COLS[groups.length % COLS.length],
      position, size: { w: 400, h: 300 },
      parentGroupId: null,
    }
    groups.push(g)
    selectedGroupId.value = g.id
    editingGroupId.value  = g.id
    persist()
    return g
  }

  function updateGroup(id: string, updates: Partial<ApiGroup>) {
    const g = currentGroups().find(g => g.id === id)
    if (g) { Object.assign(g, updates); persist() }
  }

  function deleteGroup(id: string) {
    const gs = currentGroups()
    const idx = gs.findIndex(g => g.id === id)
    if (idx >= 0) gs.splice(idx, 1)
    // Ungroup nodes belonging to this group
    const allNodes = [
      ...project.value.rest.nodes,
      ...project.value.graphql.nodes,
      ...project.value.federation.nodes,
    ]
    allNodes.forEach(n => { if (n.groupId === id) n.groupId = null })
    if (selectedGroupId.value === id) selectedGroupId.value = null
    persist()
  }

  // â”€â”€ Export helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function exportOpenApi(): string {
    const r = project.value.rest
    const paths: Record<string, any> = {}
    for (const node of r.nodes) {
      if (node.kind !== 'endpoint') continue
      const ep = node as RestEndpointNode
      const method = ep.method.toLowerCase()
      if (!paths[ep.path]) paths[ep.path] = {}
      paths[ep.path][method] = {
        summary: ep.summary || ep.path,
        description: ep.description,
        tags: ep.tags,
        parameters: ep.params
          .filter(p => p.in !== 'body')
          .map(p => ({ name: p.name, in: p.in, required: p.required, schema: { type: p.type } })),
        responses: Object.fromEntries(
          ep.responses.map(res => [
            String(res.statusCode),
            { description: res.description }
          ])
        ),
      }
    }
    const spec = {
      openapi: '3.0.0',
      info: { title: r.title, version: r.version },
      servers: [{ url: r.baseUrl }],
      paths,
    }
    return JSON.stringify(spec, null, 2)
  }

  function exportGqlSdl(): string {
    const lines: string[] = []
    for (const node of project.value.graphql.nodes) {
      if (node.kind === 'scalar') {
        lines.push(`scalar ${node.name}\n`); continue
      }
      if (node.kind === 'enum') {
        lines.push(`enum ${node.name} {`)
        node.values.forEach(v => lines.push(`  ${v}`))
        lines.push('}\n'); continue
      }
      if (node.kind === 'union') {
        lines.push(`union ${node.name} = ${node.values.join(' | ')}\n`); continue
      }
      const kw = node.kind === 'input' ? 'input'
               : node.kind === 'interface' ? 'interface'
               : node.kind === 'query-root' ? 'type Query'
               : node.kind === 'mutation-root' ? 'type Mutation'
               : node.kind === 'subscription-root' ? 'type Subscription'
               : `type ${node.name}${node.implements.length ? ` implements ${node.implements.join(' & ')}` : ''}`
      const header = node.kind.endsWith('-root') ? kw : kw
      lines.push(`${header} {`)
      for (const f of node.fields) {
        const args = f.args.length
          ? `(${f.args.map(a => `${a.name}: ${a.type}${a.defaultValue ? ` = ${a.defaultValue}` : ''}`).join(', ')})`
          : ''
        lines.push(`  ${f.name}${args}: ${f.type}`)
      }
      lines.push('}\n')
    }
    return lines.join('\n')
  }

  function exportFedSdl(): string {
    const lines: string[] = ['# GraphQL Federation SDL\n']
    const f = project.value.federation
    for (const svc of f.services) {
      lines.push(`# â”€â”€ Service: ${svc.name} (${svc.url}) â”€â”€`)
      const svcNodes = f.nodes.filter(n => n.serviceId === svc.id)
      for (const node of svcNodes) {
        const ext = node.isExtension ? 'extend ' : ''
        const key = node.isEntity && node.keyFields.length ? ` @key(fields: "${node.keyFields.join(' ')}")` : ''
        lines.push(`${ext}type ${node.name}${key} {`)
        for (const field of node.fields) {
          const decorators = [
            field.isKey      ? '# @key field' : '',
            field.isExternal ? '@external' : '',
            field.isRequired ? `@requires(fields: "${field.requiresFields}")` : '',
          ].filter(Boolean).join(' ')
          lines.push(`  ${field.name}: ${field.type}${decorators ? '  ' + decorators : ''}`)
        }
        lines.push('}\n')
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  function saveToFile() {
    const json = JSON.stringify(project.value, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${project.value.name}.api.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function loadFromFile(json: ApiProject) {
    if (!json.rest)       json.rest       = makeRestSchema()
    if (!json.graphql)    json.graphql    = makeGqlSchema()
    if (!json.federation) json.federation = makeFedSchema()
    project.value = json
    clearSelection()
    persist()
  }

  function newProject() {
    project.value = makeProject()
    importedSchema.value = null
    clearSelection()
    persist()
  }

  return {
    project, mode, setMode,
    importedSchema, loadDbSchema, clearDbSchema,
    selectedNodeId, selectedRelId, selectedGroupId, selectedServiceId,
    editingNodeId, editingGroupId, editingServiceId,
    clearSelection,
    // REST
    restNodes, restRelations, restGroups,
    createEndpoint, createRestType,
    updateRestNode, deleteRestNode,
    addRestRelation, deleteRestRelation,
    updateRestNodePosition, commitRestNodePosition,
    updateRestNodeWidth, commitRestNodeWidth,
    // GraphQL
    gqlNodes, gqlRelations, gqlGroups,
    createGqlType, updateGqlNode, deleteGqlNode,
    addGqlRelation, deleteGqlRelation,
    updateGqlNodePosition, commitGqlNodePosition,
    updateGqlNodeWidth, commitGqlNodeWidth,
    // Federation
    fedServices, fedNodes, fedRelations, fedGroups,
    createService, updateService, deleteService,
    createFedType, updateFedNode, deleteFedNode,
    addFedRelation, deleteFedRelation,
    updateFedNodePosition, commitFedNodePosition,
    updateFedNodeWidth, commitFedNodeWidth,
    updateServicePosition, updateServiceSize,
    // Groups
    createGroup, updateGroup, deleteGroup,
    // Export
    exportOpenApi, exportGqlSdl, exportFedSdl,
    saveToFile, loadFromFile, newProject,
    createFromTable,
  }
})
