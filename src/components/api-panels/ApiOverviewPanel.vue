<template>
  <section class="api-overview-panel">
    <div class="panel-header">
      <div>
        <div class="eyebrow">API Overview</div>
        <div class="header-row">
          <h3>{{ headerTitle }}</h3>
          <a class="learn-link" :href="helpLink" target="_blank" rel="noreferrer">{{ helpLabel }}</a>
        </div>
      </div>
      <div class="mode-pill">{{ modeLabel }}</div>
    </div>

    <div class="panel-grid">
      <div class="panel-column panel-column-left">
        <div class="metric-grid">
          <article v-for="metric in metrics" :key="metric.label" class="metric-card">
            <span class="metric-label">{{ metric.label }}</span>
            <strong class="metric-value">{{ metric.value }}</strong>
            <span class="metric-note">{{ metric.note }}</span>
          </article>
        </div>

        <div class="summary-block">
          <div class="summary-title">Design Notes</div>
          <ul class="summary-list">
            <li v-for="item in highlights" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="catalog-block">
          <div class="summary-title" title="Mode-aware list of items currently modeled on the API canvas">Canvas Catalog</div>
          <div class="catalog-sections">
            <section v-for="section in catalogSections" :key="section.title" class="catalog-section">
              <div class="catalog-header" :title="section.hint">
                <span>{{ section.title }}</span>
                <span class="catalog-count">{{ section.items.length }}</span>
              </div>
              <div v-if="section.items.length" class="catalog-list">
                <button
                  v-for="item in section.items"
                  :key="item.id"
                  class="catalog-item"
                  :class="{ active: item.active }"
                  :title="item.rowHint"
                  @click="focusItem(item)"
                  @dblclick="editItem(item)"
                >
                  <span class="catalog-chip" :style="chipStyle(item)" :title="item.hint">{{ item.badge }}</span>
                  <span class="catalog-main">
                    <span class="catalog-name">{{ item.title }}</span>
                    <span class="catalog-meta">{{ item.meta }}</span>
                  </span>
                </button>
              </div>
              <div v-else class="catalog-empty">{{ section.empty }}</div>
            </section>
          </div>
        </div>
      </div>

      <div class="panel-column panel-column-right">
        <div class="preview-toolbar">
          <select v-model="selectedTarget" class="target-select">
            <option v-for="target in exportTargets" :key="target.id" :value="target.id">
              {{ target.label }}
            </option>
          </select>
          <div class="preview-actions">
            <button class="ghost-btn" @click="copyOutput">{{ copied ? 'Copied' : 'Copy' }}</button>
            <button class="solid-btn" @click="downloadOutput">Download</button>
          </div>
        </div>

        <pre class="preview-code"><code>{{ previewText }}</code></pre>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useApiStore } from '../../stores/api'
import { useSchemaStore } from '../../stores/schema'
import { useApiExports } from '../../composables/useApiExports'
import { METHOD_COLORS, GQL_KIND_COLORS } from '../../types/api'
import type { ApiExportTarget, RestEndpointNode, RestNode } from '../../types/api'

const REST_HELP_LINK = 'https://developer.mozilla.org/en-US/docs/Glossary/REST'
const GRAPHQL_HELP_LINK = 'https://graphql.org/learn/'
const FEDERATION_HELP_LINK = 'https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation'

const store = useApiStore()
const schemaStore = useSchemaStore()
const { exportTargets, exportOutput, exportDownloadName, exportTargetForMode } = useApiExports()

const selectedTarget = ref<ApiExportTarget>(exportTargetForMode())
const copied = ref(false)

watch(() => store.mode, () => {
  selectedTarget.value = exportTargetForMode()
})

const modeLabel = computed(() => store.mode === 'rest' ? 'REST' : store.mode === 'graphql' ? 'GraphQL' : 'Federation')
const headerTitle = computed(() => {
  if (store.mode === 'rest') return store.project.rest.title || store.project.name
  if (store.mode === 'graphql') return store.project.graphql.name || store.project.name
  return store.project.federation.name || store.project.name
})
const helpLink = computed(() => {
  if (store.mode === 'rest') return REST_HELP_LINK
  if (store.mode === 'graphql') return GRAPHQL_HELP_LINK
  return FEDERATION_HELP_LINK
})
const helpLabel = computed(() => {
  if (store.mode === 'rest') return 'What is REST?'
  if (store.mode === 'graphql') return 'Learn GraphQL'
  return 'Learn Federation'
})

const metrics = computed(() => {
  if (store.mode === 'rest') {
    const endpoints = store.restNodes.filter(node => node.kind === 'endpoint')
    const types = store.restNodes.filter(node => node.kind === 'type')
    return [
      { label: 'Endpoints', value: endpoints.length, note: `${new Set(endpoints.map(ep => ep.path)).size} unique paths` },
      { label: 'Types', value: types.length, note: `${types.reduce((count, type) => count + type.fields.length, 0)} total fields` },
      { label: 'Linked I/O', value: endpoints.filter(ep => ep.requestBodyRef || ep.responses.some(res => res.bodyTypeRef)).length, note: 'request and response models attached' },
    ]
  }

  if (store.mode === 'graphql') {
    const roots = store.gqlNodes.filter(node => node.kind.endsWith('-root')).length
    return [
      { label: 'Types', value: store.gqlNodes.length, note: `${store.gqlNodes.reduce((count, node) => count + (node.fields?.length ?? 0), 0)} total fields` },
      { label: 'Relations', value: store.gqlRelations.length, note: 'field references and implements links' },
      { label: 'Root Nodes', value: roots, note: roots ? 'query or mutation entry points present' : 'add Query or Mutation roots' },
    ]
  }

  return [
    { label: 'Services', value: store.fedServices.length, note: 'subgraphs on canvas' },
    { label: 'Types', value: store.fedNodes.length, note: `${store.fedNodes.filter(node => node.isEntity).length} entities` },
    { label: 'Cross Links', value: store.fedRelations.length, note: 'references across services' },
  ]
})

const highlights = computed(() => {
  if (store.mode === 'rest') {
    const endpoints = store.restNodes.filter(node => node.kind === 'endpoint')
    const missingTags = endpoints.filter(ep => !ep.tags.length).length
    const missingResponses = endpoints.filter(ep => !ep.responses.length).length
    return [
      `${endpoints.filter(ep => ep.method === 'GET').length} read endpoints and ${endpoints.filter(ep => ep.method !== 'GET').length} write endpoints are modeled.`,
      missingTags ? `${missingTags} endpoints are missing tags, which will make grouped docs weaker.` : 'All endpoints have tags for grouped API docs.',
      missingResponses ? `${missingResponses} endpoints still need response examples or typed output.` : 'Every endpoint has at least one response attached.',
    ]
  }

  if (store.mode === 'graphql') {
    const orphanTypes = store.gqlNodes.filter(node => !node.kind.endsWith('-root') && !store.gqlRelations.some(rel => rel.sourceId === node.id || rel.targetId === node.id)).length
    return [
      `${store.gqlNodes.filter(node => node.kind === 'query-root').length} query roots and ${store.gqlNodes.filter(node => node.kind === 'mutation-root').length} mutation roots are available.`,
      orphanTypes ? `${orphanTypes} types are currently disconnected from the graph.` : 'Every type is connected into the graph model.',
      `${store.gqlNodes.filter(node => node.kind === 'interface' || node.kind === 'union').length} polymorphic types are defined.`,
    ]
  }

  const serviceNames = store.fedServices.map(service => service.name)
  return [
    serviceNames.length ? `Active subgraphs: ${serviceNames.join(', ')}.` : 'No subgraphs yet. Add a service to start shaping federation boundaries.',
    `${store.fedNodes.filter(node => node.isExtension).length} extension types are modeled across services.`,
    `${store.fedNodes.filter(node => node.keyFields.length > 0).length} types currently declare federation keys.`,
  ]
})

type CatalogItem = {
  id: string
  title: string
  meta: string
  badge: string
  hint: string
  rowHint: string
  color: string
  active: boolean
  type: 'node' | 'service'
}

type CatalogSection = {
  title: string
  hint: string
  empty: string
  items: CatalogItem[]
}

const catalogSections = computed<CatalogSection[]>(() => {
  if (store.mode === 'rest') {
    return [
      {
        title: 'Routes',
        hint: 'HTTP routes currently modeled on the REST canvas. Click to select, double-click to edit.',
        empty: 'No endpoints on the canvas yet.',
        items: store.restNodes
          .filter(node => node.kind === 'endpoint')
          .map(node => ({
            id: node.id,
            title: `${node.method} ${node.path}`,
            meta: node.summary || `${node.responses.length} responses`,
            badge: node.method,
            hint: `${node.method} endpoint`,
            rowHint: 'Click to select this route. Double-click to edit it.',
            color: METHOD_COLORS[node.method],
            active: store.selectedNodeId === node.id,
            type: 'node' as const,
          })),
      },
    ]
  }

  if (store.mode === 'graphql') {
    return [
      {
        title: 'Schema Types',
        hint: 'GraphQL nodes currently defined in the schema model. Click to select, double-click to edit.',
        empty: 'No GraphQL types yet.',
        items: store.gqlNodes.map(node => ({
          id: node.id,
          title: node.name,
          meta: `${node.fields.length || node.values.length} members`,
          badge: node.kind.replace('-root', '').toUpperCase(),
          hint: graphqlKindHint(node.kind),
          rowHint: 'Click to select this schema node. Double-click to edit it.',
          color: GQL_KIND_COLORS[node.kind],
          active: store.selectedNodeId === node.id,
          type: 'node' as const,
        })),
      },
    ]
  }

  return [
    {
      title: 'Services',
      hint: 'Federation service or subgraph boundaries. Click to select, double-click to edit.',
      empty: 'No federation services yet.',
      items: store.fedServices.map(service => ({
        id: service.id,
        title: service.name,
        meta: service.url,
        badge: 'SVC',
        hint: 'Federation service or subgraph boundary',
        rowHint: 'Click to select this service. Double-click to edit it.',
        color: service.color,
        active: store.selectedServiceId === service.id,
        type: 'service' as const,
      })),
    },
    {
      title: 'Subgraph Types',
      hint: 'Types that belong to services in the federation design. Click to select, double-click to edit.',
      empty: 'No types attached to services yet.',
      items: store.fedNodes.map(node => ({
        id: node.id,
        title: node.name,
        meta: `${node.fields.length} fields${node.isEntity ? ' | entity' : ''}`,
        badge: node.isExtension ? 'EXT' : 'TYPE',
        hint: node.isExtension ? 'Federation type extension owned by another service' : 'Federation object type in this subgraph',
        rowHint: 'Click to select this subgraph type. Double-click to edit it.',
        color: node.color,
        active: store.selectedNodeId === node.id,
        type: 'node' as const,
      })),
    },
  ]
})

function graphqlKindHint(kind: string): string {
  if (kind === 'type') return 'GraphQL object type'
  if (kind === 'input') return 'GraphQL input type for arguments or mutations'
  if (kind === 'enum') return 'GraphQL enum with fixed values'
  if (kind === 'interface') return 'GraphQL interface implemented by object types'
  if (kind === 'union') return 'GraphQL union of multiple object types'
  if (kind === 'scalar') return 'Custom scalar value'
  if (kind === 'query-root') return 'Root query entry point'
  if (kind === 'mutation-root') return 'Root mutation entry point'
  if (kind === 'subscription-root') return 'Root subscription entry point'
  return 'GraphQL schema node'
}

const previewText = computed(() => exportOutput(selectedTarget.value))

function chipStyle(item: CatalogItem) {
  return {
    background: `${item.color}18`,
    color: item.color,
    borderColor: `${item.color}33`,
  }
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
  const tables = schemaStore.schema.tables
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

function syncSchemaSelectionForNode(nodeId: string) {
  if (store.mode !== 'rest') return
  const node = store.restNodes.find(candidate => candidate.id === nodeId)
  if (!node) return

  const tableId = findSchemaTableIdForRestNode(node)
  if (!tableId) return

  schemaStore.selectedTableId = tableId
  schemaStore.selectedRelationId = null
  schemaStore.selectedGroupId = null
}

function focusItem(item: CatalogItem) {
  if (item.type === 'service') {
    store.selectedServiceId = item.id
    store.selectedNodeId = null
    store.selectedRelId = null
    return
  }

  store.selectedNodeId = item.id
  store.selectedServiceId = null
  store.selectedRelId = null
  syncSchemaSelectionForNode(item.id)
}

function editItem(item: CatalogItem) {
  focusItem(item)
  if (item.type === 'service') {
    store.editingServiceId = item.id
    return
  }
  store.editingNodeId = item.id
}

async function copyOutput() {
  await navigator.clipboard.writeText(previewText.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

function downloadOutput() {
  const blob = new Blob([previewText.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportDownloadName(selectedTarget.value)
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.api-overview-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  width: min(980px, calc(100% - 36px));
  height: min(620px, calc(100% - 36px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #1a1a24;
  background: #0d0d12;
  box-shadow: 0 20px 50px rgb(0, 0, 0);
  z-index: 5;
  pointer-events: auto;
  scrollbar-color: #244437 #0f0f15;
}

.api-overview-panel :deep(*) {
  scrollbar-width: thin;
  scrollbar-color: #244437 #0f0f15;
}

.api-overview-panel :deep(*::-webkit-scrollbar) {
  width: 10px;
  height: 10px;
}

.api-overview-panel :deep(*::-webkit-scrollbar-track) {
  background: #0f0f15;
  border-radius: 999px;
}

.api-overview-panel :deep(*::-webkit-scrollbar-thumb) {
  background: linear-gradient(180deg, #244437 0%, #1b342a 100%);
  border: 2px solid #0f0f15;
  border-radius: 999px;
}

.api-overview-panel :deep(*::-webkit-scrollbar-thumb:hover) {
  background: linear-gradient(180deg, #2d5a48 0%, #224236 100%);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 1.1fr) minmax(360px, 1fr);
  gap: 12px;
}

.panel-column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.eyebrow {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #61748f;
  margin-bottom: 4px;
}

h3 {
  font-size: 16px;
  color: #eef4ff;
}

.learn-link {
  color: #3ecf8e;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.learn-link:hover {
  color: #67dfab;
  border-bottom-color: #67dfab;
}

.mode-pill {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #244437;
  background: #0f1812;
  color: #3ecf8e;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.metric-card,
.summary-block,
.catalog-block,
.preview-code {
  border-radius: 12px;
  border: 1px solid #1a1a24;
}

.metric-card {
  padding: 10px;
  background: linear-gradient(180deg, #15151c 0%, #111118 100%);
}

.metric-label,
.metric-note {
  display: block;
}

.metric-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #7f92af;
}

.metric-value {
  display: block;
  margin: 6px 0 4px;
  font-size: 22px;
  color: #f4f8ff;
}

.metric-note {
  font-size: 10px;
  line-height: 1.4;
  color: #9cb0cb;
}

.summary-block,
.catalog-block {
  padding: 12px;
  background: linear-gradient(180deg, #121219 0%, #0d0d12 100%);
}

.summary-title {
  font-size: 11px;
  font-weight: 700;
  color: #d8e5f6;
  margin-bottom: 8px;
}

.summary-list {
  margin: 0;
  padding-left: 18px;
  color: #93a7c2;
  font-size: 11px;
  line-height: 1.5;
}

.catalog-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.catalog-sections {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 10px;
}

.catalog-section {
  padding: 10px;
  border-radius: 10px;
  background: #0f0f15;
  border: 1px solid #181820;
}

.catalog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #dbe7f8;
  font-size: 11px;
  font-weight: 700;
}

.catalog-count {
  color: #7f92af;
  font-size: 10px;
}

.catalog-list {
  display: grid;
  gap: 6px;
}

.catalog-item {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #21212d;
  background: #15151c;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.catalog-item:hover {
  border-color: #2b5a45;
  background: #171920;
}

.catalog-item.active {
  border-color: #3ecf8e;
  background: #101914;
  box-shadow: inset 0 0 0 1px rgba(62, 207, 142, 0.22);
}

.catalog-chip {
  min-width: 46px;
  padding: 3px 6px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
}

.catalog-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.catalog-name {
  color: #eff5ff;
  font-size: 11px;
  font-weight: 700;
}

.catalog-meta {
  color: #8ca2be;
  font-size: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-empty {
  color: #60738f;
  font-size: 11px;
  font-style: italic;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.target-select {
  flex: 1;
  min-width: 0;
  background: #18181f;
  color: #e6effa;
  border: 1px solid #25252f;
  border-radius: 10px;
  padding: 8px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.ghost-btn,
.solid-btn {
  border-radius: 10px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
}

.ghost-btn {
  background: #18181f;
  color: #9cb0cb;
  border: 1px solid #25252f;
}

.ghost-btn:hover {
  color: #e0e0e0;
  background: #20202a;
}

.solid-btn {
  background: #3ecf8e;
  color: #0a1a12;
  border: none;
  font-weight: 700;
}

.solid-btn:hover {
  background: #45e09a;
}

.preview-code {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: #0a0a0f;
  color: #b9cee8;
  font-size: 11px;
  line-height: 1.55;
  white-space: pre;
}

@media (max-width: 1100px) {
  .api-overview-panel {
    width: min(720px, calc(100% - 24px));
    height: min(680px, calc(100% - 24px));
    top: 12px;
    right: 12px;
    padding: 14px;
  }

  .panel-grid {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>