<template>
  <div class="qcanvas-root"
    ref="canvasEl"
    @mousedown="onCanvasMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @wheel.prevent="onWheel"
    @dragover.prevent
    @drop="onDrop"
  >
    <!-- Canvas content -->
    <div class="qcanvas-content" :style="contentStyle">

      <!-- JOIN SVG -->
      <svg class="joins-svg">
        <defs>
          <marker id="join-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#3B82F6" opacity="0.8"/>
          </marker>
          <marker id="join-arrow-sel" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#60A5FA"/>
          </marker>
        </defs>

        <!-- Existing JOINs -->
        <g v-for="join in query.joins" :key="join.id" @click.stop="query.selectedJoinId = join.id">
          <path :d="joinPath(join)" fill="none"
            :stroke="query.selectedJoinId === join.id ? '#60A5FA' : '#3B82F650'"
            :stroke-width="query.selectedJoinId === join.id ? 2.5 : 1.5"
            marker-end="url(#join-arrow)" pointer-events="none"/>
          <!-- Hit area -->
          <path :d="joinPath(join)" fill="none" stroke="transparent" stroke-width="14"
            style="cursor:pointer" pointer-events="stroke"/>
          <!-- JOIN type label -->
          <text :x="joinMid(join).x" :y="joinMid(join).y - 6"
            class="join-label" :fill="query.selectedJoinId === join.id ? '#60A5FA' : '#3B82F660'"
            text-anchor="middle">{{ join.joinType }}</text>
        </g>

        <!-- In-progress join line -->
        <path v-if="query.drawingJoin"
          :d="drawingPath" fill="none" stroke="#3B82F6" stroke-width="1.5"
          stroke-dasharray="5,3" opacity="0.6" pointer-events="none"/>
      </svg>

      <!-- Table nodes -->
      <div v-for="table in query.tables" :key="table.id"
        class="qtable-node"
        :class="{ selected: query.selectedTableId === table.id }"
        :style="{
          left:  table.position.x + 'px',
          top:   table.position.y + 'px',
          width: table.width + 'px',
        }"
        @mousedown.stop="startDrag(table.id, $event)"
        @click.stop="query.selectedTableId = table.id; query.selectedJoinId = null"
      >
        <!-- Header -->
        <div class="qtn-header">
          <span class="qtn-icon">⬡</span>
          <span class="qtn-name">{{ table.alias }}</span>
          <span v-if="table.alias !== table.schemaTable" class="qtn-orig">{{ table.schemaTable }}</span>
          <button class="qtn-del" @click.stop="query.removeTable(table.id)" title="Remove from canvas">✕</button>
        </div>

        <!-- Columns -->
        <div class="qtn-cols">
          <div v-for="col in table.columns" :key="col.column" class="qtn-col"
            :class="{ selected: col.selected }"
            @click.stop="query.toggleColumn(table.id, col.column)"
          >
            <!-- Left connector — drop JOIN here -->
            <div class="qconn qconn-left"
              @mouseup.stop="endJoin(table.id, col.column)"
              title="Drop join here"/>

            <span class="col-check">{{ col.selected ? '☑' : '☐' }}</span>
            <span class="col-name">{{ col.column }}</span>

            <!-- Aggregate selector -->
            <select v-if="col.selected" class="col-agg"
              :value="col.aggregate"
              @change="query.setColumnAggregate(table.id, col.column, ($event.target as HTMLSelectElement).value as any)"
              @click.stop>
              <option value="">—</option>
              <option>COUNT</option><option>SUM</option>
              <option>AVG</option><option>MIN</option><option>MAX</option>
            </select>

            <!-- Right connector — drag JOIN from here -->
            <div class="qconn qconn-right"
              :class="{ active: isJoinSource(table.id, col.column) }"
              @mousedown.stop="startJoin(table.id, col.column, $event)"
              title="Drag to create JOIN"/>
          </div>
        </div>

        <!-- Footer -->
        <div class="qtn-footer">
          <span class="qtn-sel-count">{{ selectedCount(table) }} selected</span>
        </div>
      </div>
    </div>

    <!-- ── Summary Node (on canvas) ── -->
    <div class="qcanvas-content" :style="contentStyle">
      <div v-if="query.tables.length > 0" class="query-summary-node"
        @mousedown.stop="startDrag('query-summary', $event)"
        :style="{
          left: summaryPos.x + 'px',
          top:  summaryPos.y + 'px'
        }">
        <div class="qsn-header">
          <span class="qsn-icon">📜</span>
          <span class="qsn-title">Query Summary</span>
        </div>
        <div class="qsn-body">
          <div class="qsn-section">
            <div class="qsn-label">SELECT</div>
            <div class="qsn-val">{{ selectSummary }}</div>
          </div>
          <div v-if="query.joins.length" class="qsn-section">
            <div class="qsn-label">JOINs</div>
            <div class="qsn-val">{{ query.joins.length }} relations</div>
          </div>
          <div v-if="query.wheres.length" class="qsn-section">
            <div class="qsn-label">WHERE</div>
            <div v-for="w in query.wheres" :key="w.id" class="qsn-clause">
              {{ w.tableAlias }}.{{ w.column }} {{ w.op }} {{ w.value }}
            </div>
          </div>
          <div v-if="query.groups.length" class="qsn-section">
            <div class="qsn-label">GROUP BY</div>
            <div class="qsn-val">{{ groupSummary }}</div>
          </div>
          <div v-if="query.orders.length" class="qsn-section">
            <div class="qsn-label">ORDER BY</div>
            <div class="qsn-val">{{ orderSummary }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="query.tables.length === 0" class="qempty">
      <div class="qempty-icon">⊞</div>
      <p>Drag tables from the sidebar</p>
      <span>or click a table name to add it</span>
    </div>

    <!-- ── SQL Preview panel ── -->
    <div class="sql-panel" :class="{ expanded: sqlExpanded }">
      <div class="sql-panel-header" @click="sqlExpanded = !sqlExpanded" style="cursor: pointer">
        <span class="sql-panel-title">⌨ Live SQL Output</span>
        <div class="sql-panel-actions" @click.stop>
          <button class="sql-action-btn" @click="query.resetManualSql()" title="Reset to generated SQL">
            ↺ Reset
          </button>
          <button class="sql-action-btn" @click="copySQL" :title="copied ? 'Copied!' : 'Copy SQL'">
            {{ copied ? '✓' : '⎘' }} {{ copied ? 'Copied' : 'Copy' }}
          </button>
          <button class="sql-action-btn" @click="exportSQLFile" title="Export SQL file">
            ⤓ .sql Export
          </button>
        </div>
      </div>
      <div class="sql-body">
        <div class="sql-code-display" v-if="!isEditingSql" @click="isEditingSql = true">
          {{ query.sql }}
        </div>
        <textarea
          v-else
          id="sql-editor"
          name="sql-editor"
          class="sql-code-editor"
          v-model="query.sql"
          spellcheck="false"
          @blur="isEditingSql = false"
          ref="sqlEditorRef"
        ></textarea>
      </div>
    </div>

    <!-- JOIN type selector when a JOIN is selected -->
    <div v-if="selectedJoin" class="join-inspector">
      <span class="ji-label">JOIN type</span>
      <div class="ji-types">
        <button v-for="jt in joinTypes" :key="jt"
          class="ji-btn" :class="{ active: selectedJoin.joinType === jt }"
          @click="query.updateJoinType(selectedJoin.id, jt)">{{ jt }}</button>
      </div>
      <button class="ji-del" @click="query.removeJoin(selectedJoin.id)">✕ Remove</button>
    </div>

    <!-- Zoom controls -->
    <div class="zoom-controls">
      <button @click="adjustZoom(0.1)">+</button>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <button @click="adjustZoom(-0.1)">−</button>
      <button @click="resetView" title="Reset">⊙</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useQueryStore } from '../../stores/query'
import { useSchemaStore } from '../../stores/schema'
import type { QJoin, QTable } from '../../stores/query'

const query   = useQueryStore()
const dbStore = useSchemaStore()

// Debugging visibility
onMounted(() => {
  console.log('QueryCanvas mounted. SQL length:', query.sql.length)
})
watch(() => query.sql, (newSql) => {
  console.log('SQL updated, length:', newSql.length)
})

const canvasEl   = ref<HTMLDivElement>()
const zoom       = ref(1)
const pan        = reactive({ x: 40, y: 40 })
const sqlExpanded = ref(true)
const copied      = ref(false)
const dialect     = ref('postgresql')
const joinTypes   = ['INNER','LEFT','RIGHT','FULL'] as const
const summaryPos  = reactive({ x: 400, y: 100 })
const isEditingSql = ref(false)
const sqlEditorRef = ref<HTMLTextAreaElement | null>(null)

watch(isEditingSql, (editing) => {
  if (editing) {
    setTimeout(() => sqlEditorRef.value?.focus(), 50)
  }
})

const selectSummary = computed(() => {
  const cols = query.tables.flatMap(t => t.columns.filter(c => c.selected))
  if (cols.length === 0) return '*'
  return cols.length + ' columns selected'
})
const groupSummary = computed(() => query.groups.length + ' group(s)')
const orderSummary = computed(() => query.orders.length + ' order(s)')

const contentStyle = computed(() => ({
  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

const selectedJoin = computed(() =>
  query.joins.find(j => j.id === query.selectedJoinId) ?? null
)

function onSqlInput(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value
  query.sql = val
}

// ── Drag (pan + node) ─────────────────────────────────────────────────────────
type Drag =
  | { kind: 'pan'; sx: number; sy: number }
  | { kind: 'node'; id: string; ox: number; oy: number; sx: number; sy: number }

const drag = ref<Drag | null>(null)

function toCanvas(cx: number, cy: number) {
  const r = canvasEl.value!.getBoundingClientRect()
  return { x: (cx - r.left - pan.x) / zoom.value, y: (cy - r.top - pan.y) / zoom.value }
}

function onCanvasMouseDown(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.closest('.sql-panel') || t.closest('.join-inspector') || t.closest('.zoom-controls')) return
  if (t === canvasEl.value || t.classList.contains('qcanvas-content') || t.classList.contains('joins-svg') || t.classList.contains('qcanvas-root')) {
    query.selectedTableId = null; query.selectedJoinId = null
    drag.value = { kind: 'pan', sx: e.clientX, sy: e.clientY }
  }
}

function startDrag(id: string, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.sql-panel')) return
  if (id === 'query-summary') {
    drag.value = { kind: 'node', id, ox: summaryPos.x, oy: summaryPos.y, sx: e.clientX, sy: e.clientY }
    return
  }
  const t = query.tables.find(t => t.id === id)
  if (!t) return
  drag.value = { kind: 'node', id, ox: t.position.x, oy: t.position.y, sx: e.clientX, sy: e.clientY }
}

function onMouseMove(e: MouseEvent) {
  if (query.drawingJoin) {
    const p = toCanvas(e.clientX, e.clientY)
    query.drawingJoin.mouseX = p.x
    query.drawingJoin.mouseY = p.y
    return
  }
  if (!drag.value) return
  const d = drag.value
  if (d.kind === 'pan') {
    pan.x += e.clientX - d.sx; pan.y += e.clientY - d.sy
    d.sx = e.clientX; d.sy = e.clientY
  } else if (d.kind === 'node') {
    const dx = (e.clientX - d.sx) / zoom.value
    const dy = (e.clientY - d.sy) / zoom.value
    if (d.id === 'query-summary') {
      summaryPos.x = d.ox + dx
      summaryPos.y = d.oy + dy
    } else {
      query.updateTablePosition(d.id, { x: d.ox + dx, y: d.oy + dy })
    }
  }
}

function onMouseUp() {
  drag.value = null
  if (query.drawingJoin) query.drawingJoin = null
}

function onWheel(e: WheelEvent) {
  if ((e.target as HTMLElement).closest('.sql-panel')) return
  adjustZoom(e.deltaY > 0 ? -0.08 : 0.08)
}

function adjustZoom(d: number) {
  zoom.value = Math.min(3, Math.max(0.15, zoom.value + d))
}

function resetView() { zoom.value = 1; pan.x = 40; pan.y = 40 }

// ── DROP from sidebar ─────────────────────────────────────────────────────────
function onDrop(e: DragEvent) {
  const name = e.dataTransfer?.getData('text/plain')
  if (!name) return
  const r = canvasEl.value!.getBoundingClientRect()
  const pos = {
    x: (e.clientX - r.left - pan.x) / zoom.value,
    y: (e.clientY - r.top  - pan.y) / zoom.value,
  }
  const st = dbStore.schema.tables.find(t => t.name === name)
  const cols = st?.columns.map(c => c.name) ?? []
  query.addTable(name, cols, pos)
}

// ── JOIN drawing ──────────────────────────────────────────────────────────────
function startJoin(tableId: string, column: string, e: MouseEvent) {
  const p = toCanvas(e.clientX, e.clientY)
  query.drawingJoin = { fromTableId: tableId, fromColumn: column, mouseX: p.x, mouseY: p.y }
}

function endJoin(tableId: string, column: string) {
  if (!query.drawingJoin || query.drawingJoin.fromTableId === tableId) {
    query.drawingJoin = null; return
  }
  query.addJoin(query.drawingJoin.fromTableId, query.drawingJoin.fromColumn, tableId, column)
  query.drawingJoin = null
}

function isJoinSource(tableId: string, column: string) {
  return query.drawingJoin?.fromTableId === tableId && query.drawingJoin?.fromColumn === column
}

function selectedCount(t: QTable) { return t.columns.filter(c => c.selected).length }

// ── JOIN path geometry ────────────────────────────────────────────────────────
const COL_H = 32, HEADER_H = 40, FOOTER_H = 28

function colY(table: QTable, colName: string) {
  const idx = table.columns.findIndex(c => c.column === colName)
  return table.position.y + HEADER_H + idx * COL_H + COL_H / 2
}

function tableRight(table: QTable) { return table.position.x + table.width }
function tableLeft(table: QTable)  { return table.position.x }

function joinPath(join: QJoin) {
  const lt = query.tables.find(t => t.id === join.leftTableId)
  const rt = query.tables.find(t => t.id === join.rightTableId)
  if (!lt || !rt) return ''
  const ax = tableRight(lt), ay = colY(lt, join.leftColumn)
  const bx = tableLeft(rt),  by = colY(rt, join.rightColumn)
  const cx = Math.abs(bx - ax) * 0.55 + 40
  return `M ${ax} ${ay} C ${ax + cx} ${ay}, ${bx - cx} ${by}, ${bx} ${by}`
}

function joinMid(join: QJoin) {
  const lt = query.tables.find(t => t.id === join.leftTableId)
  const rt = query.tables.find(t => t.id === join.rightTableId)
  if (!lt || !rt) return { x: 0, y: 0 }
  return {
    x: (tableRight(lt) + tableLeft(rt)) / 2,
    y: (colY(lt, join.leftColumn) + colY(rt, join.rightColumn)) / 2,
  }
}

const drawingPath = computed(() => {
  if (!query.drawingJoin) return ''
  const from = query.tables.find(t => t.id === query.drawingJoin!.fromTableId)
  if (!from) return ''
  const ax = tableRight(from), ay = colY(from, query.drawingJoin.fromColumn)
  const bx = query.drawingJoin.mouseX, by = query.drawingJoin.mouseY
  const cx = Math.abs(bx - ax) * 0.5 + 30
  return `M ${ax} ${ay} C ${ax + cx} ${ay}, ${bx - cx} ${by}, ${bx} ${by}`
})

// ── Copy SQL ──────────────────────────────────────────────────────────────────
async function copySQL() {
  try {
    await navigator.clipboard.writeText(query.sql)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch (err) {
    console.error('Failed to copy SQL:', err)
  }
}

function exportSQLFile() {
  const blob = new Blob([query.sql], { type: 'text/sql' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'query.sql'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.qcanvas-root {
  flex: 1; position: relative; overflow: hidden;
  background: #09090e;
  background-image:
    radial-gradient(circle, #1a1a28 1.5px, transparent 1.5px),
    radial-gradient(circle, #111118 1px, transparent 1px);
  background-size: 32px 32px, 8px 8px;
  cursor: default;
}

.qcanvas-content {
  position: absolute; top: 0; left: 0; width: 4000px; height: 4000px; transform-origin: 0 0;
}

.joins-svg {
  position: absolute; top: 0; left: 0; width: 4000px; height: 4000px;
  pointer-events: none; overflow: visible;
}
.joins-svg g { pointer-events: all; }
.join-label { font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 700; }

/* ── Table nodes ── */
.qtable-node {
  position: absolute; border-radius: 10px;
  background: #13131e; border: 1.5px solid #22223a;
  box-shadow: 0 6px 28px #00000065;
  cursor: grab; min-width: 200px; box-sizing: border-box; overflow: visible;
  font-family: 'JetBrains Mono', monospace;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.qtable-node:active { cursor: grabbing; }
.qtable-node.selected {
  border-color: #3B82F6;
  box-shadow: 0 0 0 2.5px #3B82F628, 0 8px 36px #00000080;
}

.qtn-header {
  display: flex; align-items: center; gap: 7px; padding: 9px 10px;
  background: linear-gradient(135deg, #1a1a35 0%, #13132a 100%);
  border-bottom: 1px solid #2a2a48; border-radius: 9px 9px 0 0;
}
.qtn-icon { font-size: 13px; color: #3B82F6; flex-shrink: 0; }
.qtn-name { font-size: 12px; font-weight: 700; color: #e0e0f0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qtn-orig { font-size: 9px; color: #44446a; flex-shrink: 0; }
.qtn-del  { background: none; border: none; color: #444; cursor: pointer; font-size: 11px; width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: color 0.15s; }
.qtn-del:hover { color: #EF4444; }

/* Columns */
.qtn-cols { display: flex; flex-direction: column; }
.qtn-col {
  display: flex; align-items: center; gap: 5px;
  padding: 0 10px; height: 32px; position: relative;
  border-bottom: 1px solid #191928; cursor: pointer;
  transition: background 0.1s;
}
.qtn-col:last-child { border-bottom: none; }
.qtn-col:hover { background: #1a1a2e; }
.qtn-col.selected { background: #1a2535; }

.col-check { font-size: 12px; color: #3B82F6; flex-shrink: 0; width: 14px; }
.col-name  { flex: 1; font-size: 11.5px; color: #c0c0d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-agg {
  background: #1e1e35; border: 1px solid #2e2e50; border-radius: 4px;
  color: #6060a0; font-size: 9px; padding: 2px 4px; cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
}

/* Connectors */
.qconn {
  position: absolute; width: 9px; height: 9px; border-radius: 50%;
  border: 2px solid #2a2a44; background: #13131e; cursor: crosshair; z-index: 10;
  transition: border-color 0.12s, background 0.12s, transform 0.12s;
}
.qconn-left  { left: -5px; }
.qconn-right { right: -5px; }
.qconn:hover, .qconn.active { border-color: #3B82F6; background: #3B82F6; transform: scale(1.4); }

/* Footer */
.qtn-footer { padding: 5px 10px; border-top: 1px solid #191928; background: #0e0e1a; border-radius: 0 0 9px 9px; }
.qtn-sel-count { font-size: 9px; color: #333360; }

/* Empty state */
.qempty {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  text-align: center; pointer-events: none;
}
.qempty-icon { font-size: 52px; color: #181828; margin-bottom: 12px; }
.qempty p    { font-size: 15px; color: #252540; margin: 0 0 4px; font-weight: 600; }
.qempty span { font-size: 12px; color: #1e1e34; }

/* ── SQL Panel ── */
.sql-panel {
  position: absolute; top: 20px; right: 20px; width: 450px;
  max-height: 85vh;
  background: #0d0d16; border: 1px solid #3B82F6;
  border-radius: 12px; box-shadow: 0 8px 32px #000000;
  z-index: 1000;
  pointer-events: all;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: height 0.2s ease;
}

.sql-panel.expanded {
  height: 500px !important;
  max-height: 85vh !important;
}

.sql-panel:not(.expanded) {
  height: 44px !important;
}

.sql-panel-header {
  display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 44px;
  background: rgba(59, 130, 246, 0.05);
  border-bottom: 1px solid #1e1e30;
}
.sql-panel-title { font-size: 11px; font-weight: 700; color: #60A5FA; letter-spacing: 0.05em; flex: 1; text-transform: uppercase; }
.sql-panel-actions { display: flex; align-items: center; gap: 8px; }
.sql-action-btn {
  background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: #60A5FA; border-radius: 6px;
  padding: 4px 10px; font-size: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s;
  display: flex; align-items: center; gap: 4px;
}
.sql-action-btn:hover { background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); }
.sql-toggle { font-size: 10px; color: #4b5563; }

.sql-body {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  background: #0d0d16;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0;
}
.sql-code-editor {
  width: 100% !important;
  height: 100% !important;
  min-height: 200px !important;
  background: #0d0d16 !important;
  border: none !important;
  color: #E2E8F0 !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  resize: none !important;
  outline: none !important;
  padding: 0 !important;
  white-space: pre !important;
  overflow: auto !important;
  tab-size: 2 !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.sql-code-display {
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: #0d0d16;
  color: #E2E8F0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-y: auto;
  cursor: text;
  padding: 0;
}

.sql-code-editor::-webkit-scrollbar {
  width: 8px;
}
.sql-code-editor::-webkit-scrollbar-track {
  background: transparent;
}
.sql-code-editor::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.sql-code-editor::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.sql-code {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6;
  color: #E2E8F0; white-space: pre-wrap; word-break: break-all; tab-size: 2; background: none; margin: 0;
  padding: 16px;
}

/* ── JOIN inspector ── */
.join-inspector {
  position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px;
  background: #13131e; border: 1px solid #3B82F640;
  border-radius: 8px; padding: 7px 14px; z-index: 100;
}
.ji-label { font-size: 10px; color: #3B82F680; font-family: 'JetBrains Mono', monospace; }
.ji-types { display: flex; gap: 4px; }
.ji-btn {
  background: none; border: 1px solid #2a2a40; color: #555; border-radius: 4px;
  padding: 3px 9px; font-size: 10px; font-weight: 700; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; transition: all 0.15s;
}
.ji-btn:hover  { color: #3B82F6; border-color: #3B82F640; }
.ji-btn.active { color: #3B82F6; border-color: #3B82F6; background: #3B82F615; }
.ji-del { background: none; border: 1px solid #EF444430; color: #EF444470; border-radius: 4px; padding: 3px 10px; font-size: 10px; cursor: pointer; transition: all 0.15s; }
.ji-del:hover { color: #EF4444; border-color: #EF4444; }

/* Zoom controls */
.zoom-controls {
  position: absolute; bottom: 20px; right: 20px;
  display: flex; align-items: center; gap: 4px;
  background: #13131a; border: 1px solid #25253a; border-radius: 8px; padding: 4px 6px;
}
.zoom-controls button {
  background: none; border: none; color: #555; cursor: pointer; font-size: 16px;
  width: 26px; height: 26px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.zoom-controls button:hover { color: #e0e0e0; background: #1e1e28; }
.zoom-controls span { font-size: 11px; color: #555; min-width: 36px; text-align: center; font-family: 'JetBrains Mono', monospace; }

/* ── Query Summary Node ── */
.query-summary-node {
  position: absolute;
  width: 240px;
  background: #131320;
  border: 1px solid #3B82F6;
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  z-index: 50;
  cursor: grab;
  overflow: hidden;
}
.query-summary-node:active { cursor: grabbing; }
.qsn-header {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #3B82F640;
}
.qsn-icon { font-size: 14px; }
.qsn-title { font-size: 12px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }
.qsn-body { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.qsn-section { display: flex; flex-direction: column; gap: 4px; }
.qsn-label { font-size: 10px; font-weight: 700; color: #3B82F6; text-transform: uppercase; }
.qsn-val { font-size: 11px; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; }
.qsn-clause {
  font-size: 11px;
  color: #94a3b8;
  background: #1e1e30;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  word-break: break-all;
}
</style>
