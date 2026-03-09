<template>
  <aside class="sidebar">
    <div class="mode-tabs">
      <button
        v-for="m in modes" :key="m.id"
        class="mode-tab"
        :class="{ active: store.mode === m.id }"
        @click="store.setMode(m.id)"
        :title="m.label"
      >
        <span class="mode-icon">{{ m.icon }}</span>
        <span class="mode-label">{{ m.label }}</span>
      </button>
    </div>

    <div class="sidebar-section">
      <input class="name-input" v-model="store.project.name" placeholder="Project name" />
      <div class="btn-row">
        <button class="btn-ghost-sm" @click="store.newProject">New</button>
        <button class="btn-ghost-sm" @click="store.saveToFile">Save</button>
        <label class="btn-ghost-sm">
          Load
          <input type="file" accept=".json" style="display:none" @change="loadFile" />
        </label>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="section-header">
        <label class="section-label">DB Schema</label>
        <button v-if="store.importedSchema" class="btn-tiny" @click="store.clearDbSchema">X</button>
      </div>
      <div v-if="!store.importedSchema" class="schema-empty">
        <label class="btn-ghost-sm block">
          Load .dbm.json
          <input type="file" accept=".json" style="display:none" @change="loadSchema" />
        </label>
        <button v-if="dbStore.schema.tables.length" class="btn-use-current" @click="useCurrentSchema">
          Use current DB
        </button>
      </div>
      <div v-else class="schema-loaded">
        <div class="schema-name">Loaded: {{ store.importedSchema.name }}</div>
        <div class="table-palette scrollable">
          <div v-for="t in store.importedSchema.tables" :key="t.name" class="palette-item" @click="importTable(t)">
            <span class="item-dot" :style="{ background: t.color }" />
            <span class="item-name">{{ t.name }}</span>
            <span class="item-plus">+</span>
          </div>
        </div>
      </div>
    </div>

    <div class="sidebar-section add-section">
      <template v-if="store.mode === 'rest'">
        <button class="btn-primary" @click="addEndpoint">
          <span>+</span> New Endpoint
        </button>
        <button class="btn-secondary" @click="addRestType">
          <span>+</span> New Type
        </button>
      </template>

      <template v-if="store.mode === 'graphql'">
        <button class="btn-primary" @click="addGqlType('type')">
          <span>+</span> New Type
        </button>
        <div class="gql-kind-grid">
          <button v-for="k in gqlKinds" :key="k.id" class="gql-kind-btn"
            :style="{ '--k-color': k.color, '--k-color-rgb': hexToRgb(k.color) }" @click="addGqlType(k.id)">
            {{ k.label }}
          </button>
        </div>
      </template>

      <template v-if="store.mode === 'federation'">
        <button class="btn-primary" @click="addService">
          <span>+</span> New Service
        </button>
        <button class="btn-secondary" @click="addFedType" :disabled="!hasServices">
          <span>+</span> Add Type
        </button>
        <div v-if="!hasServices" class="hint">Create a service first</div>
      </template>
    </div>

    <div class="sidebar-section flex-grow">
      <template v-if="store.mode === 'rest'">
        <label class="section-label" title="HTTP routes currently modeled on the API canvas. Click to select and double-click to edit.">
          Routes ({{ endpointCount }})
        </label>
        <div class="item-list scrollable">
          <div v-for="n in store.restNodes.filter(n => n.kind === 'endpoint')" :key="n.id"
            class="list-item" :class="{ active: store.selectedNodeId === n.id }"
            :title="'Click to select this route. Double-click to edit it.'"
            @click="selectRestNode(n.id)"
            @dblclick="editRestNode(n.id)">
            <span class="method-dot" :style="{ background: methodColor((n as any).method) }">{{ (n as any).method }}</span>
            <span class="item-name">{{ (n as any).path }}</span>
          </div>
          <div v-if="endpointCount === 0" class="list-empty">No routes</div>
        </div>
      </template>

      <template v-if="store.mode === 'graphql'">
        <label class="section-label">Types ({{ store.gqlNodes.length }})</label>
        <div class="item-list scrollable">
          <div v-for="n in store.gqlNodes" :key="n.id"
            class="list-item" :class="{ active: store.selectedNodeId === n.id }"
            @click="store.selectedNodeId = n.id"
            @dblclick="store.editingNodeId = n.id">
            <span class="kind-chip" :style="{ background: n.color + '22', color: n.color, borderColor: n.color + '44' }">
              {{ n.kind.replace('-root','') }}
            </span>
            <span class="item-name">{{ n.name }}</span>
            <span class="item-count">{{ n.fields?.length ?? n.values?.length ?? 0 }}</span>
          </div>
          <div v-if="store.gqlNodes.length === 0" class="list-empty">No types</div>
        </div>
      </template>

      <template v-if="store.mode === 'federation'">
        <label class="section-label">Services ({{ store.fedServices.length }})</label>
        <div class="item-list">
          <div v-for="svc in store.fedServices" :key="svc.id"
            class="list-item svc-item" :class="{ active: store.selectedServiceId === svc.id }"
            @click="store.selectedServiceId = svc.id; store.selectedNodeId = null"
            @dblclick="store.editingServiceId = svc.id">
            <span class="item-dot" :style="{ background: svc.color }" />
            <span class="item-name">{{ svc.name }}</span>
            <span class="item-count">{{ fedTypeCountFor(svc.id) }}</span>
          </div>
          <div v-if="store.fedServices.length === 0" class="list-empty">No services</div>
        </div>
        <label class="section-label" style="margin-top:8px">Types ({{ store.fedNodes.length }})</label>
        <div class="item-list scrollable">
          <div v-for="n in store.fedNodes" :key="n.id"
            class="list-item" :class="{ active: store.selectedNodeId === n.id }"
            @click="store.selectedNodeId = n.id"
            @dblclick="store.editingNodeId = n.id">
            <span class="item-dot" :style="{ background: n.color }" />
            <span class="item-name">{{ n.name }}</span>
            <span v-if="n.isEntity" class="entity-chip">entity</span>
            <span class="item-count">{{ n.fields.length }}</span>
          </div>
          <div v-if="store.fedNodes.length === 0" class="list-empty">No types</div>
        </div>
      </template>
    </div>

    <div v-if="selectedNode" class="sidebar-section inspector">
      <label class="section-label">
        {{ store.mode === 'rest' && (selectedNode as any).kind === 'endpoint' ? 'Endpoint'
         : store.mode === 'rest' ? 'Type'
         : store.mode === 'graphql' ? 'GQL Type'
         : 'Fed Type' }}
      </label>
      <div class="insp-name" :style="{ color: (selectedNode as any).color ?? '#3ECF8E' }">
        {{ (selectedNode as any).name ?? (selectedNode as any).path }}
      </div>
      <div class="insp-actions">
        <button class="btn-ghost-action" @click="store.editingNodeId = store.selectedNodeId">Edit</button>
        <button class="btn-ghost-action danger" @click="deleteSelected">Delete</button>
      </div>
    </div>

    <div v-if="store.mode === 'federation' && selectedService && !selectedNode" class="sidebar-section inspector">
      <label class="section-label">Service</label>
      <div class="insp-name" :style="{ color: selectedService.color }">{{ selectedService.name }}</div>
      <div class="insp-url">{{ selectedService.url }}</div>
      <div class="insp-actions">
        <button class="btn-ghost-action" @click="store.editingServiceId = store.selectedServiceId">Edit</button>
        <button class="btn-ghost-action danger" @click="store.deleteService(store.selectedServiceId!)">Delete</button>
      </div>
    </div>

    <div class="sidebar-footer">
      <span class="autosave">auto-saved</span>
    </div>

    <EndpointEditor  v-if="editingEndpoint"  :node="editingEndpoint"  @close="store.editingNodeId = null" />
    <RestTypeEditor  v-if="editingRestType"  :node="editingRestType"  @close="store.editingNodeId = null" />
    <GqlTypeEditor   v-if="editingGqlType"   :node="editingGqlType"   @close="store.editingNodeId = null" />
    <FedTypeEditor   v-if="editingFedType"   :node="editingFedType"   @close="store.editingNodeId = null" />
    <ServiceEditor   v-if="editingService"   :service="editingService" @close="store.editingServiceId = null" />
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useApiStore } from '../../stores/api'
import { useSchemaStore } from '../../stores/schema'
import { METHOD_COLORS, GQL_KIND_COLORS } from '../../types/api'
import type { GqlTypeKind, HttpMethod, RestEndpointNode, RestNode } from '../../types/api'
import EndpointEditor from '../api-modals/EndpointEditor.vue'
import RestTypeEditor from '../api-modals/RestTypeEditor.vue'
import GqlTypeEditor from '../api-modals/GqlTypeEditor.vue'
import FedTypeEditor from '../api-modals/FedTypeEditor.vue'
import ServiceEditor from '../api-modals/ServiceEditor.vue'

const store = useApiStore()
const dbStore = useSchemaStore()

const modes = [
  { id: 'rest' as const, label: 'REST', icon: 'R' },
  { id: 'graphql' as const, label: 'GraphQL', icon: 'G' },
  { id: 'federation' as const, label: 'Federation', icon: 'F' },
]

const gqlKinds = [
  { id: 'input' as GqlTypeKind, label: 'input', color: GQL_KIND_COLORS['input'] },
  { id: 'enum' as GqlTypeKind, label: 'enum', color: GQL_KIND_COLORS['enum'] },
  { id: 'interface' as GqlTypeKind, label: 'interface', color: GQL_KIND_COLORS['interface'] },
  { id: 'union' as GqlTypeKind, label: 'union', color: GQL_KIND_COLORS['union'] },
  { id: 'scalar' as GqlTypeKind, label: 'scalar', color: GQL_KIND_COLORS['scalar'] },
  { id: 'query-root' as GqlTypeKind, label: 'Query', color: GQL_KIND_COLORS['query-root'] },
  { id: 'mutation-root' as GqlTypeKind, label: 'Mutation', color: GQL_KIND_COLORS['mutation-root'] },
  { id: 'subscription-root' as GqlTypeKind, label: 'Sub', color: GQL_KIND_COLORS['subscription-root'] },
]

function hexToRgb(hex: string): string {
  if (!hex || hex[0] !== '#') return '99, 99, 99'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function methodColor(m: HttpMethod) { return METHOD_COLORS[m] ?? '#888' }

const endpointCount = computed(() => store.restNodes.filter(n => n.kind === 'endpoint').length)
const hasServices = computed(() => store.fedServices.length > 0)

function fedTypeCountFor(svcId: string) {
  return store.fedNodes.filter(n => n.serviceId === svcId).length
}

let nodeOffsetIdx = 0
function nextPos() {
  const n = nodeOffsetIdx++
  return { x: 80 + (n % 6) * 50, y: 80 + Math.floor(n / 6) * 60 }
}

function addEndpoint() { store.createEndpoint(nextPos()) }
function addRestType() { store.createRestType(nextPos()) }
function addGqlType(k: GqlTypeKind) { store.createGqlType(k, nextPos()) }
function addService() { store.createService({ x: 60 + store.fedServices.length * 40, y: 60 }) }
function addFedType() {
  const svc = store.selectedServiceId ?? store.fedServices[0]?.id
  if (svc) store.createFedType(svc, nextPos())
}

function deleteSelected() {
  if (!store.selectedNodeId) return
  if (store.mode === 'rest') store.deleteRestNode(store.selectedNodeId)
  if (store.mode === 'graphql') store.deleteGqlNode(store.selectedNodeId)
  if (store.mode === 'federation') store.deleteFedNode(store.selectedNodeId)
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function singularize(value: string) {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`
  if (value.endsWith('ses')) return value.slice(0, -2)
  if (value.endsWith('s') && value.length > 1) return value.slice(0, -1)
  return value
}

function routeCandidates(path: string) {
  const segment = path
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .find(part => !part.startsWith(':') && !part.startsWith('{'))

  if (!segment) return []

  const normalized = normalizeToken(segment)
  const singular = singularize(normalized)
  return Array.from(new Set([normalized, singular]))
}

function tableCandidates(name: string) {
  const normalized = normalizeToken(name)
  const singular = singularize(normalized)
  return new Set([normalized, singular])
}

function findSchemaTableIdForRestNode(node: RestNode) {
  const tables = dbStore.schema.tables
  if (!tables.length) return null

  if (node.kind === 'type') {
    const match = tables.find(table => tableCandidates(table.name).has(singularize(normalizeToken(node.name))))
    return match?.id ?? null
  }

  const endpoint = node as RestEndpointNode
  const typeRefs = [endpoint.requestBodyRef, ...endpoint.responses.map(response => response.bodyTypeRef)].filter(Boolean) as string[]
  const linkedTypes = typeRefs
    .map(typeId => store.restNodes.find(candidate => candidate.id === typeId && candidate.kind === 'type'))
    .filter((candidate): candidate is Extract<RestNode, { kind: 'type' }> => Boolean(candidate))

  for (const linkedType of linkedTypes) {
    const typeMatch = tables.find(table => tableCandidates(table.name).has(singularize(normalizeToken(linkedType.name))))
    if (typeMatch) return typeMatch.id
  }

  const routeNames = routeCandidates(endpoint.path)
  const routeMatch = tables.find(table => {
    const candidates = tableCandidates(table.name)
    return routeNames.some(name => candidates.has(name))
  })

  return routeMatch?.id ?? null
}

function syncSchemaSelectionForRestNode(nodeId: string) {
  const node = store.restNodes.find(candidate => candidate.id === nodeId)
  if (!node) return

  const tableId = findSchemaTableIdForRestNode(node)
  if (!tableId) return

  dbStore.selectedTableId = tableId
  dbStore.selectedRelationId = null
  dbStore.selectedGroupId = null
}

function selectRestNode(nodeId: string) {
  store.selectedNodeId = nodeId
  store.selectedRelId = null
  store.selectedGroupId = null
  store.selectedServiceId = null
  syncSchemaSelectionForRestNode(nodeId)
}

function editRestNode(nodeId: string) {
  selectRestNode(nodeId)
  store.editingNodeId = nodeId
}

const selectedNode = computed(() => {
  if (!store.selectedNodeId) return null
  if (store.mode === 'rest') return store.restNodes.find(n => n.id === store.selectedNodeId)
  if (store.mode === 'graphql') return store.gqlNodes.find(n => n.id === store.selectedNodeId)
  return store.fedNodes.find(n => n.id === store.selectedNodeId)
})

const selectedService = computed(() =>
  store.fedServices.find(s => s.id === store.selectedServiceId) ?? null
)

const editingEndpoint = computed(() => {
  if (store.mode !== 'rest' || !store.editingNodeId) return null
  const n = store.restNodes.find(n => n.id === store.editingNodeId)
  return n?.kind === 'endpoint' ? n : null
})
const editingRestType = computed(() => {
  if (store.mode !== 'rest' || !store.editingNodeId) return null
  const n = store.restNodes.find(n => n.id === store.editingNodeId)
  return n?.kind === 'type' ? n : null
})
const editingGqlType = computed(() => {
  if (store.mode !== 'graphql' || !store.editingNodeId) return null
  return store.gqlNodes.find(n => n.id === store.editingNodeId) ?? null
})
const editingFedType = computed(() => {
  if (store.mode !== 'federation' || !store.editingNodeId) return null
  return store.fedNodes.find(n => n.id === store.editingNodeId) ?? null
})
const editingService = computed(() => {
  if (store.mode !== 'federation' || !store.editingServiceId) return null
  return store.fedServices.find(s => s.id === store.editingServiceId) ?? null
})

function loadFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try { store.loadFromFile(JSON.parse(ev.target?.result as string)) }
    catch { alert('Invalid project file') }
  }
  reader.readAsText(file)
}

function loadSchema(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const json = JSON.parse(ev.target?.result as string)
      store.loadDbSchema(json)
    } catch { alert('Invalid schema file') }
  }
  reader.readAsText(file)
}

function useCurrentSchema() {
  store.loadDbSchema(dbStore.schema)
}

function importTable(table: any) {
  const pos = nextPos()
  if (store.mode === 'rest') {
    const type = store.createRestType(pos)
    store.updateRestNode(type.id, {
      name: table.name,
      color: table.color,
      fields: table.columns.map((c: any) => ({
        id: Math.random().toString(36).slice(2, 9),
        name: c.name,
        type: c.type || 'string',
        required: !c.nullable,
        description: ''
      }))
    })

    const getList = store.createEndpoint({ x: pos.x - 250, y: pos.y })
    store.updateRestNode(getList.id, {
      path: `/${table.name.toLowerCase()}`,
      method: 'GET',
      summary: `List ${table.name}`,
      responses: [{ id: Math.random().toString(36).slice(2, 9), statusCode: 200, description: 'OK', bodyTypeRef: type.id }]
    })

    const postItem = store.createEndpoint({ x: pos.x - 250, y: pos.y + 100 })
    store.updateRestNode(postItem.id, {
      path: `/${table.name.toLowerCase()}`,
      method: 'POST',
      summary: `Create ${table.name}`,
      requestBodyRef: type.id,
      responses: [{ id: Math.random().toString(36).slice(2, 9), statusCode: 201, description: 'Created', bodyTypeRef: type.id }]
    })
  } else if (store.mode === 'graphql') {
    const type = store.createGqlType('type', pos)
    store.updateGqlNode(type.id, {
      name: table.name,
      color: table.color,
      fields: table.columns.map((c: any) => ({
        id: Math.random().toString(36).slice(2, 9),
        name: c.name,
        type: (c.type || 'String') + (!c.nullable ? '!' : ''),
        args: [],
        description: ''
      }))
    })
  }
}
</script>

<style scoped>
.sidebar {
  width: 248px;
  min-width: 248px;
  background: #0d0d12;
  border-right: 1px solid #1a1a24;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.mode-tabs {
  display: flex;
  border-bottom: 1px solid #1a1a24;
}

.mode-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border-bottom: 2px solid transparent;
  color: #61748f;
}

.mode-tab:hover {
  background: #15151c;
  color: #9cb0cb;
}

.mode-tab.active {
  color: #3ecf8e;
  border-bottom-color: #3ecf8e;
  background: #0f1812;
}

.mode-icon {
  font-size: 14px;
}

.mode-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sidebar-section {
  padding: 10px 12px;
  border-bottom: 1px solid #181820;
}

.sidebar-section.flex-grow {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.name-input {
  width: 100%;
  background: #18181f;
  border: 1px solid #25252f;
  border-radius: 6px;
  color: #e0e0e0;
  padding: 6px 10px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 6px;
  transition: border-color 0.15s;
}

.name-input:focus {
  border-color: #3ecf8e40;
}

.btn-row {
  display: flex;
  gap: 5px;
}

.btn-ghost-sm {
  flex: 1;
  background: #18181f;
  border: 1px solid #25252f;
  color: #9cb0cb;
  border-radius: 5px;
  padding: 5px 4px;
  font-size: 10px;
  cursor: pointer;
  text-align: center;
  transition: color 0.15s, background 0.15s;
}

.btn-ghost-sm:hover {
  color: #e0e0e0;
  background: #22222c;
}

.btn-ghost-sm.block {
  display: block;
  width: 100%;
  margin-bottom: 5px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-tiny {
  background: none;
  border: 1px solid #25252f;
  border-radius: 4px;
  color: #61748f;
  font-size: 10px;
  padding: 1px 5px;
  cursor: pointer;
}

.btn-tiny:hover {
  color: #ef4444;
  border-color: #ef444440;
}

.schema-empty {
  padding: 4px 0;
}

.btn-use-current {
  width: 100%;
  background: none;
  border: 1px dashed #25252f;
  color: #9cb0cb;
  border-radius: 5px;
  padding: 5px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'JetBrains Mono', monospace;
}

.btn-use-current:hover {
  color: #3ecf8e;
  border-color: #3ecf8e40;
}

.schema-loaded {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schema-name {
  font-size: 10px;
  color: #3ecf8e;
  font-weight: 700;
}

.table-palette {
  max-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}

.palette-item:hover {
  background: #18181f;
}

.palette-item .item-plus {
  color: #61748f;
  font-size: 12px;
  margin-left: auto;
}

.palette-item:hover .item-plus {
  color: #3ecf8e;
}

.add-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-primary {
  width: 100%;
  background: #3ecf8e;
  color: #0a1a12;
  border: none;
  border-radius: 7px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #45e09a;
}

.btn-secondary {
  width: 100%;
  background: #18181f;
  color: #c3d1e6;
  border: 1px solid #25252f;
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: color 0.15s, border-color 0.15s;
}

.btn-secondary:hover:not(:disabled) {
  color: #e0e0e0;
  border-color: #3a3a50;
}

.btn-secondary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.gql-kind-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.gql-kind-btn {
  background: rgba(var(--k-color-rgb, 120, 120, 120), 0.1);
  border: 1px solid rgba(var(--k-color-rgb, 120, 120, 120), 0.25);
  color: var(--k-color);
  border-radius: 5px;
  padding: 5px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.04em;
  transition: background 0.15s;
}

.gql-kind-btn:hover {
  background: rgba(var(--k-color-rgb, 120, 120, 120), 0.2);
}

.hint {
  font-size: 10px;
  color: #61748f;
  font-style: italic;
  text-align: center;
}

.section-label {
  display: block;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7f92af;
  margin-bottom: 6px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-list.scrollable {
  flex: 1;
  overflow-y: auto;
}

.item-list.scrollable::-webkit-scrollbar {
  width: 3px;
}

.item-list.scrollable::-webkit-scrollbar-thumb {
  background: #25252f;
  border-radius: 2px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s;
}

.list-item:hover {
  background: #18181f;
}

.list-item.active {
  background: #0f1812;
}

.item-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  font-size: 12px;
  color: #b0b0bc;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count {
  font-size: 10px;
  color: #7f92af;
  background: #18181f;
  padding: 1px 5px;
  border-radius: 8px;
}

.method-dot {
  font-size: 8px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.05em;
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
  color: #0a0a0f;
}

.kind-chip {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid;
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}

.entity-chip {
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  background: #f59e0b20;
  color: #f59e0b;
  border: 1px solid #f59e0b40;
  flex-shrink: 0;
}

.list-empty {
  font-size: 11px;
  color: #61748f;
  text-align: center;
  padding: 10px;
  font-style: italic;
}

.inspector {
  background: #0a0a0f;
}

.insp-name {
  font-size: 13px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.insp-url {
  font-size: 10px;
  color: #7f92af;
  margin-bottom: 8px;
  font-family: 'JetBrains Mono', monospace;
  word-break: break-all;
}

.insp-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.btn-ghost-action {
  flex: 1;
  background: none;
  border: 1px solid #25252f;
  color: #9cb0cb;
  border-radius: 6px;
  padding: 5px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost-action:hover {
  color: #e0e0e0;
  background: #18181f;
}

.btn-ghost-action.danger:hover {
  color: #ef4444;
  border-color: #ef444440;
  background: #ef444410;
}

.sidebar-footer {
  padding: 8px 14px;
  border-top: 1px solid #181820;
}

.autosave {
  font-size: 10px;
  color: #3ecf8e80;
  letter-spacing: 0.02em;
}
</style>
