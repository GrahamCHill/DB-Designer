<template>
  <div class="qcanvas-root">
    <div
      ref="canvasEl"
      class="qcanvas-stage"
      @mousedown="onCanvasMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
      @dragover.prevent
      @drop="onDrop"
    >
      <div class="qcanvas-content" :style="contentStyle">
        <svg class="joins-svg">
          <defs>
            <marker id="join-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#3B82F6" opacity="0.8" />
            </marker>
          </defs>

          <g v-for="join in query.joins" :key="join.id" @click.stop="query.selectedJoinId = join.id">
            <path
              :d="joinPath(join)"
              fill="none"
              :stroke="query.selectedJoinId === join.id ? '#60A5FA' : '#3B82F650'"
              :stroke-width="query.selectedJoinId === join.id ? 2.5 : 1.5"
              marker-end="url(#join-arrow)"
              pointer-events="none"
            />
            <path
              :d="joinPath(join)"
              fill="none"
              stroke="transparent"
              stroke-width="14"
              style="cursor: pointer"
              pointer-events="stroke"
            />
            <text
              :x="joinMid(join).x"
              :y="joinMid(join).y - 6"
              class="join-label"
              :fill="query.selectedJoinId === join.id ? '#60A5FA' : '#3B82F660'"
              text-anchor="middle"
            >
              {{ join.joinType }}
            </text>
          </g>

          <path
            v-if="query.drawingJoin"
            :d="drawingPath"
            fill="none"
            stroke="#3B82F6"
            stroke-width="1.5"
            stroke-dasharray="5,3"
            opacity="0.6"
            pointer-events="none"
          />
        </svg>

        <div
          v-for="table in query.tables"
          :key="table.id"
          class="qtable-node"
          :class="{ selected: query.selectedTableId === table.id }"
          :style="{
            left: `${table.position.x}px`,
            top: `${table.position.y}px`,
            width: `${table.width}px`,
          }"
          @click.stop="selectTable(table.id)"
        >
          <div class="qtn-header" @mousedown.stop="startDrag(table.id, $event)">
            <span class="qtn-icon">[]</span>
            <span class="qtn-name">{{ table.alias }}</span>
            <button class="qtn-del" title="Remove from query" @mousedown.stop @click.stop="query.removeTable(table.id)">x</button>
          </div>

          <div class="qtn-cols">
            <button
              v-for="col in table.columns"
              :key="col.column"
              type="button"
              class="qtn-col"
              :class="{ selected: col.selected }"
              @click.stop="query.toggleColumn(table.id, col.column)"
            >
              <div
                class="qconn qconn-left"
                title="Drop join here"
                @mouseup.stop="endJoin(table.id, col.column)"
              />

              <span class="col-check">{{ col.selected ? '[x]' : '[ ]' }}</span>
              <span class="col-name">{{ col.column }}</span>

              <select
                v-if="col.selected"
                class="col-agg"
                :value="col.aggregate"
                @change="query.setColumnAggregate(table.id, col.column, ($event.target as HTMLSelectElement).value as any)"
                @click.stop
              >
                <option value="">-</option>
                <option>COUNT</option>
                <option>SUM</option>
                <option>AVG</option>
                <option>MIN</option>
                <option>MAX</option>
              </select>

              <div
                class="qconn qconn-right"
                :class="{ active: isJoinSource(table.id, col.column) }"
                title="Drag to create JOIN"
                @mousedown.stop="startJoin(table.id, col.column, $event)"
              />
            </button>
          </div>

          <div class="qtn-footer">
            <span class="qtn-sel-count">{{ selectedCount(table) }} selected</span>
          </div>
        </div>
      </div>

      <div class="qcanvas-content summary-layer" :style="contentStyle">
        <div
          v-if="query.tables.length > 0"
          class="query-summary-node"
          :style="{ left: `${summaryPos.x}px`, top: `${summaryPos.y}px` }"
          @mousedown.stop="startDrag('query-summary', $event)"
        >
          <div class="qsn-header">
            <span class="qsn-icon">SQL</span>
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
              <div v-for="where in query.wheres" :key="where.id" class="qsn-clause">
                {{ where.tableAlias }}.{{ where.column }} {{ where.op }} {{ where.value }}
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

      <div v-if="query.tables.length === 0" class="qempty">
        <div class="qempty-icon">Q</div>
        <p>Drag tables from the sidebar</p>
        <span>or click a table name to add it</span>
      </div>

      <div v-if="selectedJoin" class="join-inspector">
        <div class="ji-context">
          <div class="ji-context-row">
            <span class="ji-context-label">Source</span>
            <span class="ji-context-value">{{ selectedJoinTables.source }}</span>
          </div>
          <div class="ji-context-row">
            <span class="ji-context-label">Join</span>
            <span class="ji-context-value">{{ selectedJoinTables.target }}</span>
          </div>
        </div>
        <span class="ji-label">JOIN type</span>
        <div class="ji-types">
          <button
            v-for="joinType in joinTypes"
            :key="joinType"
            class="ji-btn"
            :class="{ active: selectedJoin.joinType === joinType }"
            :title="joinTypeDescriptions[joinType]"
            @click="query.updateJoinType(selectedJoin.id, joinType)"
          >
            {{ joinType }}
          </button>
        </div>
        <button class="ji-del" @click="query.removeJoin(selectedJoin.id)">Remove</button>
      </div>

      <div class="zoom-controls">
        <button @click="adjustZoom(0.1)">+</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button @click="adjustZoom(-0.1)">-</button>
        <button title="Reset view" @click="resetView">Reset</button>
      </div>
    </div>

    <aside class="sql-panel" :class="{ expanded: sqlExpanded }">
      <div class="sql-panel-header" @click="sqlExpanded = !sqlExpanded">
        <span class="sql-panel-title">Live SQL Output</span>
      </div>

      <div v-show="sqlExpanded" class="sql-body">
        <div v-if="!isEditingSql" class="sql-code-display" @click="isEditingSql = true">
          {{ query.sql }}
        </div>
        <textarea
          v-else
          id="sql-editor"
          ref="sqlEditorRef"
          v-model="query.sql"
          class="sql-code-editor"
          name="sql-editor"
          spellcheck="false"
          @blur="isEditingSql = false"
        />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQueryStore } from '../../stores/query'
import { useSchemaStore } from '../../stores/schema'
import type { QJoin, QTable } from '../../stores/query'

const query = useQueryStore()
const dbStore = useSchemaStore()

const canvasEl = ref<HTMLDivElement>()
const zoom = ref(1)
const pan = reactive({ x: 40, y: 40 })
const sqlExpanded = ref(true)
const joinTypes = ['INNER', 'LEFT', 'RIGHT', 'FULL'] as const
const joinTypeDescriptions: Record<(typeof joinTypes)[number], string> = {
  INNER: 'Only keep rows where both tables match. Use for strict related data.',
  LEFT: 'Keep every row from the source table and bring in matches from the joined table when they exist.',
  RIGHT: 'Keep every row from the joined table and bring in matches from the source table when they exist.',
  FULL: 'Keep all rows from both tables, even when one side has no match.',
}
const summaryPos = reactive({ x: 400, y: 100 })
const isEditingSql = ref(false)
const sqlEditorRef = ref<HTMLTextAreaElement | null>(null)

watch(isEditingSql, (editing) => {
  if (editing) window.setTimeout(() => sqlEditorRef.value?.focus(), 50)
})

const selectSummary = computed(() => {
  const cols = query.tables.flatMap((table) => table.columns.filter((column) => column.selected))
  return cols.length === 0 ? '*' : `${cols.length} columns selected`
})
const groupSummary = computed(() => `${query.groups.length} group(s)`)
const orderSummary = computed(() => `${query.orders.length} order(s)`)

const contentStyle = computed(() => ({
  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

const selectedJoin = computed(() => query.joins.find((join) => join.id === query.selectedJoinId) ?? null)
const selectedJoinTables = computed(() => {
  const join = selectedJoin.value
  if (!join) return { source: '', target: '' }

  const sourceTable = query.tables.find((table) => table.id === join.leftTableId)
  const targetTable = query.tables.find((table) => table.id === join.rightTableId)

  return {
    source: sourceTable?.alias ?? join.leftTableId,
    target: targetTable?.alias ?? join.rightTableId,
  }
})
type Drag =
  | { kind: 'pan'; sx: number; sy: number }
  | { kind: 'node'; id: string; ox: number; oy: number; sx: number; sy: number }

const drag = ref<Drag | null>(null)

function selectTable(tableId: string) {
  query.selectedTableId = tableId
  query.selectedJoinId = null
}

function toCanvas(cx: number, cy: number) {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: (cx - rect.left - pan.x) / zoom.value, y: (cy - rect.top - pan.y) / zoom.value }
}

function onCanvasMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.join-inspector') || target.closest('.zoom-controls')) return
  if (
    target === canvasEl.value ||
    target.classList.contains('qcanvas-content') ||
    target.classList.contains('joins-svg') ||
    target.classList.contains('qcanvas-stage')
  ) {
    query.selectedTableId = null
    query.selectedJoinId = null
    drag.value = { kind: 'pan', sx: e.clientX, sy: e.clientY }
  }
}

function startDrag(id: string, e: MouseEvent) {
  if (id === 'query-summary') {
    drag.value = { kind: 'node', id, ox: summaryPos.x, oy: summaryPos.y, sx: e.clientX, sy: e.clientY }
    return
  }

  const table = query.tables.find((entry) => entry.id === id)
  if (!table) return
  query.selectedTableId = id
  query.selectedJoinId = null
  drag.value = { kind: 'node', id, ox: table.position.x, oy: table.position.y, sx: e.clientX, sy: e.clientY }
}

function onMouseMove(e: MouseEvent) {
  if (query.drawingJoin) {
    const point = toCanvas(e.clientX, e.clientY)
    query.drawingJoin.mouseX = point.x
    query.drawingJoin.mouseY = point.y
    return
  }

  if (!drag.value) return
  const current = drag.value

  if (current.kind === 'pan') {
    pan.x += e.clientX - current.sx
    pan.y += e.clientY - current.sy
    current.sx = e.clientX
    current.sy = e.clientY
    return
  }

  const dx = (e.clientX - current.sx) / zoom.value
  const dy = (e.clientY - current.sy) / zoom.value

  if (current.id === 'query-summary') {
    summaryPos.x = current.ox + dx
    summaryPos.y = current.oy + dy
    return
  }

  query.updateTablePosition(current.id, { x: current.ox + dx, y: current.oy + dy })
}

function onMouseUp() {
  drag.value = null
  if (query.drawingJoin) query.drawingJoin = null
}

function onWheel(e: WheelEvent) {
  adjustZoom(e.deltaY > 0 ? -0.08 : 0.08)
}

function adjustZoom(delta: number) {
  zoom.value = Math.min(3, Math.max(0.15, zoom.value + delta))
}

function resetView() {
  zoom.value = 1
  pan.x = 40
  pan.y = 40
}

function onDrop(e: DragEvent) {
  const payload = e.dataTransfer?.getData('application/dbdesigner-query-table')
  const fallbackName = e.dataTransfer?.getData('text/plain')
  const dropped = payload ? parseDroppedTable(payload) : null
  const name = dropped?.name ?? fallbackName
  if (!name) return

  const rect = canvasEl.value!.getBoundingClientRect()
  const pos = {
    x: (e.clientX - rect.left - pan.x) / zoom.value,
    y: (e.clientY - rect.top - pan.y) / zoom.value,
  }

  const schemaTable = dbStore.schema.tables.find((table) => table.name === name)
  const columns = dropped?.columns ?? schemaTable?.columns.map((column) => column.name) ?? []
  query.addTable(name, columns, pos)
}

function parseDroppedTable(payload: string): { name: string; columns: string[] } | null {
  try {
    const parsed = JSON.parse(payload) as { name?: string; columns?: string[] }
    if (!parsed.name) return null
    return { name: parsed.name, columns: parsed.columns ?? [] }
  } catch {
    return null
  }
}

function startJoin(tableId: string, column: string, e: MouseEvent) {
  const point = toCanvas(e.clientX, e.clientY)
  query.drawingJoin = { fromTableId: tableId, fromColumn: column, mouseX: point.x, mouseY: point.y }
}

function endJoin(tableId: string, column: string) {
  if (!query.drawingJoin || query.drawingJoin.fromTableId === tableId) {
    query.drawingJoin = null
    return
  }

  query.addJoin(query.drawingJoin.fromTableId, query.drawingJoin.fromColumn, tableId, column)
  query.drawingJoin = null
}

function isJoinSource(tableId: string, column: string) {
  return query.drawingJoin?.fromTableId === tableId && query.drawingJoin?.fromColumn === column
}

function selectedCount(table: QTable) {
  return table.columns.filter((column) => column.selected).length
}

const columnHeight = 32
const headerHeight = 40

function columnY(table: QTable, columnName: string) {
  const index = table.columns.findIndex((column) => column.column === columnName)
  return table.position.y + headerHeight + index * columnHeight + columnHeight / 2
}

function tableRight(table: QTable) {
  return table.position.x + table.width
}

function tableLeft(table: QTable) {
  return table.position.x
}

function joinPath(join: QJoin) {
  const left = query.tables.find((table) => table.id === join.leftTableId)
  const right = query.tables.find((table) => table.id === join.rightTableId)
  if (!left || !right) return ''

  const ax = tableRight(left)
  const ay = columnY(left, join.leftColumn)
  const bx = tableLeft(right)
  const by = columnY(right, join.rightColumn)
  const curve = Math.abs(bx - ax) * 0.55 + 40

  return `M ${ax} ${ay} C ${ax + curve} ${ay}, ${bx - curve} ${by}, ${bx} ${by}`
}

function joinMid(join: QJoin) {
  const left = query.tables.find((table) => table.id === join.leftTableId)
  const right = query.tables.find((table) => table.id === join.rightTableId)
  if (!left || !right) return { x: 0, y: 0 }

  return {
    x: (tableRight(left) + tableLeft(right)) / 2,
    y: (columnY(left, join.leftColumn) + columnY(right, join.rightColumn)) / 2,
  }
}

const drawingPath = computed(() => {
  if (!query.drawingJoin) return ''
  const from = query.tables.find((table) => table.id === query.drawingJoin!.fromTableId)
  if (!from) return ''

  const ax = tableRight(from)
  const ay = columnY(from, query.drawingJoin.fromColumn)
  const bx = query.drawingJoin.mouseX
  const by = query.drawingJoin.mouseY
  const curve = Math.abs(bx - ax) * 0.5 + 30

  return `M ${ax} ${ay} C ${ax + curve} ${ay}, ${bx - curve} ${by}, ${bx} ${by}`
})
</script>

<style scoped>
.qcanvas-root {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: #09090e;
  height: stretch;
}

.qcanvas-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: #09090e;
  background-image:
    radial-gradient(circle, #1a1a28 1.5px, transparent 1.5px),
    radial-gradient(circle, #111118 1px, transparent 1px);
  background-size: 32px 32px, 8px 8px;
  cursor: default;
}

.qcanvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 4000px;
  height: 4000px;
  transform-origin: 0 0;
}

.summary-layer {
  pointer-events: none;
}

.summary-layer .query-summary-node {
  pointer-events: auto;
}

.joins-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 4000px;
  height: 4000px;
  pointer-events: none;
  overflow: visible;
}

.joins-svg g {
  pointer-events: all;
}

.join-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
}

.qtable-node {
  position: absolute;
  min-width: 200px;
  overflow: visible;
  border: 1.5px solid #22223a;
  border-radius: 10px;
  background: #13131e;
  box-shadow: 0 6px 28px #00000065;
  cursor: grab;
  font-family: 'JetBrains Mono', monospace;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.qtable-node:active {
  cursor: grabbing;
}

.qtable-node.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2.5px #3b82f628, 0 8px 36px #00000080;
}

.qtn-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
  border-bottom: 1px solid #2a2a48;
  border-radius: 9px 9px 0 0;
  background: linear-gradient(135deg, #1a1a35 0%, #13132a 100%);
}

.qtn-icon {
  color: #3b82f6;
  font-size: 13px;
}

.qtn-name {
  flex: 1;
  overflow: hidden;
  color: #e0e0f0;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qtn-del {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: none;
  color: #444;
  cursor: pointer;
  font-size: 11px;
}

.qtn-del:hover {
  color: #ef4444;
}

.qtn-cols {
  display: flex;
  flex-direction: column;
}

.qtn-col {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-bottom: 1px solid #191928;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.qtn-col:last-child {
  border-bottom: none;
}

.qtn-col:hover {
  background: #1a1a2e;
}

.qtn-col.selected {
  background: #1a2535;
}

.col-check {
  width: 24px;
  flex-shrink: 0;
  color: #3b82f6;
  font-size: 11px;
}

.col-name {
  flex: 1;
  overflow: hidden;
  color: #c0c0d8;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-agg {
  border: 1px solid #2e2e50;
  border-radius: 4px;
  background: #1e1e35;
  color: #6060a0;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  padding: 2px 4px;
}

.qconn {
  position: absolute;
  z-index: 10;
  width: 9px;
  height: 9px;
  border: 2px solid #2a2a44;
  border-radius: 50%;
  background: #13131e;
  cursor: crosshair;
  transition: border-color 0.12s, background 0.12s, transform 0.12s;
}

.qconn-left {
  left: -5px;
}

.qconn-right {
  right: -5px;
}

.qconn:hover,
.qconn.active {
  transform: scale(1.4);
  border-color: #3b82f6;
  background: #3b82f6;
}

.qtn-footer {
  padding: 5px 10px;
  border-top: 1px solid #191928;
  border-radius: 0 0 9px 9px;
  background: #0e0e1a;
}

.qtn-sel-count {
  color: #333360;
  font-size: 9px;
}

.qempty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.qempty-icon {
  margin-bottom: 12px;
  color: #181828;
  font-size: 52px;
}

.qempty p {
  margin: 0 0 4px;
  color: #252540;
  font-size: 15px;
  font-weight: 600;
}

.qempty span {
  color: #1e1e34;
  font-size: 12px;
}

.sql-panel {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  width: 420px;
  min-width: 420px;
  border-left: 1px solid #1e3354;
  background: #0d0d16;
  transition: width 0.2s ease, min-width 0.2s ease;
}

.sql-panel.expanded {
  width: 420px;
  min-width: 420px;
}

.sql-panel:not(.expanded) {
  width: 56px;
  min-width: 56px;
}

.sql-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid #1e1e30;
  background: rgba(59, 130, 246, 0.05);
  cursor: pointer;
}

.sql-panel-title {
  flex: 1;
  overflow: hidden;
  color: #60a5fa;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.sql-body {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 16px;
  background: #0d0d16;
}

.sql-code-display,
.sql-code-editor {
  flex: 1 1 auto;
  min-height: 200px;
  width: 100%;
  border: none;
  outline: none;
  background: #0d0d16;
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  padding: 0;
}

.sql-code-display {
  overflow-y: auto;
  cursor: text;
  white-space: pre-wrap;
}

.sql-code-editor {
  resize: none;
  overflow: auto;
  tab-size: 2;
  white-space: pre;
}

.join-inspector {
  position: absolute;
  bottom: 52px;
  left: 50%;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  border: 1px solid #3b82f640;
  border-radius: 8px;
  background: #13131e;
  transform: translateX(-50%);
}

.ji-context {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-right: 4px;
}

.ji-context-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ji-context-label {
  color: #64748b;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
}

.ji-context-value {
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

.ji-label {
  color: #3b82f680;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

.ji-types {
  display: flex;
  gap: 4px;
}

.ji-btn,
.ji-del {
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 10px;
  padding: 3px 10px;
}

.ji-btn {
  border: 1px solid #2a2a40;
  color: #555;
}

.ji-btn:hover,
.ji-btn.active {
  border-color: #3b82f6;
  color: #3b82f6;
}

.ji-btn.active {
  background: #3b82f615;
}

.ji-del {
  border: 1px solid #ef444430;
  color: #ef444470;
}

.ji-del:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.zoom-controls {
  position: absolute;
  right: 20px;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid #25253a;
  border-radius: 8px;
  background: #13131a;
}

.zoom-controls button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: none;
  color: #555;
  cursor: pointer;
  font-size: 16px;
}

.zoom-controls button:hover {
  background: #1e1e28;
  color: #e0e0e0;
}

.zoom-controls span {
  min-width: 36px;
  color: #555;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  text-align: center;
}

.query-summary-node {
  position: absolute;
  z-index: 50;
  width: 240px;
  overflow: hidden;
  border: 1px solid #3b82f6;
  border-radius: 10px;
  background: #131320;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  cursor: grab;
}

.query-summary-node:active {
  cursor: grabbing;
}

.qsn-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #3b82f640;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%);
}

.qsn-icon {
  font-size: 12px;
  font-weight: 700;
}

.qsn-title {
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.qsn-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.qsn-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.qsn-label {
  color: #3b82f6;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.qsn-val,
.qsn-clause {
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.qsn-clause {
  border-radius: 4px;
  background: #1e1e30;
  color: #94a3b8;
  padding: 4px 8px;
  word-break: break-all;
}
</style>






