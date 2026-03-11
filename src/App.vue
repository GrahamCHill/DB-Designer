<template>
  <div class="app">

    <!-- ── Top workspace bar ── -->
    <div class="workspace-bar">
      <div class="ws-brand">
        <span class="ws-icon">⬡</span>
        <span class="ws-name">Designer</span>
      </div>
      <div class="ws-tabs">
        <button
          v-for="ws in workspaces"
          :key="ws.id"
          class="ws-tab"
          :class="{ active: workspaceStore.active === ws.id }"
          @click="switchWorkspace(ws.id)"
        >
          <span class="ws-tab-icon">{{ ws.icon }}</span>
          <span class="ws-tab-label">{{ ws.label }}</span>
        </button>
      </div>
      <!-- Right-side global actions -->
      <div class="ws-right">
        <button
          v-if="workspaceStore.active === 'db'"
          class="ws-action-btn"
          title="Export diagram as PNG"
          @click="exportPng('png')"
        >⤓ PNG</button>
        <button
          v-if="workspaceStore.active === 'db'"
          class="ws-action-btn"
          title="Export diagram as JPG"
          @click="exportPng('jpg')"
        >⤓ JPG</button>

        <button
          v-if="workspaceStore.active === 'query'"
          class="ws-action-btn"
          title="Export query canvas as PNG"
          @click="exportPng('png')"
        >⤓ PNG</button>
        <button
          v-if="workspaceStore.active === 'query'"
          class="ws-action-btn"
          title="Export query canvas as JPG"
          @click="exportPng('jpg')"
        >⤓ JPG</button>
        <button
          v-if="workspaceStore.active === 'query'"
          class="ws-action-btn"
          title="Reset SQL preview to generated SQL"
          @click="resetQuerySql"
        >Reset</button>
        <button
          v-if="workspaceStore.active === 'query'"
          class="ws-action-btn"
          :title="queryCopied ? 'Copied!' : 'Copy SQL'"
          @click="copyQuerySQL"
        >{{ queryCopied ? 'Copied' : 'Copy' }}</button>
        <button
          v-if="workspaceStore.active === 'query'"
          class="ws-action-btn"
          title="Export SQL file"
          @click="exportQuerySQL"
        >⤓ .sql Export</button>
        <button
          v-if="workspaceStore.active === 'codegen'"
          class="ws-action-btn"
          :title="codegenCopied ? 'Copied!' : 'Copy all generated code'"
          @click="copyCodegenAll"
        >{{ codegenCopied ? 'Copied' : 'Copy All' }}</button>
        <button
          v-if="workspaceStore.active === 'codegen'"
          class="ws-action-btn"
          title="Download generated code"
          @click="downloadCodegenAll"
        >⤓ Download</button>
      </div>
    </div>

    <!-- ── Workspace content ── -->
    <div class="workspace-content">

      <!-- DB Schema (ERD) -->
      <div v-show="workspaceStore.active === 'db'" class="ws-pane">
        <Sidebar />
        <div class="main-area">
          <TabBar />
          <main class="main" id="db-canvas-area">
            <DiagramCanvas />
          </main>
        </div>
      </div>

      <!-- API Designer -->
      <div v-show="workspaceStore.active === 'api'" class="ws-pane">
        <ApiSidebar />
        <div class="main-area">
          <main class="main">
            <!-- Reuse DiagramCanvas for visual ERD in background of API Designer -->
            <div class="api-canvas-container">
              <DiagramCanvas
                class="background-erd"
                :read-only="true"
                :interactive="true"
                @generate-api="apiStore.createFromTable"
              />
              <ApiCanvas />
              <ApiOverviewPanel />
            </div>
          </main>
        </div>
      </div>

      <!-- Query Builder -->
      <div v-show="workspaceStore.active === 'query'" class="ws-pane">
        <QuerySidebar />
        <div class="main-area">
          <main class="main" id="query-canvas-area">
            <QueryCanvas />
          </main>
        </div>
      </div>

      <!-- ERD to Code -->
      <div v-show="workspaceStore.active === 'codegen'" class="ws-pane">
        <CodegenPanel ref="codegenPanel" />
      </div>

    </div>

    <!-- DB modals -->
    <TableEditorModal
      v-if="store.editingTableId && editingTable"
      :table="editingTable"
      @close="store.editingTableId = null"
    />
    <DBConnectModal v-if="showDBConnect" @close="showDBConnect = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useWorkspaceStore } from './stores/workspace'
import type { Workspace } from './stores/workspace'
const workspaceStore = useWorkspaceStore()

const workspaces: { id: Workspace; label: string; icon: string }[] = [
  { id: 'db', label: 'DB Schema', icon: '⬡' },
  { id: 'api', label: 'API Designer', icon: '⇄' },
  { id: 'query', label: 'Query Builder', icon: '⊞' },
  { id: 'codegen', label: 'ERD to Code', icon: '⟨⟩' },
]

import { useApiStore } from './stores/api'
const apiStore = useApiStore()
const queryCopied = ref(false)
const codegenCopied = ref(false)

function switchWorkspace(ws: Workspace) {
  workspaceStore.setWorkspace(ws)
}

async function copyQuerySQL() {
  try {
    await navigator.clipboard.writeText(queryStore.sql)
    queryCopied.value = true
    window.setTimeout(() => {
      queryCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy SQL:', err)
  }
}

function resetQuerySql() {
  queryStore.resetManualSql()
}

function exportQuerySQL() {
  const blob = new Blob([queryStore.sql], { type: 'text/sql' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'query.sql'
  a.click()
  URL.revokeObjectURL(url)
}

async function copyCodegenAll() {
  if (!codegenPanel.value) return
  await codegenPanel.value.copyAll()
  codegenCopied.value = true
  window.setTimeout(() => {
    codegenCopied.value = false
  }, 2000)
}

function downloadCodegenAll() {
  codegenPanel.value?.downloadAll()
}

watch(() => workspaceStore.active, () => {}, { immediate: true })

import { useSchemaStore } from './stores/schema'
import {
  TABLE_HEADER_H,
  TABLE_COL_PAD_TOP,
  TABLE_ROW_H,
} from './types'
import Sidebar from './components/sidebar/Sidebar.vue'
import TabBar from './components/canvas/TabBar.vue'
import DiagramCanvas from './components/canvas/DiagramCanvas.vue'
import TableEditorModal from './components/modals/TableEditorModal.vue'
import DBConnectModal from './components/modals/DBConnectModal.vue'
import ApiSidebar from './components/api-sidebar/ApiSidebar.vue'
import ApiCanvas from './components/canvas/api-canvas/ApiCanvas.vue'
import ApiOverviewPanel from './components/api-panels/ApiOverviewPanel.vue'
import QuerySidebar from './components/query-sidebar/QuerySidebar.vue'
import QueryCanvas from './components/query-canvas/QueryCanvas.vue'
import CodegenPanel from './components/codegen/CodegenPanel.vue'

type CodegenPanelExposed = {
  copyAll: () => Promise<void>
  downloadAll: () => void
}

type ExportTheme = 'dark' | 'light'

const store = useSchemaStore()
const showDBConnect = ref(false)
const editingTable = computed(() => store.schema.tables.find(t => t.id === store.editingTableId) ?? null)
const codegenPanel = ref<CodegenPanelExposed | null>(null)
;(window as any).__dbDesignerShowConnect = () => { showDBConnect.value = true }

// ── PNG / JPG export ──────────────────────────────────────────────────────────
import { useQueryStore } from './stores/query'
const queryStore = useQueryStore()

async function exportPng(format: 'png' | 'jpg') {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
  const h2c = (window as any).html2canvas
  if (!h2c) { alert('Could not load html2canvas'); return }

  const isQuery = workspaceStore.active === 'query'
  const isApi = workspaceStore.active === 'api'
  const exportTheme: ExportTheme = !isQuery && !isApi && store.lightExportMode ? 'light' : 'dark'

  let canvasId = '#db-canvas-area'
  if (isQuery) canvasId = '#query-canvas-area'
  if (isApi) canvasId = '.api-canvas-container'

  const captureSelector = isQuery
    ? `${canvasId} .qcanvas-stage`
    : `${canvasId} .canvas-content, ${canvasId} .qcanvas-content`

  const el = document.querySelector(captureSelector) as HTMLElement
  if (!el) { alert('Canvas not found'); return }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  if (isQuery) {
    if (queryStore.tables.length === 0) { alert('Canvas is empty'); return }
    queryStore.tables.forEach(t => {
      const w = t.width || 220
      const h = 44 + (t.columns.length * 32) + 32
      minX = Math.min(minX, t.position.x)
      minY = Math.min(minY, t.position.y)
      maxX = Math.max(maxX, t.position.x + w)
      maxY = Math.max(maxY, t.position.y + h)
    })
    const summary = document.querySelector('.query-summary-node') as HTMLElement
    if (summary) {
      const x = parseInt(summary.style.left) || 0
      const y = parseInt(summary.style.top) || 0
      const w = summary.offsetWidth || 350
      const h = summary.offsetHeight || 200
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + h)
    }
  } else if (isApi) {
    const apiStore = (window as any).apiStore || (await import('./stores/api')).useApiStore()
    const nodes = apiStore.mode === 'rest'
      ? apiStore.restNodes
      : apiStore.mode === 'graphql'
        ? apiStore.gqlNodes
        : apiStore.fedNodes

    if (nodes.length === 0) { alert('Canvas is empty'); return }
    nodes.forEach((n: any) => {
      const w = n.width || 250
      const h = 200
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w)
      maxY = Math.max(maxY, n.position.y + h)
    })
    store.schema.tables.forEach(t => {
      const w = t.width || 320
      const h = TABLE_HEADER_H + TABLE_COL_PAD_TOP + (t.columns.length * TABLE_ROW_H) + 20
      minX = Math.min(minX, t.position.x)
      minY = Math.min(minY, t.position.y)
      maxX = Math.max(maxX, t.position.x + w)
      maxY = Math.max(maxY, t.position.y + h)
    })
  } else {
    const s = store.schema
    if (s.tables.length === 0 && s.groups.length === 0) { alert('Canvas is empty'); return }
    s.tables.forEach(t => {
      const w = t.width || 320
      const h = TABLE_HEADER_H + TABLE_COL_PAD_TOP + (t.columns.length * TABLE_ROW_H) + 20
      minX = Math.min(minX, t.position.x)
      minY = Math.min(minY, t.position.y)
      maxX = Math.max(maxX, t.position.x + w)
      maxY = Math.max(maxY, t.position.y + h)
    })
    s.groups.forEach(g => {
      minX = Math.min(minX, g.position.x)
      minY = Math.min(minY, g.position.y)
      maxX = Math.max(maxX, g.position.x + g.size.w)
      maxY = Math.max(maxY, g.position.y + g.size.h)
    })
  }

  const padding = 80
  if (minX === Infinity) {
    minX = 0
    minY = 0
    maxX = 800
    maxY = 600
  } else {
    minX -= padding
    minY -= padding
    maxX += padding
    maxY += padding
  }

  const width = maxX - minX
  const height = maxY - minY

  const canvas = await h2c(el, {
    backgroundColor: exportTheme === 'light' ? '#f8fafc' : '#0f0f12',
    scale: 8,
    useCORS: true,
    logging: false,
    x: minX,
    y: minY,
    width,
    height,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    onclone: (clonedDoc: Document) => {
      if (exportTheme === 'light' && !isQuery && !isApi) {
        const exportRoot = clonedDoc.querySelector(`${canvasId} .canvas-content`) as HTMLElement | null
        exportRoot?.classList.add('export-light')

        const relationPaths = clonedDoc.querySelectorAll(`${canvasId} .relations-svg path:not(.relation-hit)`)
        relationPaths.forEach((path) => {
          const relPath = path as SVGPathElement
          relPath.setAttribute('stroke', '#020617')
          relPath.setAttribute('stroke-width', '2.6')
          relPath.style.stroke = '#020617'
          relPath.style.strokeWidth = '2.6px'
          relPath.style.opacity = '1'
          relPath.style.filter = 'drop-shadow(0 0 1px rgba(248, 250, 252, 0.55))'
        })

        const markerPolygons = clonedDoc.querySelectorAll(`${canvasId} .relations-svg marker polygon`)
        markerPolygons.forEach((polygon) => {
          const arrow = polygon as SVGPolygonElement
          arrow.setAttribute('fill', '#020617')
          arrow.style.fill = '#020617'
          arrow.style.opacity = '1'
        })

        const relationLabels = clonedDoc.querySelectorAll(`${canvasId} .relations-svg .rel-label`)
        relationLabels.forEach((label) => {
          const relLabel = label as SVGTextElement
          relLabel.setAttribute('fill', '#020617')
          relLabel.style.fill = '#020617'
          relLabel.style.fontWeight = '700'
          relLabel.style.paintOrder = 'stroke'
          relLabel.style.stroke = 'rgba(248, 250, 252, 0.96)'
          relLabel.style.strokeWidth = '3.5px'
          relLabel.style.strokeLinejoin = 'round'
        })
      }

      if (isQuery) {
        const clonedLayers = clonedDoc.querySelectorAll(`${canvasId} .qcanvas-content`)
        clonedLayers.forEach((layer) => {
          const layerEl = layer as HTMLElement
          layerEl.style.transform = 'none'
          layerEl.style.transformOrigin = '0 0'
        })
      } else {
        const clonedEl = clonedDoc.querySelector(`${canvasId} .canvas-content, ${canvasId} .qcanvas-content`) as HTMLElement
        if (clonedEl) {
          clonedEl.style.transform = 'none'
          clonedEl.style.transformOrigin = '0 0'
        }
      }
    },
  })

  const fileName = isQuery ? 'query' : (isApi ? 'api' : (store.schema.name || 'schema'))
  const themeSuffix = exportTheme === 'light' ? '-light' : ''
  const link = document.createElement('a')
  link.download = `${fileName}${themeSuffix}.${format}`
  link.href = format === 'jpg'
    ? canvas.toDataURL('image/jpeg', 0.95)
    : canvas.toDataURL('image/png')
  link.click()
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; width: 100%; overflow: hidden; }
body { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #0f0f12; color: #d0d0d8; -webkit-font-smoothing: antialiased; }

.app { display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden; }

/* ── Workspace bar ── */
.workspace-bar {
  display: flex; align-items: center; height: 40px; min-height: 40px;
  flex-shrink: 0; background: #09090d; border-bottom: 1px solid #1a1a24; z-index: 200;
}
.ws-brand { display: flex; align-items: center; gap: 7px; padding: 0 16px; border-right: 1px solid #1a1a24; height: 100%; flex-shrink: 0; }
.ws-icon { font-size: 15px; color: #3ECF8E; }
.ws-name { font-size: 12px; font-weight: 700; color: #e0e0e0; letter-spacing: 0.05em; }
.ws-tabs { display: flex; height: 100%; flex: 1; }
.ws-tab {
  display: flex; align-items: center; gap: 6px; padding: 0 18px;
  background: none; border: none; border-right: 1px solid #1a1a24;
  border-bottom: 2px solid transparent; color: #444; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
  letter-spacing: 0.04em; white-space: nowrap;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.ws-tab:hover { color: #888; background: #111116; }
.ws-tab.active { color: #3ECF8E; background: #0a1410; border-bottom-color: #3ECF8E; }
.ws-tab-icon { font-size: 13px; }
.ws-right { display: flex; align-items: center; gap: 6px; padding: 0 12px; margin-left: auto; }
.ws-action-btn {
  background: none; border: 1px solid #2a2a3a; color: #555; border-radius: 5px;
  padding: 4px 10px; font-size: 10px; font-weight: 600; cursor: pointer; font-family: 'JetBrains Mono', monospace;
  transition: color 0.15s, border-color 0.15s;
}
.ws-action-btn:hover { color: #3ECF8E; border-color: #3ECF8E50; }

/* ── Content ── */
.workspace-content { flex: 1; overflow: hidden; position: relative; }
.ws-pane { position: absolute; inset: 0; display: flex; flex-direction: row; overflow: hidden; }
.main-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.main { flex: 1; overflow: hidden; position: relative; }

.api-canvas-container F{
  background-color: #0f0f12 !important;
  position: absolute;
  inset: 0;
}

.background-erd {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}

.background-erd :deep(.zoom-controls),
.background-erd :deep(.minimap-root),
.background-erd :deep(.canvas-controls) {
  display: none !important;
}

.api-canvas-container :deep(.canvas-root) {
  background: transparent !important;
  z-index: 1;
}

.export-light {
  background:
    radial-gradient(circle, #d8dee8 1px, transparent 1px),
    #f8fafc !important;
  background-size: 24px 24px !important;
}

.export-light .table-node {
  background: #eef2f7 !important;
  border-color: #94a3b8 !important;
  box-shadow:
    0 0 0 1px rgba(71, 85, 105, 0.18),
    0 14px 30px rgba(15, 23, 42, 0.14) !important;
}

.export-light .table-node.selected {
  box-shadow:
    0 0 0 2px rgba(var(--table-color-rgb, 62, 207, 142), 0.45),
    0 16px 36px rgba(15, 23, 42, 0.12) !important;
}

.export-light .table-node.highlighted {
  box-shadow:
    0 0 0 2px rgba(var(--table-color-rgb, 62, 207, 142), 0.5),
    0 0 22px rgba(var(--table-color-rgb, 62, 207, 142), 0.18),
    0 16px 36px rgba(15, 23, 42, 0.12) !important;
}

.export-light .table-header {
  border-bottom-color: #94a3b8 !important;
  background: rgba(var(--table-color-rgb, 62, 207, 142), 0.14) !important;
}

.export-light .table-name,
.export-light .col-name {
  color: #0f172a !important;
}

.export-light .col-type,
.export-light .conn-count {
  color: rgba(var(--table-color-rgb, 62, 207, 142), 0.85) !important;
}

.export-light .col-count,
.export-light .no-columns,
.export-light .resize-handle {
  color: #475569 !important;
}

.export-light .columns-list,
.export-light .table-footer {
  background: #e2e8f0 !important;
}

.export-light .column-row:hover {
  background: #dbe4ef !important;
}

.export-light .column-row.is-pk {
  background: rgba(62, 207, 142, 0.16) !important;
}

.export-light .column-row.is-pk:hover {
  background: rgba(62, 207, 142, 0.22) !important;
}

.export-light .connector {
  border-color: #64748b !important;
  background: #eef2f7 !important;
}

.export-light .connector.connected {
  border-color: var(--dot-color, #3ECF8E) !important;
  background: var(--dot-color, #3ECF8E) !important;
}

.export-light .group-node {
  background: rgba(var(--group-color-rgb, 62, 207, 142), 0.12) !important;
  border-color: rgba(var(--group-color-rgb, 62, 207, 142), 0.65) !important;
  box-shadow: inset 0 0 0 1px rgba(var(--group-color-rgb, 62, 207, 142), 0.12) !important;
}

.export-light .group-header {
  background: rgba(var(--group-color-rgb, 62, 207, 142), 0.22) !important;
  border-bottom-color: rgba(var(--group-color-rgb, 62, 207, 142), 0.42) !important;
}

.export-light .relations-svg path:not(.relation-hit) {
  stroke: #0f172a !important;
  stroke-width: 2.1 !important;
  opacity: 1 !important;
}

.export-light .relations-svg marker polygon {
  fill: #0f172a !important;
  opacity: 1 !important;
}

.export-light .relations-svg .rel-label {
  fill: #0f172a !important;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(248, 250, 252, 0.92);
  stroke-width: 3px;
  stroke-linejoin: round;
}

</style>




